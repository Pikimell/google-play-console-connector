import { route, jsonBody } from "@/lib/route";
import { assertPackage, getOverview } from "@/lib/play";

export const GET = route(async () => {
  return { apps: [] };
});

/** Додати існуючий застосунок: перевіряємо, що сервісний акаунт має до нього доступ. */
export const POST = route(async (req) => {
  const { packageName } = await jsonBody<{ packageName: string }>(req);
  const pkg = (packageName ?? "").trim();
  assertPackage(pkg);
  const overview = await getOverview(pkg);
  const app = {
    packageName: pkg,
    title: overview.title,
    iconUrl: overview.iconUrl,
    addedAt: new Date().toISOString(),
  };
  return { app, overview };
});
