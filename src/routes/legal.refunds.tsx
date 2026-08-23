import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Psych Lab" },
      {
        name: "description",
        content:
          "Psych Lab offers a 30-day money-back guarantee on subscriptions and report unlocks. Here is how to request a refund.",
      },
      { property: "og:title", content: "Refund Policy — Psych Lab" },
      {
        property: "og:description",
        content: "30-day money-back guarantee on Psych Lab plans and report unlocks.",
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
        Payments are processed for us by Stripe. To request a refund, contact us through the support route on this site
        with your order email or receipt number, and we will process it. Refunds are returned to the original payment
        method, usually within 5–10 business days once approved.
      </p>

      <h2>Cancelling a subscription</h2>
      <p>
        You can cancel a subscription at any time from your billing page, which opens a secure Stripe portal where you
        can also update your payment method and download receipts. Cancelling
        stops future renewals; paid features stay available until the end of the period you have already paid for, and
        the account then returns to the Free plan. Cancelling on its own is not a refund request — use the process
        above if you also want your most recent payment refunded.
      </p>

      <h2>Other cases</h2>
      <p>
        If you were charged in error, charged twice, or the service was unavailable in a way that prevented you from
        using what you paid for, contact us and we will arrange a refund even outside the 30-day window. Any statutory
        cancellation or refund rights you have in your own country apply on top of this policy and are not affected by
        it.
      </p>
    </article>
  );
}
