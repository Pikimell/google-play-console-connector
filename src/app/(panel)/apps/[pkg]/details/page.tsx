"use client";
import { useState } from "react";
import { useApp } from "@/components/apps-context";
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import { api, enc, errorInfo, type ErrInfo } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import { LANGUAGES } from "@/lib/tracks";
import type { AppDetails } from "@/lib/types";

export default function DetailsPage() {
  const { pkg, reload: reloadApp } = useApp();
  const toast = useToast();
  const url = `/api/apps/${enc(pkg)}/details`;
  const { data, error, loading, reload } = useApi<AppDetails>(url);
  const [form, setForm] = useState<AppDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<ErrInfo>();
  const v = form ?? data;
  const set = (p: Partial<AppDetails>) => setForm({ ...(v ?? {}), ...p });

  async function save() {
    if (!v) return;
    setBusy(true);
    setSaveError(undefined);
    try {
      await api(url, { method: "PUT", json: v });
      toast("success", "Контакти збережено");
      setForm(null);
      await reload();
      void reloadApp();
    } catch (e) {
      setSaveError(errorInfo(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Контакти й мова" description="Контактні дані розробника, які бачать користувачі в Google Play." />
      <ErrorBox error={error} onRetry={reload} className="mb-4" />
      {loading && !data ? (
        <Skeleton className="h-72 max-w-2xl" />
      ) : v ? (
        <Card className="max-w-2xl space-y-5 p-6">
          <Field label="Мова за замовчуванням" hint="Основна мова сторінки в магазині. Має існувати опис цією мовою.">
            <Select value={v.defaultLanguage} onChange={(e) => set({ defaultLanguage: e.target.value })}>
              {!LANGUAGES.some((l) => l.code === v.defaultLanguage) && v.defaultLanguage && <option value={v.defaultLanguage}>{v.defaultLanguage}</option>}
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
            </Select>
          </Field>
          <Field label="Email для зв'язку" hint="Обов'язкове поле. Видно всім користувачам.">
            <Input type="email" value={v.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
          </Field>
          <Field label="Телефон">
            <Input value={v.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="+380…" />
          </Field>
          <Field label="Веб-сайт">
            <Input value={v.contactWebsite} onChange={(e) => set({ contactWebsite: e.target.value })} placeholder="https://" />
          </Field>
          <ErrorBox error={saveError} />
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            {form && <Button variant="ghost" onClick={() => setForm(null)}>Скасувати</Button>}
            <Button disabled={!form} loading={busy} onClick={save}>Зберегти в Google Play</Button>
          </div>
        </Card>
      ) : null}
    </>
  );
}
