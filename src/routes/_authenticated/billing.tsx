import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMyAccount, setMyPlan } from "@/lib/tests.functions";
import { CREATOR_PLANS, PARTICIPANT_PRICING, limitLabel } from "@/lib/plans";
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
  const account = useQuery({ queryKey: ["account"], queryFn: useServerFn(getMyAccount) });
  const changePlan = useServerFn(setMyPlan);

  const mutation = useMutation({
    mutationFn: (plan: "free" | "pro" | "business") => changePlan({ data: { plan } }),
    onSuccess: async (res) => {
      toast.success(`Switched to the ${res.plan} plan.`);
      await qc.invalidateQueries({ queryKey: ["account"] });
    },
    onError: () => toast.error("Could not change your plan."),
  });

  const plan = account.data?.plan;
  const usage = account.data?.usage;

  const meters = [
    { label: "AI generations", used: usage?.generations ?? 0, limit: plan?.generations ?? null },
    { label: "Participant attempts", used: usage?.attempts ?? 0, limit: plan?.attempts ?? null },
  ];

  return (
    <AppShell
      title="Plans & billing"
      subtitle="Payments are not connected yet — switching plans here updates your limits so you can test the flow."
      isAdmin={account.data?.isAdmin ?? false}
    >
      {account.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your plan…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-lg font-semibold">Creator plans</h2>
          <div className="mt-4 grid gap-5 lg:grid-cols-3">
            {CREATOR_PLANS.map((p) => {
              const current = plan?.id === p.id;
              return (
                <div
                  key={p.id}
                  className={`surface flex flex-col p-6 ${current ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                    {current ? <Badge>Current</Badge> : null}
                  </div>
                  <p className="mt-3 font-display text-3xl font-semibold">
                    {p.priceLabel}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6"
                    variant={current ? "outline" : "default"}
                    disabled={current || mutation.isPending}
                    onClick={() => mutation.mutate(p.id)}
                  >
                    {current ? "Active plan" : `Switch to ${p.name}`}
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
                One-time unlock per attempt: full narrative interpretation, subscale deep dive and cohort comparison.
              </p>
            </div>
            <div>
              <p className="font-medium">Results Plus</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                ${(PARTICIPANT_PRICING.resultsPlusCents / 100).toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Unlimited premium reports, retest tracking over time and PDF downloads.
              </p>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
