import "server-only";
import type { androidpublisher_v3 } from "googleapis";
import { getPublisher } from "./google";
import { assertPackage } from "./play";
import { ApiError } from "./errors";
import type { BasePlan, BasePlanKind, BasePlanState, NewBasePlan, PriceInput, RegionPrice, Subscription, SubscriptionListing } from "./types";

// Підписки живуть поза edit-сесіями: кожен виклик monetization.* застосовується одразу.

type GSubscription = androidpublisher_v3.Schema$Subscription;
type GBasePlan = androidpublisher_v3.Schema$BasePlan;
type GMoney = androidpublisher_v3.Schema$Money;

export const PERIODS = ["P1W", "P1M", "P3M", "P6M", "P1Y"];

function assertProductId(id: string) {
  if (!/^[a-z0-9][a-z0-9_.]{0,39}$/.test(id)) {
    throw new ApiError(400, `«${id}» не підходить як ID підписки.`, "До 40 символів: малі латинські літери, цифри, «_» і «.»; починається з літери або цифри. Наприклад premium_monthly.");
  }
}

function assertBasePlanId(id: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(id)) {
    throw new ApiError(400, `«${id}» не підходить як ID базового плану.`, "До 63 символів: малі латинські літери, цифри й дефіс; починається з літери або цифри. Наприклад monthly.");
  }
}

function toMoney({ currency, amount }: PriceInput): GMoney {
  if (!/^[A-Z]{3}$/.test(currency)) throw new ApiError(400, `Невідома валюта «${currency}».`, "Вкажи код валюти з трьох літер: USD, EUR, UAH…");
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "Ціна має бути більшою за нуль.");
  const cents = Math.round(amount * 100);
  return { currencyCode: currency, units: String(Math.floor(cents / 100)), nanos: (cents % 100) * 10_000_000 };
}

function fromMoney(m?: GMoney): number {
  return Number(m?.units ?? 0) + (m?.nanos ?? 0) / 1e9;
}

function mapBasePlan(b: GBasePlan): BasePlan {
  const kind: BasePlanKind = b.prepaidBasePlanType ? "prepaid" : b.installmentsBasePlanType ? "installments" : "autoRenewing";
  const other = b.otherRegionsConfig;
  return {
    basePlanId: b.basePlanId ?? "",
    state: (b.state as BasePlanState) ?? "STATE_UNSPECIFIED",
    kind,
    period: (b.prepaidBasePlanType ?? b.installmentsBasePlanType ?? b.autoRenewingBasePlanType)?.billingPeriodDuration ?? undefined,
    prices: (b.regionalConfigs ?? []).map(
      (r): RegionPrice => ({ region: r.regionCode ?? "", currency: r.price?.currencyCode ?? "", amount: fromMoney(r.price) }),
    ),
    otherRegions: other ? { usd: other.usdPrice ? fromMoney(other.usdPrice) : undefined, eur: other.eurPrice ? fromMoney(other.eurPrice) : undefined } : undefined,
  };
}

function mapSubscription(s: GSubscription): Subscription {
  return {
    productId: s.productId ?? "",
    archived: !!s.archived,
    listings: (s.listings ?? []).map((l) => ({
      language: l.languageCode ?? "",
      title: l.title ?? "",
      description: l.description ?? undefined,
      benefits: l.benefits ?? [],
    })),
    basePlans: (s.basePlans ?? []).map(mapBasePlan),
  };
}

function toGListings(listings: SubscriptionListing[]) {
  const clean = listings.filter((l) => l.title.trim());
  if (!clean.length) throw new ApiError(400, "Потрібна назва підписки хоча б однією мовою.");
  for (const l of clean) {
    if (l.title.trim().length > 55) throw new ApiError(400, `Назва (${l.language}) довша за 55 символів.`);
    if ((l.description?.trim().length ?? 0) > 80) throw new ApiError(400, `Опис (${l.language}) довший за 80 символів.`);
    const benefits = l.benefits.map((b) => b.trim()).filter(Boolean);
    if (benefits.length > 4) throw new ApiError(400, `Переваг (${l.language}) більше ніж 4.`);
    if (benefits.some((b) => b.length > 40)) throw new ApiError(400, `Перевага (${l.language}) довша за 40 символів.`);
  }
  return clean.map((l) => ({
    languageCode: l.language,
    title: l.title.trim(),
    description: l.description?.trim() || undefined,
    benefits: l.benefits.map((b) => b.trim()).filter(Boolean),
  }));
}

// ---------- Ціни ----------

type Converted = {
  regionsVersion: string;
  regionalConfigs: androidpublisher_v3.Schema$RegionalBasePlanConfig[];
  otherRegionsConfig: androidpublisher_v3.Schema$OtherRegionsBasePlanConfig;
};

/** Перерахувати одну ціну в усі регіони Google Play (як кнопка «Встановити ціни» в Play Console). */
async function convertPrice(pkg: string, price: PriceInput): Promise<Converted> {
  const res = await getPublisher().monetization.convertRegionPrices({ packageName: pkg, requestBody: { price: toMoney(price) } });
  const d = res.data;
  return {
    regionsVersion: d.regionVersion?.version ?? "",
    regionalConfigs: Object.values(d.convertedRegionPrices ?? {}).map((r) => ({ regionCode: r.regionCode, price: r.price, newSubscriberAvailability: true })),
    otherRegionsConfig: { usdPrice: d.convertedOtherRegionsPrice?.usdPrice, eurPrice: d.convertedOtherRegionsPrice?.eurPrice, newSubscriberAvailability: true },
  };
}

/** Попередній перегляд перерахунку — для форми, до збереження. */
export async function previewPrices(pkg: string, price: PriceInput): Promise<{ prices: RegionPrice[]; otherRegions: { usd?: number; eur?: number } }> {
  assertPackage(pkg);
  const c = await convertPrice(pkg, price);
  return {
    prices: c.regionalConfigs.map((r) => ({ region: r.regionCode ?? "", currency: r.price?.currencyCode ?? "", amount: fromMoney(r.price) })),
    otherRegions: { usd: fromMoney(c.otherRegionsConfig.usdPrice), eur: fromMoney(c.otherRegionsConfig.eurPrice) },
  };
}

let versionCache: { pkg: string; version: string; at: number } | null = null;

/** Patch вимагає версію списку регіонів; беремо її з перерахунку ціни (кеш на годину). */
async function regionsVersion(pkg: string) {
  if (versionCache && versionCache.pkg === pkg && Date.now() - versionCache.at < 3600_000) return versionCache.version;
  const { regionsVersion: version } = await convertPrice(pkg, { currency: "USD", amount: 1 });
  versionCache = { pkg, version, at: Date.now() };
  return version;
}

function toGBasePlan(input: NewBasePlan, prices: Converted): GBasePlan {
  assertBasePlanId(input.basePlanId);
  if (!PERIODS.includes(input.period)) throw new ApiError(400, `Невідомий період «${input.period}».`);
  return {
    basePlanId: input.basePlanId,
    ...(input.kind === "prepaid"
      ? { prepaidBasePlanType: { billingPeriodDuration: input.period, timeExtension: "TIME_EXTENSION_ACTIVE" } }
      : { autoRenewingBasePlanType: { billingPeriodDuration: input.period, gracePeriodDuration: "P7D", resubscribeState: "RESUBSCRIBE_STATE_ACTIVE" } }),
    regionalConfigs: prices.regionalConfigs,
    otherRegionsConfig: prices.otherRegionsConfig,
  };
}

// ---------- Підписки ----------

export async function listSubscriptions(pkg: string, showArchived = false): Promise<Subscription[]> {
  assertPackage(pkg);
  const api = getPublisher();
  const out: Subscription[] = [];
  let pageToken: string | undefined;
  do {
    const res = await api.monetization.subscriptions.list({ packageName: pkg, showArchived, pageSize: 100, pageToken });
    out.push(...(res.data.subscriptions ?? []).map(mapSubscription));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

export async function getSubscription(pkg: string, productId: string): Promise<Subscription> {
  assertPackage(pkg);
  assertProductId(productId);
  const res = await getPublisher().monetization.subscriptions.get({ packageName: pkg, productId });
  return mapSubscription(res.data);
}

export type NewSubscription = {
  productId: string;
  listings: SubscriptionListing[];
  basePlan: NewBasePlan;
  activate: boolean;
};

export async function createSubscription(pkg: string, input: NewSubscription): Promise<Subscription> {
  assertPackage(pkg);
  assertProductId(input.productId);
  const listings = toGListings(input.listings);
  const prices = await convertPrice(pkg, input.basePlan.price);
  const api = getPublisher();
  await api.monetization.subscriptions.create({
    packageName: pkg,
    productId: input.productId,
    "regionsVersion.version": prices.regionsVersion,
    requestBody: { packageName: pkg, productId: input.productId, listings, basePlans: [toGBasePlan(input.basePlan, prices)] },
  });
  if (input.activate) {
    await api.monetization.subscriptions.basePlans.activate({
      packageName: pkg,
      productId: input.productId,
      basePlanId: input.basePlan.basePlanId,
      requestBody: { packageName: pkg, productId: input.productId, basePlanId: input.basePlan.basePlanId },
    });
  }
  return getSubscription(pkg, input.productId);
}

async function patch(pkg: string, productId: string, body: GSubscription, updateMask: string, version?: string) {
  const res = await getPublisher().monetization.subscriptions.patch({
    packageName: pkg,
    productId,
    updateMask,
    "regionsVersion.version": version ?? (await regionsVersion(pkg)),
    requestBody: { packageName: pkg, productId, ...body },
  });
  return mapSubscription(res.data);
}

export async function saveListings(pkg: string, productId: string, listings: SubscriptionListing[]) {
  assertPackage(pkg);
  assertProductId(productId);
  return patch(pkg, productId, { listings: toGListings(listings) }, "listings");
}

export async function deleteSubscription(pkg: string, productId: string) {
  assertPackage(pkg);
  assertProductId(productId);
  await getPublisher().monetization.subscriptions.delete({ packageName: pkg, productId });
}

// ---------- Базові плани ----------

/** Patch з updateMask=basePlans замінює весь список, тому беремо поточний і міняємо в ньому. */
async function updateBasePlans(pkg: string, productId: string, change: (plans: GBasePlan[]) => GBasePlan[], version?: string) {
  const current = await getPublisher().monetization.subscriptions.get({ packageName: pkg, productId });
  return patch(pkg, productId, { basePlans: change(current.data.basePlans ?? []) }, "basePlans", version);
}

export async function addBasePlan(pkg: string, productId: string, input: NewBasePlan) {
  assertPackage(pkg);
  assertProductId(productId);
  const prices = await convertPrice(pkg, input.price);
  const plan = toGBasePlan(input, prices);
  return updateBasePlans(
    pkg,
    productId,
    (plans) => {
      if (plans.some((p) => p.basePlanId === input.basePlanId)) throw new ApiError(409, `Базовий план «${input.basePlanId}» уже існує.`);
      return [...plans, plan];
    },
    prices.regionsVersion,
  );
}

export async function setBasePlanPrice(pkg: string, productId: string, basePlanId: string, price: PriceInput) {
  assertPackage(pkg);
  assertProductId(productId);
  const prices = await convertPrice(pkg, price);
  return updateBasePlans(
    pkg,
    productId,
    (plans) => {
      if (!plans.some((p) => p.basePlanId === basePlanId)) throw new ApiError(404, `Базовий план «${basePlanId}» не знайдено.`);
      return plans.map((p) => (p.basePlanId === basePlanId ? { ...p, regionalConfigs: prices.regionalConfigs, otherRegionsConfig: prices.otherRegionsConfig } : p));
    },
    prices.regionsVersion,
  );
}

export async function setBasePlanState(pkg: string, productId: string, basePlanId: string, active: boolean) {
  assertPackage(pkg);
  assertProductId(productId);
  assertBasePlanId(basePlanId);
  const req = { packageName: pkg, productId, basePlanId, requestBody: { packageName: pkg, productId, basePlanId } };
  const plans = getPublisher().monetization.subscriptions.basePlans;
  await (active ? plans.activate(req) : plans.deactivate(req));
}

export async function deleteBasePlan(pkg: string, productId: string, basePlanId: string) {
  assertPackage(pkg);
  assertProductId(productId);
  assertBasePlanId(basePlanId);
  await getPublisher().monetization.subscriptions.basePlans.delete({ packageName: pkg, productId, basePlanId });
}
