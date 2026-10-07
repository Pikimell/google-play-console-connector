"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Pause, Play, Plus, Tag, Trash2 } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { BasePlanFields, BasePlanSummary, EMPTY_PLAN, ListingFields, PriceFields, PricePreview, emptyListing } from "@/components/subscription-parts";
import { Alert, Badge, Button, Card, ErrorBox, Modal, PageHeader, SectionTitle, Select, Skeleton, cn, useToast } from "@/components/ui";
import { api, enc, errorInfo, type ErrInfo } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import { LANGUAGES, languageName } from "@/lib/tracks";
import type { BasePlan, NewBasePlan, PriceInput, Subscription, SubscriptionListing } from "@/lib/types";

function ListingsEditor({ sub, url, defaultLanguage, onSaved }: { sub: Subscription; url: string; defaultLanguage?: string; onSaved: (s: Subscription) => void }) {
  const toast = useToast();
  const [lang, setLang] = useState<string>();
  const [edits, setEdits] = useState<Record<string, SubscriptionListing>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrInfo>();
  const [adding, setAdding] = useState(false);
  const [newLang, setNewLang] = useState("");

  const languages = [...new Set([...sub.listings.map((l) => l.language), ...Object.keys(edits)])].sort((a, b) =>
    a === defaultLanguage ? -1 : b === defaultLanguage ? 1 : a.localeCompare(b),
  );
  const current = lang ?? languages[0];
  const original = sub.listings.find((l) => l.language === current) ?? emptyListing(current ?? "");
  const form = (current && edits[current]) || original;
  const dirtyLangs = Object.keys(edits).filter((l) => JSON.stringify(edits[l]) !== JSON.stringify(sub.listings.find((x) => x.language === l)));

  async function save(listings: SubscriptionListing[], message: string) {
    setBusy(true);
    setError(undefined);
    try {
      const s = await api<Subscription>(url, { method: "PUT", json: { listings } });
      setEdits({});
      onSaved(s);
      toast("success", message);
    } catch (e) {
      setError(errorInfo(e));
    } finally {
      setBusy(false);
    }
  }

  const merged = () => {
    const map = new Map(sub.listings.map((l) => [l.language, l]));
    for (const [l, v] of Object.entries(edits)) map.set(l, v);
    return [...map.values()];
  };

  return (
    <section className="mb-8">
      <SectionTitle>Назва й опис</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <div className="space-y-1">
          {languages.map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm", l === current ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-gray-100")}
            >
              <span className="truncate">{languageName(l)}</span>
              {dirtyLangs.includes(l) && <span className="size-2 rounded-full bg-amber-500" />}
            </button>
          ))}
          <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Додати мову</Button>
        </div>
        {current && (
          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{languageName(current)} <span className="font-mono text-xs text-gray-400">{current}</span></h3>
              {languages.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 className="size-3.5" />}
                  onClick={() => {
                    if (!confirm(`Видалити опис «${languageName(current)}»?`)) return;
                    const rest = merged().filter((l) => l.language !== current);
                    setLang(undefined);
                    void save(rest, "Мову видалено");
                  }}
                >
                  Видалити
                </Button>
              )}
            </div>
            <ListingFields value={form} onChange={(v) => setEdits({ ...edits, [current]: v })} />
            <ErrorBox error={error} />
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              {dirtyLangs.length > 0 && <Button variant="ghost" onClick={() => setEdits({})}>Скасувати зміни</Button>}
              <Button disabled={!dirtyLangs.length} loading={busy} onClick={() => save(merged(), "Опис підписки збережено")}>
                Зберегти{dirtyLangs.length > 1 ? ` (${dirtyLangs.length} мови)` : ""}
              </Button>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Додати мову"
        footer={
          <Button
            disabled={!newLang}
            onClick={() => {
              const source = sub.listings.find((l) => l.language === defaultLanguage) ?? sub.listings[0];
              setEdits({ ...edits, [newLang]: { ...emptyListing(newLang), benefits: source ? source.benefits.map(() => "") : [] } });
              setLang(newLang);
              setAdding(false);
              setNewLang("");
            }}
          >
            Додати
          </Button>
        }
      >
        <Select value={newLang} onChange={(e) => setNewLang(e.target.value)}>
          <option value="">Обери мову…</option>
          {LANGUAGES.filter((l) => !languages.includes(l.code)).map((l) => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
        </Select>
      </Modal>
    </section>
  );
}

function BasePlanRow({ plan, url, onChange }: { plan: BasePlan; url: string; onChange: (s: Subscription) => void }) {
  const { pkg } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState<string>();
  const [pricing, setPricing] = useState(false);
  const usd = plan.prices.find((p) => p.region === "US");
  const [price, setPrice] = useState<PriceInput>({ currency: usd?.currency ?? "USD", amount: usd?.amount ?? NaN });
  const [error, setError] = useState<ErrInfo>();
  const planUrl = `${url}/base-plans/${enc(plan.basePlanId)}`;

  async function run(kind: string, init: Parameters<typeof api>[1], message: string) {
    setBusy(kind);
    setError(undefined);
    try {
      onChange(await api<Subscription>(planUrl, init));
      toast("success", message);
      return true;
    } catch (e) {
      setError(errorInfo(e));
      return false;
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BasePlanSummary plan={plan} />
        <div className="flex flex-wrap gap-1.5">
          {plan.kind !== "installments" && (
            <Button size="sm" variant="secondary" icon={<Tag className="size-3.5" />} onClick={() => setPricing(true)}>Ціна</Button>
          )}
          {plan.state === "ACTIVE" ? (
            <Button
              size="sm"
              variant="secondary"
              loading={busy === "state"}
              icon={<Pause className="size-3.5" />}
              onClick={() => confirm("Деактивувати план? Нові користувачі не зможуть його купити, чинні підписники продовжуватимуть платити.") && run("state", { method: "POST", json: { action: "deactivate" } }, "План деактивовано")}
            >
              Деактивувати
            </Button>
          ) : (
            <Button size="sm" variant="secondary" loading={busy === "state"} icon={<Play className="size-3.5" />} onClick={() => run("state", { method: "POST", json: { action: "activate" } }, "План активовано")}>
              Активувати
            </Button>
          )}
          {plan.state === "DRAFT" && (
            <Button
              size="sm"
              variant="danger"
              loading={busy === "delete"}
              icon={<Trash2 className="size-3.5" />}
              onClick={() => confirm(`Видалити чернетку плану «${plan.basePlanId}»?`) && run("delete", { method: "DELETE" }, "План видалено")}
            />
          )}
        </div>
      </div>
      <ErrorBox error={error} className="mt-3" />

      <Modal
        open={pricing}
        onClose={() => setPricing(false)}
        title={`Нова ціна · ${plan.basePlanId}`}
        footer={
          <Button
            loading={busy === "price"}
            disabled={!(price.amount > 0)}
            onClick={async () => (await run("price", { method: "POST", json: { action: "price", price } }, "Ціни оновлено в усіх країнах")) && setPricing(false)}
          >
            Застосувати в усіх країнах
          </Button>
        }
      >
        <div className="space-y-4">
          <PriceFields value={price} onChange={setPrice} />
          <PricePreview pkg={pkg} price={price} />
          <Alert tone="info">
            Нова ціна діє для нових підписників. Чинні підписники лишаються на старій ціні — перевести їх можна в Play Console («Міграція цін»), Google попереджає їх заздалегідь.
          </Alert>
          <ErrorBox error={error} />
        </div>
      </Modal>
    </Card>
  );
}

function AddBasePlanModal({ url, onClose, onAdded }: { url: string; onClose: () => void; onAdded: (s: Subscription) => void }) {
  const { pkg } = useApp();
  const [plan, setPlan] = useState<NewBasePlan>({ ...EMPTY_PLAN, basePlanId: "yearly", period: "P1Y" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrInfo>();
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Новий базовий план"
      footer={
        <Button
          loading={busy}
          disabled={!plan.basePlanId || !(plan.price.amount > 0)}
          onClick={async () => {
            setBusy(true);
            setError(undefined);
            try {
              onAdded(await api<Subscription>(`${url}/base-plans`, { method: "POST", json: plan }));
            } catch (e) {
              setError(errorInfo(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Створити чернетку
        </Button>
      }
    >
      <BasePlanFields pkg={pkg} value={plan} onChange={setPlan} />
      <p className="mt-4 text-xs text-gray-500">План з&apos;явиться як чернетка — активуй його, коли будеш готовий продавати.</p>
      <ErrorBox error={error} className="mt-3" />
    </Modal>
  );
}

export default function SubscriptionPage() {
  const params = useParams<{ productId: string }>();
  const productId = decodeURIComponent(params.productId);
  const { pkg, data: app } = useApp();
  const router = useRouter();
  const toast = useToast();
  const list = `/apps/${enc(pkg)}/subscriptions`;
  const url = `/api/apps/${enc(pkg)}/subscriptions/${enc(productId)}`;
  const { data, error, loading, reload, setData } = useApi<Subscription>(url);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lang = app?.overview.defaultLanguage;
  const title = data && ((data.listings.find((l) => l.language === lang) ?? data.listings[0])?.title || data.productId);

  async function remove() {
    if (!confirm(`Видалити підписку «${productId}»? Це можливо лише якщо її ще ніхто не купував.`)) return;
    setDeleting(true);
    try {
      await api(url, { method: "DELETE" });
      toast("success", "Підписку видалено");
      router.push(list);
    } catch (e) {
      toast("error", errorInfo(e).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={title ?? productId}
        description={<span className="font-mono">{productId}</span>}
        back={<Link href={list} className="mb-2 inline-block text-sm text-gray-500 hover:text-gray-800">← Усі підписки</Link>}
        actions={data && <Button variant="danger" loading={deleting} icon={<Trash2 className="size-4" />} onClick={remove}>Видалити</Button>}
      />
      <ErrorBox error={error} onRetry={reload} className="mb-4" />
      {loading && !data ? (
        <Skeleton className="h-96" />
      ) : data ? (
        <>
          {data.archived && <Alert tone="warning" className="mb-6">Підписка в архіві — нові покупки неможливі.</Alert>}
          <ListingsEditor sub={data} url={url} defaultLanguage={lang} onSaved={setData} />
          <section>
            <SectionTitle aside={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Додати план</Button>}>
              Базові плани <Badge className="ml-1">{data.basePlans.length}</Badge>
            </SectionTitle>
            <div className="space-y-3">
              {data.basePlans.map((p) => <BasePlanRow key={p.basePlanId} plan={p} url={url} onChange={setData} />)}
              {!data.basePlans.length && <Alert tone="warning">Немає базових планів — підписку неможливо купити. Додай хоча б один і активуй.</Alert>}
            </div>
          </section>
          {adding && (
            <AddBasePlanModal
              url={url}
              onClose={() => setAdding(false)}
              onAdded={(s) => {
                setData(s);
                setAdding(false);
                toast("success", "Базовий план створено як чернетку");
              }}
            />
          )}
        </>
      ) : null}
    </>
  );
}
