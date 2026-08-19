import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: { from: (t: string) => any }, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

async function audit(actorId: string, targetUserId: string | null, action: string, detail: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: actorId,
    target_user_id: targetUserId,
    action,
    detail: JSON.parse(JSON.stringify(detail ?? {})),
  });
}

/** Per-creator control panel data: plan, override, fee rate, usage and grants. */
export const getCreatorAdminDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readUsage, effectiveLimits } = await import("./usage.server");
    const { revenueShareBps, defaultRevenueShareBps } = await import("./earnings.server");

    const [{ data: profile }, usage, limits, feeBps, defaultBps, { data: grants }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, name, org, plan, plan_override, revenue_share_bps")
        .eq("id", data.userId)
        .maybeSingle(),
      readUsage(data.userId),
      effectiveLimits(data.userId),
      revenueShareBps(data.userId),
      defaultRevenueShareBps(),
      supabaseAdmin
        .from("usage_grants")
        .select("id, metric, amount, period, source, note, created_at")
        .eq("creator_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    return {
      profile,
      usage,
      limits: limits.limits,
      grantTotals: limits.grants,
      planId: limits.plan.id,
      feeBps,
      defaultRevenueShareBps: defaultBps,
      grants: grants ?? [],
    };
  });

export const setCreatorPlanOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        // null clears the override and hands control back to the subscription.
        plan: z.enum(["free", "pro", "business"]).nullable(),
        reason: z.string().trim().max(300).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ plan_override: data.plan })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await audit(context.userId, data.userId, "creator.plan_override", { plan: data.plan, reason: data.reason ?? null });
    return { ok: true as const };
  });

export const grantCreatorCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        metric: z.enum(["generations", "attempts", "listings"]),
        amount: z.number().int().min(-100000).max(100000).refine((n) => n !== 0, "Amount cannot be zero"),
        recurring: z.boolean().default(false),
        note: z.string().trim().max(300).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { addUsageGrant } = await import("./usage.server");
    await addUsageGrant({
      creatorId: data.userId,
      metric: data.metric,
      amount: data.amount,
      source: "admin",
      // A recurring grant has no period, so it applies to every month.
      period: data.recurring ? null : undefined,
      note: data.note ?? null,
      createdBy: context.userId,
    });
    await audit(context.userId, data.userId, "creator.credits_granted", data);
    return { ok: true as const };
  });

export const removeCreatorGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ grantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: grant } = await supabaseAdmin
      .from("usage_grants")
      .select("id, creator_id, source")
      .eq("id", data.grantId)
      .maybeSingle();
    if (!grant) return { ok: false as const, reason: "Grant not found." };
    if (grant.source === "purchase") return { ok: false as const, reason: "Purchased packs cannot be removed." };
    await supabaseAdmin.from("usage_grants").delete().eq("id", data.grantId);
    await audit(context.userId, grant.creator_id, "creator.grant_removed", { grantId: data.grantId });
    return { ok: true as const, reason: "" };
  });

export const setCreatorRevenueShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        // null clears the override and falls back to the platform default.
        bps: z.number().int().min(0).max(5000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ revenue_share_bps: data.bps })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await audit(context.userId, data.userId, "creator.revenue_share", { bps: data.bps });
    return { ok: true as const };
  });

export const setPlatformRevenueShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bps: z.number().int().min(0).max(5000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { setDefaultRevenueShareBps } = await import("./earnings.server");
    await setDefaultRevenueShareBps(data.bps);
    await audit(context.userId, null, "platform.revenue_share", { bps: data.bps });
    return { ok: true as const };
  });

export const getAdminAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("admin_audit_log")
      .select("id, actor_id, target_user_id, action, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = [...new Set((rows ?? []).flatMap((r) => [r.actor_id, r.target_user_id]).filter(Boolean))] as string[];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, name, org").in("id", ids)
      : { data: [] as { id: string; name: string | null; org: string | null }[] };
    const nameOf = (id: string | null) => {
      if (!id) return "—";
      const p = (profiles ?? []).find((x) => x.id === id);
      return p?.name ?? p?.org ?? id.slice(0, 8);
    };
    return (rows ?? []).map((r) => ({
      id: r.id,
      action: r.action,
      detail: r.detail,
      createdAt: r.created_at,
      actor: nameOf(r.actor_id),
      target: nameOf(r.target_user_id),
    }));
  });
