import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { StoredApp, TesterGroup } from "./types";
import { parseEmails } from "./emails";

/**
 * Локальне сховище (data/store.json).
 * Google Play API не вміє ні показувати список застосунків акаунта, ні зберігати email-списки тестувальників,
 * тому ці дані панель тримає у себе.
 */
type StoreData = {
  apps: StoredApp[];
  testerGroups: TesterGroup[];
  /** Треки, приховані в панелі (Google не дозволяє видаляти треки). Ключ — назва пакета. */
  hiddenTracks: Record<string, string[]>;
};

const FILE = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATA_DIR ?? "data", "store.json");
let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<StoreData> {
  try {
    const parsed = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<StoreData>;
    return { apps: parsed.apps ?? [], testerGroups: parsed.testerGroups ?? [], hiddenTracks: parsed.hiddenTracks ?? {} };
  } catch {
    return { apps: [], testerGroups: [], hiddenTracks: {} };
  }
}

async function write(data: StoreData) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, FILE);
}

function mutate<T>(fn: (data: StoreData) => T): Promise<T> {
  const next = queue.then(async () => {
    const data = await read();
    const result = fn(data);
    await write(data);
    return result;
  });
  queue = next.catch(() => {});
  return next;
}

// ---------- Застосунки ----------

export async function listApps() {
  return (await read()).apps;
}

export function upsertApp(app: StoredApp) {
  return mutate((d) => {
    const i = d.apps.findIndex((a) => a.packageName === app.packageName);
    if (i >= 0) d.apps[i] = { ...d.apps[i], ...app };
    else d.apps.push(app);
    return app;
  });
}

export function removeApp(packageName: string) {
  return mutate((d) => {
    d.apps = d.apps.filter((a) => a.packageName !== packageName);
  });
}

// ---------- Приховані треки ----------

export async function getHiddenTracks(packageName: string) {
  return (await read()).hiddenTracks[packageName] ?? [];
}

export function setTrackHidden(packageName: string, track: string, hidden: boolean) {
  return mutate((d) => {
    const set = new Set(d.hiddenTracks[packageName] ?? []);
    if (hidden) set.add(track);
    else set.delete(track);
    d.hiddenTracks[packageName] = [...set];
    return d.hiddenTracks[packageName];
  });
}

// ---------- Групи тестувальників ----------

export async function listTesterGroups() {
  return (await read()).testerGroups;
}

export function normalizeEmails(input: string[] | string): string[] {
  return parseEmails(input).valid;
}

export function createTesterGroup(input: { name: string; emails: string[]; googleGroup?: string }) {
  const now = new Date().toISOString();
  const group: TesterGroup = {
    id: crypto.randomUUID(),
    name: input.name.trim() || "Без назви",
    emails: normalizeEmails(input.emails),
    googleGroup: input.googleGroup?.trim().toLowerCase() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  return mutate((d) => {
    d.testerGroups.push(group);
    return group;
  });
}

export function updateTesterGroup(id: string, patch: Partial<Pick<TesterGroup, "name" | "emails" | "googleGroup">>) {
  return mutate((d) => {
    const g = d.testerGroups.find((x) => x.id === id);
    if (!g) return null;
    if (patch.name !== undefined) g.name = patch.name.trim() || g.name;
    if (patch.emails !== undefined) g.emails = normalizeEmails(patch.emails);
    if (patch.googleGroup !== undefined) g.googleGroup = patch.googleGroup.trim().toLowerCase() || undefined;
    g.updatedAt = new Date().toISOString();
    return g;
  });
}

export function deleteTesterGroup(id: string) {
  return mutate((d) => {
    d.testerGroups = d.testerGroups.filter((g) => g.id !== id);
  });
}
