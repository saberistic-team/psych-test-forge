export type PlanId = "free" | "pro" | "business";

export type PlanDef = {
  id: PlanId;
  name: string;
  priceLabel: string;
  priceCents: number;
  generations: number | null;
  attempts: number | null;
  listings: number | null;
  canPublish: boolean;
  pdfExport: boolean;
  whiteLabel: boolean;
  features: string[];
};

export const CREATOR_PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    priceCents: 0,
    generations: 2,
    attempts: 5,
    listings: 0,
    canPublish: false,
    pdfExport: false,
    whiteLabel: false,
    features: [
      "2 AI generations per month",
      "Drafts only — publishing locked",
      "Watermarked participant results",
      "5 participant attempts per month",
      "Marketplace listings locked",
      "Community attribution",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$19",
    priceCents: 1900,
    generations: 50,
    attempts: 500,
    listings: 3,
    canPublish: true,
    pdfExport: true,
    whiteLabel: false,
    features: [
      "50 AI generations per month",
      "Publish unlimited tests",
      "500 attempts per month",
      "PDF report export",
      "3 public marketplace listings",
      "Custom branding",
      "Priority generation queue",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceLabel: "$79",
    priceCents: 7900,
    generations: null,
    attempts: 10000,
    listings: null,
    canPublish: true,
    pdfExport: true,
    whiteLabel: true,
    features: [
      "Unlimited AI generations",
      "10,000 attempts per month",
      "Unlimited marketplace listings + featured requests",
      "Full white-label",
      "5 team seats",
      "License-clearance advice for established tests",
      "CSV / API export of results",
    ],
  },
];

export const PARTICIPANT_PRICING = {
  premiumReportCents: 299,
  resultsPlusCents: 900,
};

export type UsageMetric = "generations" | "attempts" | "listings";

export type AddonPack = {
  id: string;
  priceId: string;
  metric: UsageMetric;
  amount: number;
  priceCents: number;
  name: string;
  description: string;
};

/**
 * One-off packs that top up the current month's allowance. They never roll over:
 * a pack bought in March raises March's limit only.
 */
export const ADDON_PACKS: AddonPack[] = [
  {
    id: "generations",
    priceId: "addon_generations_25",
    metric: "generations",
    amount: 25,
    priceCents: 900,
    name: "AI generations pack",
    description: "25 extra AI drafts this month.",
  },
  {
    id: "attempts",
    priceId: "addon_attempts_500",
    metric: "attempts",
    amount: 500,
    priceCents: 900,
    name: "Responses pack",
    description: "500 extra participant responses this month.",
  },
  {
    id: "listings",
    priceId: "addon_listings_3",
    metric: "listings",
    amount: 3,
    priceCents: 900,
    name: "Marketplace listings pack",
    description: "3 extra public listing slots this month.",
  },
];

export const LISTING_ACCESS_PRODUCT = "listing_access";

/** Bounds for a creator-set listing price. */
export const LISTING_PRICE_MIN_CENTS = 100;
export const LISTING_PRICE_MAX_CENTS = 100000;

export const DEFAULT_REVENUE_SHARE_BPS = 2000;

export function packByPriceId(priceId: string): AddonPack | undefined {
  return ADDON_PACKS.find((p) => p.priceId === priceId);
}

/** Packs a plan can actually use — unlimited metrics are not sellable. */
export function packsForPlan(plan: PlanDef): AddonPack[] {
  return ADDON_PACKS.filter((pack) => {
    if (pack.metric === "generations") return plan.generations !== null;
    if (pack.metric === "attempts") return plan.attempts !== null;
    return plan.listings !== null;
  });
}

export function centsToUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function planById(id: string | null | undefined): PlanDef {
  return CREATOR_PLANS.find((p) => p.id === id) ?? CREATOR_PLANS[0]!;
}

export function limitLabel(value: number | null): string {
  return value === null ? "Unlimited" : String(value);
}

export const GENERATION_MODELS = [
  { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash — fast, great default" },
  { id: "openai/gpt-5.4", label: "GPT-5.4 — strongest psychometrics" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini — balanced" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro — long, complex specs" },
];
