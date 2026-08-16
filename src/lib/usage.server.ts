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
  const map: Record<string, number> = { generations: 0, attempts: 0, pdf_exports: 0 };
  for (const row of data ?? []) map[row.metric] = row.value;
  return { period, ...map } as { period: string; generations: number; attempts: number; pdf_exports: number };
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

export async function countPdfExport(userId: string) {
  await increment(userId, "pdf_exports");
}
