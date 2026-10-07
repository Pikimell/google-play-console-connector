"use client";
import Link from "next/link";
import { useState } from "react";
import { CreditCard, Plus } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { BasePlanFields, BasePlanSummary, EMPTY_PLAN, ListingFields, emptyListing } from "@/components/subscription-parts";
import { Alert, Badge, Button, Card, Checkbox, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Skeleton, useToast } from "@/components/ui";
import { api, enc, errorInfo, type ErrInfo } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import { languageName } from "@/lib/tracks";
import type { NewBasePlan, Subscription, SubscriptionListing } from "@/lib/types";

function subscriptionTitle(s: Subscription, lang?: string) {
  return (s.listings.find((l) => l.language === lang) ?? s.listings[0])?.title || s.productId;
}

function NewSubscriptionModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (s: Subscription) => void }) {
  const { pkg, data } = useApp();
  const lang = data?.overview.defaultLanguage ?? "en-US";
  const [productId, setProductId] = useState("");
  const [listing, setListing] = useState<SubscriptionListing>(() => emptyListing(lang));
  const [plan, setPlan] = useState<NewBasePlan>(EMPTY_PLAN);
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrInfo>();

  async function create() {
    setBusy(true);
    setError(undefined);
    try {
      const s = await api<Subscription>(`/api/apps/${enc(pkg)}/subscriptions`, {
        method: "POST",
        json: { productId, listings: [{ ...listing, language: lang }], basePlan: plan, activate },
      });
      onCreated(s);
    } catch (e) {
      setError(errorInfo(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Нова підписка"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Скасувати</Button>
          <Button loading={busy} disabled={!productId || !listing.title.trim() || !(plan.price.amount > 0)} onClick={create}>Створити</Button>
        </>
      }
    >
      <div className="space-y-6">
        <Field label="ID підписки" hint="Його використовує код застосунку (Billing Library). Малі літери, цифри, «_» і «.». Змінити потім не можна.">
          <Input value={productId} onChange={(e) => setProductId(e.target.value.toLowerCase())} placeholder="premium" />
        </Field>
        <div>
          <div className="mb-3 text-sm font-semibold text-gray-900">Опис · {languageName(lang)}</div>
          <ListingFields value={listing} onChange={setListing} />
          <p className="mt-2 text-xs text-gray-500">Інші мови можна додати після створення.</p>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold text-gray-900">Базовий план</div>
          <BasePlanFields pkg={pkg} value={plan} onChange={setPlan} />
        </div>
        <Checkbox checked={activate} onChange={setActivate} label="Одразу активувати план" description="Інакше план лишиться чернеткою, і купити його не вийде, доки не активуєш." />
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

export default function SubscriptionsPage() {
  const { pkg, data: app } = useApp();
  const toast = useToast();
  const [archived, setArchived] = useState(false);
  const { data, error, loading, reload } = useApi<{ subscriptions: Subscription[] }>(`/api/apps/${enc(pkg)}/subscriptions${archived ? "?archived=1" : ""}`);
  const [creating, setCreating] = useState(false);
  const base = `/apps/${enc(pkg)}/subscriptions`;
  const lang = app?.overview.defaultLanguage;
  const list = data?.subscriptions ?? [];

  return (
    <>
      <PageHeader
        title="Підписки"
        description="Підписки й базові плани (період, ціна). Зміни застосовуються в Google Play одразу, без релізу."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Нова підписка</Button>}
      />
      <ErrorBox error={error} onRetry={reload} className="mb-4" />
      {loading && !data ? (
        <Skeleton className="h-48" />
      ) : data && !list.length ? (
        <EmptyState
          icon={<CreditCard className="size-10" />}
          title="Підписок ще немає"
          action={<Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Створити першу</Button>}
        >
          Перед створенням у Google Play має бути завантажена збірка з бібліотекою Google Play Billing (достатньо чернетки на внутрішньому тестуванні).
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {list.map((s) => (
            <Link key={s.productId} href={`${base}/${enc(s.productId)}`} className="block">
              <Card className="p-5 transition hover:border-brand-300 hover:shadow">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">{subscriptionTitle(s, lang)}</span>
                  <span className="font-mono text-xs text-gray-500">{s.productId}</span>
                  {s.archived && <Badge>в архіві</Badge>}
                </div>
                {s.basePlans.length ? (
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    {s.basePlans.map((p) => <BasePlanSummary key={p.basePlanId} plan={p} />)}
                  </div>
                ) : (
                  <Alert tone="warning">Немає базових планів — підписку неможливо купити.</Alert>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
      <div className="mt-4">
        <Checkbox checked={archived} onChange={setArchived} label="Показувати архівні підписки" />
      </div>

      {creating && (
        <NewSubscriptionModal
          open
          onClose={() => setCreating(false)}
          onCreated={(s) => {
            setCreating(false);
            toast("success", `Підписку «${s.productId}» створено`);
            void reload();
          }}
        />
      )}
    </>
  );
}
