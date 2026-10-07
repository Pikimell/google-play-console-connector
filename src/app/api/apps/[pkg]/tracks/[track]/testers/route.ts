import { route, jsonBody } from "@/lib/route";
import { getTesters, setTesters } from "@/lib/play";

type P = { pkg: string; track: string };

export const GET = route<P>(async (_req, { pkg, track }) => getTesters(pkg, decodeURIComponent(track)));

export const PUT = route<P>(async (req, { pkg, track }) => {
  const { googleGroups } = await jsonBody<{ googleGroups: string[] }>(req);
  const res = await setTesters(pkg, decodeURIComponent(track), googleGroups ?? []);
  return res.result;
});
