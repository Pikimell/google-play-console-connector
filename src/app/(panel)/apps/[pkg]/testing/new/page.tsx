"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Plus, Users } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { BuildUploader, ExistingBuildPicker, optInLink, ReleaseNotesEditor, type UploadedBuild } from "@/components/release-parts";
import { CsvButton, GoogleGroupGuide, TesterGroupForm } from "@/components/tester-groups";
import { Alert, Badge, Button, Card, ChoiceCard, CopyButton, ErrorBox, Field, Input, LinkButton, Modal, PageHeader, Spinner, Stepper, WizardFooter, cn } from "@/components/ui";
import { api, enc, errorInfo, type ErrInfo } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import type { ReleaseNote, TesterGroup } from "@/lib/types";

const STEPS = ["Назва", "Тестувальники", "Збірка", "Створення"];
const SUGGESTIONS = ["team", "qa", "client", "beta-testers", "friends"];

export default function NewClosedTestingPage() {
  const { data, pkg, reload } = useApp();
  const groupsApi = useApi<{ groups: TesterGroup[] }>("/api/tester-groups");
  const [step, setStep] = useState(0);
  const [trackMode, setTrackMode] = useState<"new" | "alpha">("new");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [buildMode, setBuildMode] = useState<"upload" | "existing" | "later">("upload");
  const [uploaded, setUploaded] = useState<UploadedBuild>();
  const [existingCode, setExistingCode] = useState<number>();
  const [notes, setNotes] = useState<ReleaseNote[]>();
  const [asDraft, setAsDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrInfo>();
  const [result, setResult] = useState<{ track: string; sentForReview: boolean }>();

  // прибрати незакомічений edit з файлом, якщо користувач пішов
  const openEdit = useRef<string | null>(null);
  useEffect(() => {
    openEdit.current = uploaded && !result ? uploaded.editId : null;
  }, [uploaded, result]);
  useEffect(() => {
    const drop = () => {
      if (openEdit.current) void fetch(`/api/apps/${enc(pkg)}/edits/${enc(openEdit.current)}`, { method: "DELETE", keepalive: true });
      openEdit.current = null;
    };
    window.addEventListener("pagehide", drop);
    return () => {
      window.removeEventListener("pagehide", drop);
      drop();
    };
  }, [pkg]);

  const groups = groupsApi.data?.groups ?? [];
  const chosen = groups.filter((g) => selected.includes(g.id));
  const withoutGG = chosen.filter((g) => !g.googleGroup);
  const existingTracks = new Set((data?.overview.tracks ?? []).map((t) => t.track.toLowerCase()));
  const trimmed = name.trim();
  const nameError =
    trackMode === "new" && trimmed
      ? !/^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,49}$/.test(trimmed)
        ? "Лише латинські літери, цифри, пробіл, «-» і «_» (до 50 символів)."
        : existingTracks.has(trimmed.toLowerCase())
          ? "Трек з такою назвою вже існує."
          : undefined
      : undefined;
  const trackLabel = trackMode === "alpha" ? "Закрите тестування (Alpha)" : trimmed;
  const versionCode = buildMode === "upload" ? uploaded?.versionCode : buildMode === "existing" ? existingCode : undefined;
  const releaseNotes = notes ?? [{ language: data?.overview.defaultLanguage || "uk", text: "" }];

  function resetUpload() {
    if (uploaded) void api(`/api/apps/${enc(pkg)}/edits/${enc(uploaded.editId)}`, { method: "DELETE" }).catch(() => {});
    setUploaded(undefined);
  }

  async function create() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api<{ track: string; sentForReview: boolean }>(`/api/apps/${enc(pkg)}/closed-testing`, {
        method: "POST",
        json: {
          newTrackName: trackMode === "new" ? trimmed : undefined,
          existingTrack: trackMode === "alpha" ? "alpha" : undefined,
          googleGroups: chosen.map((g) => g.googleGroup).filter(Boolean),
          editId: buildMode === "upload" ? uploaded?.editId : undefined,
          release: versionCode
            ? { versionCodes: [String(versionCode)], status: asDraft ? "draft" : "completed", releaseNotes: releaseNotes.filter((n) => n.text.trim()) }
            : undefined,
        },
      });
      setResult(res);
      void reload();
    } catch (e) {
      setError(errorInfo(e));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Card className="max-w-3xl p-8">
        <CheckCircle2 className="mb-3 size-12 text-emerald-600" />
        <h2 className="text-xl font-semibold">Закрите тестування «{result.track}» створено</h2>
        <ol className="mt-5 space-y-4 text-sm text-gray-700">
          {withoutGG.length > 0 && (
            <li className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 font-semibold text-amber-900">Додай email-список у Play Console (Google не дає зробити це через API)</div>
              <p className="mb-3 text-amber-900">
                Play Console → Тестування → Закрите тестування → «{result.track}» → вкладка «Тестувальники» → «Створити список email-адрес» → «Завантажити CSV».
              </p>
              <div className="flex flex-wrap gap-2">
                {withoutGG.map((g) => <CsvButton key={g.id} name={g.name} emails={g.emails} label={`CSV «${g.name}» (${g.emails.length})`} />)}
              </div>
            </li>
          )}
          {!versionCode && (
            <li className="rounded-xl border border-gray-200 p-4">
              <div className="mb-2 font-semibold">Завантаж збірку для тестувальників</div>
              <LinkButton size="sm" href={`/apps/${enc(pkg)}/release?track=${enc(result.track)}`}>Нова версія в цей трек</LinkButton>
            </li>
          )}
          {!result.sentForReview && (
            <Alert tone="warning">Відправ зміни на перевірку вручну: Play Console → «Огляд публікації» → «Надіслати зміни на перевірку».</Alert>
          )}
          <li className="rounded-xl border border-gray-200 p-4">
            <div className="mb-2 font-semibold">Надішли тестувальникам посилання</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-gray-100 px-2 py-1 break-all">{optInLink(pkg)}</code>
              <CopyButton text={optInLink(pkg)} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Посилання запрацює, коли реліз пройде перевірку Google (для закритого тестування зазвичай від кількох годин). Тестувальник відкриває його під своїм Google-акаунтом → «Стати тестувальником» → встановлює з Google Play.
            </p>
          </li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-2">
          <LinkButton href={`/apps/${enc(pkg)}/testing/${enc(result.track)}`} icon={<Users className="size-4" />}>Керувати тестувальниками</LinkButton>
          <LinkButton variant="secondary" href={`/apps/${enc(pkg)}/testing`}>Усі тестування</LinkButton>
        </div>
      </Card>
    );
  }

  const alphaHasRelease = (data?.overview.tracks ?? []).some((t) => t.track === "alpha" && t.releases.length > 0);

  return (
    <>
      <PageHeader title="Нове закрите тестування" description="Окремий трек зі своїми тестувальниками і своєю версією застосунку." />
      <Stepper steps={STEPS} current={step} />
      <Card className="max-w-3xl p-6">
        {step === 0 && (
          <>
            <h2 className="mb-4 text-lg font-semibold">Як назвемо тестування?</h2>
            <div className="space-y-2">
              <ChoiceCard selected={trackMode === "new"} onClick={() => setTrackMode("new")} title="Новий окремий трек" description="Наприклад, окремо для команди, окремо для клієнта." />
              {trackMode === "new" && (
                <div className="ml-8 space-y-2">
                  <Field label="Назва треку" hint="Бачиш лише ти (і в Play Console). Після створення змінити не можна.">
                    <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="client-beta" />
                  </Field>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.filter((s) => !existingTracks.has(s)).map((s) => (
                      <button key={s} type="button" onClick={() => setName(s)} className="rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs hover:border-brand-500">{s}</button>
                    ))}
                  </div>
                  {nameError && <p className="text-sm text-red-600">{nameError}</p>}
                </div>
              )}
              <ChoiceCard
                selected={trackMode === "alpha"}
                onClick={() => setTrackMode("alpha")}
                title="Стандартний трек «Закрите тестування (Alpha)»"
                description="Вже існує в кожному застосунку. Добре підходить, якщо закрите тестування одне."
                badge={alphaHasRelease ? <Badge tone="amber">вже має реліз</Badge> : undefined}
              />
            </div>
            <WizardFooter>
              <Button disabled={trackMode === "new" && (!trimmed || !!nameError)} onClick={() => setStep(1)}>Далі →</Button>
            </WizardFooter>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="mb-1 text-lg font-semibold">Хто тестує?</h2>
            <p className="mb-4 text-sm text-gray-600">Обери одну чи кілька груп. Групи зберігаються в панелі — їх можна використовувати і в інших застосунках.</p>
            {groupsApi.loading && !groupsApi.data ? (
              <Spinner />
            ) : (
              <div className="space-y-2">
                {groups.map((g) => {
                  const on = selected.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelected(on ? selected.filter((x) => x !== g.id) : [...selected, g.id])}
                      className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition", on ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-gray-200 hover:bg-gray-50")}
                    >
                      <input type="checkbox" readOnly checked={on} className="size-4 accent-brand-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{g.name}</span>
                        <span className="block truncate text-xs text-gray-500">{g.googleGroup ?? "без Google-групи — тестувальників треба буде додати CSV-файлом у Play Console"}</span>
                      </span>
                      <Badge>{g.emails.length} email</Badge>
                    </button>
                  );
                })}
                <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setCreatingGroup(true)}>Створити нову групу</Button>
              </div>
            )}
            {withoutGG.length > 0 && (
              <Alert tone="warning" className="mt-4">
                {withoutGG.map((g) => `«${g.name}»`).join(", ")} без Google-групи. Трек буде створено, а email-и потрібно буде один раз завантажити CSV-файлом у Play Console (панель дасть файл і покаже куди).
              </Alert>
            )}
            <div className="mt-4"><GoogleGroupGuide /></div>
            <WizardFooter onBack={() => setStep(0)}>
              {!selected.length && <Button variant="ghost" onClick={() => setStep(2)}>Пропустити</Button>}
              <Button disabled={!selected.length} onClick={() => setStep(2)}>Далі →</Button>
            </WizardFooter>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="mb-4 text-lg font-semibold">Яку версію отримають тестувальники?</h2>
            <div className="mb-5 grid gap-2 sm:grid-cols-3">
              <ChoiceCard selected={buildMode === "upload"} onClick={() => setBuildMode("upload")} title="Новий файл" />
              <ChoiceCard selected={buildMode === "existing"} onClick={() => { resetUpload(); setBuildMode("existing"); }} title="Вже завантажена" />
              <ChoiceCard selected={buildMode === "later"} onClick={() => { resetUpload(); setBuildMode("later"); }} title="Додам пізніше" />
            </div>
            {buildMode === "upload" && <BuildUploader pkg={pkg} value={uploaded} onUploaded={setUploaded} onReset={resetUpload} />}
            {buildMode === "existing" && <ExistingBuildPicker pkg={pkg} value={existingCode} onChange={setExistingCode} />}
            {versionCode && (
              <div className="mt-5 space-y-4">
                <ReleaseNotesEditor value={releaseNotes} onChange={setNotes} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} className="size-4 accent-brand-600" />
                  Зберегти реліз як чернетку (обов&apos;язково, якщо застосунок ще жодного разу не публікувався)
                </label>
              </div>
            )}
            <WizardFooter onBack={() => setStep(1)}>
              <Button disabled={buildMode !== "later" && !versionCode} onClick={() => setStep(3)}>Далі →</Button>
            </WizardFooter>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="mb-4 text-lg font-semibold">Усе правильно?</h2>
            <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm">
              <div className="flex gap-4 px-4 py-2.5"><dt className="w-36 shrink-0 text-gray-500">Трек</dt><dd className="font-medium">{trackLabel}</dd></div>
              <div className="flex gap-4 px-4 py-2.5">
                <dt className="w-36 shrink-0 text-gray-500">Тестувальники</dt>
                <dd className="space-y-1">
                  {chosen.length === 0 ? <span className="text-amber-700">не обрано — можна додати пізніше</span> : chosen.map((g) => (
                    <div key={g.id}>{g.name} <span className="text-gray-500">· {g.emails.length} email{g.googleGroup ? ` · ${g.googleGroup}` : " · через CSV"}</span></div>
                  ))}
                </dd>
              </div>
              <div className="flex gap-4 px-4 py-2.5">
                <dt className="w-36 shrink-0 text-gray-500">Збірка</dt>
                <dd className="font-medium">{versionCode ? `versionCode ${versionCode}${asDraft ? " · чернетка" : ""}` : "буде додано пізніше"}</dd>
              </div>
            </dl>
            <ErrorBox error={error} className="mt-4" />
            <WizardFooter onBack={() => setStep(2)}>
              <Button size="lg" loading={busy} onClick={create}>Створити тестування</Button>
            </WizardFooter>
          </>
        )}
      </Card>

      <Modal open={creatingGroup} onClose={() => setCreatingGroup(false)} title="Нова група тестувальників" wide>
        <TesterGroupForm
          submitLabel="Створити й обрати"
          onCancel={() => setCreatingGroup(false)}
          onSaved={async (g) => {
            setCreatingGroup(false);
            await groupsApi.reload();
            setSelected((s) => [...s, g.id]);
          }}
        />
      </Modal>
    </>
  );
}
