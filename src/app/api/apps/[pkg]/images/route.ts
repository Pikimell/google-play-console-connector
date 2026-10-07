import { Readable } from "node:stream";
import { route } from "@/lib/route";
import { deleteImage, IMAGE_TYPES, listImages, uploadImage } from "@/lib/play";
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
  if (!/^image\/(png|jpeg)$/.test(mime)) throw new ApiError(400, "Google Play приймає лише PNG або JPEG.");
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) throw new ApiError(400, "Зображення більше 15 МБ.");
  const res = await uploadImage(pkg, language, type, mime, Readable.from(buf));
  return { image: res.result };
});

export const DELETE = route<P>(async (req, { pkg }) => {
  const { language, type, id } = params(req);
  if (!type || !id) throw new ApiError(400, "Не вказано зображення.");
  await deleteImage(pkg, language, type, id);
});
