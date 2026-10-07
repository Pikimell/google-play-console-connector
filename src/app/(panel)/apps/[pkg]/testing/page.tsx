"use client";
import Link from "next/link";
import { FlaskConical, Lock, Plus, Rocket, Users } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { optInLink } from "@/components/release-parts";
import { Alert, Badge, Card, CopyButton, EmptyState, LinkButton, PageHeader, Skeleton } from "@/components/ui";
import { enc } from "@/lib/client";
import { primaryRelease, STATUS_LABEL, STATUS_TONE, trackInfo } from "@/lib/tracks";

export default function TestingPage() {
  const { data, loading, pkg } = useApp();
  const base = `/apps/${enc(pkg)}`;
  const closed = (data?.overview.tracks ?? []).filter((t) => trackInfo(t.track).kind === "closed" && !t.track.includes(":"));

  return (
    <>
      <PageHeader
        title="Закрите тестування"
        description="Кожен трек — окрема група тестувальників зі своєю версією застосунку."
        actions={<LinkButton href={`${base}/testing/new`} icon={<Plus className="size-4" />}>Нове закрите тестування</LinkButton>}
      />

      <Card className="mb-6 p-4">
        <div className="mb-1 text-sm font-medium">Посилання для тестувальників (однакове для всіх треків)</div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-gray-100 px-2 py-1 text-sm break-all">{optInLink(pkg)}</code>
          <CopyButton text={optInLink(pkg)} />
        </div>
        <p className="mt-2 text-xs text-gray-500">Google сам визначає, до якого треку належить людина, за її email. Посилання запрацює, коли на треку з&apos;явиться опублікований реліз.</p>
      </Card>

      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : closed.length === 0 ? (
        <EmptyState icon={<FlaskConical className="size-10" />} title="Ще немає закритих тестувань" action={<LinkButton href={`${base}/testing/new`} icon={<Plus className="size-4" />}>Створити</LinkButton>}>
          Майстер проведе через 3 кроки: назва → тестувальники → збірка.
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {closed.map((t) => {
            const r = primaryRelease(t.releases);
            const info = trackInfo(t.track);
            return (
              <Card key={t.track} className="flex flex-col p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <Link href={`${base}/testing/${enc(t.track)}`} className="font-semibold text-gray-900 hover:text-brand-700">{t.track === "alpha" ? info.label : t.track}</Link>
                  {r ? <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> : <Badge>Без збірки</Badge>}
                </div>
                <p className="flex-1 text-sm text-gray-600">{r ? `${r.name || "Без назви"} · code ${r.versionCodes.join(", ")}` : "Ще немає версії для тестувальників."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <LinkButton size="sm" href={`${base}/testing/${enc(t.track)}`} icon={<Users className="size-3.5" />}>Тестувальники</LinkButton>
                  <LinkButton size="sm" variant="secondary" href={`${base}/release?track=${enc(t.track)}`} icon={<Rocket className="size-3.5" />}>Нова версія</LinkButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Alert tone="info" className="mt-6" title="А внутрішнє тестування?">
        <Lock className="mr-1 inline size-3.5" />
        Внутрішнє тестування (до 100 людей, без перевірки Google) підтримує лише email-списки, які Google не дозволяє змінювати через API.
        Список тестувальників для нього задай один раз у Play Console → Тестування → Внутрішнє тестування → «Тестувальники»
        (зручно взяти CSV зі сторінки «Тестувальники» тут). Нові версії туди вантаж звідси: <Link href={`${base}/release?track=internal`}>Нова версія → Внутрішнє</Link>.
      </Alert>
    </>
  );
}
