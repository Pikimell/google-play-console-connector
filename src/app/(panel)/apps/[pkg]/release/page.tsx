"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, FlaskConical, Globe, Lock, Rocket, Users } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { BuildUploader, ExistingBuildPicker, optInLink, ReleaseNotesEditor, type UploadedBuild } from "@/components/release-parts";
import { Alert, Badge, Button, Card, ChoiceCard, CopyButton, ErrorBox, Field, Input, LinkButton, PageHeader, Spinner, Stepper, WizardFooter } from "@/components/ui";
import { api, enc, errorInfo } from "@/lib/client";
import { primaryRelease, STANDARD_TRACKS, STATUS_LABEL, trackInfo, trackSortKey } from "@/lib/tracks";
import type { ReleaseNote } from "@/lib/types";

const STEPS = ["Збірка", "Куди публікуємо", "Опис змін", "Перевірка"];

type Status = "completed" | "inProgress" | "draft";

const TRACK_ICON = { internal: Lock, closed: Users, open: Globe, production: Rocket } as const;

function ReleaseWizard() {
  const { data, loading, pkg, reload } = useApp();
  const search = useSearchParams();
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<"upload" | "existing">("upload");
  const [uploaded, setUploaded] = useState<UploadedBuild>();
  const [existingCode, setExistingCode] = useState<number>();
  const [track, setTrack] = useState(search.get("track") ?? "");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState<ReleaseNote[]>();
  const [status, setStatus] = useState<Status>("completed");
  const [percent, setPercent] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof errorInfo>>();
  const [result, setResult] = useState<{ sentForReview: boolean }>();

  // Незакомічений edit з файлом видаляємо, якщо користувач пішов зі сторінки
  const openEdit = useRef<string | null>(null);
  useEffect(() => {
    openEdit.current = uploaded && !result ? uploaded.editId : null;
  }, [uploaded, result]);
  useEffect(() => {
    const drop = () => {
      if (openEdit.current) {
        void fetch(`/api/apps/${enc(pkg)}/edits/${enc(openEdit.current)}`, { method: "DELETE", keepalive: true });
        openEdit.current = null;
      }
    };
    window.addEventListener("pagehide", drop);
    return () => {
      window.removeEventListener("pagehide", drop);
      drop();
    };
  }, [pkg]);

  if (loading && !data) return <Spinner />;
  const overview = data?.overview;
  const defaultLang = overview?.defaultLanguage || "uk";
  const releaseNotes = notes ?? [{ language: defaultLang, text: "" }];

  const allTracks = new Map((overview?.tracks ?? []).map((t) => [t.track, t]));
  for (const t of STANDARD_TRACKS) if (!allTracks.has(t)) allTracks.set(t, { track: t, releases: [] });
  const trackList = [...allTracks.values()].filter((t) => !t.track.includes(":")).sort((a, b) => trackSortKey(b.track) - trackSortKey(a.track));
  const info = track ? trackInfo(track) : null;
  const versionCode = source === "upload" ? uploaded?.versionCode : existingCode;
  const effectiveStatus: Status = info?.kind !== "production" && status === "inProgress" ? "completed" : status;

  function resetUpload() {
    if (uploaded) void api(`/api/apps/${enc(pkg)}/edits/${enc(uploaded.editId)}`, { method: "DELETE" }).catch(() => {});
    setUploaded(undefined);
  }

  async function publish() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api<{ sentForReview: boolean }>(`/api/apps/${enc(pkg)}/releases`, {
        method: "POST",
        json: {
          editId: source === "upload" ? uploaded?.editId : undefined,
          track,
          versionCodes: [String(versionCode)],
          name: name.trim() || undefined,
          status: effectiveStatus,
          userFraction: effectiveStatus === "inProgress" ? percent / 100 : undefined,
          releaseNotes: releaseNotes.filter((n) => n.text.trim()),
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
    const testing = info?.kind === "closed" || info?.kind === "open" || info?.kind === "internal";
    return (
      <Card className="max-w-3xl p-8">
        <CheckCircle2 className="mb-3 size-12 text-emerald-600" />
        <h2 className="text-xl font-semibold">{effectiveStatus === "draft" ? "Чернетку релізу збережено" : "Реліз створено!"}</h2>
        <p className="mt-1 text-gray-600">
          versionCode {versionCode} → <b>{info?.label}</b> · {STATUS_LABEL[effectiveStatus]}
          {effectiveStatus === "inProgress" && ` (${percent}%)`}
        </p>
        <div className="mt-5 space-y-3">
          {effectiveStatus === "draft" ? (
            <Alert tone="info">Чернетку видно в Play Console. Щоб її опублікувати, відкрий трек у Play Console → «Редагувати реліз» → «Перевірити реліз» → «Почати розгортання».</Alert>
          ) : result.sentForReview ? (
            <Alert tone="success">
              Зміни відправлено в Google Play. {info?.kind === "internal" ? "Внутрішнє тестування зазвичай доступне за кілька хвилин." : "Якщо потрібна перевірка Google — вона зазвичай триває від кількох годин до кількох днів."}
            </Alert>
          ) : (
            <Alert tone="warning" title="Потрібно вручну відправити на перевірку">
              Google не дозволив автоматично відправити зміни на перевірку (наприклад, увімкнена «Керована публікація» або попередню версію відхилено). Відкрий Play Console → «Огляд публікації» → «Надіслати зміни на перевірку».
            </Alert>
          )}
          {testing && info?.kind !== "internal" && (
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="mb-1 text-sm font-medium">Посилання для тестувальників</div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-gray-100 px-2 py-1 text-sm break-all">{optInLink(pkg)}</code>
                <CopyButton text={optInLink(pkg)} />
              </div>
              <p className="mt-2 text-xs text-gray-500">Тестувальник відкриває посилання з того Google-акаунта, який є у списку, натискає «Стати тестувальником» і встановлює застосунок з Google Play.</p>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <LinkButton href={`/apps/${enc(pkg)}`}>До огляду</LinkButton>
          {info?.kind === "closed" && <LinkButton variant="secondary" href={`/apps/${enc(pkg)}/testing/${enc(track)}`} icon={<Users className="size-4" />}>Тестувальники</LinkButton>}
          <Button variant="ghost" onClick={() => window.location.assign(`/apps/${enc(pkg)}/release`)}>Ще одна версія</Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <PageHeader title="Нова версія" description="Чотири кроки: файл → трек → опис змін → публікація." />
      <Stepper steps={STEPS} current={step} />
      <Card className="max-w-3xl p-6">
        {step === 0 && (
          <>
            <h2 className="mb-4 text-lg font-semibold">Яку збірку публікуємо?</h2>
            <div className="mb-5 grid gap-2 sm:grid-cols-2">
              <ChoiceCard selected={source === "upload"} onClick={() => setSource("upload")} title="Завантажити новий файл" description="AAB або APK з комп'ютера" />
              <ChoiceCard selected={source === "existing"} onClick={() => { resetUpload(); setSource("existing"); }} title="Вже завантажена збірка" description="Наприклад, перенести з тестування в production" />
            </div>
            {source === "upload" ? (
              <BuildUploader pkg={pkg} value={uploaded} onUploaded={setUploaded} onReset={resetUpload} />
            ) : (
              <ExistingBuildPicker pkg={pkg} value={existingCode} onChange={setExistingCode} />
            )}
            <WizardFooter>
              <Button disabled={!versionCode} onClick={() => setStep(1)}>Далі →</Button>
            </WizardFooter>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="mb-1 text-lg font-semibold">Куди публікуємо?</h2>
            <p className="mb-4 text-sm text-gray-600">Зазвичай шлях такий: внутрішнє → закрите → (відкрите) → робоча версія.</p>
            <div className="space-y-2">
              {trackList.map((t) => {
                const ti = trackInfo(t.track);
                const Icon = TRACK_ICON[ti.kind];
                const current = primaryRelease(t.releases);
                return (
                  <ChoiceCard
                    key={t.track}
                    selected={track === t.track}
                    onClick={() => setTrack(t.track)}
                    icon={<Icon className="size-5" />}
                    title={ti.label}
                    badge={current ? <Badge tone="gray">зараз: {current.name || `code ${current.versionCodes.join(",")}`}</Badge> : undefined}
                    description={ti.description}
                  />
                );
              })}
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Потрібен окремий трек закритого тестування (наприклад для клієнта)?{" "}
              <a className="font-medium text-brand-700 hover:underline" href={`/apps/${enc(pkg)}/testing/new`}>
                <FlaskConical className="inline size-3.5" /> Створити
              </a>
            </p>
            <WizardFooter onBack={() => setStep(0)}>
              <Button disabled={!track} onClick={() => setStep(2)}>Далі →</Button>
            </WizardFooter>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="mb-4 text-lg font-semibold">Опис змін</h2>
            <div className="space-y-5">
              <Field label="Назва релізу" hint="Видно лише тобі в Play Console. Якщо залишити порожнім — Google візьме versionName зі збірки.">
                <Input placeholder={`Наприклад: 1.4.0 (${versionCode})`} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <ReleaseNotesEditor value={releaseNotes} onChange={setNotes} />
              <div>
                <div className="mb-2 text-sm font-medium text-gray-800">Як публікувати</div>
                <div className="space-y-2">
                  <ChoiceCard selected={effectiveStatus === "completed"} onClick={() => setStatus("completed")} title="Опублікувати одразу" description={info?.kind === "production" ? "Для всіх користувачів після перевірки Google" : "Для всіх тестувальників цього треку"} />
                  {info?.kind === "production" && (
                    <ChoiceCard selected={effectiveStatus === "inProgress"} onClick={() => setStatus("inProgress")} title="Поступове розгортання" description="Спершу лише частина користувачів. Відсоток можна збільшувати пізніше на сторінці «Релізи й треки»." />
                  )}
                  <ChoiceCard selected={effectiveStatus === "draft"} onClick={() => setStatus("draft")} title="Зберегти як чернетку" description="Нічого не публікується. Обов'язково для застосунків, які ще ні разу не публікувались." />
                </div>
                {effectiveStatus === "inProgress" && (
                  <div className="mt-4 rounded-xl bg-gray-50 p-4">
                    <div className="mb-2 flex justify-between text-sm"><span>Частка користувачів</span><b>{percent}%</b></div>
                    <input type="range" min={1} max={99} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="w-full accent-brand-600" />
                    <div className="mt-2 flex gap-2">
                      {[1, 5, 10, 20, 50].map((p) => (
                        <button key={p} type="button" onClick={() => setPercent(p)} className="rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs hover:border-brand-500">{p}%</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <WizardFooter onBack={() => setStep(1)}>
              <Button disabled={releaseNotes.some((n) => n.text.length > 500)} onClick={() => setStep(3)}>Далі →</Button>
            </WizardFooter>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="mb-4 text-lg font-semibold">Перевір і публікуй</h2>
            <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm">
              {[
                ["Застосунок", overview?.title ? `${overview.title} (${pkg})` : pkg],
                ["Збірка", `versionCode ${versionCode}${uploaded && source === "upload" ? ` · ${uploaded.fileName}` : ""}`],
                ["Трек", info?.label],
                ["Назва релізу", name.trim() || "автоматично (versionName)"],
                ["Публікація", `${STATUS_LABEL[effectiveStatus]}${effectiveStatus === "inProgress" ? ` · ${percent}%` : ""}`],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-4 px-4 py-2.5">
                  <dt className="w-36 shrink-0 text-gray-500">{k}</dt>
                  <dd className="min-w-0 font-medium break-words text-gray-900">{v}</dd>
                </div>
              ))}
              <div className="flex gap-4 px-4 py-2.5">
                <dt className="w-36 shrink-0 text-gray-500">Що нового</dt>
                <dd className="min-w-0 space-y-2">
                  {releaseNotes.filter((n) => n.text.trim()).length === 0 ? (
                    <span className="text-amber-700">не заповнено</span>
                  ) : (
                    releaseNotes.filter((n) => n.text.trim()).map((n) => (
                      <div key={n.language}>
                        <Badge>{n.language}</Badge>
                        <p className="mt-1 whitespace-pre-line text-gray-800">{n.text}</p>
                      </div>
                    ))
                  )}
                </dd>
              </div>
            </dl>
            {info?.kind === "production" && effectiveStatus !== "draft" && (
              <Alert tone="warning" className="mt-4">Це <b>робоча версія</b> — після перевірки Google її отримають реальні користувачі.</Alert>
            )}
            <ErrorBox error={error} className="mt-4" />
            <WizardFooter onBack={() => setStep(2)}>
              <Button size="lg" loading={busy} onClick={publish} icon={<Rocket className="size-4" />}>
                {effectiveStatus === "draft" ? "Зберегти чернетку" : "Опублікувати"}
              </Button>
            </WizardFooter>
          </>
        )}
      </Card>
    </>
  );
}

export default function ReleasePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReleaseWizard />
    </Suspense>
  );
}
