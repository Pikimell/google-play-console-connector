import { route, jsonBody } from "@/lib/route";
import { getPublisher } from "@/lib/google";
import type { Review } from "@/lib/types";
import { ApiError } from "@/lib/errors";

type P = { pkg: string };

function ts(t?: { seconds?: string | null } | null) {
  return t?.seconds ? new Date(Number(t.seconds) * 1000).toISOString() : undefined;
}

/** Відгуки з текстом за останні 7 днів (обмеження Google API). */
export const GET = route<P>(async (req, { pkg }) => {
  const token = new URL(req.url).searchParams.get("token") ?? undefined;
  const res = await getPublisher().reviews.list({ packageName: pkg, maxResults: 50, token, translationLanguage: "uk" });
  const reviews: Review[] = (res.data.reviews ?? []).map((r) => {
    const user = r.comments?.find((c) => c.userComment)?.userComment;
    const dev = r.comments?.find((c) => c.developerComment)?.developerComment;
    return {
      reviewId: r.reviewId!,
      authorName: r.authorName ?? undefined,
      rating: user?.starRating ?? undefined,
      text: user?.text?.trim(),
      lastModified: ts(user?.lastModified),
      language: user?.reviewerLanguage ?? undefined,
      appVersionName: user?.appVersionName ?? undefined,
      device: user?.deviceMetadata?.productName ?? user?.device ?? undefined,
      reply: dev ? { text: dev.text ?? undefined, lastModified: ts(dev.lastModified) } : undefined,
    };
  });
  return { reviews, nextToken: res.data.tokenPagination?.nextPageToken ?? null };
});

export const POST = route<P>(async (req, { pkg }) => {
  const { reviewId, text } = await jsonBody<{ reviewId: string; text: string }>(req);
  if (!text?.trim()) throw new ApiError(400, "Відповідь порожня.");
  if (text.length > 350) throw new ApiError(400, "Відповідь — максимум 350 символів.");
  await getPublisher().reviews.reply({ packageName: pkg, reviewId, requestBody: { replyText: text.trim() } });
});
