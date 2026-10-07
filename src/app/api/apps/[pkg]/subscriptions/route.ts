import { route, jsonBody } from "@/lib/route";
import { createSubscription, listSubscriptions, type NewSubscription } from "@/lib/subscriptions";

type P = { pkg: string };

export const GET = route<P>(async (req, { pkg }) => {
  const archived = new URL(req.url).searchParams.get("archived") === "1";
  return { subscriptions: await listSubscriptions(pkg, archived) };
});

export const POST = route<P>(async (req, { pkg }) => createSubscription(pkg, await jsonBody<NewSubscription>(req)));
