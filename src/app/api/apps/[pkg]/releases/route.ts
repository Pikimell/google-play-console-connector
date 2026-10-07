import { route, jsonBody } from "@/lib/route";
import { publishRelease, type ReleaseInput } from "@/lib/play";

/** Створити реліз на треку: або з новим файлом (editId з кроку завантаження), або з уже завантаженою версією. */
export const POST = route<{ pkg: string }>(async (req, { pkg }) => {
  const body = await jsonBody<ReleaseInput & { editId?: string }>(req);
  const { editId, ...input } = body;
  const res = await publishRelease(pkg, input, editId);
  return { ok: true, sentForReview: res.sentForReview };
});
