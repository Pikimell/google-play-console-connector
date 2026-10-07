import "server-only";
import { ApiError } from "./errors";
import { languageEnglishName } from "./tracks";
import type { Listing } from "./types";

export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export function openaiConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  return { apiKey, model, baseUrl, configured: Boolean(apiKey) };
}

function requireConfig() {
  const c = openaiConfig();
  if (!c.apiKey) {
    throw new ApiError(400, "OpenAI не підключено.", "Додай OPENAI_API_KEY у файл .env.local і перезапусти панель. Деталі — на сторінці «Підключення».");
  }
  return c as typeof c & { apiKey: string };
}

async function openaiFetch(path: string, init?: RequestInit) {
  const c = requireConfig();
  const res = await fetch(`${c.baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg: string = data?.error?.message ?? `OpenAI повернув помилку ${res.status}`;
    if (res.status === 401) throw new ApiError(502, "OpenAI не прийняв API-ключ.", "Перевір OPENAI_API_KEY у .env.local (ключ можна створити на platform.openai.com/api-keys).");
    if (res.status === 404 || (/model/i.test(msg) && /does not exist|not found|access/i.test(msg))) {
      throw new ApiError(502, `Модель «${c.model}» недоступна для твого ключа.`, "Зміни OPENAI_MODEL у .env.local (наприклад gpt-5-mini або gpt-4.1-mini).");
    }
    if (res.status === 429) throw new ApiError(429, "OpenAI: перевищено ліміт або закінчився баланс.", msg);
    throw new ApiError(502, `OpenAI: ${msg}`);
  }
  return data;
}

/** Перевірка: ключ дійсний і модель доступна. */
export async function checkOpenAI() {
  const c = requireConfig();
  await openaiFetch(`/models/${encodeURIComponent(c.model)}`);
  return { model: c.model };
}

export type TranslateField = "title" | "shortDescription" | "fullDescription";
export const LIMITS: Record<TranslateField, number> = { title: 30, shortDescription: 80, fullDescription: 4000 };
const FIELD_NAMES: Record<TranslateField, string> = { title: "App name", shortDescription: "Short description", fullDescription: "Full description" };

const SYSTEM = `You are a professional app-store localization specialist for Google Play.
Translate the store listing naturally and idiomatically for native speakers of the target locale — this is marketing copy, not a literal translation.
Rules:
- Keep brand names, product names and trademarks untranslated (e.g. the app's brand part of the title).
- Preserve formatting exactly: line breaks, bullet characters, emoji, capitalization style of headings.
- Use terminology native users would search for in the store (ASO-friendly), but never invent features.
- STRICT character limits per field (count every character including spaces): App name ≤ 30, Short description ≤ 80, Full description ≤ 4000. If a natural translation is too long, rephrase shorter.
- Return only the requested fields.`;

type Translation = Partial<Record<TranslateField, string>>;

async function callModel(source: Listing, sourceLang: string, targetLang: string, fields: TranslateField[], feedback?: string) {
  const c = requireConfig();
  const payload: Record<string, string> = {};
  for (const f of fields) if (source[f]?.trim()) payload[f] = source[f]!;
  const properties = Object.fromEntries(Object.keys(payload).map((f) => [f, { type: "string", description: `${FIELD_NAMES[f as TranslateField]} (max ${LIMITS[f as TranslateField]} chars)` }]));

  const user = [
    `Source locale: ${sourceLang} (${languageEnglishName(sourceLang)})`,
    `Target locale: ${targetLang} (${languageEnglishName(targetLang)})`,
    "",
    "Source listing (JSON):",
    JSON.stringify(payload, null, 2),
    feedback ? `\nIMPORTANT — previous attempt was rejected: ${feedback}` : "",
  ].join("\n");

  const data = await openaiFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: c.model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "store_listing",
          strict: true,
          schema: { type: "object", properties, required: Object.keys(payload), additionalProperties: false },
        },
      },
    }),
  });
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new ApiError(502, "OpenAI повернув порожню відповідь.");
  try {
    return JSON.parse(content) as Translation;
  } catch {
    throw new ApiError(502, "OpenAI повернув некоректний JSON.");
  }
}

function overLimit(t: Translation) {
  return (Object.keys(t) as TranslateField[]).filter((f) => (t[f]?.length ?? 0) > LIMITS[f]);
}

function cut(text: string, max: number) {
  if (text.length <= max) return text;
  const s = text.slice(0, max);
  const i = s.lastIndexOf(" ");
  return (i > max * 0.6 ? s.slice(0, i) : s).replace(/[\s,.;:–-]+$/, "");
}

/** Перекласти опис. До 2 спроб, якщо модель перевищила ліміти символів; потім — обережне обрізання з попередженням. */
export async function translateListing(source: Listing, targetLang: string, fields: TranslateField[]) {
  if (!fields.some((f) => source[f]?.trim())) throw new ApiError(400, "В оригіналі немає тексту для перекладу.");
  let t = await callModel(source, source.language, targetLang, fields);
  for (let attempt = 0; attempt < 2 && overLimit(t).length; attempt++) {
    const bad = overLimit(t).map((f) => `${FIELD_NAMES[f]} is ${t[f]!.length} chars, limit ${LIMITS[f]}`).join("; ");
    t = await callModel(source, source.language, targetLang, fields, `${bad}. Make these fields shorter.`);
  }
  const warnings: string[] = [];
  for (const f of overLimit(t)) {
    warnings.push(`${FIELD_NAMES[f]} обрізано до ${LIMITS[f]} символів — перевір вручну.`);
    t[f] = cut(t[f]!, LIMITS[f]);
  }
  return { translation: t, warnings };
}
