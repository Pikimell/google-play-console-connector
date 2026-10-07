import { route, jsonBody } from "@/lib/route";
import { deleteSubscription, getSubscription, saveListings } from "@/lib/subscriptions";
import type { SubscriptionListing } from "@/lib/types";

type P = { pkg: string; productId: string };

export const GET = route<P>(async (_req, { pkg, productId }) => getSubscription(pkg, productId));

export const PUT = route<P>(async (req, { pkg, productId }) => {
  const { listings } = await jsonBody<{ listings: SubscriptionListing[] }>(req);
  return saveListings(pkg, productId, listings);
});

export const DELETE = route<P>(async (_req, { pkg, productId }) => {
  await deleteSubscription(pkg, productId);
});
