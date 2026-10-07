import { route, jsonBody } from "@/lib/route";
import { retireTrack } from "@/lib/play";
import { setTrackHidden } from "@/lib/store";

type P = { pkg: string; track: string };

/** «Видалити» тестування: зупинити збірку, відв'язати тестувальників, сховати трек у панелі. */
export const POST = route<P>(async (req, { pkg, track }) => {
  const t = decodeURIComponent(track);
  const { halt = true, clearTesters = true } = await jsonBody<{ halt?: boolean; clearTesters?: boolean }>(req);
  const res = await retireTrack(pkg, t, { halt, clearTesters });
  const hiddenTracks = await setTrackHidden(pkg, t, true);
  return { sentForReview: res.sentForReview, hiddenTracks };
});
