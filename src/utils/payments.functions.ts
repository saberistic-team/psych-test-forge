import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayJson, type PaddleEnv } from "@/lib/paddle.server";
import { ACTIVE_STATUSES } from "@/lib/paddle-catalog";

const envSchema = z.enum(["sandbox", "live"]);

/** Resolves a human-readable price ID to the Paddle internal price ID. */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ priceId: z.string().min(1).max(120), environment: envSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const result = await gatewayJson<{ data?: { id: string }[] }>(
      data.environment as PaddleEnv,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const id = result.data?.[0]?.id;
    if (!id) throw new Error("Price not found");
    return id;
  });

/** Current creator subscription (if any) for the signed-in user. */
export const getMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ environment: envSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("subscriptions")
      .select(
        "id, plan, price_id, status, cancel_at_period_end, current_period_start, current_period_end, paddle_subscription_id",
      )
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return { subscription: null, isActive: false };

    const endsAt = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
    const inPeriod = endsAt === null || endsAt > Date.now();
    const isActive =
      (ACTIVE_STATUSES.includes(row.status) && inPeriod) || (row.status === "canceled" && inPeriod);

    return { subscription: row, isActive };
  });

/** Creates a Paddle customer-portal session so the user can manage or cancel. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ environment: envSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("subscriptions")
      .select("paddle_customer_id, paddle_subscription_id")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .not("paddle_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row?.paddle_customer_id) throw new Error("No billing account found yet.");

    const result = await gatewayJson<{ data?: { urls?: { general?: { overview?: string } } } }>(
      data.environment as PaddleEnv,
      `/customers/${row.paddle_customer_id}/portal-sessions`,
      {
        method: "POST",
        body: JSON.stringify(
          row.paddle_subscription_id ? { subscription_ids: [row.paddle_subscription_id] } : {},
        ),
      },
    );

    const url = result.data?.urls?.general?.overview;
    if (!url) throw new Error("Could not open the billing portal.");
    return { url };
  });
