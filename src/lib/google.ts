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

/** Виконати читання в тимчасовому edit, який потім видаляється. */
export async function readInEdit<T>(pkg: string, fn: (editId: string, api: Publisher) => Promise<T>): Promise<T> {
  const api = getPublisher();
  const edit = await api.edits.insert({ packageName: pkg });
  const editId = edit.data.id!;
  try {
    return await fn(editId, api);
  } finally {
    await api.edits.delete({ packageName: pkg, editId }).catch(() => {});
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
    return { sentForReview: true };
  } catch (e) {
    const msg = googleMessage(e);
    if (/changesNotSentForReview/i.test(msg)) {
      await api.edits.commit({ packageName: pkg, editId, changesNotSentForReview: true });
      return { sentForReview: false };
    }
    throw e;
  }
}

/** Виконати зміни в edit і закомітити; при помилці edit видаляється. */
export async function writeInEdit<T>(
  pkg: string,
  fn: (editId: string, api: Publisher) => Promise<T>,
): Promise<{ result: T } & CommitResult> {
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
