import { route, jsonBody } from "@/lib/route";
import { addBasePlan } from "@/lib/subscriptions";
import type { NewBasePlan } from "@/lib/types";

export const POST = route<{ pkg: string; productId: string }>(async (req, { pkg, productId }) => addBasePlan(pkg, productId, await jsonBody<NewBasePlan>(req)));
