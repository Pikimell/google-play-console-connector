"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type ComponentProps } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Info, Loader2, X, XCircle } from "lucide-react";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------- Кнопки ----------

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANT: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-600/50",
  secondary: "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-950 shadow-sm disabled:text-gray-400",
  ghost: "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:text-gray-400",
  danger: "bg-white dark:bg-gray-900 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:text-red-300 dark:disabled:text-red-500",
};
const SIZE = { sm: "h-8 px-3 text-sm gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-base gap-2" };

type BtnProps = { variant?: Variant; size?: keyof typeof SIZE; loading?: boolean; icon?: ReactNode };

export function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...p }: BtnProps & ComponentProps<"button">) {
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed", VARIANT[variant], SIZE[size], className)}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", size = "md", icon, className, children, ...p }: BtnProps & ComponentProps<typeof Link>) {
  return (
    <Link {...p} className={cn("inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition", VARIANT[variant], SIZE[size], className)}>
      {icon}
      {children}
    </Link>
  );
}

// ---------- Контейнери ----------

export function Card({ className, children, ...p }: ComponentProps<"div">) {
  return (
    <div {...p} className={cn("rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{children}</h2>
      {aside}
    </div>
  );
}

// ---------- Статуси ----------

const TONE = {
  green: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-600/20 dark:ring-emerald-400/20",
  blue: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-600/20 dark:ring-sky-400/20",
  amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-600/20 dark:ring-amber-400/20",
  red: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-600/20 dark:ring-red-400/20",
  gray: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-500/20",
  violet: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-600/20 dark:ring-violet-400/20",
};

export function Badge({ tone = "gray", children, className }: { tone?: keyof typeof TONE; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONE[tone], className)}>{children}</span>;
}

type AlertTone = "info" | "warning" | "error" | "success";
const ALERT: Record<AlertTone, { cls: string; icon: ReactNode }> = {
  info: { cls: "border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sky-900 dark:text-sky-200", icon: <Info className="size-5 text-sky-600 dark:text-sky-400" /> },
  warning: { cls: "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200", icon: <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" /> },
  error: { cls: "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-900 dark:text-red-200", icon: <XCircle className="size-5 text-red-600 dark:text-red-400" /> },
  success: { cls: "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200", icon: <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" /> },
};

export function Alert({ tone = "info", title, children, className, action }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4 text-sm", ALERT[tone].cls, className)}>
      <div className="shrink-0">{ALERT[tone].icon}</div>
      <div className="min-w-0 flex-1 space-y-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className="leading-relaxed [&_a]:underline">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function ErrorBox({ error, onRetry, className }: { error?: { message: string; hint?: string; details?: string }; onRetry?: () => void; className?: string }) {
  if (!error) return null;
  return (
    <Alert tone="error" title={error.message} className={className} action={onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Повторити</Button>}>
      {error.hint && <p>{error.hint}</p>}
      {error.details && error.details !== error.message && (
        <details className="mt-1 text-xs opacity-75">
          <summary className="cursor-pointer">Технічні деталі від Google</summary>
          <p className="mt-1 font-mono break-all">{error.details}</p>
        </details>
      )}
    </Alert>
  );
}

export function Spinner({ label = "Завантаження…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 py-8 text-sm text-gray-500 dark:text-gray-400", className)}>
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-gray-200/70 dark:bg-gray-800/70", className)} />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-gray-400">{icon}</div>}
      <div className="font-semibold text-gray-900 dark:text-gray-100">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-gray-600 dark:text-gray-400">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------- Форми ----------

export function Field({ label, hint, counter, children, className }: { label: ReactNode; hint?: ReactNode; counter?: { value: number; max: number }; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        {counter && <span className={cn("text-xs tabular-nums", counter.value > counter.max ? "font-semibold text-red-600 dark:text-red-400" : "text-gray-400")}>{counter.value}/{counter.max}</span>}
      </div>
      {children}
      {hint && <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</div>}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-gray-50 dark:disabled:bg-gray-950";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input {...p} className={cn(inputCls, "h-10", className)} />;
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea {...p} className={cn(inputCls, "py-2 leading-relaxed", className)} />;
}

export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select {...p} className={cn(inputCls, "h-10 pr-8", className)} />;
}

/** Великий варіант вибору (радіо-картка). */
export function ChoiceCard({ selected, onClick, title, description, icon, disabled, badge }: { selected: boolean; onClick: () => void; title: ReactNode; description?: ReactNode; icon?: ReactNode; disabled?: boolean; badge?: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
        selected ? "border-brand-600 bg-brand-50 dark:bg-brand-500/15 ring-1 ring-brand-600" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-950",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-brand-600 bg-brand-600" : "border-gray-300 dark:border-gray-700")}>
        {selected && <Check className="size-3 text-white" strokeWidth={3} />}
      </span>
      {icon && <span className="mt-0.5 text-gray-500 dark:text-gray-400">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
          {title}
          {badge}
        </span>
        {description && <span className="mt-0.5 block text-sm text-gray-600 dark:text-gray-400">{description}</span>}
      </span>
    </button>
  );
}

export function Checkbox({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-950">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 rounded border-gray-300 dark:border-gray-700 accent-brand-600" />
      <span>
        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
        {description && <span className="block text-xs text-gray-500 dark:text-gray-400">{description}</span>}
      </span>
    </label>
  );
}

// ---------- Майстер (покрокові сценарії) ----------

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-brand-600 text-white",
                active && "bg-brand-600 text-white ring-4 ring-brand-100 dark:ring-brand-500/25",
                !done && !active && "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("text-sm", active ? "font-semibold text-gray-900 dark:text-gray-100" : done ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400")}>{s}</span>
            {i < steps.length - 1 && <span className={cn("mx-1 h-px w-8 sm:w-12", done ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-700")} />}
          </li>
        );
      })}
    </ol>
  );
}

export function WizardFooter({ onBack, backLabel = "Назад", children }: { onBack?: () => void; backLabel?: string; children: ReactNode }) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-5">
      <div>{onBack && <Button variant="ghost" onClick={onBack}>← {backLabel}</Button>}</div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, indeterminate }: { value?: number; indeterminate?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
      {indeterminate ? (
        <div className="animate-indeterminate h-full w-2/5 rounded-full bg-brand-500" />
      ) : (
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
      )}
    </div>
  );
}

// ---------- Дрібниці ----------

export function CopyButton({ text, label = "Копіювати", size = "sm", variant = "secondary" }: { text: string; label?: string; size?: "sm" | "md"; variant?: Variant }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      icon={done ? <Check className="size-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-4" />}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Скопійовано" : label}
    </Button>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn("w-full rounded-2xl bg-white dark:bg-gray-900 shadow-xl", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-400" aria-label="Закрити">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Сповіщення ----------

type Toast = { id: number; tone: "success" | "error" | "info"; text: string };
const ToastCtx = createContext<(tone: Toast["tone"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, tone, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-xl px-4 py-3 text-sm text-white shadow-lg",
              t.tone === "success" ? "bg-emerald-700" : t.tone === "error" ? "bg-red-700" : "bg-gray-900",
            )}
          >
            {t.tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : t.tone === "error" ? <XCircle className="mt-0.5 size-4 shrink-0" /> : <Info className="mt-0.5 size-4 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
