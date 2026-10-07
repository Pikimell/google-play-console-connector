import { route, jsonBody } from "@/lib/route";
import { createClosedTrack, listTracks } from "@/lib/play";

export const GET = route<{ pkg: string }>(async (_req, { pkg }) => ({ tracks: await listTracks(pkg) }));

/** Створити новий трек закритого тестування. */
export const POST = route<{ pkg: string }>(async (req, { pkg }) => {
  const { name } = await jsonBody<{ name: string }>(req);
  const res = await createClosedTrack(pkg, name ?? "");
  return { track: res.result };
});
