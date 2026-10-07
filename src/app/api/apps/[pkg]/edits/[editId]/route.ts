import { route } from "@/lib/route";
import { getPublisher } from "@/lib/google";

/** Скасувати незавершений майстер релізу (видалити edit з завантаженим файлом). */
export const DELETE = route<{ pkg: string; editId: string }>(async (_req, { pkg, editId }) => {
  await getPublisher().edits.delete({ packageName: pkg, editId }).catch(() => {});
});
