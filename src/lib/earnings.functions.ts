import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const envSchema = z.enum(["sandbox", "live"]);

async function assertAdmin(supabase: { from: (t: string) => any }, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

/** Creator earnings: this month, per questionnaire, and every settled month. */
export const getMyEarnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ environment: envSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { earningsForCreator } = await import("./earnings.server");
    const { planForUser } = await import("./usage.server");
    const [summary, plan] = await Promise.all([
      earningsForCreator(context.userId, data.environment),
      planForUser(context.userId),
    ]);
    const { data: account } = await context.supabase
      .from("payout_accounts")
      .select("method, details, holder_name, country")
      .eq("creator_id", context.userId)
      .maybeSingle();
    return { summary, plan: plan.id, canSell: plan.id === "business", account };
  });

export const saveMyPayoutAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        method: z.enum(["bank", "paypal", "wise", "other"]),
        details: z.string().trim().min(3).max(400),
        holderName: z.string().trim().max(160).nullish(),
        country: z.string().trim().max(80).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("payout_accounts").upsert(
      {
        creator_id: context.userId,
        method: data.method,
        details: data.details,
        holder_name: data.holderName ?? null,
        country: data.country ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "creator_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin settlement queue: closed months per creator with payout details. */
export const getAdminPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ environment: envSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { adminPayouts, defaultRevenueShareBps } = await import("./earnings.server");
    const [rows, defaultBps] = await Promise.all([adminPayouts(data.environment), defaultRevenueShareBps()]);
    return { payouts: rows, defaultRevenueShareBps: defaultBps };
  });

export const markPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        payoutId: z.string().uuid(),
        paid: z.boolean().default(true),
        reference: z.string().trim().max(200).nullish(),
        note: z.string().trim().max(500).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("payouts")
      .update({
        status: data.paid ? "paid" : "pending",
        reference: data.reference ?? null,
        note: data.note ?? null,
        paid_at: data.paid ? new Date().toISOString() : null,
      })
      .eq("id", data.payoutId);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("creator_earnings")
      .update({ status: data.paid ? "paid" : "pending" })
      .eq("payout_id", data.payoutId);
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: data.paid ? "payout.marked_paid" : "payout.reopened",
      detail: { payoutId: data.payoutId, reference: data.reference ?? null },
    });
    return { ok: true as const };
  });
