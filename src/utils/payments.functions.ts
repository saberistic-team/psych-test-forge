import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createManagedSession,
  createStripeClient,
  getStripeErrorMessage,
  type StripeEnv,
} from "@/lib/stripe.server";
import { ACTIVE_STATUSES } from "@/lib/payments-catalog";

const envSchema = z.enum(["sandbox", "live"]);

const checkoutSchema = z.object({
  priceId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  quantity: z.number().int().min(1).max(10).default(1),
  customerEmail: z.string().email().optional(),
  userId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
  metadata: z.record(z.string(), z.string()).default({}),
  returnUrl: z.string().url(),
  environment: envSchema,
});

/**
 * Creates an embedded checkout session for a catalog price. The amount always
 * comes from Stripe, never from the client.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ data }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      const price = prices.data[0];
      if (!price) return { error: "That price is not available yet." };
      const isRecurring = price.type === "recurring";

      let customerId: string | undefined;
      if (data.userId || data.customerEmail) {
        customerId = await resolveOrCreateCustomer(stripe, {
          ...(data.customerEmail ? { email: data.customerEmail } : {}),
          ...(data.userId ? { userId: data.userId } : {}),
        });
      }

      let description: string | undefined;
      if (!isRecurring) {
        const productId = typeof price.product === "string" ? price.product : price.product.id;
        description = (await stripe.products.retrieve(productId)).name;
      }

      const metadata = {
        ...data.metadata,
        ...(data.userId ? { userId: data.userId } : {}),
      };

      const session = await createManagedSession(stripe, {
        line_items: [{ price: price.id, quantity: data.quantity }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        ...(customerId ? { customer: customerId } : {}),
        ...(isRecurring
          ? { subscription_data: { metadata } }
          : description
            ? { payment_intent_data: { description } }
            : {}),
        metadata,
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Finds the Stripe customer for this user (by metadata, then email) or creates one. */
async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");

  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data[0]) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customer = existing.data[0];
    if (customer) {
      if (options.userId && customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email ? { email: options.email } : {}),
    ...(options.userId ? { metadata: { userId: options.userId } } : {}),
  });
  return created.id;
}

/** Current creator subscription (if any) for the signed-in user. */
export const getMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ environment: envSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("subscriptions")
      .select(
        "id, plan, price_id, status, cancel_at_period_end, current_period_start, current_period_end, provider_subscription_id",
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

/** Creates a Stripe billing-portal session so the user can manage or cancel. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ environment: envSchema, returnUrl: z.string().url().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    const { data: row } = await context.supabase
      .from("subscriptions")
      .select("provider_customer_id")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .not("provider_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row?.provider_customer_id) return { error: "No billing account found yet." };

    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const portal = await stripe.billingPortal.sessions.create({
        customer: row.provider_customer_id,
        ...(data.returnUrl ? { return_url: data.returnUrl } : {}),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
