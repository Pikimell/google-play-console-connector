"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Languages, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { Alert, Badge, Button, Card, ErrorBox, Field, Input, LinkButton, Modal, PageHeader, Select, Skeleton, Textarea, cn, useToast } from "@/components/ui";
import { api, enc, errorInfo, type ErrInfo } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import { LANGUAGES, languageName } from "@/lib/tracks";
import type { Listing } from "@/lib/types";

type Data = { defaultLanguage?: string; listings: Listing[] };

function ListingEditor() {
  const { pkg, reload: reloadApp } = useApp();
  const toast = useToast();
  const url = `/api/apps/${enc(pkg)}/listings`;
  const { data, error, loading, reload } = useApi<Data>(url);
  const search = useSearchParams();
  const [lang, setLang] = useState<string | undefined>(search.get("lang") ?? undefined);
  const status = useApi<{ openai: { configured: boolean } }>("/api/status");
  const [translating, setTranslating] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, Listing>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<ErrInfo>();
  const [adding, setAdding] = useState(false);
  const [newLang, setNewLang] = useState("");
  const [extra, setExtra] = useState<string[]>([]);

  const listings = data?.listings ?? [];
  const languages = [...new Set([...listings.map((l) => l.language), ...extra])].sort((a, b) => (a === data?.defaultLanguage ? -1 : b === data?.defaultLanguage ? 1 : a.localeCompare(b)));
  const current = lang ?? data?.defaultLanguage ?? languages[0];
  const original = listings.find((l) => l.language === current) ?? { language: current ?? "", title: "", shortDescription: "", fullDescription: "", video: "" };
  const form = (current && edits[current]) || original;
  const dirty = !!current && !!edits[current] && JSON.stringify(edits[current]) !== JSON.stringify(original);
  const set = (patch: Partial<Listing>) => current && setEdits({ ...edits, [current]: { ...form, ...patch } });

  // Джерело для перекладу: англійська (en-US), а якщо редагуємо її саму — основна мова
  const translateFrom = listings.find((l) => l.language === "en-US" && l.language !== current) ?? listings.find((l) => l.language === data?.defaultLanguage && l.language !== current);

  async function translate() {
    if (!translateFrom || !current) return;
    if (dirty && !confirm("Замінити незбережені зміни перекладом?")) return;
    setTranslating(true);
    setSaveError(undefined);
    setWarnings([]);
    try {
      const res = await api<{ translation: Partial<Listing>; warnings: string[] }>("/api/translate", {
        method: "POST",
        json: { source: translateFrom, target: current },
      });
      setEdits({ ...edits, [current]: { ...form, ...res.translation, video: form.video || translateFrom.video || "" } });
      setWarnings(res.warnings);
      toast("info", "Переклад готовий — перевір і натисни «Зберегти в Google Play»");
    } catch (e) {
      setSaveError(errorInfo(e));
    } finally {
      setTranslating(false);
    }
  }

  async function save() {
    setBusy(true);
    setSaveError(undefined);
    try {
      await api(url, { method: "PUT", json: form });
      toast("success", `Опис (${languageName(form.language)}) збережено в Google Play`);
      const { [form.language]: _, ...rest } = edits;
      void _;
      setEdits(rest);
      await reload();
      void reloadApp();
    } catch (e) {
      setSaveError(errorInfo(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeLang() {
    if (!current || !confirm(`Видалити переклад «${languageName(current)}» з Google Play?`)) return;
    try {
      if (listings.some((l) => l.language === current)) await api(`${url}?language=${enc(current)}`, { method: "DELETE" });
      setExtra(extra.filter((x) => x !== current));
      setLang(undefined);
      toast("success", "Переклад видалено");
      await reload();
    } catch (e) {
      toast("error", errorInfo(e).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Опис у магазині"
        description="Назва та описи на сторінці застосунку в Google Play — для кожної мови окремо."
        actions={<LinkButton variant="secondary" href={`/apps/${enc(pkg)}/localize`} icon={<Languages className="size-4" />}>Перекласти на багато мов</LinkButton>}
      />
      <ErrorBox error={error} onRetry={reload} className="mb-4" />
      {loading && !data ? (
        <Skeleton className="h-96" />
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="space-y-1">
            {languages.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm", l === current ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-gray-100")}
              >
                <span className="truncate">{languageName(l)}</span>
                {l === data.defaultLanguage ? <Badge tone="green">основна</Badge> : edits[l] ? <span className="size-2 rounded-full bg-amber-500" /> : null}
              </button>
            ))}
            <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Додати мову</Button>
          </div>

          {current && (
            <Card className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{languageName(current)} <span className="font-mono text-xs text-gray-400">{current}</span></h2>
                <div className="flex flex-wrap gap-1.5">
                  {translateFrom && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={translating}
                      disabled={!status.data?.openai.configured}
                      title={status.data?.openai.configured ? undefined : "Підключи OpenAI на сторінці «Підключення»"}
                      icon={<Languages className="size-3.5" />}
                      onClick={translate}
                    >
                      Перекласти з {languageName(translateFrom.language)}
                    </Button>
                  )}
                  {current !== data.defaultLanguage && <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={removeLang}>Видалити</Button>}
                </div>
              </div>
              {warnings.length > 0 && <Alert tone="warning">{warnings.join(" ")}</Alert>}
              <Field label="Назва застосунку" counter={{ value: form.title?.length ?? 0, max: 30 }}>
                <Input value={form.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="Короткий опис" counter={{ value: form.shortDescription?.length ?? 0, max: 80 }} hint="Показується під назвою. Одне речення про головну користь.">
                <Input value={form.shortDescription} onChange={(e) => set({ shortDescription: e.target.value })} />
              </Field>
              <Field label="Повний опис" counter={{ value: form.fullDescription?.length ?? 0, max: 4000 }}>
                <Textarea rows={14} value={form.fullDescription} onChange={(e) => set({ fullDescription: e.target.value })} />
              </Field>
              <Field label="Відео YouTube (необов'язково)" hint="Посилання на публічне або неопубліковане відео, без реклами.">
                <Input value={form.video} onChange={(e) => set({ video: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" />
              </Field>
              <ErrorBox error={saveError} />
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                {dirty && <Button variant="ghost" onClick={() => { const { [current]: _, ...rest } = edits; void _; setEdits(rest); }}>Скасувати зміни</Button>}
                <Button disabled={!dirty} loading={busy} onClick={save}>Зберегти в Google Play</Button>
              </div>
            </Card>
          )}
        </div>
      ) : null}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Додати мову"
        footer={<Button disabled={!newLang} onClick={() => { setExtra([...extra, newLang]); setLang(newLang); setAdding(false); setNewLang(""); }}>Додати</Button>}
      >
        <Select value={newLang} onChange={(e) => setNewLang(e.target.value)}>
          <option value="">Обери мову…</option>
          {LANGUAGES.filter((l) => !languages.includes(l.code)).map((l) => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
        </Select>
        <p className="mt-2 text-xs text-gray-500">Переклад з&apos;явиться в Google Play після збереження.</p>
      </Modal>
    </>
  );
}

export default function ListingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ListingEditor />
    </Suspense>
  );
}
