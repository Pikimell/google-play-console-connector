import { route, jsonBody } from "@/lib/route";
import { setTrackHidden } from "@/lib/store";

/** Сховати/повернути трек у панелі (у Google Play нічого не змінюється). */
export const POST = route<{ pkg: string; track: string }>(async (req, { pkg, track }) => {
  const { hidden } = await jsonBody<{ hidden: boolean }>(req);
  return { hiddenTracks: await setTrackHidden(pkg, decodeURIComponent(track), Boolean(hidden)) };
});
