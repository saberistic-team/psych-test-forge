import { CREATOR_PLANS, type PlanDef, type UsageMetric } from "./plans";

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * The plan in force for a creator. `plan_override` is an admin grant and wins over
 * the subscription-derived `plan`, so a webhook can't silently undo an admin decision.
 */
export async function planForUser(userId: string): Promise<PlanDef> {
  const db = await admin();
  const { data } = await db.from("profiles").select("plan, plan_override").eq("id", userId).maybeSingle();
  const id = data?.plan_override ?? data?.plan;
  return CREATOR_PLANS.find((p) => p.id === id) ?? CREATOR_PLANS[0]!;
}

export async function readUsage(userId: string) {
  const db = await admin();
  const period = currentPeriod();
  const { data } = await db
    .from("usage_metering")
    .select("metric, value")
    .eq("creator_id", userId)
    .eq("period", period);
  const map: Record<string, number> = { generations: 0, attempts: 0, pdf_exports: 0, listings: 0 };
  for (const row of data ?? []) map[row.metric] = row.value;
  return { period, ...map } as {
    period: string;
    generations: number;
    attempts: number;
    pdf_exports: number;
    listings: number;
  };
}

export type GrantTotals = Record<UsageMetric, { purchased: number; admin: number; total: number }>;

/**
 * Extra units on top of the plan for the current month. A grant with `period = null`
 * is a recurring monthly bonus; a dated grant only counts in its own month.
 */
export async function readGrants(userId: string): Promise<GrantTotals> {
  const db = await admin();
  const period = currentPeriod();
  const { data } = await db
    .from("usage_grants")
    .select("metric, amount, period, source")
    .eq("creator_id", userId)
    .or(`period.is.null,period.eq.${period}`);
  const empty = (): GrantTotals[UsageMetric] => ({ purchased: 0, admin: 0, total: 0 });
  const totals: GrantTotals = { generations: empty(), attempts: empty(), listings: empty() };
  for (const row of data ?? []) {
    const bucket = totals[row.metric as UsageMetric];
    if (!bucket) continue;
    if (row.source === "purchase") bucket.purchased += row.amount;
    else bucket.admin += row.amount;
    bucket.total += row.amount;
  }
  return totals;
}

export type EffectiveLimits = {
  plan: PlanDef;
  grants: GrantTotals;
  limits: Record<UsageMetric, number | null>;
};

/** plan allowance + purchased packs + admin grants, for the current month. */
export async function effectiveLimits(userId: string): Promise<EffectiveLimits> {
  const [plan, grants] = await Promise.all([planForUser(userId), readGrants(userId)]);
  const add = (base: number | null, metric: UsageMetric) =>
    base === null ? null : base + grants[metric].total;
  return {
    plan,
    grants,
    limits: {
      generations: add(plan.generations, "generations"),
      attempts: add(plan.attempts, "attempts"),
      listings: add(plan.listings, "listings"),
    },
  };
}

async function increment(userId: string, metric: string) {
  const db = await admin();
  const period = currentPeriod();
  const { data: existing } = await db
    .from("usage_metering")
    .select("id, value")
    .eq("creator_id", userId)
    .eq("metric", metric)
    .eq("period", period)
    .maybeSingle();
  if (existing) {
    await db
      .from("usage_metering")
      .update({ value: existing.value + 1 })
      .eq("id", existing.id);
  } else {
    await db.from("usage_metering").insert({ creator_id: userId, metric, period, value: 1 });
  }
}

async function decrement(userId: string, metric: string) {
  const db = await admin();
  const period = currentPeriod();
  const { data: existing } = await db
    .from("usage_metering")
    .select("id, value")
    .eq("creator_id", userId)
    .eq("metric", metric)
    .eq("period", period)
    .maybeSingle();
  if (existing && existing.value > 0) {
    await db
      .from("usage_metering")
      .update({ value: Math.max(0, existing.value - 1) })
      .eq("id", existing.id);
  }
}

/** Gives back a generation credit when the run failed — failed attempts are never charged. */
export async function releaseGeneration(userId: string) {
  await decrement(userId, "generations");
}

function extraLabel(grants: GrantTotals[UsageMetric]): string {
  const parts: string[] = [];
  if (grants.purchased) parts.push(`${grants.purchased} purchased`);
  if (grants.admin) parts.push(`${grants.admin} granted`);
  return parts.length ? ` (including ${parts.join(" and ")})` : "";
}

export async function checkAndCountGeneration(userId: string) {
  const { plan, limits, grants } = await effectiveLimits(userId);
  const usage = await readUsage(userId);
  const limit = limits.generations;
  if (limit !== null && usage.generations >= limit) {
    return {
      allowed: false as const,
      plan: plan.id,
      reason: `You have used all ${limit} AI generations available this month${extraLabel(grants.generations)}. Buy a generations pack in Billing or upgrade your plan.`,
    };
  }
  await increment(userId, "generations");
  return { allowed: true as const, plan: plan.id, reason: "" };
}

export async function checkAndCountAttempt(creatorId: string) {
  const { limits, grants } = await effectiveLimits(creatorId);
  const usage = await readUsage(creatorId);
  const limit = limits.attempts;
  if (limit !== null && usage.attempts >= limit) {
    return {
      allowed: false as const,
      reason: `This questionnaire has reached its monthly response limit of ${limit}${extraLabel(grants.attempts)}.`,
    };
  }
  await increment(creatorId, "attempts");
  return { allowed: true as const, reason: "" };
}

/** Live listing slots: the number of currently listed tests is the source of truth. */
export async function listingUsage(userId: string) {
  const db = await admin();
  const { plan, limits, grants } = await effectiveLimits(userId);
  const { count } = await db
    .from("tests")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", userId)
    .eq("listed", true)
    .is("deleted_at", null);
  const used = count ?? 0;
  const limit = limits.listings;
  return {
    plan,
    grants,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    canRequestFeatured: plan.id === "business",
    canPriceListings: plan.id === "business",
  };
}

export async function checkAndCountListing(userId: string) {
  const usage = await listingUsage(userId);
  if (usage.limit !== null && usage.used >= usage.limit) {
    return {
      allowed: false as const,
      status: 402 as const,
      plan: usage.plan.id,
      used: usage.used,
      limit: usage.limit,
      reason:
        usage.limit === 0
          ? `Public marketplace listings are a paid feature — the ${usage.plan.name} plan includes none. Upgrade to Pro for 3 listings.`
          : `All ${usage.limit} of your public listing slots${extraLabel(usage.grants.listings)} are in use. Unlist a test, buy a listings pack, or upgrade to Business for unlimited listings.`,
    };
  }
  await increment(userId, "listings");
  return {
    allowed: true as const,
    status: 200 as const,
    plan: usage.plan.id,
    used: usage.used,
    limit: usage.limit,
    reason: "",
  };
}

export async function countPdfExport(userId: string) {
  await increment(userId, "pdf_exports");
}

/** Records a bought pack or an admin grant. Idempotent per payment reference. */
export async function addUsageGrant(input: {
  creatorId: string;
  metric: UsageMetric;
  amount: number;
  source: "admin" | "purchase";
  period?: string | null | undefined;
  note?: string | null;
  providerRef?: string | null;
  environment?: string;
  createdBy?: string | null;
}) {
  const db = await admin();
  const { error } = await db.from("usage_grants").insert({
    creator_id: input.creatorId,
    metric: input.metric,
    amount: input.amount,
    source: input.source,
    period: input.period === undefined ? currentPeriod() : input.period,
    note: input.note ?? null,
    provider_ref: input.providerRef ?? null,
    environment: input.environment ?? "sandbox",
    created_by: input.createdBy ?? null,
  });
  // A duplicate provider_ref means the webhook already applied this purchase.
  if (error && !error.message.includes("duplicate key")) throw new Error(error.message);
  return { ok: !error };
}
