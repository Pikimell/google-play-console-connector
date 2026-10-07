import { route, jsonBody } from "@/lib/route";
import { changeRollout } from "@/lib/play";

type Action = Parameters<typeof changeRollout>[2];

export const POST = route<{ pkg: string; track: string }>(async (req, { pkg, track }) => {
  const action = await jsonBody<Action>(req);
  const res = await changeRollout(pkg, decodeURIComponent(track), action);
  return { ok: true, sentForReview: res.sentForReview };
});
