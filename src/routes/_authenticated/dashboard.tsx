import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { getMyAccount, listMyTests } from "@/lib/tests.functions";
import { listGenerationJobs } from "@/lib/generation.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { limitLabel } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Creator overview — Psych Lab" },
      { name: "description", content: "Your tests, generations, attempts and plan usage at a glance." },
      { property: "og:title", content: "Creator overview — Psych Lab" },
      { property: "og:description", content: "Track your Psych Lab tests, attempts and monthly usage." },
    ],
  }),
  component: Dashboard,
});

function UsageCard({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit === null ? 8 : Math.min(100, (used / Math.max(1, limit)) * 100);
  return (
    <div className="surface p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">
        {used}
        <span className="ml-1 text-base font-medium text-muted-foreground">/ {limitLabel(limit)}</span>
      </p>
      <Progress value={pct} className="mt-3 h-1.5" />
    </div>
  );
}

function Dashboard() {
  const account = useQuery({ queryKey: ["account"], queryFn: useServerFn(getMyAccount) });
  const tests = useQuery({ queryKey: ["my-tests"], queryFn: useServerFn(listMyTests) });
  const jobs = useQuery({ queryKey: ["generation-jobs"], queryFn: useServerFn(listGenerationJobs) });

  const usage = account.data?.usage;
  const plan = account.data?.plan;
  const live = (tests.data ?? []).filter((t) => t.published).length;
  const attempts = (tests.data ?? []).reduce((sum, t) => sum + t.attempt_count, 0);

  return (
    <AppShell
      title={`Welcome${account.data?.profile?.name ? `, ${account.data.profile.name}` : ""}`}
      subtitle="Generate an instrument, publish it behind a join code and watch the responses come in."
      isAdmin={account.data?.isAdmin ?? false}
      actions={
        <Button asChild>
          <Link to="/generate">
            <Sparkles className="size-4" /> New test
          </Link>
        </Button>
      }
    >
      {account.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your workspace…
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{plan?.name ?? "Free"} plan</Badge>
            {!plan?.canPublish ? (
              <Link to="/billing" className="text-sm text-muted-foreground underline">
                Upgrade to publish tests
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <UsageCard label="Generations this month" used={usage?.generations ?? 0} limit={plan?.generations ?? 0} />
            <UsageCard label="Attempts this month" used={usage?.attempts ?? 0} limit={plan?.attempts ?? 0} />
            <div className="surface p-5">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Live tests</p>
              <p className="mt-2 font-display text-3xl font-semibold">{live}</p>
              <p className="mt-3 text-xs text-muted-foreground">{tests.data?.length ?? 0} total in library</p>
            </div>
            <div className="surface p-5">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Total attempts</p>
              <p className="mt-2 font-display text-3xl font-semibold">{attempts}</p>
              <Link to="/analytics" className="mt-3 inline-block text-xs text-muted-foreground underline">
                View results
              </Link>
            </div>
          </div>

          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent tests</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/tests">View library</Link>
              </Button>
            </div>
            {(tests.data?.length ?? 0) === 0 ? (
              <div className="surface mt-4 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No tests yet. Describe an instrument or a construct and let the generator draft it.
                </p>
                <Button asChild className="mt-5">
                  <Link to="/generate">
                    <Plus className="size-4" /> Generate a test
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {tests.data!.slice(0, 5).map((t) => (
                  <li key={t.id} className="surface flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium">{t.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.attempt_count} attempts · {new Date(t.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.published ? (
                        <Badge className="font-mono">{t.access_code}</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                      <Button asChild size="sm" variant="outline">
                        <Link to="/tests/$id" params={{ id: t.id }}>
                          Open
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(jobs.data?.length ?? 0) > 0 ? (
            <section className="mt-10">
              <h2 className="text-lg font-semibold">Recent generations</h2>
              <ul className="mt-4 space-y-2">
                {jobs.data!.map((j) => (
                  <li key={j.id} className="surface flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{j.request}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={j.status === "done" ? "secondary" : j.status === "error" ? "destructive" : "outline"}>
                        {j.status}
                      </Badge>
                      {j.test_id ? (
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/tests/$id" params={{ id: j.test_id }}>
                            Open
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
