import { route, jsonBody } from "@/lib/route";
import { setupClosedTesting, type ClosedTestingInput } from "@/lib/play";

/** Майстер «Нове закрите тестування»: трек + тестувальники + реліз одним комітом. */
export const POST = route<{ pkg: string }>(async (req, { pkg }) => {
  return setupClosedTesting(pkg, await jsonBody<ClosedTestingInput>(req));
});
