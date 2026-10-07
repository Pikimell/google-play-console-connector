"use client";
import { useState } from "react";
import { Download, ExternalLink, HelpCircle } from "lucide-react";
import { Alert, Button, ErrorBox, Field, Input, Textarea } from "./ui";
import { api, errorInfo } from "@/lib/client";
import { emailsCsv, isEmail, parseEmails } from "@/lib/emails";
import type { TesterGroup } from "@/lib/types";

export function downloadCsv(name: string, emails: string[]) {
  const blob = new Blob([emailsCsv(emails)], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^\p{L}\p{N}_-]+/gu, "_") || "testers"}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function CsvButton({ name, emails, label = "CSV для Play Console" }: { name: string; emails: string[]; label?: string }) {
  return (
    <Button size="sm" variant="secondary" disabled={!emails.length} icon={<Download className="size-4" />} onClick={() => downloadCsv(name, emails)}>
      {label}
    </Button>
  );
}

/** Пояснення, чому потрібна Google-група, і як її зробити за 2 хвилини. */
export function GoogleGroupGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <HelpCircle className="size-4 text-sky-600" />
        Як працюють тестувальники і навіщо Google-група
        <span className="ml-auto text-xs font-normal text-sky-700 group-open:hidden">показати</span>
      </summary>
      <div className="mt-3 space-y-3 leading-relaxed">
        <p>
          Google Play API дозволяє автоматично призначати тестувальників <b>лише через Google-групу</b> (email виду <code>назва@googlegroups.com</code>). Email-списки, які ти бачиш у Play Console, через API змінювати не можна.
        </p>
        <p className="font-semibold">Варіант А — Google-група (рекомендовано, все автоматично):</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Відкрий{" "}
            <a href="https://groups.google.com/my-groups" target="_blank" rel="noreferrer" className="font-medium underline">
              groups.google.com <ExternalLink className="inline size-3" />
            </a>{" "}
            → «Створити групу». Назва будь-яка, наприклад <code>myapp-testers</code>.
          </li>
          <li>Хто може переглядати учасників / приєднуватися — на твій смак. Найпростіше: «Лише запрошені користувачі».</li>
          <li>
            Відкрий групу → «Учасники» → «Додати учасників» → встав email-и (кнопка «Копіювати email-и» тут у панелі) → <b>вимкни</b> «Надіслати запрошення» і додай напряму (якщо є такий варіант) — або залиш запрошення, тоді люди мають їх прийняти.
          </li>
          <li>Скопіюй email групи і встав його в поле «Email Google-групи» тут. Панель сама прив&apos;яже групу до треку тестування.</li>
        </ol>
        <p>Надалі, щоб додати людину, достатньо додати її в Google-групу — у Play Console нічого міняти не потрібно.</p>
        <p className="font-semibold">Варіант Б — email-список у Play Console (вручну):</p>
        <p>
          Кнопкою «CSV для Play Console» завантаж файл → Play Console → Тестування → Закрите тестування → твій трек → «Тестувальники» → «Створити список email-адрес» → «Завантажити CSV-файл».
        </p>
      </div>
    </details>
  );
}

/** Форма створення/редагування групи тестувальників. */
export function TesterGroupForm({ initial, onSaved, onCancel, submitLabel = "Зберегти" }: { initial?: TesterGroup; onSaved: (g: TesterGroup) => void; onCancel?: () => void; submitLabel?: string }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [text, setText] = useState(initial?.emails.join("\n") ?? "");
  const [googleGroup, setGoogleGroup] = useState(initial?.googleGroup ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof errorInfo>>();
  const parsed = parseEmails(text);
  const ggInvalid = googleGroup.trim() !== "" && !isEmail(googleGroup);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const body = { name, emails: parsed.valid, googleGroup: googleGroup.trim() };
      const res = initial
        ? await api<{ group: TesterGroup }>(`/api/tester-groups/${initial.id}`, { method: "PUT", json: body })
        : await api<{ group: TesterGroup }>("/api/tester-groups", { method: "POST", json: body });
      onSaved(res.group);
    } catch (err) {
      setError(errorInfo(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Назва групи" hint="Для тебе, наприклад «Команда», «Клієнт ACME», «Бета-тестери».">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Команда" autoFocus />
      </Field>
      <Field
        label="Email-адреси тестувальників"
        hint="Встав будь-як: через кому, пробіл чи з нового рядка — панель сама розбере. Потрібні адреси Google-акаунтів (Gmail або Google Workspace)."
      >
        <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"ivan@gmail.com\nolena@gmail.com, petro@company.com"} className="font-mono text-xs" />
      </Field>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Розпізнано: {parsed.valid.length}</span>
        {parsed.invalid.length > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">Некоректні: {parsed.invalid.join(", ")}</span>}
      </div>
      <Field label="Email Google-групи (необов'язково, але дуже бажано)" hint="Наприклад myapp-testers@googlegroups.com. Саме її панель прив'язує до треку тестування через API.">
        <Input value={googleGroup} onChange={(e) => setGoogleGroup(e.target.value)} placeholder="myapp-testers@googlegroups.com" className="font-mono" />
      </Field>
      {ggInvalid && <Alert tone="error">Email Google-групи виглядає некоректно.</Alert>}
      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Скасувати</Button>}
        <Button type="submit" loading={busy} disabled={ggInvalid || (!parsed.valid.length && !googleGroup.trim())}>{submitLabel}</Button>
      </div>
    </form>
  );
}
