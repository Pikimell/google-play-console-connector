import "server-only";
import type { androidpublisher_v3 } from "googleapis";
import { readInEdit, writeInEdit, getPublisher, commitEdit } from "./google";
import type { AppDetails, AppOverview, Bundle, ImageType, Listing, Release, ReleaseNote, ReleaseStatus, StoreImage, Track } from "./types";
import { ApiError } from "./errors";

type GTrack = androidpublisher_v3.Schema$Track;
type GRelease = androidpublisher_v3.Schema$TrackRelease;

export function assertPackage(pkg: string) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(pkg)) {
    throw new ApiError(400, `«${pkg}» не схоже на назву пакета.`, "Формат: com.company.app — саме так, як applicationId у build.gradle.");
  }
}

function mapRelease(r: GRelease): Release {
  return {
    name: r.name ?? undefined,
    versionCodes: r.versionCodes ?? [],
    status: (r.status as ReleaseStatus) ?? "draft",
    userFraction: r.userFraction ?? undefined,
    releaseNotes: (r.releaseNotes ?? []).map((n) => ({ language: n.language ?? "", text: n.text ?? "" })),
  };
}

function mapTrack(t: GTrack): Track {
  return { track: t.track!, releases: (t.releases ?? []).map(mapRelease) };
}

function toGRelease(r: Release): GRelease {
  return {
    name: r.name || undefined,
    versionCodes: r.versionCodes,
    status: r.status,
    userFraction: r.status === "inProgress" || r.status === "halted" ? r.userFraction : undefined,
    releaseNotes: r.releaseNotes?.filter((n) => n.text.trim()).map((n) => ({ language: n.language, text: n.text.trim() })),
  };
}

// ---------- Огляд ----------

export async function getOverview(pkg: string): Promise<AppOverview> {
  assertPackage(pkg);
  return readInEdit(pkg, async (editId, api) => {
    const [details, tracks] = await Promise.all([
      api.edits.details.get({ packageName: pkg, editId }),
      api.edits.tracks.list({ packageName: pkg, editId }),
    ]);
    const lang = details.data.defaultLanguage ?? undefined;
    let title: string | undefined;
    let iconUrl: string | undefined;
    if (lang) {
      const [listing, icon] = await Promise.allSettled([
        api.edits.listings.get({ packageName: pkg, editId, language: lang }),
        api.edits.images.list({ packageName: pkg, editId, language: lang, imageType: "icon" }),
      ]);
      if (listing.status === "fulfilled") title = listing.value.data.title ?? undefined;
      if (icon.status === "fulfilled") iconUrl = icon.value.data.images?.[0]?.url ?? undefined;
    }
    return {
      packageName: pkg,
      title,
      iconUrl,
      defaultLanguage: lang,
      contactEmail: details.data.contactEmail ?? undefined,
      tracks: (tracks.data.tracks ?? []).map(mapTrack),
    };
  });
}

export async function listTracks(pkg: string): Promise<Track[]> {
  return readInEdit(pkg, async (editId, api) => {
    const res = await api.edits.tracks.list({ packageName: pkg, editId });
    return (res.data.tracks ?? []).map(mapTrack);
  });
}

export async function listBundles(pkg: string): Promise<Bundle[]> {
  return readInEdit(pkg, async (editId, api) => {
    const [bundles, apks] = await Promise.all([
      api.edits.bundles.list({ packageName: pkg, editId }),
      api.edits.apks.list({ packageName: pkg, editId }),
    ]);
    const out: Bundle[] = [
      ...(bundles.data.bundles ?? []).map((b) => ({ versionCode: b.versionCode!, sha256: b.sha256 ?? undefined, kind: "aab" as const })),
      ...(apks.data.apks ?? []).map((a) => ({ versionCode: a.versionCode!, sha256: a.binary?.sha256 ?? undefined, kind: "apk" as const })),
    ];
    return out.sort((a, b) => b.versionCode - a.versionCode);
  });
}

// ---------- Релізи ----------

export type ReleaseInput = {
  track: string;
  versionCodes: string[];
  name?: string;
  status: ReleaseStatus;
  userFraction?: number;
  releaseNotes?: ReleaseNote[];
};

export function validateRelease(input: ReleaseInput) {
  if (!input.track) throw new ApiError(400, "Не обрано трек.");
  if (!input.versionCodes?.length) throw new ApiError(400, "Не обрано жодної версії (versionCode).");
  if (input.status === "inProgress") {
    const f = Number(input.userFraction);
    if (!(f > 0 && f < 1)) throw new ApiError(400, "Відсоток розгортання має бути більше 0% і менше 100%.");
  }
  for (const n of input.releaseNotes ?? []) {
    if (n.text.length > 500) throw new ApiError(400, `Опис змін (${n.language}) довший за 500 символів.`);
  }
}

/** Встановити реліз на трек у вже відкритому edit. Інші релізи-чернетки на треку не чіпаємо. */
async function setRelease(api: ReturnType<typeof getPublisher>, pkg: string, editId: string, input: ReleaseInput) {
  validateRelease(input);
  const release = toGRelease({ ...input, versionCodes: input.versionCodes.map(String) });
  await api.edits.tracks.update({
    packageName: pkg,
    editId,
    track: input.track,
    requestBody: { track: input.track, releases: [release] },
  });
}

export async function publishRelease(pkg: string, input: ReleaseInput, editId?: string) {
  assertPackage(pkg);
  const api = getPublisher();
  if (editId) {
    // edit з уже завантаженим файлом. Якщо щось не так — edit не видаляємо, щоб можна було виправити дані й повторити.
    await setRelease(api, pkg, editId, input);
    return commitEdit(pkg, editId);
  }
  return writeInEdit(pkg, (id) => setRelease(api, pkg, id, input));
}

/** Змінити поточний реліз треку: відсоток розгортання, пауза, відновлення, завершення. */
export async function changeRollout(
  pkg: string,
  track: string,
  action: { type: "fraction"; userFraction: number } | { type: "halt" } | { type: "resume" } | { type: "complete" },
) {
  return writeInEdit(pkg, async (editId, api) => {
    const res = await api.edits.tracks.get({ packageName: pkg, editId, track });
    const releases = res.data.releases ?? [];
    const target = releases.find((r) => r.status === "inProgress" || r.status === "halted");
    if (!target) throw new ApiError(400, "На цьому треку немає релізу з поступовим розгортанням.");
    if (action.type === "fraction") {
      if (!(action.userFraction > 0 && action.userFraction < 1)) throw new ApiError(400, "Відсоток має бути між 0 і 100.");
      target.userFraction = action.userFraction;
      target.status = "inProgress";
    } else if (action.type === "halt") {
      target.status = "halted";
    } else if (action.type === "resume") {
      target.status = "inProgress";
    } else {
      target.status = "completed";
      delete target.userFraction;
    }
    await api.edits.tracks.update({ packageName: pkg, editId, track, requestBody: { track, releases } });
  });
}

export async function createClosedTrack(pkg: string, name: string) {
  const clean = name.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,49}$/.test(clean)) {
    throw new ApiError(400, "Назва треку: латинські літери, цифри, пробіл, «-» або «_», до 50 символів.");
  }
  return writeInEdit(pkg, async (editId, api) => {
    const res = await api.edits.tracks.create({
      packageName: pkg,
      editId,
      requestBody: { track: clean, type: "CLOSED_TESTING", formFactor: "DEFAULT" },
    });
    return res.data.track ?? clean;
  });
}

// ---------- Тестувальники ----------

export async function getTesters(pkg: string, track: string) {
  return readInEdit(pkg, async (editId, api) => {
    const res = await api.edits.testers.get({ packageName: pkg, editId, track });
    return { googleGroups: res.data.googleGroups ?? [] };
  });
}

export async function setTesters(pkg: string, track: string, googleGroups: string[]) {
  const clean = [...new Set(googleGroups.map((g) => g.trim().toLowerCase()).filter(Boolean))];
  return writeInEdit(pkg, async (editId, api) => {
    await api.edits.testers.update({ packageName: pkg, editId, track, requestBody: { googleGroups: clean } });
    return { googleGroups: clean };
  });
}

// ---------- Інформація в магазині ----------

export async function getListings(pkg: string): Promise<{ defaultLanguage?: string; listings: Listing[] }> {
  return readInEdit(pkg, async (editId, api) => {
    const [details, res] = await Promise.all([
      api.edits.details.get({ packageName: pkg, editId }),
      api.edits.listings.list({ packageName: pkg, editId }),
    ]);
    return {
      defaultLanguage: details.data.defaultLanguage ?? undefined,
      listings: (res.data.listings ?? []).map((l) => ({
        language: l.language!,
        title: l.title ?? "",
        shortDescription: l.shortDescription ?? "",
        fullDescription: l.fullDescription ?? "",
        video: l.video ?? "",
      })),
    };
  });
}

export async function saveListing(pkg: string, l: Listing) {
  if ((l.title ?? "").length > 30) throw new ApiError(400, "Назва — максимум 30 символів.");
  if ((l.shortDescription ?? "").length > 80) throw new ApiError(400, "Короткий опис — максимум 80 символів.");
  if ((l.fullDescription ?? "").length > 4000) throw new ApiError(400, "Повний опис — максимум 4000 символів.");
  return writeInEdit(pkg, async (editId, api) => {
    await api.edits.listings.update({
      packageName: pkg,
      editId,
      language: l.language,
      requestBody: {
        language: l.language,
        title: l.title,
        shortDescription: l.shortDescription,
        fullDescription: l.fullDescription,
        video: l.video || undefined,
      },
    });
  });
}

export async function deleteListing(pkg: string, language: string) {
  return writeInEdit(pkg, async (editId, api) => {
    await api.edits.listings.delete({ packageName: pkg, editId, language });
  });
}

export async function getDetails(pkg: string): Promise<AppDetails> {
  return readInEdit(pkg, async (editId, api) => {
    const d = (await api.edits.details.get({ packageName: pkg, editId })).data;
    return {
      defaultLanguage: d.defaultLanguage ?? "",
      contactEmail: d.contactEmail ?? "",
      contactPhone: d.contactPhone ?? "",
      contactWebsite: d.contactWebsite ?? "",
    };
  });
}

export async function saveDetails(pkg: string, d: AppDetails) {
  return writeInEdit(pkg, async (editId, api) => {
    await api.edits.details.update({
      packageName: pkg,
      editId,
      requestBody: {
        defaultLanguage: d.defaultLanguage || undefined,
        contactEmail: d.contactEmail || undefined,
        contactPhone: d.contactPhone || undefined,
        contactWebsite: d.contactWebsite || undefined,
      },
    });
  });
}

// ---------- Графіка ----------

export const IMAGE_TYPES: ImageType[] = [
  "icon",
  "featureGraphic",
  "phoneScreenshots",
  "sevenInchScreenshots",
  "tenInchScreenshots",
  "tvBanner",
  "tvScreenshots",
  "wearScreenshots",
];

export async function listImages(pkg: string, language: string): Promise<Record<ImageType, StoreImage[]>> {
  return readInEdit(pkg, async (editId, api) => {
    const entries = await Promise.all(
      IMAGE_TYPES.map(async (imageType) => {
        const res = await api.edits.images.list({ packageName: pkg, editId, language, imageType });
        return [imageType, (res.data.images ?? []).map((i) => ({ id: i.id!, url: i.url!, sha256: i.sha256 ?? undefined }))] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<ImageType, StoreImage[]>;
  });
}

export async function uploadImage(pkg: string, language: string, imageType: ImageType, mimeType: string, body: NodeJS.ReadableStream) {
  return writeInEdit(pkg, async (editId, api) => {
    if (imageType === "icon" || imageType === "featureGraphic" || imageType === "tvBanner") {
      // одиночні зображення: замінюємо
      await api.edits.images.deleteall({ packageName: pkg, editId, language, imageType });
    }
    const res = await api.edits.images.upload({ packageName: pkg, editId, language, imageType, media: { mimeType, body } });
    return res.data.image;
  });
}

export async function deleteImage(pkg: string, language: string, imageType: ImageType, imageId: string) {
  return writeInEdit(pkg, async (editId, api) => {
    await api.edits.images.delete({ packageName: pkg, editId, language, imageType, imageId });
  });
}

// ---------- Закрите тестування одним кроком ----------

export type ClosedTestingInput = {
  /** Назва нового треку; якщо не задано — використовується наявний трек `existingTrack`. */
  newTrackName?: string;
  existingTrack?: string;
  googleGroups: string[];
  /** edit із щойно завантаженим файлом (з кроку завантаження) */
  editId?: string;
  release?: Omit<ReleaseInput, "track">;
};

/** Створити трек, призначити тестувальників і (за бажання) реліз — усе в одному edit, атомарно. */
export async function setupClosedTesting(pkg: string, input: ClosedTestingInput) {
  assertPackage(pkg);
  const api = getPublisher();
  const name = input.newTrackName?.trim();
  if (name && !/^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,49}$/.test(name)) {
    throw new ApiError(400, "Назва треку: латинські літери, цифри, пробіл, «-» або «_», до 50 символів.");
  }
  if (!name && !input.existingTrack) throw new ApiError(400, "Не вказано трек.");
  if (input.release) validateRelease({ ...input.release, track: name || input.existingTrack! });

  const editId = input.editId ?? (await api.edits.insert({ packageName: pkg })).data.id!;
  try {
    let track = input.existingTrack!;
    if (name) {
      const created = await api.edits.tracks.create({
        packageName: pkg,
        editId,
        requestBody: { track: name, type: "CLOSED_TESTING", formFactor: "DEFAULT" },
      });
      track = created.data.track ?? name;
    }
    const groups = [...new Set(input.googleGroups.map((g) => g.trim().toLowerCase()).filter(Boolean))];
    if (groups.length) {
      await api.edits.testers.update({ packageName: pkg, editId, track, requestBody: { googleGroups: groups } });
    }
    if (input.release) await setRelease(api, pkg, editId, { ...input.release, track });
    const commit = await commitEdit(pkg, editId);
    return { track, ...commit };
  } catch (e) {
    // edit з файлом залишаємо, щоб можна було повторити; власний — прибираємо
    if (!input.editId) await api.edits.delete({ packageName: pkg, editId }).catch(() => {});
    throw e;
  }
}

// ---------- «Видалення» тестування ----------

/**
 * Google Play API не вміє видаляти треки. Найближче до видалення:
 * прибрати релізи з треку і відв'язати тестувальників — одним комітом.
 */
export async function retireTrack(pkg: string, track: string, opts: { halt: boolean; clearTesters: boolean }) {
  if (!opts.halt && !opts.clearTesters) return { sentForReview: true };
  return writeInEdit(pkg, async (editId, api) => {
    if (opts.halt) {
      const res = await api.edits.tracks.get({ packageName: pkg, editId, track });
      if (res.data.releases?.length) {
        // halted для completed потребує попереднього релізу й залишає його в роздачі.
        // Порожній список прибирає всі збірки саме з цього треку, не видаляючи AAB.
        await api.edits.tracks.update({ packageName: pkg, editId, track, requestBody: { track, releases: [] } });
      }
    }
    if (opts.clearTesters) {
      const testers = await api.edits.testers.get({ packageName: pkg, editId, track });
      if (testers.data.googleGroups?.length) {
        await api.edits.testers.update({ packageName: pkg, editId, track, requestBody: { googleGroups: [] } });
      }
    }
  });
}
