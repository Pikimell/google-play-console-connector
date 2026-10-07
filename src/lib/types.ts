// Типи, спільні для сервера і браузера.

export type StoredApp = {
  packageName: string;
  title?: string;
  iconUrl?: string;
  addedAt: string;
};

export type TesterGroup = {
  id: string;
  name: string;
  emails: string[];
  /** Email Google-групи (наприклад my-testers@googlegroups.com) — лише її можна прив'язати через API. */
  googleGroup?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReleaseStatus = "completed" | "inProgress" | "halted" | "draft";

export type ReleaseNote = { language: string; text: string };

export type Release = {
  name?: string;
  versionCodes: string[];
  status: ReleaseStatus;
  userFraction?: number;
  releaseNotes?: ReleaseNote[];
};

export type Track = {
  track: string;
  releases: Release[];
};

export type AppOverview = {
  packageName: string;
  title?: string;
  iconUrl?: string;
  defaultLanguage?: string;
  contactEmail?: string;
  tracks: Track[];
};

export type Bundle = { versionCode: number; sha256?: string; kind: "aab" | "apk" };

export type Listing = {
  language: string;
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
  video?: string;
};

export type AppDetails = {
  defaultLanguage?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
};

export type ImageType =
  | "icon"
  | "featureGraphic"
  | "phoneScreenshots"
  | "sevenInchScreenshots"
  | "tenInchScreenshots"
  | "tvBanner"
  | "tvScreenshots"
  | "wearScreenshots";

export type StoreImage = { id: string; url: string; sha256?: string };

export type Review = {
  reviewId: string;
  authorName?: string;
  rating?: number;
  text?: string;
  lastModified?: string;
  language?: string;
  appVersionName?: string;
  device?: string;
  reply?: { text?: string; lastModified?: string };
};

export type ApiErrorBody = {
  error: { status: number; message: string; hint?: string; details?: string };
};

// ---------- Підписки ----------

export type BasePlanKind = "autoRenewing" | "prepaid" | "installments";
/** ACTIVE, INACTIVE або DRAFT — як у Google Play. */
export type BasePlanState = "ACTIVE" | "INACTIVE" | "DRAFT" | "STATE_UNSPECIFIED";

/** Ціна в регіоні: amount — число в одиницях валюти (наприклад 4.99). */
export type RegionPrice = { region: string; currency: string; amount: number };

export type BasePlan = {
  basePlanId: string;
  state: BasePlanState;
  kind: BasePlanKind;
  /** ISO 8601: P1W, P1M, P3M, P6M, P1Y. */
  period?: string;
  prices: RegionPrice[];
  otherRegions?: { usd?: number; eur?: number };
};

export type SubscriptionListing = {
  language: string;
  title: string;
  description?: string;
  benefits: string[];
};

export type Subscription = {
  productId: string;
  archived: boolean;
  listings: SubscriptionListing[];
  basePlans: BasePlan[];
};

/** Нова ціна, яку Google перерахує в усі регіони. */
export type PriceInput = { currency: string; amount: number };

export type NewBasePlan = {
  basePlanId: string;
  kind: "autoRenewing" | "prepaid";
  period: string;
  price: PriceInput;
};
