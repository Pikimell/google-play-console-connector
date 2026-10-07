"use client";
import { useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { Badge, Button, Card, EmptyState, ErrorBox, PageHeader, Skeleton, Textarea, cn, useToast } from "@/components/ui";
import { api, enc, errorInfo, formatDate } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import type { Review } from "@/lib/types";

function Stars({ n = 0 }: { n?: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn("size-4", i <= n ? "fill-amber-400 text-amber-400" : "text-gray-300")} />)}
    </span>
  );
}

function ReviewCard({ pkg, r, onReplied }: { pkg: string; r: Review; onReplied: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(r.reply?.text ?? "");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await api(`/api/apps/${enc(pkg)}/reviews`, { method: "POST", json: { reviewId: r.reviewId, text } });
      toast("success", "Відповідь опубліковано");
      setOpen(false);
      onReplied();
    } catch (e) {
      toast("error", errorInfo(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Stars n={r.rating} />
        <span className="font-medium">{r.authorName || "Користувач"}</span>
        <span className="text-gray-400">{formatDate(r.lastModified)}</span>
        {r.appVersionName && <Badge>v{r.appVersionName}</Badge>}
        {r.device && <Badge>{r.device}</Badge>}
      </div>
      {r.text && <p className="mt-2 text-sm whitespace-pre-line text-gray-800">{r.text}</p>}
      {r.reply && !open && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="mb-1 text-xs font-medium text-gray-500">Твоя відповідь · {formatDate(r.reply.lastModified)}</div>
          <p className="whitespace-pre-line text-gray-700">{r.reply.text}</p>
        </div>
      )}
      {open ? (
        <div className="mt-3 space-y-2">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Дякуємо за відгук!…" />
          <div className="flex items-center justify-between">
            <span className={cn("text-xs", text.length > 350 ? "text-red-600" : "text-gray-400")}>{text.length}/350</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Скасувати</Button>
              <Button size="sm" loading={busy} disabled={!text.trim() || text.length > 350} onClick={send}>Опублікувати відповідь</Button>
            </div>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="mt-2" icon={<MessageSquare className="size-3.5" />} onClick={() => setOpen(true)}>
          {r.reply ? "Змінити відповідь" : "Відповісти"}
        </Button>
      )}
    </Card>
  );
}

export default function ReviewsPage() {
  const { pkg } = useApp();
  const { data, error, loading, reload } = useApi<{ reviews: Review[] }>(`/api/apps/${enc(pkg)}/reviews`);
  const [filter, setFilter] = useState<"all" | "unanswered" | "low">("all");
  const all = data?.reviews ?? [];
  const list = all.filter((r) => (filter === "unanswered" ? !r.reply : filter === "low" ? (r.rating ?? 5) <= 3 : true));

  return (
    <>
      <PageHeader title="Відгуки" description="Google API віддає лише відгуки з текстом за останні 7 днів. Старіші — у Play Console." />
      <div className="mb-4 flex gap-2">
        {([["all", `Усі (${all.length})`], ["unanswered", `Без відповіді (${all.filter((r) => !r.reply).length})`], ["low", "1–3 зірки"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full border px-3 py-1 text-sm", filter === k ? "border-brand-600 bg-brand-50 font-medium text-brand-700" : "border-gray-300 bg-white hover:bg-gray-50")}>{label}</button>
        ))}
      </div>
      <ErrorBox error={error} onRetry={reload} className="mb-4" />
      {loading && !data ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : list.length === 0 ? (
        <EmptyState icon={<MessageSquare className="size-10" />} title="Відгуків немає">За останні 7 днів нових відгуків з текстом не було.</EmptyState>
      ) : (
        <div className="space-y-3">{list.map((r) => <ReviewCard key={r.reviewId} pkg={pkg} r={r} onReplied={reload} />)}</div>
      )}
    </>
  );
}
