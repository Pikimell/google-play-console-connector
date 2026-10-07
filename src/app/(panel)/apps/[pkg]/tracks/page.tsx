"use client";
import { useState } from "react";
import { ArrowUpRight, Pause, Play, Rocket, SlidersHorizontal, CheckCheck } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { Alert, Badge, Button, Card, ChoiceCard, ErrorBox, LinkButton, Modal, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import { api, enc, errorInfo } from "@/lib/client";
import { STANDARD_TRACKS, STATUS_LABEL, STATUS_TONE, trackInfo, trackSortKey } from "@/lib/tracks";
import type { Release } from "@/lib/types";

type Promote = { from: string; release: Release };

export default function TracksPage() {
  const { data, loading, reload, pkg } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [fraction, setFraction] = useState<{ track: string; percent: number } | null>(null);
  const [promote, setPromote] = useState<Promote | null>(null);
  const [target, setTarget] = useState("");
  const [targetStatus, setTargetStatus] = useState<"completed" | "draft">("completed");
  const [modalError, setModalError] = useState<ReturnType<typeof errorInfo>>();

  const tracks = [...(data?.overview.tracks ?? [])].sort((a, b) => trackSortKey(a.track) - trackSortKey(b.track));
  const targets = [...new Set([...STANDARD_TRACKS, ...tracks.map((t) => t.track)])].sort((a, b) => trackSortKey(a) - trackSortKey(b));

  async function rollout(track: string, action: object, okText: string) {
    setBusy(track);
    try {
      const res = await api<{ sentForReview: boolean }>(`/api/apps/${enc(pkg)}/tracks/${enc(track)}/rollout`, { method: "POST", json: action });
      toast("success", res.sentForReview ? okText : `${okText}. Відправ зміни на перевірку в Play Console.`);
      await reload();
      return true;
    } catch (e) {
      const info = errorInfo(e);
      toast("error", info.message);
      setModalError(info);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function doPromote() {
    if (!promote || !target) return;
    setBusy("promote");
    setModalError(undefined);
    try {
      await api(`/api/apps/${enc(pkg)}/releases`, {
        method: "POST",
        json: {
          track: target,
          versionCodes: promote.release.versionCodes,
          name: promote.release.name,
          releaseNotes: promote.release.releaseNotes,
          status: targetStatus,
        },
      });
      toast("success", `Версію перенесено в «${trackInfo(target).label}»`);
      setPromote(null);
      await reload();
    } catch (e) {
      setModalError(errorInfo(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Релізи й треки"
        description="Керування поточними релізами: поступове розгортання, пауза, перенесення версії з тестування далі."
        actions={<LinkButton href={`/apps/${enc(pkg)}/release`} icon={<Rocket className="size-4" />}>Нова версія</LinkButton>}
      />
      {loading && !data && <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>}

      <div className="space-y-4">
        {tracks.map((t) => {
          const info = trackInfo(t.track);
          return (
            <Card key={t.track} className="p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900">{info.label}</h2>
                  <p className="text-sm text-gray-500">{info.description}</p>
                </div>
                <LinkButton size="sm" variant="secondary" href={`/apps/${enc(pkg)}/release?track=${enc(t.track)}`}>Нова версія сюди</LinkButton>
              </div>
              {t.releases.length === 0 ? (
                <p className="text-sm text-gray-400">Релізів немає.</p>
              ) : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {t.releases.map((r, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{r.name || "Без назви"}</span>
                          <Badge tone={STATUS_TONE[r.status]}>
                            {STATUS_LABEL[r.status]}
                            {r.userFraction ? ` · ${Math.round(r.userFraction * 100)}%` : ""}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">versionCode {r.versionCodes.join(", ") || "—"}</div>
                        {r.releaseNotes?.[0]?.text && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{r.releaseNotes[0].text}</p>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {r.status === "inProgress" && (
                          <>
                            <Button size="sm" variant="secondary" icon={<SlidersHorizontal className="size-3.5" />} onClick={() => { setModalError(undefined); setFraction({ track: t.track, percent: Math.round((r.userFraction ?? 0.1) * 100) }); }}>
                              Змінити %
                            </Button>
                            <Button size="sm" variant="secondary" loading={busy === t.track} icon={<Pause className="size-3.5" />} onClick={() => confirm("Призупинити розгортання? Нові користувачі перестануть отримувати оновлення.") && rollout(t.track, { type: "halt" }, "Розгортання призупинено")}>
                              Пауза
                            </Button>
                          </>
                        )}
                        {r.status === "halted" && (
                          <Button size="sm" variant="secondary" loading={busy === t.track} icon={<Play className="size-3.5" />} onClick={() => rollout(t.track, { type: "resume" }, "Розгортання відновлено")}>
                            Відновити
                          </Button>
                        )}
                        {(r.status === "inProgress" || r.status === "halted") && (
                          <Button size="sm" loading={busy === t.track} icon={<CheckCheck className="size-3.5" />} onClick={() => confirm("Розгорнути на 100% користувачів?") && rollout(t.track, { type: "complete" }, "Розгорнуто на 100%")}>
                            100%
                          </Button>
                        )}
                        {r.versionCodes.length > 0 && (
                          <Button size="sm" variant="ghost" icon={<ArrowUpRight className="size-3.5" />} onClick={() => { setModalError(undefined); setTarget(""); setTargetStatus("completed"); setPromote({ from: t.track, release: r }); }}>
                            Перенести
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal
        open={!!fraction}
        onClose={() => setFraction(null)}
        title="Частка користувачів"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFraction(null)}>Скасувати</Button>
            <Button loading={!!busy} onClick={async () => fraction && (await rollout(fraction.track, { type: "fraction", userFraction: fraction.percent / 100 }, `Розгортання: ${fraction.percent}%`)) && setFraction(null)}>
              Зберегти
            </Button>
          </>
        }
      >
        {fraction && (
          <>
            <div className="mb-2 flex justify-between text-sm"><span>Скільки користувачів отримають оновлення</span><b>{fraction.percent}%</b></div>
            <input type="range" min={1} max={99} value={fraction.percent} onChange={(e) => setFraction({ ...fraction, percent: Number(e.target.value) })} className="w-full accent-brand-600" />
            <div className="mt-2 flex gap-2">
              {[5, 10, 20, 50, 80].map((p) => (
                <button key={p} type="button" onClick={() => setFraction({ ...fraction, percent: p })} className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs hover:border-brand-500">{p}%</button>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">Зменшити відсоток Google не дозволяє — лише збільшити або призупинити.</p>
            <ErrorBox error={modalError} className="mt-3" />
          </>
        )}
      </Modal>

      <Modal
        open={!!promote}
        onClose={() => setPromote(null)}
        title="Перенести версію в інший трек"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPromote(null)}>Скасувати</Button>
            <Button disabled={!target} loading={busy === "promote"} onClick={doPromote}>Перенести</Button>
          </>
        }
      >
        {promote && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <b>{promote.release.name || `code ${promote.release.versionCodes.join(", ")}`}</b> з «{trackInfo(promote.from).label}». Назва релізу та «Що нового» скопіюються.
            </p>
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Обери трек…</option>
              {targets.filter((t) => t !== promote.from).map((t) => (
                <option key={t} value={t}>{trackInfo(t).label}</option>
              ))}
            </Select>
            <div className="grid gap-2 sm:grid-cols-2">
              <ChoiceCard selected={targetStatus === "completed"} onClick={() => setTargetStatus("completed")} title="Опублікувати" />
              <ChoiceCard selected={targetStatus === "draft"} onClick={() => setTargetStatus("draft")} title="Як чернетку" />
            </div>
            {target === "production" && <Alert tone="warning">Для поступового розгортання в production скористайся майстром «Нова версія» → «Вже завантажена збірка».</Alert>}
            <ErrorBox error={modalError} />
          </div>
        )}
      </Modal>
    </>
  );
}
