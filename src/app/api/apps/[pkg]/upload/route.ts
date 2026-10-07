import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { route } from "@/lib/route";
import { discardEdit, getPublisher, pinEdit, withEditLock } from "@/lib/google";
import { assertPackage } from "@/lib/play";
import { ApiError } from "@/lib/errors";

export const maxDuration = 1800;

/**
 * Крок 1 майстра релізу: приймаємо AAB/APK, створюємо edit і завантажуємо файл у Google Play.
 * Edit залишається відкритим — на наступних кроках до нього додається реліз і він комітиться.
 */
export const POST = route<{ pkg: string }>(async (req, { pkg }) => {
  assertPackage(pkg);
  const filename = new URL(req.url).searchParams.get("filename") ?? "app.aab";
  const kind = filename.toLowerCase().endsWith(".apk") ? "apk" : "aab";
  if (!/\.(aab|apk)$/i.test(filename)) throw new ApiError(400, "Потрібен файл .aab (рекомендовано) або .apk.");
  if (!req.body) throw new ApiError(400, "Файл не отримано.");

  const tmp = path.join(os.tmpdir(), `gpc-${Date.now()}-${Math.random().toString(36).slice(2)}.${kind}`);
  try {
    await pipeline(Readable.fromWeb(req.body as import("node:stream/web").ReadableStream), fs.createWriteStream(tmp));
    const size = fs.statSync(tmp).size;
    if (size < 1024) throw new ApiError(400, "Файл порожній або пошкоджений.");

    const api = getPublisher();
    // edit створюємо ексклюзивно і одразу закріплюємо: поки файл вантажиться (і далі в майстрі),
    // інші запити читають через нього і не «вбивають» його.
    const editId = await withEditLock(pkg, async () => {
      const edit = await api.edits.insert({ packageName: pkg });
      pinEdit(pkg, edit.data.id!);
      return edit.data.id!;
    });
    try {
      const media = { mimeType: "application/octet-stream", body: fs.createReadStream(tmp) };
      if (kind === "aab") {
        const res = await api.edits.bundles.upload({ packageName: pkg, editId, media }, { timeout: 30 * 60 * 1000 });
        return { editId, kind, versionCode: res.data.versionCode, sha256: res.data.sha256, size };
      }
      const res = await api.edits.apks.upload({ packageName: pkg, editId, media }, { timeout: 30 * 60 * 1000 });
      return { editId, kind, versionCode: res.data.versionCode, sha256: res.data.binary?.sha256, size };
    } catch (e) {
      await discardEdit(pkg, editId);
      throw e;
    }
  } finally {
    fs.promises.unlink(tmp).catch(() => {});
  }
});
