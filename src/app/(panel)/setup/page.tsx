"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CopyButton, Field, Input, PageHeader } from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { useApps } from "@/components/apps-context";
import { clearBrowserData, readSettings, saveSettings, settingsSnapshot, subscribeSettings } from "@/lib/browser-storage";
import { parseSettings, parseServiceAccount, type ConnectionSettings } from "@/lib/connection-settings";

type Status = {
  credentials: { ok: boolean; error?: string; email?: string; projectId?: string };
  token?: { ok: boolean; error?: string; hint?: string };
  openai: { configured: boolean; model: string; ok?: boolean; error?: string; hint?: string };
};
const ext = (href: string, text: string) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-brand-700 dark:text-emerald-300 hover:underline">{text} ↗</a>;

export default function SetupPage() {
  const { data, error, loading, reload } = useApi<Status>("/api/status?check=1");
  const apps = useApps();
  const snapshot = useSyncExternalStore(subscribeSettings, settingsSnapshot, () => "{}");
  const stored = useMemo(() => {
    try { return { settings: parseSettings(JSON.parse(snapshot)), error: undefined }; }
    catch { return { settings: {} as ConnectionSettings, error: "Не вдалося прочитати налаштування браузера. Перевір доступ до локального сховища або очисть дані кнопкою нижче." }; }
  }, [snapshot]);
  const settings = stored.settings;
  const [openaiKey, setOpenaiKey] = useState("");
  const [model, setModel] = useState<string>();
  const selectedModel = model ?? settings.openaiModel ?? "gpt-5-mini";
  const [message, setMessage] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  async function persist(next: ConnectionSettings) {
    saveSettings(next);
    setMessage("Збережено в цьому браузері.");
    await Promise.all([reload(), apps.reload()]);
  }

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setProblem(undefined); setMessage(undefined);
    try {
      if (file.size > 12000) throw new Error("Файл завеликий. Обери JSON-ключ сервісного акаунта (до 12 КБ).");
      const google = parseServiceAccount(JSON.parse(await file.text()));
      // Reject oversized credentials before they exceed HTTP header limits.
      if (new TextEncoder().encode(JSON.stringify(google)).length > 5500) throw new Error("JSON-ключ завеликий для підключення.");
      await persist({ ...readSettings(), google });
    } catch (e) { setProblem(e instanceof SyntaxError ? "Файл не є коректним JSON." : e instanceof Error ? e.message : "Не вдалося завантажити ключ."); }
    finally { setBusy(false); }
  }

  async function saveOpenAI(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setProblem(undefined); setMessage(undefined);
    try {
      const next = { ...readSettings(), openaiModel: selectedModel.trim(), openaiKey: openaiKey.trim() || settings.openaiKey };
      await persist(next);
      setOpenaiKey("");
    } catch (e) { setProblem(e instanceof Error ? e.message : "Не вдалося зберегти ключ."); }
    finally { setBusy(false); }
  }

  async function disconnect(kind: "google" | "openai") {
    setBusy(true); setProblem(undefined); setMessage(undefined);
    try {
      const next = { ...readSettings() };
      if (kind === "google") delete next.google;
      else { delete next.openaiKey; delete next.openaiModel; setOpenaiKey(""); setModel(undefined); }
      await persist(next);
    } catch (e) { setProblem(e instanceof Error ? e.message : "Не вдалося видалити ключ."); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader title="Підключення" description="Додай власні ключі та керуй Google Play із цього браузера. Реєстрація не потрібна."
      actions={<Button variant="secondary" loading={loading} disabled={busy} onClick={reload}>Перевірити підключення</Button>} />
    <div className="space-y-5">
      <Alert title="Налаштування зберігаються лише в цьому браузері">
        JSON-ключ і OpenAI-ключ зберігаються в локальному сховищі браузера та передаються серверу сайту для виконання запитів до Google й OpenAI.
        Сервер не записує їх у файли чи базу даних. Використовуй власний пристрій. Після очищення даних браузера ключі й списки потрібно додати знову.
      </Alert>
      {(problem || stored.error || error) && <Alert tone="error" title={problem || stored.error || error?.message} />}
      {message && <Alert tone="success" title={message} />}
      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">1. JSON-ключ Google Play</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">У Google Cloud створи сервісний акаунт, відкрий «Keys → Add key → Create new key → JSON» і завантаж отриманий файл тут.</p>
        <p className="text-sm">{ext("https://console.cloud.google.com/iam-admin/serviceaccounts", "Відкрити сервісні акаунти Google Cloud")}</p>
        <Field label={settings.google ? "Замінити JSON-ключ" : "Завантажити JSON-ключ"}>
          <Input type="file" accept=".json,application/json" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </Field>
        {settings.google && <>
          <div className="flex flex-wrap items-center gap-2 text-sm"><code className="break-all">{settings.google.client_email}</code><CopyButton text={settings.google.client_email} /></div>
          {data?.token?.ok && <Badge tone="green">Google видав токен доступу</Badge>}
          {data?.token?.ok === false && <Alert tone="error" title={data.token.error}>{data.token.hint}</Alert>}
          <Button variant="secondary" disabled={busy} onClick={() => disconnect("google")}>Видалити Google-ключ із браузера</Button>
        </>}
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="text-lg font-semibold">2. Доступ до Google Play</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
          <li>{ext(`https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com${settings.google?.project_id ? `?project=${encodeURIComponent(settings.google.project_id)}` : ""}`, "Увімкни Google Play Android Developer API")} у проєкті сервісного акаунта.</li>
          <li>У {ext("https://play.google.com/console/developers/users-and-permissions", "Play Console → Користувачі й дозволи")} запроси email сервісного акаунта, вказаний вище. Дай доступ до потрібних застосунків і дій: релізів, тестування, описів або відгуків. Права можуть почати діяти із затримкою.</li>
          <li><Link href="/apps/new" className="font-medium text-brand-700 dark:text-emerald-300 hover:underline">Додай застосунок за назвою пакета →</Link> Google API не надає автоматичного списку застосунків.</li>
        </ol>
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">3. OpenAI для перекладу (необов’язково)</h2>
        <p className="text-sm">Створи ключ на {ext("https://platform.openai.com/api-keys", "сторінці API keys")}. Оплата перекладів відбувається з твого акаунта OpenAI.</p>
        {data?.openai.ok && <Badge tone="green">Підключено: {data.openai.model}</Badge>}
        {data?.openai.ok === false && <Alert tone="error" title={data.openai.error}>{data.openai.hint}</Alert>}
        <form onSubmit={saveOpenAI} className="space-y-4">
          <Field label="OpenAI API-ключ" hint={settings.openaiKey ? "Ключ уже збережено. Залиш поле порожнім, щоб зберегти поточний." : undefined}>
            <Input type="password" autoComplete="off" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder={settings.openaiKey ? "Ключ збережено" : "sk-…"} />
          </Field>
          <Field label="Модель"><Input required value={selectedModel} onChange={e => setModel(e.target.value)} placeholder="gpt-5-mini" /></Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy}>Зберегти OpenAI</Button>
            {settings.openaiKey && <Button type="button" variant="secondary" disabled={busy} onClick={() => disconnect("openai")}>Видалити OpenAI-ключ</Button>}
          </div>
        </form>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Очистити дані цього сайту</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Видалить ключі, списки застосунків, приховані треки та групи тестувальників у цьому браузері. Застосунки й релізи в Google Play залишаться.</p>
        {confirmClear ? <div className="space-y-3">
          <Alert tone="warning" title="Видалити всі ключі та локальні списки з цього браузера?">Відновити їх можна буде лише повторним додаванням.</Alert>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => {
              try { clearBrowserData(); window.location.reload(); } catch { setProblem("Не вдалося очистити сховище браузера."); }
            }}>Так, видалити локальні дані</Button>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>Скасувати</Button>
          </div>
        </div> : <Button variant="secondary" disabled={busy} onClick={() => setConfirmClear(true)}>Очистити всі локальні дані</Button>}
      </Card>
    </div>
  </>;
}
