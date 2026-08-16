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
