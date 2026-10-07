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

/** Мови Google Play (найуживаніші зверху). */
export const LANGUAGES: { code: string; name: string }[] = [
  { code: "uk", name: "Українська" },
  { code: "en-US", name: "English (US)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "pl-PL", name: "Polski" },
  { code: "de-DE", name: "Deutsch" },
  { code: "fr-FR", name: "Français" },
  { code: "es-ES", name: "Español (España)" },
  { code: "es-419", name: "Español (Latinoamérica)" },
  { code: "it-IT", name: "Italiano" },
  { code: "pt-BR", name: "Português (Brasil)" },
  { code: "pt-PT", name: "Português (Portugal)" },
  { code: "ro", name: "Română" },
  { code: "cs-CZ", name: "Čeština" },
  { code: "sk", name: "Slovenčina" },
  { code: "hu-HU", name: "Magyar" },
  { code: "nl-NL", name: "Nederlands" },
  { code: "sv-SE", name: "Svenska" },
  { code: "da-DK", name: "Dansk" },
  { code: "no-NO", name: "Norsk" },
  { code: "fi-FI", name: "Suomi" },
  { code: "lt", name: "Lietuvių" },
  { code: "lv", name: "Latviešu" },
  { code: "et", name: "Eesti" },
  { code: "bg", name: "Български" },
  { code: "ka-GE", name: "ქართული" },
  { code: "kk", name: "Қазақ" },
  { code: "tr-TR", name: "Türkçe" },
  { code: "he-IL", name: "עברית" },
  { code: "ar", name: "العربية" },
  { code: "hi-IN", name: "हिन्दी" },
  { code: "ja-JP", name: "日本語" },
  { code: "ko-KR", name: "한국어" },
  { code: "zh-CN", name: "中文（简体）" },
  { code: "zh-TW", name: "中文（繁體）" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "th", name: "ไทย" },
];

export function languageName(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}
