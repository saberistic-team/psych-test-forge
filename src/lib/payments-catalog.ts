/** Human-readable price IDs used by checkout code (client-safe). */
export const PRICE_IDS = {
  proMonthly: "pro_monthly",
  proYearly: "pro_yearly",
  businessMonthly: "business_monthly",
  businessYearly: "business_yearly",
  premiumReport: "premium_report_once",
  resultsPlusMonthly: "results_plus_monthly",
} as const;

/** Price used to resolve the marketplace access product for creator-set prices. */
export const LISTING_ACCESS_PRICE = "listing_access_default";

export type BillingInterval = "month" | "year";

/** Maps a price ID to the internal plan it grants. */
export const PRICE_TO_PLAN: Record<string, string> = {
  pro_monthly: "pro",
  pro_yearly: "pro",
  business_monthly: "business",
  business_yearly: "business",
  results_plus_monthly: "results_plus",
};

export const CREATOR_PLAN_PRICES: Record<"pro" | "business", Record<BillingInterval, string>> = {
  pro: { month: PRICE_IDS.proMonthly, year: PRICE_IDS.proYearly },
  business: { month: PRICE_IDS.businessMonthly, year: PRICE_IDS.businessYearly },
};

export const YEARLY_PRICES: Record<"pro" | "business", number> = {
  pro: 19000,
  business: 79000,
};

/** Statuses that keep paid features unlocked (past_due is a dunning grace period). */
export const ACTIVE_STATUSES = ["active", "trialing", "past_due"];
