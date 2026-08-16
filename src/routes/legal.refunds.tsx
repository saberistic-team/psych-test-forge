import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Psych Lab" },
      {
        name: "description",
        content:
          "Psych Lab offers a 30-day money-back guarantee on subscriptions and report unlocks. Here is how to request a refund through Paddle.",
      },
      { property: "og:title", content: "Refund Policy — Psych Lab" },
      {
        property: "og:description",
        content: "30-day money-back guarantee on Psych Lab plans and report unlocks, handled by Paddle.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <article>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Refund Policy</h1>
      <p className="mt-2 text-xs text-muted-foreground">Last updated 16 August 2026</p>

      <h2>30-day money-back guarantee</h2>
      <p>
        <strong>Psych Lab</strong> offers a 30-day money-back guarantee. If you are not satisfied with your purchase,
        you can request a full refund within 30 days of your order date. This applies to Pro and Business creator
        subscriptions, Results+ participant subscriptions, and one-time premium report unlocks.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Payments and refunds are processed by our reseller and Merchant of Record, Paddle. To request a refund, visit{" "}
        <a href="https://paddle.net" target="_blank" rel="noreferrer noopener">
          paddle.net
        </a>{" "}
        with your order email or receipt, or contact us through the support route on this site and we will pass the
        request on. Refunds are returned to the original payment method, usually within 5–10 business days once
        approved.
      </p>

      <h2>Cancelling a subscription</h2>
      <p>
        You can cancel a subscription at any time from your billing page or the Paddle customer portal. Cancelling
        stops future renewals; paid features stay available until the end of the period you have already paid for, and
        the account then returns to the Free plan. Cancelling on its own is not a refund request — use the process
        above if you also want your most recent payment refunded.
      </p>

      <h2>Other cases</h2>
      <p>
        If you were charged in error, charged twice, or the service was unavailable in a way that prevented you from
        using what you paid for, contact us and we will arrange a refund even outside the 30-day window. Paddle's own{" "}
        <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noreferrer noopener">
          refund policy
        </a>{" "}
        and{" "}
        <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noreferrer noopener">
          buyer terms
        </a>{" "}
        also apply to every order, including any statutory cancellation rights you have in your country.
      </p>
    </article>
  );
}
