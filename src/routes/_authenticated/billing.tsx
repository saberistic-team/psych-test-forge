import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getMyAccount } from "@/lib/tests.functions";
import { createPortalSession, getMySubscription } from "@/utils/payments.functions";
import {
  ADDON_PACKS,
  CREATOR_PLANS,
  PARTICIPANT_PRICING,
  centsToUsd,
  limitLabel,
  packsForPlan,
  type AddonPack,
} from "@/lib/plans";
import { CREATOR_PLAN_PRICES, YEARLY_PRICES, type BillingInterval } from "@/lib/payments-catalog";
import { getStripeEnvironment } from "@/lib/stripe";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Plans & billing — Psych Lab" },
      { name: "description", content: "Compare Free, Pro and Business plans and track your monthly usage." },
      { property: "og:title", content: "Plans & billing — Psych Lab" },
      { property: "og:description", content: "Manage your Psych Lab creator subscription and usage limits." },
    ],
  }),
  component: Billing,
});

function Billing() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const environment = getStripeEnvironment();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const { openCheckout, loading: checkoutLoading, checkoutElement } = useStripeCheckout();

  const account = useQuery({ queryKey: ["account"], queryFn: useServerFn(getMyAccount) });
  const fetchSubscription = useServerFn(getMySubscription);
  const subscription = useQuery({
    queryKey: ["my-subscription", environment],
    queryFn: () => fetchSubscription({ data: { environment } }),
  });

  const openPortal = useServerFn(createPortalSession);
  const portal = useMutation({
    mutationFn: () => openPortal({ data: { environment } }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.url, "_blank", "noopener");
    },
    onError: () => toast.error("Could not open the billing portal."),
  });

  const plan = account.data?.plan;
  const usage = account.data?.usage;
  const sub = subscription.data?.subscription ?? null;

  const limits = account.data?.limits;
  const grants = account.data?.grants;
  const meters = [
    {
      metric: "generations" as const,
      label: "AI generations",
      used: usage?.generations ?? 0,
      limit: limits ? limits.generations : (plan?.generations ?? null),
      extra: grants?.generations.total ?? 0,
    },
    {
      metric: "attempts" as const,
      label: "Participant responses",
      used: usage?.attempts ?? 0,
      limit: limits ? limits.attempts : (plan?.attempts ?? null),
      extra: grants?.attempts.total ?? 0,
    },
    {
      metric: "listings" as const,
      label: "Marketplace listings",
      used: account.data?.listings.used ?? 0,
      limit: limits ? limits.listings : (plan?.listings ?? null),
      extra: grants?.listings.total ?? 0,
    },
  ];

  const availablePacks = plan ? packsForPlan(plan) : [];
  const canBuyPacks = plan?.id === "pro" || plan?.id === "business";

  const buyPack = (pack: AddonPack) => {
    if (!user) return;
    openCheckout({
      priceId: pack.priceId,
      title: pack.name,
      ...(user.email ? { customerEmail: user.email } : {}),
      userId: user.id,
      metadata: { packId: pack.id },
      returnUrl: `${window.location.origin}/billing?pack=success`,
    });
  };

  const startCheckout = (planId: "pro" | "business") => {
    if (!user) return;
    openCheckout({
      priceId: CREATOR_PLAN_PRICES[planId][interval],
      title: `Subscribe to ${planId === "pro" ? "Pro" : "Business"}`,
      ...(user.email ? { customerEmail: user.email } : {}),
      userId: user.id,
      returnUrl: `${window.location.origin}/billing?checkout=success`,
    });
  };

  const priceFor = (planId: string, monthlyCents: number) => {
    if (planId === "free") return { label: "$0", suffix: "" };
    if (interval === "year" && (planId === "pro" || planId === "business")) {
      return { label: `$${YEARLY_PRICES[planId] / 100}`, suffix: "/year" };
    }
    return { label: `$${monthlyCents / 100}`, suffix: "/mo" };
  };

  return (
    <AppShell
      title="Plans & billing"
      subtitle="Subscribe, upgrade or cancel at any time — cancelling keeps your plan until the end of the paid period."
      isAdmin={account.data?.isAdmin ?? false}
    >
      {account.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your plan…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {meters.map((m) => (
              <div key={m.label} className="surface p-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="font-mono text-sm text-muted-foreground">
                    {m.used} / {limitLabel(m.limit)}
                  </p>
                </div>
                <Progress
                  className="mt-3"
                  value={m.limit === null ? 8 : Math.min(100, (m.used / Math.max(1, m.limit)) * 100)}
                />
                {m.extra > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Includes {m.extra} extra from packs and grants.</p>
                ) : null}
              </div>
            ))}
          </div>

          {sub ? (
            <div className="surface mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-medium capitalize">
                  {sub.plan} subscription · {sub.status.replace("_", " ")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {sub.status === "past_due"
                    ? "A payment failed. Update your payment method to keep your plan — access continues while we retry."
                    : sub.cancel_at_period_end || sub.status === "canceled"
                      ? `Access continues until ${sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "the end of the period"}, then you move to Free.`
                      : `Renews ${sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "automatically"}.`}
                </p>
              </div>
              <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
                {portal.isPending ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
                Manage billing
              </Button>
            </div>
          ) : null}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Creator plans</h2>
            <div className="flex rounded-lg border border-border p-1">
              {(["month", "year"] as BillingInterval[]).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInterval(i)}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    interval === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/10"
                  }`}
                >
                  {i === "month" ? "Monthly" : "Yearly · 2 months free"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-5 lg:grid-cols-3">
            {CREATOR_PLANS.map((p) => {
              const current = plan?.id === p.id;
              const price = priceFor(p.id, p.priceCents);
              return (
                <div key={p.id} className={`surface flex flex-col p-6 ${current ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                    {current ? <Badge>Current</Badge> : null}
                  </div>
                  <p className="mt-3 font-display text-3xl font-semibold">
                    {price.label}
                    <span className="text-sm font-normal text-muted-foreground">{price.suffix}</span>
                  </p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {p.id === "free" ? (
                    <Button className="mt-6" variant="outline" disabled={current} onClick={() => portal.mutate()}>
                      {current ? "Active plan" : "Cancel in billing portal"}
                    </Button>
                  ) : (
                    <Button
                      className="mt-6"
                      variant={current ? "outline" : "default"}
                      disabled={checkoutLoading || !user}
                      onClick={() => (current && sub ? portal.mutate() : startCheckout(p.id as "pro" | "business"))}
                    >
                      {checkoutLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                      {current ? "Manage plan" : `Subscribe to ${p.name}`}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <h2 className="mt-10 text-lg font-semibold">Add-on packs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One-off top-ups for the current month. They raise this month's allowance only and never roll over.
          </p>
          <div className="mt-4 grid gap-5 lg:grid-cols-3">
            {ADDON_PACKS.map((pack) => {
              const usable = availablePacks.some((p) => p.id === pack.id);
              return (
                <div key={pack.id} className="surface flex flex-col p-6">
                  <p className="font-medium">{pack.name}</p>
                  <p className="mt-2 font-display text-2xl font-semibold">{centsToUsd(pack.priceCents)}</p>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{pack.description}</p>
                  <Button
                    className="mt-5"
                    variant="outline"
                    disabled={!canBuyPacks || !usable || checkoutLoading || !user}
                    onClick={() => buyPack(pack)}
                  >
                    {!canBuyPacks
                      ? "Pro or Business only"
                      : !usable
                        ? "Already unlimited on your plan"
                        : `Buy for ${centsToUsd(pack.priceCents)}`}
                  </Button>
                </div>
              );
            })}
          </div>

          <h2 className="mt-10 text-lg font-semibold">Participant pricing</h2>
          <div className="surface mt-4 grid gap-6 p-6 sm:grid-cols-2">
            <div>
              <p className="font-medium">Premium report</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                ${(PARTICIPANT_PRICING.premiumReportCents / 100).toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                One-time purchase that unlocks the full narrative report and PDF for every result that participant
                has taken.
              </p>
            </div>
            <div>
              <p className="font-medium">Results Plus</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                ${(PARTICIPANT_PRICING.resultsPlusCents / 100).toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Ongoing access to premium reports, retest tracking over time and PDF downloads.
              </p>
            </div>
          </div>
        </>
      )}
      <p className="mt-8 text-xs text-muted-foreground">
        Payments, receipts and tax are handled securely by Stripe on our behalf. By subscribing you agree to our <Link to="/legal/terms" className="underline">Terms</Link>,{" "}
        <Link to="/legal/privacy" className="underline">Privacy Notice</Link> and{" "}
        <Link to="/legal/refunds" className="underline">Refund Policy</Link> (30-day money-back guarantee).
      </p>
      {checkoutElement}
    </AppShell>
  );
}
