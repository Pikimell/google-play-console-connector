"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Plus, Rocket, Trash2, Users } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { optInLink } from "@/components/release-parts";
import { CsvButton, GoogleGroupGuide, TesterGroupForm } from "@/components/tester-groups";
import { Alert, Badge, Button, Card, CopyButton, ErrorBox, Input, LinkButton, Modal, PageHeader, SectionTitle, Spinner, useToast } from "@/components/ui";
import { api, enc, errorInfo, type ErrInfo } from "@/lib/client";
import { isEmail } from "@/lib/emails";
import { useApi } from "@/lib/hooks";
import { primaryRelease, STATUS_LABEL, STATUS_TONE, trackInfo } from "@/lib/tracks";
import type { TesterGroup } from "@/lib/types";

export default function TrackTestersPage() {
  const params = useParams<{ track: string }>();
  const track = decodeURIComponent(params.track);
  const { data, pkg } = useApp();
  const toast = useToast();
  const base = `/apps/${enc(pkg)}`;
  const testers = useApi<{ googleGroups: string[] }>(`/api/apps/${enc(pkg)}/tracks/${enc(track)}/testers`);
  const groupsApi = useApi<{ groups: TesterGroup[] }>("/api/tester-groups");
  const [draft, setDraft] = useState<string[] | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrInfo>();
  const [creating, setCreating] = useState(false);

  const assigned = draft ?? testers.data?.googleGroups ?? [];
  const dirty = draft !== null && JSON.stringify([...draft].sort()) !== JSON.stringify([...(testers.data?.googleGroups ?? [])].sort());
  const groups = groupsApi.data?.groups ?? [];
  const byGG = new Map(groups.filter((g) => g.googleGroup).map((g) => [g.googleGroup!, g]));
  const t = data?.overview.tracks.find((x) => x.track === track);
  const release = t ? primaryRelease(t.releases) : undefined;

  const toggle = (gg: string) => setDraft(assigned.includes(gg) ? assigned.filter((x) => x !== gg) : [...assigned, gg]);

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api<{ googleGroups: string[] }>(`/api/apps/${enc(pkg)}/tracks/${enc(track)}/testers`, { method: "PUT", json: { googleGroups: assigned } });
      testers.setData(res);
      setDraft(null);
      toast("success", "Тестувальників збережено в Google Play");
    } catch (e) {
      setError(errorInfo(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><Users className="size-6 text-brand-600" />{trackInfo(track).label}</span>}
        back={<Link href={`${base}/testing`} className="mb-2 inline-block text-sm text-gray-500 hover:text-gray-800">← Усі тестування</Link>}
        actions={<LinkButton href={`${base}/release?track=${enc(track)}`} icon={<Rocket className="size-4" />}>Нова версія сюди</LinkButton>}
      />

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-1 text-sm font-medium text-gray-500">Поточна версія</div>
          {release ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{release.name || `code ${release.versionCodes.join(", ")}`}</span>
              <Badge tone={STATUS_TONE[release.status]}>{STATUS_LABEL[release.status]}</Badge>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Ще немає. <Link className="font-medium text-brand-700 hover:underline" href={`${base}/release?track=${enc(track)}`}>Завантажити →</Link></p>
          )}
        </Card>
        <Card className="p-4">
          <div className="mb-1 text-sm font-medium text-gray-500">Посилання для тестувальників</div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="truncate text-sm">{optInLink(pkg)}</code>
            <CopyButton text={optInLink(pkg)} />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle aside={<Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Нова група</Button>}>
          Google-групи, прив&apos;язані до треку
        </SectionTitle>
        {testers.loading && !testers.data ? (
          <Spinner />
        ) : testers.error ? (
          <ErrorBox error={testers.error} onRetry={testers.reload} />
        ) : (
          <>
            <div className="space-y-2">
              {groups.map((g) => {
                const on = !!g.googleGroup && assigned.includes(g.googleGroup);
                return (
                  <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3">
                    <label className={`flex min-w-0 flex-1 items-center gap-3 ${g.googleGroup ? "cursor-pointer" : "opacity-70"}`}>
                      <input type="checkbox" disabled={!g.googleGroup} checked={on} onChange={() => g.googleGroup && toggle(g.googleGroup)} className="size-4 accent-brand-600" />
                      <span className="min-w-0">
                        <span className="block font-medium">{g.name} <span className="font-normal text-gray-500">· {g.emails.length} email</span></span>
                        <span className="block truncate font-mono text-xs text-gray-500">{g.googleGroup ?? "немає Google-групи — лише через CSV"}</span>
                      </span>
                    </label>
                    <CsvButton name={g.name} emails={g.emails} label="CSV" />
                  </div>
                );
              })}
              {assigned.filter((gg) => !byGG.has(gg)).map((gg) => (
                <div key={gg} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                  <input type="checkbox" checked readOnly className="size-4 accent-brand-600" />
                  <span className="flex-1 font-mono text-sm">{gg}</span>
                  <Badge>не з панелі</Badge>
                  <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => toggle(gg)} aria-label="Прибрати" />
                </div>
              ))}
              {!groups.length && !assigned.length && <p className="text-sm text-gray-500">Груп ще немає — створи першу.</p>}
            </div>

            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = manual.trim().toLowerCase();
                if (isEmail(v) && !assigned.includes(v)) setDraft([...assigned, v]);
                setManual("");
              }}
            >
              <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Або встав email будь-якої Google-групи…" className="font-mono" />
              <Button type="submit" variant="secondary" disabled={!isEmail(manual)}>Додати</Button>
            </form>

            <ErrorBox error={error} className="mt-4" />
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
              {dirty && <span className="mr-auto text-sm text-amber-700">Є незбережені зміни</span>}
              {dirty && <Button variant="ghost" onClick={() => setDraft(null)}>Скасувати</Button>}
              <Button disabled={!dirty} loading={busy} onClick={save}>Зберегти в Google Play</Button>
            </div>
          </>
        )}
      </Card>

      <Alert tone="info" className="mt-6" title="Тестувальники через email-список">
        Якщо в Play Console для цього треку вже є email-списки — вони працюють паралельно з Google-групами, панель їх не чіпає (Google не показує їх через API).
      </Alert>
      <div className="mt-4"><GoogleGroupGuide /></div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Нова група тестувальників" wide>
        <TesterGroupForm
          submitLabel="Створити"
          onCancel={() => setCreating(false)}
          onSaved={async (g) => {
            setCreating(false);
            await groupsApi.reload();
            if (g.googleGroup && !assigned.includes(g.googleGroup)) setDraft([...assigned, g.googleGroup]);
          }}
        />
      </Modal>
    </>
  );
}
