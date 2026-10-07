import { route } from "@/lib/route";
import { listBundles } from "@/lib/play";

export const GET = route<{ pkg: string }>(async (_req, { pkg }) => ({ bundles: await listBundles(pkg) }));
