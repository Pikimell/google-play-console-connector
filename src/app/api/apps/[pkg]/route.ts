import { route } from "@/lib/route";
import { getOverview } from "@/lib/play";
import { listApps, removeApp, upsertApp } from "@/lib/store";

type P = { pkg: string };

export const GET = route<P>(async (_req, { pkg }) => {
  const overview = await getOverview(pkg);
  // освіжаємо назву та іконку в локальному списку
  const stored = (await listApps()).find((a) => a.packageName === pkg);
  if (stored && (stored.title !== overview.title || stored.iconUrl !== overview.iconUrl)) {
    await upsertApp({ ...stored, title: overview.title, iconUrl: overview.iconUrl });
  }
  return { overview, saved: Boolean(stored) };
});

/** Прибрати застосунок зі списку панелі (у Google Play нічого не видаляється). */
export const DELETE = route<P>(async (_req, { pkg }) => {
  await removeApp(pkg);
});
