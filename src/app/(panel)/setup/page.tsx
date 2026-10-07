"use client";
import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, XCircle } from "lucide-react";
import { Alert, Badge, Button, Card, CopyButton, PageHeader, Spinner, cn } from "@/components/ui";
import { useApi } from "@/lib/hooks";

type Status = {
  credentials: { ok: boolean; source: string; error?: string; email?: string; projectId?: string };
  token?: { ok: boolean; error?: string; hint?: string };
  passwordEnabled: boolean;
  appsCount: number;
};

function Step({ n, state, title, children }: { n: number; state: "ok" | "fail" | "todo"; title: string; children: React.ReactNode }) {
  return (
    <Card className="flex gap-4 p-5">
      <div className="pt-0.5">
        {state === "ok" ? <CheckCircle2 className="size-6 text-emerald-600" /> : state === "fail" ? <XCircle className="size-6 text-red-600" /> : <Circle className="size-6 text-gray-300" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">Крок {n}</div>
        <h3 className={cn("mb-2 font-semibold", state === "fail" ? "text-red-800" : "text-gray-900")}>{title}</h3>
        <div className="space-y-2 text-sm leading-relaxed text-gray-700">{children}</div>
      </div>
    </Card>
  );
}

const ext = (href: string, text: string) => (
  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
    {text} <ExternalLink className="size-3.5" />
  </a>
);

export default function SetupPage() {
  const { data, loading, reload } = useApi<Status>("/api/status?check=1");
  if (loading && !data) return <Spinner label="Перевіряю підключення…" />;
  const c = data?.credentials;
  const email = c?.email ?? "";
  const keyState = c?.ok ? (data?.token?.ok === false ? "fail" : "ok") : "fail";

  return (
    <>
      <PageHeader
        title="Підключення до Google Play"
        description="Один раз проходиш ці кроки — і далі все робиться з панелі."
        actions={<Button variant="secondary" loading={loading} onClick={reload}>Перевірити ще раз</Button>}
      />
      <div className="space-y-4">
        <Step n={1} state={keyState} title="JSON-ключ сервісного акаунта">
          {c?.ok ? (
            <>
              <p>Ключ знайдено ({c.source}).{data?.token?.ok && " Google успішно видав токен доступу."}</p>
              {data?.token?.ok === false && <Alert tone="error" title={data.token.error}>{data.token.hint}</Alert>}
            </>
          ) : (
            <>
              <Alert tone="error" title="Ключ не знайдено">{c?.error}</Alert>
              <p>Поклади завантажений JSON-файл у папку проєкту ось так:</p>
              <pre className="rounded-lg bg-gray-900 p-3 font-mono text-xs text-gray-100">credentials/service-account.json</pre>
              <p>Після цього перезапусти <code className="rounded bg-gray-100 px-1">npm run dev</code> і натисни «Перевірити ще раз».</p>
            </>
          )}
        </Step>

        <Step n={2} state="todo" title="Увімкнути Google Play Android Developer API">
          <p>У Google Cloud проєкті, де створений сервісний акаунт, має бути увімкнений цей API.</p>
          <p>{ext(`https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com${c?.projectId ? `?project=${c.projectId}` : ""}`, "Відкрити сторінку API і натиснути «Enable»")}</p>
          <p className="text-gray-500">Якщо вже увімкнено — просто пропусти цей крок.</p>
        </Step>

        <Step n={3} state={data && data.appsCount > 0 ? "ok" : "todo"} title="Дати сервісному акаунту доступ у Play Console">
          {email && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3">
              <code className="font-mono text-sm break-all">{email}</code>
              <CopyButton text={email} />
            </div>
          )}
          <ol className="list-decimal space-y-1 pl-5">
            <li>{ext("https://play.google.com/console/developers/users-and-permissions", "Play Console → Користувачі й дозволи")} → «Запросити нових користувачів».</li>
            <li>Встав email вище.</li>
            <li>
              На вкладці <b>«Дозволи облікового запису»</b> найпростіше дати <b>«Адміністратор (усі дозволи)»</b> — тоді доступ буде до всіх наявних і майбутніх застосунків.
              Мінімально потрібні: перегляд інформації про застосунок, керування релізами в робочій версії й тестових треках, керування тестувальниками, редагування сторінки в магазині, відповіді на відгуки.
            </li>
            <li>Натисни «Запросити» — підтверджувати нічого не потрібно.</li>
          </ol>
          <p className="text-gray-500">Права інколи починають діяти через кілька хвилин (зрідка — до доби).</p>
        </Step>

        <Step n={4} state={data && data.appsCount > 0 ? "ok" : "todo"} title="Додати застосунки в панель">
          <p>
            {data?.appsCount ? <>Додано застосунків: <Badge tone="green">{data.appsCount}</Badge>. </> : null}
            Вкажи назву пакета — панель перевірить доступ і запам&apos;ятає застосунок.
          </p>
          <Link href="/apps/new" className="font-medium text-brand-700 hover:underline">Додати застосунок →</Link>
        </Step>

        <Step n={5} state={data?.passwordEnabled ? "ok" : "todo"} title="Пароль на панель (рекомендовано)">
          {data?.passwordEnabled ? (
            <p>Пароль увімкнено. Панель захищена.</p>
          ) : (
            <>
              <p>Зараз панель відкрита без пароля. Для локального запуску це нормально, але якщо розгортатимеш її на сервері — обов&apos;язково додай у файл <code className="rounded bg-gray-100 px-1">.env.local</code>:</p>
              <pre className="rounded-lg bg-gray-900 p-3 font-mono text-xs text-gray-100">ADMIN_PASSWORD=придумай-надійний-пароль</pre>
            </>
          )}
        </Step>
      </div>
    </>
  );
}
