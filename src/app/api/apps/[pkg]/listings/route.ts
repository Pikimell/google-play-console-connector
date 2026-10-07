import { route, jsonBody } from "@/lib/route";
import { deleteListing, getListings, saveListings } from "@/lib/play";
import type { Listing } from "@/lib/types";
import { ApiError } from "@/lib/errors";

type P = { pkg: string };

export const GET = route<P>(async (_req, { pkg }) => getListings(pkg));

/** Тіло — один опис або масив описів (пакетне збереження перекладів одним комітом). */
export const PUT = route<P>(async (req, { pkg }) => {
  const body = await jsonBody<Listing | Listing[]>(req);
  const listings = Array.isArray(body) ? body : [body];
  if (!listings.length) throw new ApiError(400, "Немає що зберігати.");
  await saveListings(pkg, listings);
});

export const DELETE = route<P>(async (req, { pkg }) => {
  const language = new URL(req.url).searchParams.get("language");
  if (!language) throw new ApiError(400, "Не вказано мову.");
  await deleteListing(pkg, language);
});
