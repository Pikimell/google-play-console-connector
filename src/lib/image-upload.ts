import "server-only";
import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { ApiError } from "./errors";
import { writeInEdit } from "./google";
import type { ImageType } from "./types";

export type ImageUpload = { mimeType: string; buffer: Buffer };

function isUnavailable(error: unknown) {
  const e = error as { response?: { status?: number }; status?: number; code?: number | string };
  return Number(e?.response?.status ?? e?.status ?? e?.code) === 503;
}

/** Усі файли проходять перевірку Google й зберігаються одним edit. */
export async function uploadImages(pkg: string, language: string, imageType: ImageType, files: ImageUpload[]) {
  const single = ["icon", "featureGraphic", "tvBanner"].includes(imageType);
  if (!files.length || files.length > (single ? 1 : 8)) {
    throw new ApiError(400, single ? "Обери одне зображення." : "Обери від 1 до 8 зображень.");
  }
  for (const file of files) {
    if (!/^image\/(png|jpeg)$/.test(file.mimeType)) throw new ApiError(400, "Google Play приймає лише PNG або JPEG.");
    if (!file.buffer.length) throw new ApiError(400, "Файл зображення порожній.");
    if (file.buffer.length > 15 * 1024 * 1024) throw new ApiError(400, "Зображення більше 15 МБ.");
  }

  for (let attempt = 0; ; attempt++) {
    let readyToCommit = false;
    try {
      return await writeInEdit(pkg, async (editId, api) => {
        const params = { packageName: pkg, editId, language, imageType };
        if (single) {
          await api.edits.images.deleteall(params);
        } else {
          const existing = (await api.edits.images.list(params)).data.images ?? [];
          if (existing.length + files.length > 8) throw new ApiError(400, "Можна додати максимум 8 скриншотів цього типу.");
          if (imageType === "phoneScreenshots" && existing.length + files.length < 2) {
            throw new ApiError(400, "Google Play потребує щонайменше 2 скриншоти телефона. Обери їх разом.");
          }
        }
        const images = [];
        for (const file of files) {
          const res = await api.edits.images.upload({
            ...params,
            media: { mimeType: file.mimeType, body: Readable.from(file.buffer) },
          }, { retry: false });
          images.push(res.data.image);
        }
        readyToCommit = true;
        return images;
      });
    } catch (error) {
      if (!isUnavailable(error)) throw error;
      // Коміт міг пройти попри 503: повторювати всю операцію небезпечно.
      if (readyToCommit) {
        throw new ApiError(503, "Google Play не підтвердив збереження зображень.", "Онови сторінку й перевір графіку перед повторним завантаженням.");
      }
      // writeInEdit скасував edit. Новий edit і нові потоки не дублюють часткове завантаження.
      if (attempt >= 2) {
        throw new ApiError(503, "Сервіс завантаження Google Play тимчасово недоступний.", "Автоматичні повторні спроби не допомогли. Спробуй ще раз за кілька хвилин.");
      }
      await delay(1000 * 2 ** attempt);
    }
  }
}
