import { createHmac, timingSafeEqual } from "node:crypto";

export type PaddleEnv = "sandbox" | "live";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/paddle";

function connectionKey(env: PaddleEnv): string {
  const key = env === "live" ? process.env["PADDLE_LIVE_API_KEY"] : process.env["PADDLE_SANDBOX_API_KEY"];
  if (!key) throw new Error(`Missing Paddle API key for ${env}`);
  return key;
}

function webhookSecret(env: PaddleEnv): string {
  const secret =
    env === "live"
      ? process.env["PAYMENTS_LIVE_WEBHOOK_SECRET"]
      : process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"];
  if (!secret) throw new Error(`Missing Paddle webhook secret for ${env}`);
  return secret;
}

/** Calls the Paddle API through the Lovable connector gateway. */
export async function gatewayFetch(env: PaddleEnv, path: string, init: RequestInit = {}): Promise<Response> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error("Missing LOVABLE_API_KEY");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", connectionKey(env));
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const res = await fetch(`${GATEWAY_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
  });
  return res;
}

export async function gatewayJson<T = unknown>(
  env: PaddleEnv,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await gatewayFetch(env, path, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`Paddle ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as T;
}

export type PaddleWebhookEvent = {
  event_id?: string;
  event_type: string;
  data: Record<string, any>;
};

/**
 * Verifies the `Paddle-Signature` header (HMAC-SHA256 over `${ts}:${rawBody}`)
 * and returns the parsed event. Throws when the signature does not match.
 */
export async function verifyWebhook(request: Request, env: PaddleEnv): Promise<PaddleWebhookEvent> {
  const header = request.headers.get("paddle-signature");
  if (!header) throw new Error("Missing Paddle-Signature header");

  const parts = new Map<string, string>();
  for (const chunk of header.split(";")) {
    const [key, value] = chunk.split("=");
    if (key && value) parts.set(key.trim(), value.trim());
  }
  const ts = parts.get("ts");
  const h1 = parts.get("h1");
  if (!ts || !h1) throw new Error("Malformed Paddle-Signature header");

  const raw = await request.text();
  const expected = createHmac("sha256", webhookSecret(env)).update(`${ts}:${raw}`).digest("hex");

  const a = Buffer.from(h1, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid Paddle signature");

  return JSON.parse(raw) as PaddleWebhookEvent;
}

/**
 * Creates a Paddle transaction for a price that is not in the catalog — used for
 * creator-set marketplace prices. Paddle.js can then open a checkout for the
 * returned transaction ID.
 */
export async function createAdHocTransaction(
  env: PaddleEnv,
  input: {
    productExternalId: string;
    amountCents: number;
    currency?: string;
    description: string;
    customData: Record<string, string>;
  },
): Promise<string> {
  const products = await gatewayJson<{ data?: { id: string }[] }>(
    env,
    `/products?external_id=${encodeURIComponent(input.productExternalId)}`,
  );
  const productId = products.data?.[0]?.id;
  if (!productId) throw new Error("Marketplace product is not set up yet.");

  const result = await gatewayJson<{ data?: { id?: string } }>(env, "/transactions", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          quantity: 1,
          price: {
            description: input.description.slice(0, 200),
            product_id: productId,
            unit_price: { amount: String(input.amountCents), currency_code: input.currency ?? "USD" },
            quantity: { minimum: 1, maximum: 1 },
          },
        },
      ],
      custom_data: input.customData,
      collection_mode: "automatic",
    }),
  });
  const id = result.data?.id;
  if (!id) throw new Error("Could not start checkout.");
  return id;
}
