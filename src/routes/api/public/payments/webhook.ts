import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { verifyWebhook, type PaddleEnv } from "@/lib/paddle.server";
import { ACTIVE_STATUSES, PRICE_TO_PLAN } from "@/lib/paddle-catalog";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
  }
  return _supabase;
}

type Item = {
  price?: { id?: string; import_meta?: { external_id?: string | null } | null };
  product?: { id?: string; import_meta?: { external_id?: string | null } | null };
};

function externalPriceId(data: Record<string, any>): string | null {
  const items: Item[] = data["items"] ?? [];
  for (const item of items) {
    const external = item.price?.import_meta?.external_id;
    if (external) return external;
  }
  return null;
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

async function upsertSubscription(data: Record<string, any>, env: PaddleEnv) {
  const priceId = externalPriceId(data);
  if (!priceId) {
    console.warn("Skipping subscription: missing import_meta.external_id", { subscription: data["id"] });
    return;
  }
  const plan = PRICE_TO_PLAN[priceId];
  if (!plan) {
    console.warn("Skipping subscription: unknown price", priceId);
    return;
  }

  const custom = (data["custom_data"] ?? {}) as Record<string, string>;
  const userId = custom["userId"] ?? null;
  const participantId = custom["participantId"] ?? null;
  if (!userId && !participantId) {
    console.error("Subscription has no userId/participantId in custom_data", data["id"]);
    return;
  }

  const period = data["current_billing_period"] ?? {};
  const status = String(data["status"] ?? "active");
  const row = {
    user_id: userId,
    participant_id: participantId,
    plan,
    price_id: priceId,
    status,
    paddle_subscription_id: data["id"],
    paddle_customer_id: data["customer_id"],
    provider_ref: data["id"],
    current_period_start: period["starts_at"] ?? null,
    current_period_end: period["ends_at"] ?? null,
    cancel_at_period_end: data["scheduled_change"]?.action === "cancel",
    environment: env,
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabase()
    .from("subscriptions")
    .upsert(row, { onConflict: "paddle_subscription_id" });
  if (error) console.error("subscription upsert failed", error.message);

  if (userId) await syncCreatorPlan(userId, plan, status, row.current_period_end);
}

async function handleSubscriptionCanceled(data: Record<string, any>, env: PaddleEnv) {
  const db = getSupabase();
  const { data: rows } = await db
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data["id"])
    .eq("environment", env)
    .select("user_id, plan, current_period_end");

  const row = rows?.[0] as { user_id: string | null; plan: string; current_period_end: string | null } | undefined;
  if (row?.user_id) await syncCreatorPlan(row.user_id, row.plan, "canceled", row.current_period_end);
}

/** A creator-priced marketplace sale: records the purchase and the earning line. */
async function handleListingSale(data: Record<string, any>, env: PaddleEnv) {
  const custom = (data["custom_data"] ?? {}) as Record<string, string>;
  const testId = custom["testId"];
  const participantId = custom["participantId"];
  if (!testId || !participantId) {
    console.error("Listing purchase missing testId/participantId", data["id"]);
    return;
  }
  const totals = data["details"]?.totals ?? {};
  const { recordListingSale } = await import("@/lib/earnings.server");
  await recordListingSale({
    testId,
    participantId,
    buyerUserId: custom["userId"] ?? null,
    mode: custom["mode"] === "take" ? "take" : "results",
    amountCents: Number(totals.total ?? 0),
    currency: String(data["currency_code"] ?? "USD"),
    providerRef: String(data["id"]),
    environment: env,
  });
}

/** A bought add-on pack tops up this month's allowance for the buying creator. */
async function handleAddonPack(data: Record<string, any>, priceId: string, env: PaddleEnv) {
  const { packByPriceId } = await import("@/lib/plans");
  const pack = packByPriceId(priceId);
  if (!pack) return;
  const custom = (data["custom_data"] ?? {}) as Record<string, string>;
  const userId = custom["userId"];
  if (!userId) {
    console.error("Add-on pack purchase missing userId", data["id"]);
    return;
  }
  const items: { quantity?: number }[] = data["items"] ?? [];
  const quantity = Math.max(1, Number(items[0]?.quantity ?? 1));
  const { addUsageGrant } = await import("@/lib/usage.server");
  await addUsageGrant({
    creatorId: userId,
    metric: pack.metric,
    amount: pack.amount * quantity,
    source: "purchase",
    note: `${pack.name}${quantity > 1 ? ` x${quantity}` : ""}`,
    providerRef: String(data["id"]),
    environment: env,
  });
}

/** Refunds and chargebacks reverse the creator's earning so it is never paid out. */
async function handleAdjustment(data: Record<string, any>) {
  const action = String(data["action"] ?? "");
  if (action !== "refund" && action !== "chargeback") return;
  const transactionId = data["transaction_id"];
  if (!transactionId) return;
  const { reverseListingSale } = await import("@/lib/earnings.server");
  await reverseListingSale(String(transactionId));
}

/** One-time purchases: report unlocks, add-on packs and marketplace listing sales. */
async function handleTransactionCompleted(data: Record<string, any>, env: PaddleEnv) {
  const custom = (data["custom_data"] ?? {}) as Record<string, string>;
  if (custom["kind"] === "listing") {
    await handleListingSale(data, env);
    return;
  }

  const priceId = externalPriceId(data);
  if (!priceId) return;
  if (priceId.startsWith("addon_")) {
    await handleAddonPack(data, priceId, env);
    return;
  }
  if (priceId !== "premium_report_once") return;


  const participantId = custom["participantId"];
  const attemptId = custom["attemptId"];
  if (!participantId || !attemptId) {
    console.error("Premium report purchase missing participantId/attemptId", data["id"]);
    return;
  }

  const total = data["details"]?.totals?.total;
  const { error } = await getSupabase().from("premium_reports").upsert(
    {
      attempt_id: attemptId,
      participant_id: participantId,
      purchased: true,
      amount: total ? Number(total) / 100 : 2.99,
      provider_ref: data["id"],
      environment: env,
    },
    { onConflict: "attempt_id" },
  );
  if (error) console.error("premium report upsert failed", error.message);
}

async function handleWebhook(request: Request, env: PaddleEnv) {
  const event = await verifyWebhook(request, env);

  switch (event.event_type) {
    case "subscription.created":
    case "subscription.updated":
      await upsertSubscription(event.data, env);
      break;
    case "subscription.canceled":
      await handleSubscriptionCanceled(event.data, env);
      break;
    case "transaction.completed":
      await handleTransactionCompleted(event.data, env);
      break;
    case "transaction.payment_failed":
      // Paddle keeps retrying; the subscription.updated event moves the row to
      // past_due, which still grants access during the grace period.
      console.log("Payment failed for transaction", event.data["id"]);
      break;
    case "adjustment.created":
    case "adjustment.updated":
      await handleAdjustment(event.data);
      break;

    default:
      console.log("Unhandled Paddle event:", event.event_type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (error) {
          console.error("Webhook error:", error);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
