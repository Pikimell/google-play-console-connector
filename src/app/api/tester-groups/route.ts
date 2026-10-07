import { route, jsonBody } from "@/lib/route";
import { createTesterGroup, listTesterGroups } from "@/lib/store";

export const GET = route(async () => ({ groups: await listTesterGroups() }));

export const POST = route(async (req) => {
  const body = await jsonBody<{ name: string; emails: string[] | string; googleGroup?: string }>(req);
  const emails = Array.isArray(body.emails) ? body.emails : String(body.emails ?? "").split(/[\s,;]+/);
  return { group: await createTesterGroup({ name: body.name ?? "", emails, googleGroup: body.googleGroup }) };
});
