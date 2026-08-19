import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  LISTING_ACCESS_PRODUCT,
  LISTING_PRICE_MAX_CENTS,
  LISTING_PRICE_MIN_CENTS,
} from "./plans";

const envSchema = z.enum(["sandbox", "live"]);

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** True when this participant already paid for this listing in this environment. */
async function hasPaid(testId: string, participantId: string, environment: string) {
  const db = await adminDb();
  const { data } = await db
    .from("listing_purchases")
    .select("id")
    .eq("test_id", testId)
    .eq("participant_id", participantId)
    .eq("environment", environment)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function listingAccessState(testId: string, participantId: string, environment: string) {
  const db = await adminDb();
  const { data: test } = await db
    .from("tests")
    .select("id, title, price_cents, sale_mode")
    .eq("id", testId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!test) return { paid: false, priceCents: 0, saleMode: "free" as const, title: "", required: false };
  const saleMode = (test.sale_mode ?? "free") as "free" | "take" | "results";
  const priced = saleMode !== "free" && test.price_cents > 0;
  const paid = priced ? await hasPaid(testId, participantId, environment) : true;
  return { paid, priceCents: test.price_cents, saleMode, title: test.title, required: priced };
}

/** Public: what a respondent must pay (if anything) before taking or unlocking. */
export const getListingAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        testId: z.string().uuid(),
        participantId: z.string().min(6).max(64),
        environment: envSchema.default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => listingAccessState(data.testId, data.participantId, data.environment));

/**
 * Public: starts a checkout for a creator-priced listing. The amount comes from the
 * database, never from the client, so the price cannot be tampered with.
 */
export const createListingCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        testId: z.string().uuid(),
        participantId: z.string().min(6).max(64),
        environment: envSchema.default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { data: test } = await db
      .from("tests")
      .select("id, title, price_cents, sale_mode, published, listed, creator_id")
      .eq("id", data.testId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!test || !test.published || !test.listed) throw new Error("This questionnaire is not on sale.");
    const saleMode = (test.sale_mode ?? "free") as "free" | "take" | "results";
    if (saleMode === "free" || test.price_cents <= 0) throw new Error("This questionnaire is free.");
    if (await hasPaid(data.testId, data.participantId, data.environment)) {
      return { transactionId: null, alreadyPaid: true as const };
    }

    const { createAdHocTransaction } = await import("./paddle.server");
    const transactionId = await createAdHocTransaction(data.environment, {
      productExternalId: LISTING_ACCESS_PRODUCT,
      amountCents: test.price_cents,
      description: test.title,
      customData: {
        kind: "listing",
        testId: test.id,
        participantId: data.participantId,
        mode: saleMode === "take" ? "take" : "results",
      },
    });
    return { transactionId, alreadyPaid: false as const };
  });

/** Business creators set the price and what the payment buys. */
export const setListingPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        testId: z.string().uuid(),
        saleMode: z.enum(["free", "take", "results"]),
        priceCents: z.number().int().min(0).max(LISTING_PRICE_MAX_CENTS),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { planForUser } = await import("./usage.server");
    const plan = await planForUser(context.userId);
    if (plan.id !== "business") {
      return { ok: false as const, reason: "Selling listings is a Business plan feature." };
    }
    if (data.saleMode !== "free" && data.priceCents < LISTING_PRICE_MIN_CENTS) {
      return { ok: false as const, reason: `The minimum price is $${(LISTING_PRICE_MIN_CENTS / 100).toFixed(2)}.` };
    }

    const db = await adminDb();
    const { error } = await db
      .from("tests")
      .update({
        sale_mode: data.saleMode,
        price_cents: data.saleMode === "free" ? 0 : data.priceCents,
      })
      .eq("id", data.testId)
      .eq("creator_id", context.userId);
    if (error) return { ok: false as const, reason: error.message };
    return { ok: true as const, reason: "" };
  });
