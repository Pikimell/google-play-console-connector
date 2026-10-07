"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge, Button, ErrorBox, Field, Input, Select, Textarea, cn } from "./ui";
import { api, enc, errorInfo, type ErrInfo } from "@/lib/client";
import type { BasePlan, BasePlanState, NewBasePlan, PriceInput, RegionPrice, SubscriptionListing } from "@/lib/types";

export const PERIOD_LABEL: Record<string, string> = {
  P1W: "тиждень",
  P1M: "місяць",
  P3M: "3 місяці",
  P6M: "6 місяців",
  P1Y: "рік",
};

export const PLAN_STATE: Record<BasePlanState, { label: string; tone: "green" | "gray" | "amber" }> = {
  ACTIVE: { label: "активний", tone: "green" },
  INACTIVE: { label: "неактивний", tone: "gray" },
  DRAFT: { label: "чернетка", tone: "amber" },
  STATE_UNSPECIFIED: { label: "невідомо", tone: "gray" },
};

export const CURRENCIES = ["USD", "EUR", "UAH", "GBP", "PLN"];

export function formatPrice(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("uk-UA", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** Ціна в кількох ключових регіонах — для короткого показу. */
export function keyPrices(prices: RegionPrice[]) {
  const order = ["UA", "US", "DE", "GB", "PL"];
  return order.map((r) => prices.find((p) => p.region === r)).filter((p): p is RegionPrice => !!p);
}

export function BasePlanSummary({ plan }: { plan: BasePlan }) {
  const shown = keyPrices(plan.prices);
  const state = PLAN_STATE[plan.state] ?? PLAN_STATE.STATE_UNSPECIFIED;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">{plan.basePlanId}</span>
        <Badge tone={state.tone}>{state.label}</Badge>
        <span className="text-xs text-gray-500">
          {plan.kind === "prepaid" ? "передплачений" : plan.kind === "installments" ? "розстрочка" : "автопродовження"}
          {plan.period && ` · ${PERIOD_LABEL[plan.period] ?? plan.period}`}
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-600">
        {shown.length ? shown.map((p) => `${p.region}: ${formatPrice(p.amount, p.currency)}`).join(" · ") : "ціни не задані"}
        {plan.prices.length > shown.length && <span className="text-gray-400"> · ще {plan.prices.length - shown.length} регіонів</span>}
      </div>
    </div>
  );
}

// ---------- Ціна ----------

export function PriceFields({ value, onChange }: { value: PriceInput; onChange: (v: PriceInput) => void }) {
  return (
    <div className="flex gap-2">
      <Input
        type="number"
        min="0"
        step="0.01"
        className="flex-1"
        value={Number.isFinite(value.amount) && value.amount ? value.amount : ""}
        onChange={(e) => onChange({ ...value, amount: parseFloat(e.target.value) })}
        placeholder="4.99"
      />
      <div className="w-28 shrink-0">
        <Select value={value.currency} onChange={(e) => onChange({ ...value, currency: e.target.value })}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </div>
    </div>
  );
}

/** Показати, як Google перерахує ціну в інші країни. */
export function PricePreview({ pkg, price }: { pkg: string; price: PriceInput }) {
  const [data, setData] = useState<{ key: string; prices: RegionPrice[] }>();
  const [error, setError] = useState<ErrInfo>();
  const [busy, setBusy] = useState(false);
  const key = `${price.amount}${price.currency}`;
  const valid = Number.isFinite(price.amount) && price.amount > 0;

  async function load() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api<{ prices: RegionPrice[] }>(`/api/apps/${enc(pkg)}/subscriptions/prices`, { method: "POST", json: price });
      setData({ key, prices: res.prices });
    } catch (e) {
      setError(errorInfo(e));
    } finally {
      setBusy(false);
    }
  }

  const shown = data?.key === key ? data.prices : undefined;
  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="ghost" disabled={!valid} loading={busy} onClick={load}>
        Як це буде в інших країнах?
      </Button>
      <ErrorBox error={error} />
      {shown && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {[...keyPrices(shown), ...shown.filter((p) => !keyPrices(shown).includes(p))].map((p) => (
              <span key={p.region} className="flex justify-between gap-2">
                <span className="text-gray-500">{p.region}</span>
                <span className="tabular-nums">{formatPrice(p.amount, p.currency)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Базовий план ----------

const PERIOD_ID: Record<string, string> = { P1W: "weekly", P1M: "monthly", P3M: "quarterly", P6M: "half-yearly", P1Y: "yearly" };

export const EMPTY_PLAN: NewBasePlan = { basePlanId: "monthly", kind: "autoRenewing", period: "P1M", price: { currency: "USD", amount: NaN } };

export function BasePlanFields({ pkg, value, onChange }: { pkg: string; value: NewBasePlan; onChange: (v: NewBasePlan) => void }) {
  const set = (patch: Partial<NewBasePlan>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ID базового плану" hint="Малі літери, цифри, дефіс. Змінити потім не можна.">
          <Input value={value.basePlanId} onChange={(e) => set({ basePlanId: e.target.value.toLowerCase() })} placeholder="monthly" />
        </Field>
        <Field label="Період оплати">
          <Select
            value={value.period}
            onChange={(e) => {
              const period = e.target.value;
              // Якщо ID ще стандартний — підставити зручний ID під новий період
              const keep = value.basePlanId && !Object.values(PERIOD_ID).includes(value.basePlanId);
              set({ period, basePlanId: keep ? value.basePlanId : PERIOD_ID[period] });
            }}
          >
            {Object.entries(PERIOD_LABEL).map(([p, l]) => <option key={p} value={p}>{l}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Тип">
        <Select value={value.kind} onChange={(e) => set({ kind: e.target.value as NewBasePlan["kind"] })}>
          <option value="autoRenewing">Автопродовження — списується кожен період</option>
          <option value="prepaid">Передплачений — оплата один раз, без автосписання</option>
        </Select>
      </Field>
      <Field label="Ціна" hint="Google автоматично перерахує її в усі країни з урахуванням місцевих валют і податків.">
        <PriceFields value={value.price} onChange={(price) => set({ price })} />
      </Field>
      <PricePreview pkg={pkg} price={value.price} />
    </div>
  );
}

// ---------- Опис ----------

export function emptyListing(language: string): SubscriptionListing {
  return { language, title: "", description: "", benefits: [] };
}

export function ListingFields({ value, onChange }: { value: SubscriptionListing; onChange: (v: SubscriptionListing) => void }) {
  const set = (patch: Partial<SubscriptionListing>) => onChange({ ...value, ...patch });
  const benefits = value.benefits;
  return (
    <div className="space-y-4">
      <Field label="Назва" counter={{ value: value.title.length, max: 55 }} hint="Так підписку бачать користувачі в Google Play і на екрані оплати.">
        <Input value={value.title} onChange={(e) => set({ title: e.target.value })} placeholder="Premium" />
      </Field>
      <Field label="Опис (необов'язково)" counter={{ value: value.description?.length ?? 0, max: 80 }}>
        <Textarea rows={2} value={value.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <div>
        <div className="mb-1.5 text-sm font-medium text-gray-800">Переваги <span className="font-normal text-gray-500">(до 4, по 40 символів)</span></div>
        <div className="space-y-2">
          {benefits.map((b, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={b}
                className={cn(b.length > 40 && "border-red-400")}
                onChange={(e) => set({ benefits: benefits.map((x, j) => (j === i ? e.target.value : x)) })}
                placeholder="Без реклами"
              />
              <Button type="button" variant="ghost" size="md" icon={<X className="size-4" />} onClick={() => set({ benefits: benefits.filter((_, j) => j !== i) })} aria-label="Прибрати" />
            </div>
          ))}
          {benefits.length < 4 && (
            <Button type="button" variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => set({ benefits: [...benefits, ""] })}>
              Додати перевагу
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
