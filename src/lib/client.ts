"use client";
import type { ApiErrorBody } from "./types";

export class ClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public hint?: string,
    public details?: string,
  ) {
    super(message);
  }
}

export async function api<T = { ok: true }>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ClientError("Немає з'єднання з сервером панелі.", 0);
  }
  if (res.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok || data?.error) {
    const e = data?.error;
    throw new ClientError(e?.message ?? `Помилка ${res.status}`, res.status, e?.hint, e?.details);
  }
  return data as T;
}

/** Завантаження файлу з прогресом (fetch не вміє показувати прогрес відправки). */
export function uploadWithProgress<T>(url: string, file: Blob, onProgress: (fraction: number) => void, contentType?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.upload.onload = () => onProgress(1);
    xhr.onerror = () => reject(new ClientError("З'єднання перервалося під час завантаження.", 0));
    xhr.onload = () => {
      let data: (T & Partial<ApiErrorBody>) | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 400 || !data || data.error) {
        const e = data?.error;
        reject(new ClientError(e?.message ?? `Помилка ${xhr.status}`, xhr.status, e?.hint, e?.details));
      } else resolve(data as T);
    };
    xhr.send(file);
  });
}

export type ErrInfo = { message: string; hint?: string; details?: string };

export function errorInfo(e: unknown): ErrInfo {
  if (e instanceof ClientError) return { message: e.message, hint: e.hint, details: e.details };
  return { message: e instanceof Error ? e.message : String(e) };
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / 1024 ** 2).toFixed(1)} МБ`;
}

export function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function enc(s: string) {
  return encodeURIComponent(s);
}
