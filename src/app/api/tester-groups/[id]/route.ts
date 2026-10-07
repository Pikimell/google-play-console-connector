import { route, jsonBody } from "@/lib/route";
import { deleteTesterGroup, updateTesterGroup } from "@/lib/store";
import { ApiError } from "@/lib/errors";

type P = { id: string };

export const PUT = route<P>(async (req, { id }) => {
  const body = await jsonBody<{ name?: string; emails?: string[] | string; googleGroup?: string }>(req);
  const emails = body.emails === undefined ? undefined : Array.isArray(body.emails) ? body.emails : body.emails.split(/[\s,;]+/);
  const group = await updateTesterGroup(id, { name: body.name, emails, googleGroup: body.googleGroup });
  if (!group) throw new ApiError(404, "Групу не знайдено.");
  return { group };
});

export const DELETE = route<P>(async (_req, { id }) => {
  await deleteTesterGroup(id);
});
