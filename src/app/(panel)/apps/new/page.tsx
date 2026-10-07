"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, PackagePlus, Sparkles } from "lucide-react";
import { useApps } from "@/components/apps-context";
import { AppIcon } from "@/components/app-icon";
import { Alert, Button, Card, ChoiceCard, ErrorBox, Field, Input, LinkButton, PageHeader, Stepper, WizardFooter } from "@/components/ui";
import { api, enc, errorInfo } from "@/lib/client";
import type { AppOverview, StoredApp } from "@/lib/types";

type Mode = "existing" | "new";

const NEW_STEPS = ["Створити в Play Console", "Доступ", "Підключити", "Готово"];
const EXISTING_STEPS = ["Підключити", "Готово"];

const CONSOLE_TASKS = [
  "Доступ до застосунку (чи потрібен логін для перевірки)",
  "Реклама (чи містить застосунок рекламу)",
  "Вікова категорія (анкета IARC)",
  "Цільова аудиторія і вміст",
  "Безпека даних (Data safety)",
  "Політика конфіденційності (посилання)",
  "Державні застосунки / фінансові функції / охорона здоров'я (якщо стосується)",
  "Категорія і контакти, ціна та країни",
];

export default function NewAppPage() {
  const router = useRouter();
  const apps = useApps();
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState(0);
  const [pkg, setPkg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof errorInfo>>();
  const [added, setAdded] = useState<{ app: StoredApp; overview: AppOverview }>();

  const steps = mode === "new" ? NEW_STEPS : EXISTING_STEPS;
  const connectStep = mode === "new" ? 2 : 0;

  async function connect() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api<{ app: StoredApp; overview: AppOverview }>("/api/apps", { method: "POST", json: { packageName: pkg.trim() } });
      setAdded(res);
      await apps.reload();
      setStep(connectStep + 1);
    } catch (e) {
      setError(errorInfo(e));
    } finally {
      setBusy(false);
    }
  }

  if (!mode) {
    return (
      <>
        <PageHeader title="Додати застосунок" description="Обери, що саме потрібно зробити." />
        <div className="grid max-w-3xl gap-3">
          <ChoiceCard
            selected={false}
            onClick={() => setMode("existing")}
            icon={<PackagePlus className="size-5" />}
            title="Застосунок уже є в Google Play Console"
            description="Підключу його до панелі за назвою пакета (applicationId) — і зможеш одразу завантажувати версії та керувати тестуванням."
          />
          <ChoiceCard
            selected={false}
            onClick={() => setMode("new")}
            icon={<Sparkles className="size-5" />}
            title="Створити зовсім новий застосунок"
            description="Покроково: створення в Play Console → доступ → підключення → перша збірка."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={mode === "new" ? "Новий застосунок" : "Підключити наявний застосунок"}
        back={<button onClick={() => { setMode(null); setStep(0); setError(undefined); }} className="mb-2 text-sm text-gray-500 hover:text-gray-800">← Змінити вибір</button>}
      />
      <Stepper steps={steps} current={step} />

      <Card className="max-w-3xl p-6">
        {mode === "new" && step === 0 && (
          <>
            <h2 className="mb-2 text-lg font-semibold">Створи застосунок у Play Console</h2>
            <Alert tone="info" className="mb-4">
              Google Play API <b>не дозволяє</b> створювати нові застосунки — це можна зробити лише вручну в Play Console. Це займає 1 хвилину, а все інше далі робиться звідси.
            </Alert>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>
                Відкрий{" "}
                <a className="font-medium text-brand-700 hover:underline" href="https://play.google.com/console/developers" target="_blank" rel="noreferrer">
                  Play Console <ExternalLink className="inline size-3.5" />
                </a>{" "}
                і натисни <b>«Створити застосунок»</b>.
              </li>
              <li>Вкажи назву, мову за замовчуванням, тип (застосунок / гра) і чи він безкоштовний.</li>
              <li>Підтверди декларації і натисни <b>«Створити застосунок»</b>.</li>
            </ol>
            <p className="mt-4 text-sm text-gray-600">
              Назву пакета (наприклад <code className="rounded bg-gray-100 px-1">com.mycompany.myapp</code>) Google зафіксує під час першого завантаження збірки — вона дорівнює <code className="rounded bg-gray-100 px-1">applicationId</code> у build.gradle.
            </p>
            <WizardFooter>
              <Button onClick={() => setStep(1)}>Я створив застосунок →</Button>
            </WizardFooter>
          </>
        )}

        {mode === "new" && step === 1 && (
          <>
            <h2 className="mb-2 text-lg font-semibold">Перевір доступ сервісного акаунта</h2>
            <p className="text-sm text-gray-700">
              Якщо при запрошенні сервісного акаунта ти дав йому права <b>на весь обліковий запис</b> (адміністратор) — новий застосунок уже доступний, просто йди далі.
            </p>
            <p className="mt-2 text-sm text-gray-700">
              Якщо права видавались на окремі застосунки — відкрий Play Console → «Користувачі й дозволи» → сервісний акаунт → «Дозволи для застосунків» → додай новий застосунок.
            </p>
            <WizardFooter onBack={() => setStep(0)}>
              <Button onClick={() => setStep(2)}>Далі →</Button>
            </WizardFooter>
          </>
        )}

        {step === connectStep && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void connect();
            }}
          >
            <h2 className="mb-4 text-lg font-semibold">Вкажи назву пакета</h2>
            <Field label="Назва пакета (applicationId)" hint="Як у build.gradle: android.defaultConfig.applicationId. Її видно і в Play Console під назвою застосунку.">
              <Input autoFocus placeholder="com.mycompany.myapp" value={pkg} onChange={(e) => setPkg(e.target.value)} className="font-mono" />
            </Field>
            {mode === "new" && (
              <Alert tone="warning" className="mt-4" title="Застосунок без жодної збірки">
                Поки в нього немає першої збірки, Google може не знаходити застосунок за назвою пакета. У такому разі завантаж першу збірку в Play Console вручну (Тестування → Внутрішнє тестування → Створити реліз) — далі всі наступні версії вже вантажитимеш звідси.
              </Alert>
            )}
            <ErrorBox error={error} className="mt-4" />
            <WizardFooter onBack={mode === "new" ? () => setStep(1) : undefined}>
              <Button type="submit" loading={busy} disabled={!pkg.trim()}>Перевірити й підключити</Button>
            </WizardFooter>
          </form>
        )}

        {step === connectStep + 1 && added && (
          <>
            <div className="mb-6 flex items-center gap-4">
              <AppIcon src={added.overview.iconUrl} name={added.overview.title || added.app.packageName} size={56} />
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <CheckCircle2 className="size-5 text-emerald-600" /> {added.overview.title || added.app.packageName} підключено
                </div>
                <div className="font-mono text-sm text-gray-500">{added.app.packageName}</div>
              </div>
            </div>

            {mode === "new" && (
              <div className="mb-6">
                <h3 className="mb-2 font-semibold">Що залишилось зробити в Play Console перед публікацією</h3>
                <p className="mb-2 text-sm text-gray-600">
                  Ці анкети Google дозволяє заповнити лише в Play Console (розділ «Панель» → «Налаштуйте застосунок»). Без них реліз можна зберегти лише як чернетку:
                </p>
                <ul className="grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
                  {CONSOLE_TASKS.map((t) => (
                    <li key={t} className="flex gap-2"><span className="text-gray-400">☐</span>{t}</li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-gray-600">Опис у магазині, графіку і контакти можна заповнити прямо тут, у панелі.</p>
              </div>
            )}

            <h3 className="mb-2 font-semibold">Наступні кроки</h3>
            <div className="flex flex-wrap gap-2">
              <LinkButton href={`/apps/${enc(added.app.packageName)}/release`}>Завантажити версію</LinkButton>
              <LinkButton variant="secondary" href={`/apps/${enc(added.app.packageName)}/testing/new`}>Створити закрите тестування</LinkButton>
              {mode === "new" && <LinkButton variant="secondary" href={`/apps/${enc(added.app.packageName)}/listing`}>Заповнити опис</LinkButton>}
              <Button variant="ghost" onClick={() => router.push(`/apps/${enc(added.app.packageName)}`)}>Огляд застосунку</Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
