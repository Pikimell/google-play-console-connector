"use client";
import { parseSettings, type ConnectionSettings } from "./connection-settings";
import { parseEmails } from "./emails";
import type { StoredApp, TesterGroup } from "./types";

const SETTINGS_KEY = "gpc:connection:v1";
type BrowserData = { apps: StoredApp[]; testerGroups: TesterGroup[]; hiddenTracks: Record<string, string[]> };

export function subscribeSettings(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("gpc:settings", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("gpc:settings", listener);
  };
}
export function settingsSnapshot() {
  try { return localStorage.getItem(SETTINGS_KEY) ?? "{}"; }
  catch { return "unavailable"; }
}

export function readSettings(): ConnectionSettings {
  const value = localStorage.getItem(SETTINGS_KEY);
  return value ? parseSettings(JSON.parse(value)) : {};
}
export function saveSettings(settings: ConnectionSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(parseSettings(settings)));
  window.dispatchEvent(new Event("gpc:settings"));
}
export function clearBrowserData() {
  const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
  for (const key of keys) if (key === SETTINGS_KEY || key?.startsWith("gpc:data:v1:")) localStorage.removeItem(key!);
  window.dispatchEvent(new Event("gpc:settings"));
}
export function browserDataKey() {
  return `gpc:data:v1:${readSettings().google?.client_email ?? "unconnected"}`;
}
function readData(key = browserDataKey()): BrowserData {
  const value = localStorage.getItem(key);
  if (!value) return { apps: [], testerGroups: [], hiddenTracks: {} };
  const data = JSON.parse(value) as BrowserData;
  return { apps: data.apps ?? [], testerGroups: data.testerGroups ?? [], hiddenTracks: data.hiddenTracks ?? {} };
}
function writeData(data: BrowserData, key = browserDataKey()) {
  localStorage.setItem(key, JSON.stringify(data));
}

/** Secrets are sent only to this site's API, never to third-party URLs. */
export function connectionHeaders(url: string): Record<string, string> {
  const target = new URL(url, window.location.origin);
  if (target.origin !== window.location.origin || !target.pathname.startsWith("/api/")) throw new Error("Недозволена адреса API.");
  const settings = readSettings();
  const send: ConnectionSettings = target.pathname === "/api/translate"
    ? { openaiKey: settings.openaiKey, openaiModel: settings.openaiModel }
    : target.pathname === "/api/status" ? settings : { google: settings.google };
  const bytes = new TextEncoder().encode(JSON.stringify(send));
  return { "X-Play-Connection": btoa(Array.from(bytes, b => String.fromCharCode(b)).join("")) };
}

/** Browser-only operations do not send apps, tester emails or keys to the server. */
export function localRequest(url: string, method: string, body: unknown): { data: unknown } | undefined {
  const pathname = new URL(url, window.location.origin).pathname;
  const data = readData();
  if (pathname === "/api/apps" && method === "GET") return { data: { apps: data.apps } };
  const app = pathname.match(/^\/api\/apps\/([^/]+)$/);
  if (app && method === "DELETE") {
    const pkg = decodeURIComponent(app[1]);
    data.apps = data.apps.filter(a => a.packageName !== pkg);
    delete data.hiddenTracks[pkg];
    writeData(data);
    return { data: { ok: true } };
  }
  const visibility = pathname.match(/^\/api\/apps\/([^/]+)\/tracks\/([^/]+)\/visibility$/);
  if (visibility && method === "POST") {
    const pkg = decodeURIComponent(visibility[1]);
    const track = decodeURIComponent(visibility[2]);
    const hidden = new Set(data.hiddenTracks[pkg] ?? []);
    if ((body as { hidden?: boolean })?.hidden) hidden.add(track); else hidden.delete(track);
    data.hiddenTracks[pkg] = [...hidden];
    writeData(data);
    return { data: { hiddenTracks: data.hiddenTracks[pkg] } };
  }
  const groups = pathname.match(/^\/api\/tester-groups(?:\/([^/]+))?$/);
  if (!groups) return;
  const id = groups[1] ? decodeURIComponent(groups[1]) : undefined;
  if (!id && method === "GET") return { data: { groups: data.testerGroups } };
  if (id && method === "DELETE") {
    data.testerGroups = data.testerGroups.filter(g => g.id !== id);
    writeData(data);
    return { data: { ok: true } };
  }
  if ((!id && method === "POST") || (id && method === "PUT")) {
    const input = body as Partial<Pick<TesterGroup, "name" | "googleGroup">> & { emails?: string | string[] };
    const now = new Date().toISOString();
    let group = id ? data.testerGroups.find(g => g.id === id) : undefined;
    if (id && !group) throw new Error("Групу не знайдено.");
    if (!group) { group = { id: crypto.randomUUID(), name: "Без назви", emails: [], createdAt: now, updatedAt: now }; data.testerGroups.push(group); }
    if (input.name !== undefined) group.name = input.name.trim() || group.name;
    if (input.emails !== undefined) group.emails = parseEmails(input.emails).valid;
    if (input.googleGroup !== undefined) group.googleGroup = input.googleGroup.trim().toLowerCase() || undefined;
    group.updatedAt = now;
    writeData(data);
    return { data: { group } };
  }
  throw new Error("Непідтримувана операція зі списком тестувальників.");
}

export function remoteResponse(url: string, method: string, response: unknown, storageKey = browserDataKey()): unknown {
  const pathname = new URL(url, window.location.origin).pathname;
  const data = readData(storageKey);
  if (pathname === "/api/status") return { ...(response as object), appsCount: data.apps.length };
  if (pathname === "/api/apps" && method === "POST") {
    const { app } = response as { app: StoredApp };
    const i = data.apps.findIndex(a => a.packageName === app.packageName);
    if (i < 0) data.apps.push(app); else data.apps[i] = { ...data.apps[i], ...app };
    writeData(data, storageKey);
  }
  const app = pathname.match(/^\/api\/apps\/([^/]+)$/);
  if (app && method === "GET") {
    const pkg = decodeURIComponent(app[1]);
    const { overview } = response as { overview: { title?: string; iconUrl?: string } };
    const saved = data.apps.find(a => a.packageName === pkg);
    if (saved) { saved.title = overview.title; saved.iconUrl = overview.iconUrl; writeData(data, storageKey); }
    return { ...(response as object), saved: Boolean(saved), hiddenTracks: data.hiddenTracks[pkg] ?? [] };
  }
  const retired = pathname.match(/^\/api\/apps\/([^/]+)\/tracks\/([^/]+)\/retire$/);
  if (retired && method === "POST") {
    const pkg = decodeURIComponent(retired[1]);
    data.hiddenTracks[pkg] = [...new Set([...(data.hiddenTracks[pkg] ?? []), decodeURIComponent(retired[2])])];
    writeData(data, storageKey);
    return { ...(response as object), hiddenTracks: data.hiddenTracks[pkg] };
  }
  return response;
}
