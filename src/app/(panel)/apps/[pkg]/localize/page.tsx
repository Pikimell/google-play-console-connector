"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Languages, Loader2, Pencil, RotateCw, Search, XCircle } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { Alert, Badge, Button, Card, ErrorBox, Input, LinkButton, PageHeader, SectionTitle, Select, Skeleton, cn, useToast } from "@/components/ui";
import { api, enc, errorInfo, type ErrInfo } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import { LANGUAGES, languageName } from "@/lib/tracks";
import type { Listing } from "@/lib/types";

type Field = "title" | "shortDescription" | "fullDescription";
type JobState = "waiting" | "translating" | "translated" | "saving" | "saved" | "error";
type Job = { state: JobState; error?: ErrInfo; warnings?: string[] };
type Status = { openai: { configured: boolean; model: string } };

const FIELD_LABELS: Record<Field, string> = { title: "Назва", shortDescription: "Короткий опис", fullDescription: "Повний опис" };
const POPULAR = ["de-DE", "fr-FR", "es-ES", "es-419", "it-IT", "pt-BR", "pl-PL", "uk", "tr-TR", "ja-JP", "ko-KR", "zh-CN"];
const CONCURRENCY = 3;

export default function LocalizePage() {
  const { pkg } = useApp();
  const toast = useToast();
  const url = `/api/apps/${enc(pkg)}/listings`;
  const listingsApi = useApi<{ defaultLanguage?: string; listings: Listing[] }>(url);
  const status = useApi<Status>("/api/status");
  const [sourceLang, setSourceLang] = useState<string>();
  const [targets, setTargets] = useState<string[]>([]);
  const [fields, setFields] = useState<Field[]>(["title", "shortDescription", "fullDescription"]);
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [running, setRunning] = useState(false);

  const listings = listingsApi.data?.listings ?? [];
  const existing = new Set(listings.map((l) => l.language));
  const source =
    listings.find((l) => l.language === sourceLang) ??
    listings.find((l) => l.language === "en-US") ??
    listings.find((l) => l.language === listingsApi.data?.defaultLanguage) ??
    listings[0];
  const openaiReady = status.data?.openai.configured;
  const visibleLangs = LANGUAGES.filter((l) => l.code !== source?.language && (!query || `${l.name} ${l.en} ${l.code}`.toLowerCase().includes(query.toLowerCase())));
  const toggleTarget = (c: string) => setTargets((t) => (t.includes(c) ? t.filter((x) => x !== c) : [...t, c]));
  const setJob = (lang: string, j: Job) => setJobs((all) => ({ ...all, [lang]: j }));

  /** Перекласти мови (по 3 паралельно), потім зберегти всі вдалі переклади одним комітом у Google Play. */
  async function run(langs: string[]) {
    if (!source || !langs.length) return;
    const overwrite = langs.filter((l) => existing.has(l));
    if (overwrite.length > 1 && !confirm(`${overwrite.length} мов вже мають опис (${overwrite.map(languageName).join(", ")}). Перезаписати їх перекладом?`)) return;
    setRunning(true);
    setJobs((all) => ({ ...all, ...Object.fromEntries(langs.map((l) => [l, { state: "waiting" } as Job])) }));

    const done: Listing[] = [];
    const queue = [...langs];
    async function worker() {
      for (let lang = queue.shift(); lang; lang = queue.shift()) {
        setJob(lang, { state: "translating" });
        try {
          const res = await api<{ translation: Partial<Listing>; warnings: string[] }>("/api/translate", {
            method: "POST",
            json: { source, target: lang, fields },
          });
          const prev = listings.find((l) => l.language === lang);
          done.push({
            language: lang,
            title: res.translation.title ?? prev?.title ?? "",
            shortDescription: res.translation.shortDescription ?? prev?.shortDescription ?? "",
            fullDescription: res.translation.fullDescription ?? prev?.fullDescription ?? "",
            video: prev?.video || source!.video || "",
          });
          setJob(lang, { state: "translated", warnings: res.warnings });
        } catch (e) {
          setJob(lang, { state: "error", error: errorInfo(e) });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, langs.length) }, worker));

    if (done.length) {
      setJobs((all) => ({ ...all, ...Object.fromEntries(done.map((l) => [l.language, { ...all[l.language], state: "saving" as JobState }])) }));
      try {
        await api(url, { method: "PUT", json: done });
        setJobs((all) => ({ ...all, ...Object.fromEntries(done.map((l) => [l.language, { ...all[l.language], state: "saved" as JobState }])) }));
        toast("success", `Збережено в Google Play: ${done.length} ${done.length === 1 ? "мова" : "мов(и)"}`);
        setTargets((t) => t.filter((x) => !done.some((d) => d.language === x)));
        await listingsApi.reload();
      } catch (e) {
        const err = errorInfo(e);
        setJobs((all) => ({ ...all, ...Object.fromEntries(done.map((l) => [l.language, { state: "error" as JobState, error: err }])) }));
      }
    }
    setRunning(false);
  }

  const jobList = Object.entries(jobs);

  return (
    <>
      <PageHeader
        title="Локалізація"
        description="Автоматичний переклад опису в магазині через OpenAI. Обираєш оригінал і мови — переклади одразу зберігаються в Google Play."
        actions={<LinkButton variant="secondary" href={`/apps/${enc(pkg)}/listing`} icon={<Pencil className="size-4" />}>Ручне редагування</LinkButton>}
      />

      {status.data && !openaiReady && (
        <Alert tone="warning" className="mb-4" title="OpenAI не підключено" action={<LinkButton size="sm" href="/setup">Підключити</LinkButton>}>
          Додай OPENAI_API_KEY у .env.local — інструкція на сторінці «Підключення».
        </Alert>
      )}
      <ErrorBox error={listingsApi.error} onRetry={listingsApi.reload} className="mb-4" />

      {listingsApi.loading && !listingsApi.data ? (
        <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-72" /></div>
      ) : !source ? (
        <Alert tone="info" title="Спершу заповни опис хоча б однією мовою">
          <Link href={`/apps/${enc(pkg)}/listing`}>Опис у магазині →</Link>
        </Alert>
      ) : (
        <div className="space-y-4">
          {/* 1. Оригінал */}
          <Card className="p-5">
            <SectionTitle aside={status.data?.openai.configured && <Badge tone="violet">модель {status.data.openai.model}</Badge>}>1. Мова оригіналу</SectionTitle>
            <div className="flex flex-wrap items-start gap-4">
              <Select value={source.language} onChange={(e) => setSourceLang(e.target.value)} className="w-64">
                {listings.map((l) => (
                  <option key={l.language} value={l.language}>{languageName(l.language)} ({l.language})</option>
                ))}
              </Select>
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-semibold">{source.title || <span className="text-amber-700">без назви</span>}</div>
                <div className="truncate text-gray-600">{source.shortDescription}</div>
                <div className="text-xs text-gray-400">Повний опис: {source.fullDescription?.length ?? 0} символів</div>
              </div>
            </div>
          </Card>

          {/* 2. Мови перекладу */}
          <Card className="p-5">
            <SectionTitle aside={<span className="text-sm text-gray-500">Обрано: <b className="text-gray-900">{targets.length}</b></span>}>2. На які мови перекласти</SectionTitle>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Пошук мови…" className="pl-9" />
              </div>
              <Button size="sm" variant="secondary" onClick={() => setTargets([...new Set([...targets, ...POPULAR.filter((c) => c !== source.language)])])}>+ Популярні</Button>
              <Button size="sm" variant="secondary" disabled={listings.length < 2} onClick={() => setTargets(listings.map((l) => l.language).filter((c) => c !== source.language))}>
                Усі наявні ({Math.max(0, listings.length - 1)})
              </Button>
              {targets.length > 0 && <Button size="sm" variant="ghost" onClick={() => setTargets([])}>Очистити</Button>}
            </div>
            <div className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border border-gray-100 p-1 sm:grid-cols-2 lg:grid-cols-3">
              {visibleLangs.map((l) => {
                const on = targets.includes(l.code);
                return (
                  <label key={l.code} className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm", on ? "bg-brand-50" : "hover:bg-gray-50")}>
                    <input type="checkbox" checked={on} onChange={() => toggleTarget(l.code)} className="size-4 accent-brand-600" />
                    <span className="min-w-0 flex-1 truncate">{l.name}</span>
                    {existing.has(l.code) && <Badge tone="green" className="shrink-0">є</Badge>}
                    <span className="shrink-0 font-mono text-[11px] text-gray-400">{l.code}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-sm font-medium text-gray-700">Що перекладати:</span>
              {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
                <label key={f} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={fields.includes(f)} onChange={() => setFields(fields.includes(f) ? fields.filter((x) => x !== f) : [...fields, f])} className="size-4 accent-brand-600" />
                  {FIELD_LABELS[f]}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
              <Button size="lg" icon={<Languages className="size-4" />} loading={running} disabled={!openaiReady || !targets.length || !fields.length} onClick={() => run(targets)}>
                Перекласти й зберегти{targets.length ? ` (${targets.length})` : ""}
              </Button>
            </div>
          </Card>

          {/* Прогрес */}
          {jobList.length > 0 && (
            <Card className="p-5">
              <SectionTitle aside={!running && <Button size="sm" variant="ghost" onClick={() => setJobs({})}>Очистити</Button>}>Хід перекладу</SectionTitle>
              <div className="divide-y divide-gray-100">
                {jobList.map(([lang, j]) => (
                  <div key={lang} className="flex flex-wrap items-start gap-3 py-2 text-sm">
                    <JobIcon state={j.state} />
                    <span className="w-48 shrink-0 font-medium">{languageName(lang)}</span>
                    <span className="min-w-0 flex-1 text-gray-600">
                      {j.state === "error" ? (
                        <span className="text-red-700">{j.error?.message}{j.error?.hint && <span className="block text-xs text-red-600">{j.error.hint}</span>}</span>
                      ) : (
                        JOB_TEXT[j.state]
                      )}
                      {j.warnings?.map((w) => <span key={w} className="block text-xs text-amber-700"><AlertTriangle className="mr-1 inline size-3" />{w}</span>)}
                    </span>
                    {j.state === "error" && !running && <Button size="sm" variant="secondary" icon={<RotateCw className="size-3.5" />} onClick={() => run([lang])}>Ще раз</Button>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 3. Наявні локалізації */}
          <Card className="p-5">
            <SectionTitle>Наявні локалізації ({listings.length})</SectionTitle>
            <div className="divide-y divide-gray-100">
              {listings.map((l) => {
                const isSource = l.language === source.language;
                const j = jobs[l.language];
                const busy = j && ["waiting", "translating", "saving"].includes(j.state);
                return (
                  <div key={l.language} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="w-44 shrink-0">
                      <div className="text-sm font-medium">{languageName(l.language)}</div>
                      <div className="font-mono text-[11px] text-gray-400">{l.language}</div>
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="truncate">{l.title || <span className="text-gray-400">—</span>}</div>
                      <div className="truncate text-xs text-gray-500">{l.shortDescription}</div>
                    </div>
                    {isSource ? (
                      <Badge tone="violet">оригінал</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" loading={busy} disabled={!openaiReady || running || !fields.length} icon={<Languages className="size-3.5" />} onClick={() => run([l.language])}>
                        Перекласти з {languageName(source.language)}
                      </Button>
                    )}
                    <LinkButton size="sm" variant="ghost" href={`/apps/${enc(pkg)}/listing?lang=${enc(l.language)}`} icon={<Pencil className="size-3.5" />} aria-label="Редагувати" />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

const JOB_TEXT: Record<JobState, string> = {
  waiting: "У черзі…",
  translating: "Перекладаю…",
  translated: "Перекладено, чекає збереження",
  saving: "Зберігаю в Google Play…",
  saved: "Збережено в Google Play",
  error: "",
};

function JobIcon({ state }: { state: JobState }) {
  if (state === "saved") return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />;
  if (state === "error") return <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />;
  if (state === "waiting") return <Circle className="mt-0.5 size-4 shrink-0 text-gray-300" />;
  if (state === "translated") return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gray-400" />;
  return <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-brand-600" />;
}
