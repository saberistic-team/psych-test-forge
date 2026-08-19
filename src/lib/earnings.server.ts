import { DEFAULT_REVENUE_SHARE_BPS } from "./plans";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function monthKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Platform default fee, overridable per creator on profiles.revenue_share_bps. */
export async function revenueShareBps(creatorId: string): Promise<number> {
  const db = await admin();
  const [{ data: profile }, { data: setting }] = await Promise.all([
    db.from("profiles").select("revenue_share_bps").eq("id", creatorId).maybeSingle(),
    db.from("platform_settings").select("value").eq("key", "revenue_share_bps").maybeSingle(),
  ]);
  if (typeof profile?.revenue_share_bps === "number") return profile.revenue_share_bps;
  const fallback = Number(setting?.value ?? DEFAULT_REVENUE_SHARE_BPS);
  return Number.isFinite(fallback) ? fallback : DEFAULT_REVENUE_SHARE_BPS;
}

export async function defaultRevenueShareBps(): Promise<number> {
  const db = await admin();
  const { data } = await db.from("platform_settings").select("value").eq("key", "revenue_share_bps").maybeSingle();
  const value = Number(data?.value ?? DEFAULT_REVENUE_SHARE_BPS);
  return Number.isFinite(value) ? value : DEFAULT_REVENUE_SHARE_BPS;
}

export async function setDefaultRevenueShareBps(bps: number) {
  const db = await admin();
  await db
    .from("platform_settings")
    .upsert({ key: "revenue_share_bps", value: bps as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

/**
 * Records a paid listing sale and its earning line. Idempotent on the payment
 * reference, so a replayed webhook cannot double-credit a creator.
 */
export async function recordListingSale(input: {
  testId: string;
  participantId: string;
  buyerUserId?: string | null;
  mode: "take" | "results";
  amountCents: number;
  currency: string;
  providerRef: string;
  environment: string;
}) {
  const db = await admin();
  const { data: test } = await db.from("tests").select("id, creator_id").eq("id", input.testId).maybeSingle();
  if (!test) throw new Error("Unknown test for listing purchase");

  const { data: existing } = await db
    .from("listing_purchases")
    .select("id")
    .eq("provider_ref", input.providerRef)
    .maybeSingle();
  if (existing) return { purchaseId: existing.id, duplicate: true as const };

  const { data: purchase, error } = await db
    .from("listing_purchases")
    .insert({
      test_id: input.testId,
      creator_id: test.creator_id,
      participant_id: input.participantId,
      buyer_user_id: input.buyerUserId ?? null,
      mode: input.mode,
      amount_cents: input.amountCents,
      currency: input.currency,
      provider_ref: input.providerRef,
      environment: input.environment,
    })
    .select("id")
    .single();
  if (error || !purchase) throw new Error(error?.message ?? "Could not record the purchase");

  const feeBps = await revenueShareBps(test.creator_id);
  const feeCents = Math.round((input.amountCents * feeBps) / 10000);
  const { error: earnError } = await db.from("creator_earnings").insert({
    purchase_id: purchase.id,
    creator_id: test.creator_id,
    test_id: input.testId,
    month: monthKey(),
    gross_cents: input.amountCents,
    fee_bps: feeBps,
    fee_cents: feeCents,
    net_cents: input.amountCents - feeCents,
    environment: input.environment,
  });
  if (earnError) throw new Error(earnError.message);
  return { purchaseId: purchase.id, duplicate: false as const };
}

/** A refund or chargeback reverses the earning so it is never paid out. */
export async function reverseListingSale(providerRef: string) {
  const db = await admin();
  const { data: purchase } = await db
    .from("listing_purchases")
    .select("id")
    .eq("provider_ref", providerRef)
    .maybeSingle();
  if (!purchase) return { ok: false as const };
  await db.from("listing_purchases").update({ status: "refunded" }).eq("id", purchase.id);
  await db.from("creator_earnings").update({ status: "reversed" }).eq("purchase_id", purchase.id);
  return { ok: true as const };
}

/**
 * Groups every open earning from a finished month into that creator's payout row.
 * Runs lazily whenever earnings are read, so no scheduled job is required.
 */
export async function closeFinishedMonths(creatorId?: string) {
  const db = await admin();
  const current = monthKey();
  let query = db
    .from("creator_earnings")
    .select("id, creator_id, month, gross_cents, fee_cents, net_cents, environment, status")
    .eq("status", "open")
    .lt("month", current);
  if (creatorId) query = query.eq("creator_id", creatorId);
  const { data: rows } = await query;
  if (!rows?.length) return { closed: 0 };

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.creator_id}|${row.month}|${row.environment}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  for (const [key, group] of groups) {
    const [creator, month, environment] = key.split("|") as [string, string, string];
    const gross = group.reduce((s, r) => s + r.gross_cents, 0);
    const fee = group.reduce((s, r) => s + r.fee_cents, 0);
    const net = group.reduce((s, r) => s + r.net_cents, 0);

    const { data: existing } = await db
      .from("payouts")
      .select("id, gross_cents, fee_cents, net_cents, status")
      .eq("creator_id", creator)
      .eq("month", month)
      .eq("environment", environment)
      .maybeSingle();

    let payoutId = existing?.id ?? null;
    if (existing) {
      await db
        .from("payouts")
        .update({
          gross_cents: existing.gross_cents + gross,
          fee_cents: existing.fee_cents + fee,
          net_cents: existing.net_cents + net,
        })
        .eq("id", existing.id);
    } else {
      const { data: created } = await db
        .from("payouts")
        .insert({
          creator_id: creator,
          month,
          environment,
          gross_cents: gross,
          fee_cents: fee,
          net_cents: net,
          status: "pending",
        })
        .select("id")
        .single();
      payoutId = created?.id ?? null;
    }
    if (payoutId) {
      await db
        .from("creator_earnings")
        .update({ status: "pending", payout_id: payoutId })
        .in(
          "id",
          group.map((r) => r.id),
        );
    }
  }
  return { closed: rows.length };
}

export type EarningsSummary = {
  month: string;
  currentMonth: { grossCents: number; feeCents: number; netCents: number; sales: number };
  lifetime: { grossCents: number; netCents: number; sales: number };
  perTest: {
    testId: string;
    title: string;
    priceCents: number;
    saleMode: string;
    sales: number;
    grossCents: number;
    netCents: number;
  }[];
  months: {
    month: string;
    grossCents: number;
    feeCents: number;
    netCents: number;
    sales: number;
    status: "open" | "pending" | "paid";
    reference: string | null;
    paidAt: string | null;
  }[];
  feeBps: number;
};

export async function earningsForCreator(creatorId: string, environment: string): Promise<EarningsSummary> {
  await closeFinishedMonths(creatorId);
  const db = await admin();
  const current = monthKey();

  const [{ data: earnings }, { data: payouts }, feeBps] = await Promise.all([
    db
      .from("creator_earnings")
      .select("test_id, month, gross_cents, fee_cents, net_cents, status")
      .eq("creator_id", creatorId)
      .eq("environment", environment)
      .neq("status", "reversed"),
    db
      .from("payouts")
      .select("month, gross_cents, fee_cents, net_cents, status, reference, paid_at")
      .eq("creator_id", creatorId)
      .eq("environment", environment),
    revenueShareBps(creatorId),
  ]);

  const rows = earnings ?? [];
  const testIds = [...new Set(rows.map((r) => r.test_id))];
  const { data: tests } = testIds.length
    ? await db.from("tests").select("id, title, price_cents, sale_mode").in("id", testIds)
    : { data: [] as { id: string; title: string; price_cents: number; sale_mode: string }[] };
  const testById = new Map((tests ?? []).map((t) => [t.id, t]));

  const thisMonth = rows.filter((r) => r.month === current);
  const perTest = testIds.map((id) => {
    const mine = rows.filter((r) => r.test_id === id);
    const test = testById.get(id);
    return {
      testId: id,
      title: test?.title ?? "Questionnaire",
      priceCents: test?.price_cents ?? 0,
      saleMode: test?.sale_mode ?? "free",
      sales: mine.length,
      grossCents: mine.reduce((s, r) => s + r.gross_cents, 0),
      netCents: mine.reduce((s, r) => s + r.net_cents, 0),
    };
  });
  perTest.sort((a, b) => b.netCents - a.netCents);

  const monthKeys = [...new Set([...rows.map((r) => r.month), ...(payouts ?? []).map((p) => p.month)])].sort(
    (a, b) => b.localeCompare(a),
  );
  const payoutByMonth = new Map((payouts ?? []).map((p) => [p.month, p]));

  return {
    month: current,
    currentMonth: {
      grossCents: thisMonth.reduce((s, r) => s + r.gross_cents, 0),
      feeCents: thisMonth.reduce((s, r) => s + r.fee_cents, 0),
      netCents: thisMonth.reduce((s, r) => s + r.net_cents, 0),
      sales: thisMonth.length,
    },
    lifetime: {
      grossCents: rows.reduce((s, r) => s + r.gross_cents, 0),
      netCents: rows.reduce((s, r) => s + r.net_cents, 0),
      sales: rows.length,
    },
    perTest,
    months: monthKeys.map((month) => {
      const mine = rows.filter((r) => r.month === month);
      const payout = payoutByMonth.get(month);
      const status: "open" | "pending" | "paid" =
        month === current ? "open" : payout?.status === "paid" ? "paid" : "pending";
      return {
        month,
        grossCents: mine.reduce((s, r) => s + r.gross_cents, 0) || (payout?.gross_cents ?? 0),
        feeCents: mine.reduce((s, r) => s + r.fee_cents, 0) || (payout?.fee_cents ?? 0),
        netCents: mine.reduce((s, r) => s + r.net_cents, 0) || (payout?.net_cents ?? 0),
        sales: mine.length,
        status,
        reference: payout?.reference ?? null,
        paidAt: payout?.paid_at ?? null,
      };
    }),
    feeBps,
  };
}

export async function adminPayouts(environment: string) {
  await closeFinishedMonths();
  const db = await admin();
  const [{ data: payouts }, { data: profiles }, { data: accounts }] = await Promise.all([
    db
      .from("payouts")
      .select("id, creator_id, month, gross_cents, fee_cents, net_cents, status, reference, note, paid_at")
      .eq("environment", environment)
      .order("month", { ascending: false }),
    db.from("profiles").select("id, name, org"),
    db.from("payout_accounts").select("creator_id, method, details, holder_name, country"),
  ]);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const accountById = new Map((accounts ?? []).map((a) => [a.creator_id, a]));
  return (payouts ?? []).map((p) => {
    const account = accountById.get(p.creator_id);
    return {
      id: p.id,
      creatorId: p.creator_id,
      creator: byId.get(p.creator_id)?.name ?? byId.get(p.creator_id)?.org ?? "—",
      month: p.month,
      grossCents: p.gross_cents,
      feeCents: p.fee_cents,
      netCents: p.net_cents,
      status: p.status,
      reference: p.reference,
      note: p.note,
      paidAt: p.paid_at,
      payoutMethod: account?.method ?? null,
      payoutDetails: account?.details ?? null,
      payoutHolder: account?.holder_name ?? null,
      payoutCountry: account?.country ?? null,
    };
  });
}
