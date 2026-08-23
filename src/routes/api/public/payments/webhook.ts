import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";
import { ACTIVE_STATUSES, PRICE_TO_PLAN } from "@/lib/payments-catalog";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
  }
  return _supabase;
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/** Human-readable price id, stable across test and live. */
function externalPriceId(price: any): string | null {
  return price?.lookup_key ?? price?.metadata?.lovable_external_id ?? null;
}

/** Keeps profiles.plan in sync: paid while the period is live, Free afterwards. */
async function syncCreatorPlan(userId: string, plan: string, status: string, periodEnd: string | null) {
  const inPeriod = !periodEnd || new Date(periodEnd).getTime() > Date.now();
  const keepsAccess = (ACTIVE_STATUSES.includes(status) || status === "canceled") && inPeriod;
  await getSupabase()
    .from("profiles")
    .update({ plan: keepsAccess ? plan : "free" })
    .eq("id", userId);
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId = externalPriceId(item?.price);
  if (!priceId) {
    console.warn("Skipping subscription: price has no lookup key", subscription.id);
    return;
  }
  const plan = PRICE_TO_PLAN[priceId];
  if (!plan) {
    console.warn("Skipping subscription: unknown price", priceId);
    return;
  }

  const metadata = (subscription.metadata ?? {}) as Record<string, string>;
  const userId = metadata["userId"] ?? null;
  const participantId = metadata["participantId"] ?? null;
  if (!userId && !participantId) {
    console.error("Subscription has no userId/participantId in metadata", subscription.id);
    return;
  }

  const status = String(subscription.status ?? "active");
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const row = {
    user_id: userId,
    participant_id: participantId,
    plan,
    price_id: priceId,
    status,
    provider_subscription_id: String(subscription.id),
    provider_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : (subscription.customer?.id ?? null),
    provider_ref: String(subscription.id),
    current_period_start: isoFromUnix(periodStart),
    current_period_end: isoFromUnix(periodEnd),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    environment: env,
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabase()
    .from("subscriptions")
    .upsert(row, { onConflict: "provider_subscription_id" });
  if (error) console.error("subscription upsert failed", error.message);

  if (userId) await syncCreatorPlan(userId, plan, status, row.current_period_end);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const { data: rows } = await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("provider_subscription_id", String(subscription.id))
    .eq("environment", env)
    .select("user_id, plan, current_period_end");

  const row = rows?.[0];
  if (row?.user_id) await syncCreatorPlan(row.user_id, row.plan, "canceled", row.current_period_end);
}

/** A creator-priced marketplace sale: records the purchase and the earning line. */
async function handleListingSale(session: any, metadata: Record<string, string>, env: StripeEnv) {
  const testId = metadata["testId"];
  const participantId = metadata["participantId"];
  if (!testId || !participantId) {
    console.error("Listing purchase missing testId/participantId", session.id);
    return;
  }
  const { recordListingSale } = await import("@/lib/earnings.server");
  await recordListingSale({
    testId,
    participantId,
    buyerUserId: metadata["userId"] ?? null,
    mode: metadata["mode"] === "take" ? "take" : "results",
    amountCents: Number(session.amount_total ?? 0),
    currency: String(session.currency ?? "usd").toUpperCase(),
    providerRef: String(session.payment_intent ?? session.id),
    environment: env,
  });
}

/** A bought add-on pack tops up this month's allowance for the buying creator. */
async function handleAddonPack(
  session: any,
  priceId: string,
  quantity: number,
  metadata: Record<string, string>,
  env: StripeEnv,
) {
  const { packByPriceId } = await import("@/lib/plans");
  const pack = packByPriceId(priceId);
  if (!pack) return;
  const userId = metadata["userId"];
  if (!userId) {
    console.error("Add-on pack purchase missing userId", session.id);
    return;
  }
  const { addUsageGrant } = await import("@/lib/usage.server");
  await addUsageGrant({
    creatorId: userId,
    metric: pack.metric,
    amount: pack.amount * quantity,
    source: "purchase",
    note: `${pack.name}${quantity > 1 ? ` x${quantity}` : ""}`,
    providerRef: String(session.payment_intent ?? session.id),
    environment: env,
  });
}

async function handlePremiumReport(session: any, metadata: Record<string, string>, env: StripeEnv) {
  const participantId = metadata["participantId"];
  const attemptId = metadata["attemptId"];
  if (!participantId || !attemptId) {
    console.error("Premium report purchase missing participantId/attemptId", session.id);
    return;
  }
  const total = session.amount_total;
  const { error } = await getSupabase().from("premium_reports").upsert(
    {
      attempt_id: attemptId,
      participant_id: participantId,
      purchased: true,
      amount: total ? Number(total) / 100 : 2.99,
      provider_ref: String(session.payment_intent ?? session.id),
      environment: env,
    },
    { onConflict: "attempt_id" },
  );
  if (error) console.error("premium report upsert failed", error.message);
}

/** One-time purchases: report unlocks, add-on packs and marketplace listing sales. */
async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  if (session.payment_status === "unpaid") return;
  if (session.mode === "subscription") return; // handled by customer.subscription.*

  const metadata = (session.metadata ?? {}) as Record<string, string>;
  if (metadata["kind"] === "listing") {
    await handleListingSale(session, metadata, env);
    return;
  }

  const { createStripeClient } = await import("@/lib/stripe.server");
  const stripe = createStripeClient(env);
  const lineItems = await stripe.checkout.sessions.listLineItems(String(session.id), {
    limit: 1,
    expand: ["data.price"],
  });
  const line = lineItems.data[0];
  const priceId = externalPriceId(line?.price);
  if (!priceId) return;

  if (priceId.startsWith("addon_")) {
    await handleAddonPack(session, priceId, Math.max(1, Number(line?.quantity ?? 1)), metadata, env);
    return;
  }
  if (priceId === "premium_report_once") await handlePremiumReport(session, metadata, env);
}

/** Refunds and chargebacks reverse the creator's earning so it is never paid out. */
async function handleRefund(charge: any) {
  const paymentIntent = charge?.payment_intent;
  if (!paymentIntent) return;
  const { reverseListingSale } = await import("@/lib/earnings.server");
  await reverseListingSale(String(paymentIntent));
}

async function handleWebhook(request: Request, env: StripeEnv) {
  const event = await verifyWebhook(request, env);
  const object = event.data.object;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(object, env);
      break;
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutCompleted(object, env);
      break;
    case "charge.refunded":
    case "charge.dispute.created":
      await handleRefund(object);
      break;
    case "invoice.payment_failed":
      // Stripe keeps retrying; customer.subscription.updated moves the row to
      // past_due, which still grants access during the grace period.
      console.log("Payment failed for invoice", object?.id);
      break;
    default:
      console.log("Unhandled payments event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid env query parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (error) {
          console.error("Webhook error:", error);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
