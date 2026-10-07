import type { Release, ReleaseStatus } from "./types";

export const STANDARD_TRACKS = ["internal", "alpha", "beta", "production"] as const;

type TrackInfo = { label: string; short: string; description: string; kind: "internal" | "closed" | "open" | "production" };

const INFO: Record<string, TrackInfo> = {
  internal: {
    label: "Внутрішнє тестування",
    short: "Внутрішнє",
    kind: "internal",
    description: "До 100 тестувальників, з'являється майже одразу, без перевірки Google. Ідеально для швидкої перевірки збірки.",
  },
  alpha: {
    label: "Закрите тестування (Alpha)",
    short: "Закрите · Alpha",
    kind: "closed",
    description: "Стандартний трек закритого тестування. Тестувальники — за списком email або Google-групою.",
  },
  beta: {
    label: "Відкрите тестування",
    short: "Відкрите",
    kind: "open",
    description: "Будь-хто може приєднатися за посиланням або зі сторінки в Google Play. Проходить перевірку Google.",
  },
  production: {
    label: "Робоча версія (Production)",
    short: "Production",
    kind: "production",
    description: "Версія для всіх користувачів Google Play. Проходить перевірку Google. Можна розгортати поступово.",
  },
};

export function trackInfo(track: string): TrackInfo {
  if (INFO[track]) return INFO[track];
  if (track.includes(":")) {
    const [ff, base] = track.split(":");
    const b = trackInfo(base);
    return { ...b, label: `${b.label} · ${ff}`, short: `${b.short} · ${ff}` };
  }
  return {
    label: `Закрите тестування «${track}»`,
    short: track,
    kind: "closed",
    description: "Власний трек закритого тестування. Тестувальники — за списком email або Google-групою.",
  };
}

export function isClosedTrack(track: string) {
  return trackInfo(track).kind === "closed";
}

export const STATUS_LABEL: Record<ReleaseStatus, string> = {
  completed: "Опубліковано",
  inProgress: "Поступове розгортання",
  halted: "Призупинено",
  draft: "Чернетка",
};

export const STATUS_TONE: Record<ReleaseStatus, "green" | "blue" | "amber" | "gray"> = {
  completed: "green",
  inProgress: "blue",
  halted: "amber",
  draft: "gray",
};

/** Реліз, який зараз «активний» на треку (опублікований / розгортається), інакше найсвіжіший. */
export function primaryRelease(releases: Release[]): Release | undefined {
  return (
    releases.find((r) => r.status === "inProgress") ??
    releases.find((r) => r.status === "completed") ??
    releases.find((r) => r.status === "halted") ??
    releases[0]
  );
}

export function maxVersionCode(releases: Release[]) {
  let max = 0;
  for (const r of releases) for (const v of r.versionCodes) max = Math.max(max, Number(v));
  return max || undefined;
}

export function trackSortKey(track: string) {
  const order: Record<string, number> = { production: 0, beta: 1, alpha: 2, internal: 9 };
  return order[track] ?? 3;
}

/** Мови Google Play (найуживаніші зверху). Коди — саме ті, що приймає Google Play API. */
export const LANGUAGES: { code: string; name: string; en: string }[] = [
  { code: "en-US", name: "English (US)", en: "English (United States)" },
  { code: "uk", name: "Українська", en: "Ukrainian" },
  { code: "en-GB", name: "English (UK)", en: "English (United Kingdom)" },
  { code: "de-DE", name: "Deutsch", en: "German" },
  { code: "fr-FR", name: "Français", en: "French (France)" },
  { code: "es-ES", name: "Español (España)", en: "Spanish (Spain)" },
  { code: "es-419", name: "Español (Latinoamérica)", en: "Spanish (Latin America)" },
  { code: "es-US", name: "Español (EE. UU.)", en: "Spanish (United States)" },
  { code: "it-IT", name: "Italiano", en: "Italian" },
  { code: "pt-BR", name: "Português (Brasil)", en: "Portuguese (Brazil)" },
  { code: "pt-PT", name: "Português (Portugal)", en: "Portuguese (Portugal)" },
  { code: "pl-PL", name: "Polski", en: "Polish" },
  { code: "nl-NL", name: "Nederlands", en: "Dutch" },
  { code: "tr-TR", name: "Türkçe", en: "Turkish" },
  { code: "ja-JP", name: "日本語", en: "Japanese" },
  { code: "ko-KR", name: "한국어", en: "Korean" },
  { code: "zh-CN", name: "中文（简体）", en: "Chinese (Simplified)" },
  { code: "zh-TW", name: "中文（繁體）", en: "Chinese (Traditional, Taiwan)" },
  { code: "zh-HK", name: "中文（香港）", en: "Chinese (Traditional, Hong Kong)" },
  { code: "ar", name: "العربية", en: "Arabic" },
  { code: "hi-IN", name: "हिन्दी", en: "Hindi" },
  { code: "id", name: "Bahasa Indonesia", en: "Indonesian" },
  { code: "vi", name: "Tiếng Việt", en: "Vietnamese" },
  { code: "th", name: "ไทย", en: "Thai" },
  { code: "ms", name: "Bahasa Melayu", en: "Malay" },
  { code: "ms-MY", name: "Bahasa Melayu (Malaysia)", en: "Malay (Malaysia)" },
  { code: "fil", name: "Filipino", en: "Filipino" },
  { code: "cs-CZ", name: "Čeština", en: "Czech" },
  { code: "sk", name: "Slovenčina", en: "Slovak" },
  { code: "hu-HU", name: "Magyar", en: "Hungarian" },
  { code: "ro", name: "Română", en: "Romanian" },
  { code: "bg", name: "Български", en: "Bulgarian" },
  { code: "hr", name: "Hrvatski", en: "Croatian" },
  { code: "sr", name: "Српски", en: "Serbian" },
  { code: "sl", name: "Slovenščina", en: "Slovenian" },
  { code: "mk-MK", name: "Македонски", en: "Macedonian" },
  { code: "el-GR", name: "Ελληνικά", en: "Greek" },
  { code: "sv-SE", name: "Svenska", en: "Swedish" },
  { code: "da-DK", name: "Dansk", en: "Danish" },
  { code: "no-NO", name: "Norsk", en: "Norwegian" },
  { code: "fi-FI", name: "Suomi", en: "Finnish" },
  { code: "is-IS", name: "Íslenska", en: "Icelandic" },
  { code: "lt", name: "Lietuvių", en: "Lithuanian" },
  { code: "lv", name: "Latviešu", en: "Latvian" },
  { code: "et", name: "Eesti", en: "Estonian" },
  { code: "ka-GE", name: "ქართული", en: "Georgian" },
  { code: "hy-AM", name: "Հայերեն", en: "Armenian" },
  { code: "az-AZ", name: "Azərbaycan", en: "Azerbaijani" },
  { code: "kk", name: "Қазақ", en: "Kazakh" },
  { code: "ky-KG", name: "Кыргызча", en: "Kyrgyz" },
  { code: "uz", name: "Oʻzbek", en: "Uzbek" },
  { code: "mn-MN", name: "Монгол", en: "Mongolian" },
  { code: "be", name: "Беларуская", en: "Belarusian" },
  { code: "ru-RU", name: "Русский", en: "Russian" },
  { code: "iw-IL", name: "עברית", en: "Hebrew" },
  { code: "fa", name: "فارسی", en: "Persian" },
  { code: "ur", name: "اردو", en: "Urdu" },
  { code: "bn-BD", name: "বাংলা", en: "Bengali" },
  { code: "ta-IN", name: "தமிழ்", en: "Tamil" },
  { code: "te-IN", name: "తెలుగు", en: "Telugu" },
  { code: "mr-IN", name: "मराठी", en: "Marathi" },
  { code: "gu", name: "ગુજરાતી", en: "Gujarati" },
  { code: "kn-IN", name: "ಕನ್ನಡ", en: "Kannada" },
  { code: "ml-IN", name: "മലയാളം", en: "Malayalam" },
  { code: "pa", name: "ਪੰਜਾਬੀ", en: "Punjabi" },
  { code: "ne-NP", name: "नेपाली", en: "Nepali" },
  { code: "si-LK", name: "සිංහල", en: "Sinhala" },
  { code: "my-MM", name: "မြန်မာ", en: "Burmese" },
  { code: "km-KH", name: "ខ្មែរ", en: "Khmer" },
  { code: "lo-LA", name: "ລາວ", en: "Lao" },
  { code: "en-AU", name: "English (Australia)", en: "English (Australia)" },
  { code: "en-CA", name: "English (Canada)", en: "English (Canada)" },
  { code: "en-IN", name: "English (India)", en: "English (India)" },
  { code: "en-SG", name: "English (Singapore)", en: "English (Singapore)" },
  { code: "en-ZA", name: "English (South Africa)", en: "English (South Africa)" },
  { code: "fr-CA", name: "Français (Canada)", en: "French (Canada)" },
  { code: "ca", name: "Català", en: "Catalan" },
  { code: "eu-ES", name: "Euskara", en: "Basque" },
  { code: "gl-ES", name: "Galego", en: "Galician" },
  { code: "af", name: "Afrikaans", en: "Afrikaans" },
  { code: "sw", name: "Kiswahili", en: "Swahili" },
  { code: "zu", name: "isiZulu", en: "Zulu" },
  { code: "am", name: "አማርኛ", en: "Amharic" },
  { code: "rm", name: "Rumantsch", en: "Romansh" },
];

export function languageName(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

export function languageEnglishName(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.en ?? code;
}
