import { route } from "@/lib/route";
import { deleteImage, IMAGE_TYPES, listImages } from "@/lib/play";
import { uploadImages, type ImageUpload } from "@/lib/image-upload";
import type { ImageType } from "@/lib/types";
import { ApiError } from "@/lib/errors";

type P = { pkg: string };

function params(req: Request) {
  const sp = new URL(req.url).searchParams;
  const language = sp.get("language");
  if (!language) throw new ApiError(400, "Не вказано мову.");
  const type = sp.get("type") as ImageType | null;
  if (type && !IMAGE_TYPES.includes(type)) throw new ApiError(400, "Невідомий тип зображення.");
  return { language, type, id: sp.get("id") };
}

export const GET = route<P>(async (req, { pkg }) => ({ images: await listImages(pkg, params(req).language) }));

export const POST = route<P>(async (req, { pkg }) => {
  const { language, type } = params(req);
  if (!type) throw new ApiError(400, "Не вказано тип зображення.");
  const mime = req.headers.get("content-type") ?? "image/png";
  let files: ImageUpload[];
  if (mime.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const entries = form.getAll("files");
    if (!entries.length || entries.length > 8 || entries.some((f) => typeof f === "string")) {
      throw new ApiError(400, "Обери від 1 до 8 файлів зображень.");
    }
    files = [];
    for (const entry of entries) {
      const file = entry as File;
      if (file.size > 15 * 1024 * 1024) throw new ApiError(400, "Зображення більше 15 МБ.");
      files.push({ mimeType: file.type, buffer: Buffer.from(await file.arrayBuffer()) });
    }
  } else {
    files = [{ mimeType: mime, buffer: Buffer.from(await req.arrayBuffer()) }];
  }
  const res = await uploadImages(pkg, language, type, files);
  return { image: res.result[0], images: res.result, sentForReview: res.sentForReview };
});

export const DELETE = route<P>(async (req, { pkg }) => {
  const { language, type, id } = params(req);
  if (!type || !id) throw new ApiError(400, "Не вказано зображення.");
  await deleteImage(pkg, language, type, id);
});
