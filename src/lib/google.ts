import "server-only";
import fs from "node:fs";
import path from "node:path";
import { google, type androidpublisher_v3 } from "googleapis";
import { ApiError } from "./errors";

export type Publisher = androidpublisher_v3.Androidpublisher;

type ServiceAccountKey = {
  type?: string;
  project_id?: string;
  client_email: string;
  private_key: string;
};

type CredentialsState =
  | { ok: true; key: ServiceAccountKey; source: string }
  | { ok: false; error: string; source: string };

const DEFAULT_KEY_FILE = "./credentials/service-account.json";

export function loadCredentials(): CredentialsState {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    const source = "змінна GOOGLE_SERVICE_ACCOUNT_JSON";
    try {
      const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
      return validateKey(JSON.parse(json), source);
    } catch {
      return { ok: false, source, error: "Не вдалося розібрати JSON з GOOGLE_SERVICE_ACCOUNT_JSON." };
    }
  }

  const file = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_KEY_FILE;
  const abs = path.resolve(/*turbopackIgnore: true*/ process.cwd(), file);
  const source = `файл ${file}`;
  if (!fs.existsSync(abs)) {
    return { ok: false, source, error: `Файл ключа не знайдено: ${abs}` };
  }
  try {
    return validateKey(JSON.parse(fs.readFileSync(abs, "utf8")), source);
  } catch {
    return { ok: false, source, error: `Файл ${file} не є коректним JSON.` };
  }
}

function validateKey(key: Partial<ServiceAccountKey>, source: string): CredentialsState {
  if (!key.client_email || !key.private_key) {
    return { ok: false, source, error: "У JSON немає client_email або private_key — це точно ключ сервісного акаунта?" };
  }
  return { ok: true, source, key: key as ServiceAccountKey };
}

let cached: { publisher: Publisher; email: string } | null = null;

export function getPublisher(): Publisher {
  if (cached) return cached.publisher;
  const creds = loadCredentials();
  if (!creds.ok) {
    throw new ApiError(500, creds.error, "Відкрий сторінку «Налаштування» — там покроково описано, куди покласти ключ.");
  }
  const auth = new google.auth.JWT({
    email: creds.key.client_email,
    key: creds.key.private_key,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const publisher = google.androidpublisher({ version: "v3", auth, timeout: 30 * 60 * 1000 });
  cached = { publisher, email: creds.key.client_email };
  return publisher;
}

// ---------- Координація edit-сесій ----------
//
// Google Play погано переносить кілька одночасних edit для одного застосунку: створення/видалення
// одного edit може «вбити» інший («This Edit has been deleted»). Тому для кожного пакета:
//  • усі одночасні читання ділять ОДИН спільний edit (видаляється, коли останнє читання завершилось);
//  • запис чекає завершення читань і виконується строго по черзі;
//  • edit із щойно завантаженим файлом (майстер релізу) «закріплюється» — читання йдуть через нього.

type PkgState = {
  readers: number;
  shared: Promise<string> | null;
  deleting: Promise<unknown> | null;
  pendingWriters: number;
  writerChain: Promise<void>;
  pinned: string | null;
  idle: (() => void)[];
};

const g = globalThis as unknown as { __gpcEdits?: Map<string, PkgState> };
const states = (g.__gpcEdits ??= new Map());

function state(pkg: string): PkgState {
  let s = states.get(pkg);
  if (!s) {
    s = { readers: 0, shared: null, deleting: null, pendingWriters: 0, writerChain: Promise.resolve(), pinned: null, idle: [] };
    states.set(pkg, s);
  }
  return s;
}

function notifyIdle(s: PkgState) {
  const waiters = s.idle.splice(0);
  waiters.forEach((w) => w());
}

async function waitIdle(s: PkgState) {
  while (s.readers > 0 || s.deleting) {
    if (s.deleting) await s.deleting.catch(() => {});
    else await new Promise<void>((r) => s.idle.push(r));
  }
}

export function isEditGoneError(e: unknown) {
  return /edit has been deleted|edit.*(?:not found|expired|already been (?:replaced|committed))|editId.*invalid/i.test(googleMessage(e));
}

/** Закріпити edit із завантаженим файлом: доки він відкритий, читання користуються ним. */
export function pinEdit(pkg: string, editId: string) {
  state(pkg).pinned = editId;
}

export function unpinEdit(pkg: string, editId?: string) {
  const s = state(pkg);
  if (!editId || s.pinned === editId) s.pinned = null;
}

async function acquireRead(pkg: string): Promise<{ editId: string; release: () => Promise<void>; pinned: boolean }> {
  const s = state(pkg);
  while (s.pendingWriters > 0) await s.writerChain;
  if (s.pinned) return { editId: s.pinned, release: async () => {}, pinned: true };
  if (s.deleting) await s.deleting.catch(() => {});
  const api = getPublisher();
  s.readers++;
  if (!s.shared) s.shared = api.edits.insert({ packageName: pkg }).then((r) => r.data.id!);
  const p = s.shared;
  let editId: string;
  try {
    editId = await p;
  } catch (e) {
    s.readers--;
    if (s.shared === p) s.shared = null;
    notifyIdle(s);
    throw e;
  }
  let released = false;
  return {
    editId,
    pinned: false,
    release: async () => {
      if (released) return;
      released = true;
      s.readers--;
      if (s.readers === 0 && s.shared === p) {
        s.shared = null;
        const del = api.edits.delete({ packageName: pkg, editId }).catch(() => {});
        s.deleting = del;
        await del;
        if (s.deleting === del) s.deleting = null;
      }
      notifyIdle(s);
    },
  };
}

/** Ексклюзивний доступ до edit-ів пакета (для запису). */
export async function withEditLock<T>(pkg: string, fn: () => Promise<T>): Promise<T> {
  const s = state(pkg);
  s.pendingWriters++;
  const prev = s.writerChain;
  let done!: () => void;
  s.writerChain = new Promise<void>((r) => (done = r));
  try {
    await prev;
    await waitIdle(s);
    return await fn();
  } finally {
    s.pendingWriters--;
    done();
  }
}

/** Виконати читання. Одночасні читання ділять один edit; якщо Google його видалив — одна повторна спроба. */
export async function readInEdit<T>(pkg: string, fn: (editId: string, api: Publisher) => Promise<T>): Promise<T> {
  const api = getPublisher();
  for (let attempt = 0; ; attempt++) {
    const lease = await acquireRead(pkg);
    try {
      return await fn(lease.editId, api);
    } catch (e) {
      if (attempt === 0 && isEditGoneError(e)) {
        const s = state(pkg);
        if (lease.pinned) unpinEdit(pkg, lease.editId);
        else if (s.shared) s.shared = null; // наступне читання створить новий edit
        continue;
      }
      throw e;
    } finally {
      await lease.release();
    }
  }
}

export type CommitResult = { sentForReview: boolean };

/**
 * Закомітити edit. Якщо Google вимагає ручної відправки на перевірку
 * (керована публікація, відхилена версія тощо) — комітимо з changesNotSentForReview.
 */
export async function commitEdit(pkg: string, editId: string): Promise<CommitResult> {
  const api = getPublisher();
  try {
    await api.edits.commit({ packageName: pkg, editId });
    unpinEdit(pkg, editId);
    return { sentForReview: true };
  } catch (e) {
    const msg = googleMessage(e);
    if (/changesNotSentForReview/i.test(msg)) {
      await api.edits.commit({ packageName: pkg, editId, changesNotSentForReview: true });
      unpinEdit(pkg, editId);
      return { sentForReview: false };
    }
    // невдалий коміт: edit (і завантажений файл) лишається, щоб можна було виправити дані й повторити
    throw e;
  }
}

/** Виконати зміни в новому edit і закомітити (ексклюзивно); при помилці edit видаляється. */
export async function writeInEdit<T>(
  pkg: string,
  fn: (editId: string, api: Publisher) => Promise<T>,
): Promise<{ result: T } & CommitResult> {
  return withEditLock(pkg, async () => {
    const api = getPublisher();
    const edit = await api.edits.insert({ packageName: pkg });
    const editId = edit.data.id!;
    try {
      const result = await fn(editId, api);
      const commit = await commitEdit(pkg, editId);
      return { result, ...commit };
    } catch (e) {
      await api.edits.delete({ packageName: pkg, editId }).catch(() => {});
      throw e;
    }
  });
}

/** Видалити (скасувати) edit — під блокуванням, щоб не зачепити інші операції. */
export function discardEdit(pkg: string, editId: string) {
  unpinEdit(pkg, editId);
  return withEditLock(pkg, () => getPublisher().edits.delete({ packageName: pkg, editId }).then(() => {}).catch(() => {}));
}

export function googleMessage(e: unknown): string {
  const err = e as { response?: { data?: { error?: { message?: string } | string; error_description?: string } }; message?: string };
  const data = err?.response?.data;
  if (data) {
    if (typeof data.error === "object" && data.error?.message) return data.error.message;
    if (data.error_description) return data.error_description;
    if (typeof data.error === "string") return data.error;
  }
  return err?.message ?? String(e);
}
