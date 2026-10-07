import { route, jsonBody } from "@/lib/route";
import { deleteListing, getListings, saveListing } from "@/lib/play";
import type { Listing } from "@/lib/types";
import { ApiError } from "@/lib/errors";

type P = { pkg: string };

export const GET = route<P>(async (_req, { pkg }) => getListings(pkg));

export const PUT = route<P>(async (req, { pkg }) => {
  const listing = await jsonBody<Listing>(req);
  if (!listing.language) throw new ApiError(400, "Не вказано мову.");
  await saveListing(pkg, listing);
});

export const DELETE = route<P>(async (req, { pkg }) => {
  const language = new URL(req.url).searchParams.get("language");
  if (!language) throw new ApiError(400, "Не вказано мову.");
  await deleteListing(pkg, language);
});
