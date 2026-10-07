import { route, jsonBody } from "@/lib/route";
import { getDetails, saveDetails } from "@/lib/play";
import type { AppDetails } from "@/lib/types";

type P = { pkg: string };

export const GET = route<P>(async (_req, { pkg }) => getDetails(pkg));

export const PUT = route<P>(async (req, { pkg }) => {
  await saveDetails(pkg, await jsonBody<AppDetails>(req));
});
