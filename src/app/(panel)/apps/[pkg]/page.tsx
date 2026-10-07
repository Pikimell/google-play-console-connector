"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FlaskConical, Layers, Plus, Rocket, Users } from "lucide-react";
import { useApp, useApps } from "@/components/apps-context";
import { Alert, Badge, Button, Card, LinkButton, PageHeader, Skeleton, useToast } from "@/components/ui";
import { api, enc, errorInfo } from "@/lib/client";
import { primaryRelease, STATUS_LABEL, STATUS_TONE, trackInfo, trackSortKey } from "@/lib/tracks";
import type { Track } from "@/lib/types";

function TrackCard({ pkg, t }: { pkg: string; t: Track }) {
  const info = trackInfo(t.track);
  const r = primaryRelease(t.releases);
  const base = `/apps/${enc(pkg)}`;
  const note = r?.releaseNotes?.[0]?.text;
  return (
    <Card className="flex flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-gray-900">{info.label}</div>
          <div className="font-mono text-xs text-gray-400">{t.track}</div>
        </div>
        {r ? <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}{r.status === "inProgress" && r.userFraction ? ` · ${Math.round(r.userFraction * 100)}%` : ""}</Badge> : <Badge>Порожньо</Badge>}
      </div>
      {r ? (
        <div className="flex-1 text-sm">
          <div className="text-gray-900">{r.name || "Без назви"} <span className="text-gray-500">· code {r.versionCodes.join(", ")}</span></div>
          {note && <p className="mt-1 line-clamp-2 text-gray-500">{note}</p>}
          {t.releases.length > 1 && <p className="mt-1 text-xs text-gray-400">+ ще {t.releases.length - 1} реліз(и) на треку</p>}
        </div>
      ) : (
        <p className="flex-1 text-sm text-gray-500">На цьому треку ще немає релізів.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton size="sm" variant="secondary" href={`${base}/release?track=${enc(t.track)}`} icon={<Rocket className="size-3.5" />}>Нова версія сюди</LinkButton>
        {info.kind === "closed" && (
          <LinkButton size="sm" variant="ghost" href={`${base}/testing/${enc(t.track)}`} icon={<Users className="size-3.5" />}>Тестувальники</LinkButton>
        )}
      </div>
    </Card>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const toast = useToast();
  const apps = useApps();
  const { data, loading, reload, pkg } = useApp();
  const base = `/apps/${enc(pkg)}`;
  const hidden = new Set(data?.hiddenTracks ?? []);
  const tracks = [...(data?.overview.tracks ?? [])].filter((t) => !hidden.has(t.track)).sort((a, b) => trackSortKey(a.track) - trackSortKey(b.track));
  const active = tracks.filter((t) => t.releases.length > 0);
  const empty = tracks.filter((t) => t.releases.length === 0);

  async function addToList() {
    try {
      await api("/api/apps", { method: "POST", json: { packageName: pkg } });
      await Promise.all([apps.reload(), reload()]);
      toast("success", "Застосунок додано в список");
    } catch (e) {
      toast("error", errorInfo(e).message);
    }
  }

  async function remove() {
    if (!confirm("Прибрати застосунок зі списку панелі? У Google Play нічого не зміниться.")) return;
    await api(`/api/apps/${enc(pkg)}`, { method: "DELETE" });
    await apps.reload();
    router.push("/");
  }

  return (
    <>
      <PageHeader
        title="Огляд"
        description="Що зараз опубліковано на кожному треку."
        actions={
          <>
            <LinkButton href={`${base}/release`} icon={<Rocket className="size-4" />}>Завантажити нову версію</LinkButton>
            <LinkButton href={`${base}/testing/new`} variant="secondary" icon={<FlaskConical className="size-4" />}>Нове закрите тестування</LinkButton>
          </>
        }
      />
      {data && !data.saved && (
        <Alert tone="info" className="mb-4" action={<Button size="sm" onClick={addToList} icon={<Plus className="size-4" />}>Додати</Button>}>
          Цього застосунку немає в меню панелі.
        </Alert>
      )}

      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : data ? (
        <>
          {active.length === 0 && (
            <Alert tone="info" className="mb-4" title="Ще немає жодного релізу">
              Почни з <Link href={`${base}/release?track=internal`}>внутрішнього тестування</Link> — це найшвидший спосіб перевірити збірку на своєму телефоні.
            </Alert>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((t) => <TrackCard key={t.track} pkg={pkg} t={t} />)}
          </div>
          {empty.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-gray-500">Порожні треки</h2>
              <div className="flex flex-wrap gap-2">
                {empty.map((t) => (
                  <Link key={t.track} href={`${base}/release?track=${enc(t.track)}`} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 hover:border-brand-500">
                    {trackInfo(t.track).short} <Plus className="size-3.5 text-gray-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Link href={`${base}/tracks`} className="group"><Card className="flex items-center gap-3 p-4 group-hover:border-brand-500"><Layers className="size-5 text-brand-600" /><span className="flex-1 text-sm font-medium">Керувати релізами</span><ArrowRight className="size-4 text-gray-400" /></Card></Link>
            <Link href={`${base}/testing`} className="group"><Card className="flex items-center gap-3 p-4 group-hover:border-brand-500"><FlaskConical className="size-5 text-brand-600" /><span className="flex-1 text-sm font-medium">Закрите тестування</span><ArrowRight className="size-4 text-gray-400" /></Card></Link>
            <Link href={`${base}/listing`} className="group"><Card className="flex items-center gap-3 p-4 group-hover:border-brand-500"><Users className="size-5 text-brand-600" /><span className="flex-1 text-sm font-medium">Опис у магазині</span><ArrowRight className="size-4 text-gray-400" /></Card></Link>
          </div>
        </>
      ) : null}

      {data?.saved && (
        <div className="mt-12 border-t border-gray-200 pt-4">
          <Button variant="ghost" size="sm" onClick={remove} className="text-gray-500">Прибрати застосунок з панелі</Button>
        </div>
      )}
    </>
  );
}
