import { route, jsonBody } from "@/lib/route";
import { ApiError } from "@/lib/errors";
import { deleteBasePlan, getSubscription, setBasePlanPrice, setBasePlanState } from "@/lib/subscriptions";
import type { PriceInput } from "@/lib/types";

type P = { pkg: string; productId: string; basePlanId: string };
type Action = { action: "activate" | "deactivate" } | { action: "price"; price: PriceInput };

export const POST = route<P>(async (req, { pkg, productId, basePlanId }) => {
  const body = await jsonBody<Action>(req);
  switch (body.action) {
    case "activate":
    case "deactivate":
      await setBasePlanState(pkg, productId, basePlanId, body.action === "activate");
      return getSubscription(pkg, productId);
    case "price":
      return setBasePlanPrice(pkg, productId, basePlanId, body.price);
    default:
      throw new ApiError(400, "Невідома дія.");
  }
});

export const DELETE = route<P>(async (_req, { pkg, productId, basePlanId }) => {
  await deleteBasePlan(pkg, productId, basePlanId);
  return getSubscription(pkg, productId);
});
