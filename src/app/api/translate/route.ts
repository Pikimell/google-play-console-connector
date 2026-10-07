import { route, jsonBody } from "@/lib/route";
import { translateListing, type TranslateField } from "@/lib/openai";
import { ApiError } from "@/lib/errors";
import type { Listing } from "@/lib/types";

export const maxDuration = 300;

const FIELDS: TranslateField[] = ["title", "shortDescription", "fullDescription"];

/** Перекласти опис магазину однією мовою (без збереження — зберігає клієнт, пакетом). */
export const POST = route(async (req) => {
  const { source, target, fields } = await jsonBody<{ source: Listing; target: string; fields?: TranslateField[] }>(req);
  if (!source?.language || !target) throw new ApiError(400, "Не вказано мову оригіналу або перекладу.");
  if (source.language === target) throw new ApiError(400, "Мова перекладу збігається з оригіналом.");
  const use = (fields?.length ? fields : FIELDS).filter((f) => FIELDS.includes(f));
  return translateListing(source, target, use);
});
