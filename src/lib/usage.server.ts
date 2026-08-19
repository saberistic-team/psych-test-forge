import { CREATOR_PLANS, type PlanDef } from "./plans";

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function planForUser(userId: string): Promise<PlanDef> {
  const db = await admin();
  const { data } = await db.from("profiles").select("plan").eq("id", userId).maybeSingle();
  return CREATOR_PLANS.find((p) => p.id === data?.plan) ?? CREATOR_PLANS[0]!;
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

export async function checkAndCountGeneration(userId: string) {
  const plan = await planForUser(userId);
  const usage = await readUsage(userId);
  if (plan.generations !== null && usage.generations >= plan.generations) {
    return {
      allowed: false as const,
      plan: plan.id,
      reason: `Your ${plan.name} plan includes ${plan.generations} AI generations per month and you have used all of them.`,
    };
  }
  await increment(userId, "generations");
  return { allowed: true as const, plan: plan.id, reason: "" };
}

export async function checkAndCountAttempt(creatorId: string) {
  const plan = await planForUser(creatorId);
  const usage = await readUsage(creatorId);
  if (plan.attempts !== null && usage.attempts >= plan.attempts) {
    return {
      allowed: false as const,
      reason: "This test has reached the monthly response limit of its creator's plan.",
    };
  }
  await increment(creatorId, "attempts");
  return { allowed: true as const, reason: "" };
}

/** Live listing slots: the number of currently listed tests is the source of truth. */
export async function listingUsage(userId: string) {
  const db = await admin();
  const plan = await planForUser(userId);
  const { count } = await db
    .from("tests")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", userId)
    .eq("listed", true)
    .is("deleted_at", null);
  const used = count ?? 0;
  const limit = plan.listings;
  return {
    plan,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    canRequestFeatured: plan.id === "business",
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
          : `Your ${usage.plan.name} plan includes ${usage.limit} public listings and all of them are in use. Unlist a test or upgrade to Business for unlimited listings.`,
    };
  }
  await increment(userId, "listings");
  return { allowed: true as const, status: 200 as const, plan: usage.plan.id, used: usage.used, limit: usage.limit, reason: "" };
}

export async function countPdfExport(userId: string) {
  await increment(userId, "pdf_exports");
}
