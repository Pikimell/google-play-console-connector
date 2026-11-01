export type ServiceAccountKey = {
  type: "service_account";
  project_id?: string;
  client_email: string;
  private_key: string;
};

export type ConnectionSettings = {
  google?: ServiceAccountKey;
  openaiKey?: string;
  openaiModel?: string;
};

export function parseServiceAccount(value: unknown): ServiceAccountKey {
  if (!value || typeof value !== "object") throw new Error("Потрібен JSON-ключ сервісного акаунта.");
  const key = value as Record<string, unknown>;
  if (key.type !== "service_account" || typeof key.client_email !== "string" || !/^[^\s@]+@[^\s@]+$/.test(key.client_email)
    || typeof key.private_key !== "string" || !key.private_key.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("JSON має містити type: service_account, client_email і private_key. Завантаж ключ сервісного акаунта з Google Cloud.");
  }
  return { type: "service_account", client_email: key.client_email, private_key: key.private_key,
    ...(typeof key.project_id === "string" ? { project_id: key.project_id } : {}) };
}

export function parseSettings(value: unknown): ConnectionSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Некоректні налаштування підключення.");
  const s = value as Record<string, unknown>;
  if (s.openaiKey !== undefined && (typeof s.openaiKey !== "string" || s.openaiKey.length > 1024)) throw new Error("Некоректний OpenAI API-ключ.");
  if (s.openaiModel !== undefined && (typeof s.openaiModel !== "string" || !/^[a-zA-Z0-9._:-]{1,100}$/.test(s.openaiModel))) throw new Error("Некоректна назва моделі OpenAI.");
  return { ...(s.google ? { google: parseServiceAccount(s.google) } : {}),
    ...(s.openaiKey ? { openaiKey: (s.openaiKey as string).trim() } : {}),
    ...(s.openaiModel ? { openaiModel: s.openaiModel as string } : {}) };
}
