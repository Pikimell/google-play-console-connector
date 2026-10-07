"use client";
import Link from "next/link";
import { useState } from "react";
import { Eye, FlaskConical, Lock, Plus, Rocket, Trash2, Users } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { optInLink } from "@/components/release-parts";
import { Alert, Badge, Button, Card, Checkbox, CopyButton, EmptyState, ErrorBox, LinkButton, Modal, PageHeader, Skeleton, cn, useToast } from "@/components/ui";
import { api, enc, errorInfo, type ErrInfo } from "@/lib/client";
import { primaryRelease, STATUS_LABEL, STATUS_TONE, trackInfo } from "@/lib/tracks";
import type { Track } from "@/lib/types";

type Tab = "active" | "inactive" | "hidden";

/** Активне тестування = є збірка, яку зараз отримують тестувальники. */
function isActive(t: Track) {
  return t.releases.some((r) => r.status === "completed" || r.status === "inProgress");
}

export default function TestingPage() {
  const { data, loading, reload, pkg } = useApp();
  const toast = useToast();
  const base = `/apps/${enc(pkg)}`;
  const [tab, setTab] = useState<Tab>("active");
  const [removing, setRemoving] = useState<Track | null>(null);
  const [halt, setHalt] = useState(true);
  const [clearTesters, setClearTesters] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ErrInfo>();

  const hidden = new Set(data?.hiddenTracks ?? []);
  const closed = (data?.overview.tracks ?? []).filter((t) => trackInfo(t.track).kind === "closed" && !t.track.includes(":"));
  const groups: Record<Tab, Track[]> = {
    active: closed.filter((t) => !hidden.has(t.track) && isActive(t)),
    inactive: closed.filter((t) => !hidden.has(t.track) && !isActive(t)),
    hidden: closed.filter((t) => hidden.has(t.track)),
  };
  const list = groups[tab];

  function openRemove(t: Track) {
    setError(undefined);
    setHalt(isActive(t));
    setClearTesters(true);
    setRemoving(t);
  }

  async function remove() {
    if (!removing) return;
    setBusy(removing.track);
    setError(undefined);
    try {
      const res = await api<{ sentForReview: boolean }>(`/api/apps/${enc(pkg)}/tracks/${enc(removing.track)}/retire`, {
        method: "POST",
        json: { halt: halt && isActive(removing), clearTesters },
      });
      toast("success", res.sentForReview ? `Тестування «${removing.track}» видалено` : "Видалено. Відправ зміни на перевірку в Play Console.");
      setRemoving(null);
      await reload();
    } catch (e) {
      setError(errorInfo(e));
    } finally {
      setBusy(null);
    }
  }

  async function setHidden(t: Track, value: boolean) {
    setBusy(t.track);
    try {
      await api(`/api/apps/${enc(pkg)}/tracks/${enc(t.track)}/visibility`, { method: "POST", json: { hidden: value } });
      toast("success", value ? "Приховано" : `«${t.track}» повернуто`);
      setRemoving(null);
      await reload();
    } catch (e) {
      toast("error", errorInfo(e).message);
    } finally {
      setBusy(null);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "active", label: "Активні" },
    { key: "inactive", label: "Без збірки / зупинені" },
    { key: "hidden", label: "Видалені" },
  ];

  return (
    <>
      <PageHeader
        title="Закрите тестування"
        description="Кожен трек — окрема група тестувальників зі своєю версією застосунку."
        actions={<LinkButton href={`${base}/testing/new`} icon={<Plus className="size-4" />}>Нове закрите тестування</LinkButton>}
      />

      <Card className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
        <span className="text-sm font-medium">Посилання для тестувальників:</span>
        <code className="rounded bg-gray-100 px-2 py-1 text-sm break-all">{optInLink(pkg)}</code>
        <CopyButton text={optInLink(pkg)} />
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition",
              tab === t.key ? "border-brand-600 bg-brand-50 font-medium text-brand-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            )}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 text-xs", tab === t.key ? "bg-brand-100" : "bg-gray-100")}>{groups[t.key].length}</span>
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
      ) : list.length === 0 ? (
        tab === "active" ? (
          <EmptyState icon={<FlaskConical className="size-10" />} title="Немає активних тестувань" action={<LinkButton href={`${base}/testing/new`} icon={<Plus className="size-4" />}>Створити</LinkButton>}>
            {groups.inactive.length > 0 ? `Є ${groups.inactive.length} без збірки або зупинених — див. сусідню вкладку.` : "Майстер проведе через 3 кроки: назва → тестувальники → збірка."}
          </EmptyState>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">{tab === "hidden" ? "Видалених тестувань немає." : "Тут порожньо."}</p>
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((t) => {
            const r = primaryRelease(t.releases);
            return (
              <Card key={t.track} className={cn("flex flex-col p-4", tab === "hidden" && "opacity-75")}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <Link href={`${base}/testing/${enc(t.track)}`} className="min-w-0 truncate font-semibold text-gray-900 hover:text-brand-700">
                    {t.track === "alpha" ? trackInfo(t.track).label : t.track}
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    {r ? <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> : <Badge>Без збірки</Badge>}
                    {tab !== "hidden" && (
                      <button
                        onClick={() => openRemove(t)}
                        className="-mr-1 rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Видалити тестування"
                        aria-label="Видалити тестування"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="flex-1 text-sm text-gray-600">{r ? `${r.name || "Без назви"} · code ${r.versionCodes.join(", ")}` : "Ще немає версії для тестувальників."}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {tab === "hidden" ? (
                    <Button size="sm" variant="secondary" loading={busy === t.track} icon={<Eye className="size-3.5" />} onClick={() => setHidden(t, false)}>Повернути</Button>
                  ) : (
                    <>
                      <LinkButton size="sm" href={`${base}/testing/${enc(t.track)}`} icon={<Users className="size-3.5" />}>Тестувальники</LinkButton>
                      <LinkButton size="sm" variant="secondary" href={`${base}/release?track=${enc(t.track)}`} icon={<Rocket className="size-3.5" />}>Нова версія</LinkButton>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "active" && (
        <Alert tone="info" className="mt-6" title="А внутрішнє тестування?">
          <Lock className="mr-1 inline size-3.5" />
          Внутрішнє тестування підтримує лише email-списки, які Google не дозволяє змінювати через API — список задай один раз у Play Console (CSV є на сторінці «Тестувальники»).
          Нові версії туди вантаж звідси: <Link href={`${base}/release?track=internal`}>Нова версія → Внутрішнє</Link>.
        </Alert>
      )}

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Видалити тестування «${removing?.track}»?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Скасувати</Button>
            <Button variant="danger" loading={!!busy} icon={<Trash2 className="size-4" />} onClick={remove}>Видалити</Button>
          </>
        }
      >
        {removing && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">
              Google Play не дозволяє повністю видаляти треки, тому панель зробить усе, що можна, і прибере тестування зі списку:
            </p>
            <div className="rounded-xl border border-gray-200 p-1">
              {isActive(removing) && (
                <Checkbox
                  checked={halt}
                  onChange={setHalt}
                  label="Зупинити роздачу збірки"
                  description="Тестувальники більше не зможуть встановити чи оновити цю версію."
                />
              )}
              <Checkbox checked={clearTesters} onChange={setClearTesters} label="Відв'язати тестувальників (Google-групи)" description="Email-списки, додані вручну в Play Console, залишаться — їх Google через API не показує." />
            </div>
            <p className="text-xs text-gray-500">Повернути тестування можна у вкладці «Видалені» (збірку потім опублікуй заново через «Нова версія»).</p>
            <ErrorBox error={error} />
            {error && (
              <Button size="sm" variant="secondary" onClick={() => setHidden(removing, true)}>Лише прибрати зі списку, нічого не змінюючи в Google Play</Button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
