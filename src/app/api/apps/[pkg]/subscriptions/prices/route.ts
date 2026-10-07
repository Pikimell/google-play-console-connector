import { route, jsonBody } from "@/lib/route";
import { previewPrices } from "@/lib/subscriptions";
import type { PriceInput } from "@/lib/types";

export const POST = route<{ pkg: string }>(async (req, { pkg }) => previewPrices(pkg, await jsonBody<PriceInput>(req)));
