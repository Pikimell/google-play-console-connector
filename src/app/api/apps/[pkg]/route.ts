import { route } from "@/lib/route";
import { getOverview } from "@/lib/play";

export const GET = route<{ pkg: string }>(async (_req, { pkg }) => ({ overview: await getOverview(pkg) }));
