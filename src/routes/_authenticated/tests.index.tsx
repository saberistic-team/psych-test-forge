import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { getMyAccount, listMyTests } from "@/lib/tests.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TestIcon } from "@/components/visuals/TestIcon";
import { specSchema } from "@/lib/spec";
import { visualsOf } from "@/lib/visuals";

export const Route = createFileRoute("/_authenticated/tests/")({
  head: () => ({
    meta: [
      { title: "Test library — Psych Lab" },
      { name: "description", content: "Every test you have generated, with its join code and response count." },
      { property: "og:title", content: "Test library — Psych Lab" },
      { property: "og:description", content: "Manage, publish and share your generated psychological tests." },
    ],
  }),
  component: TestLibrary,
});

function TestLibrary() {
  const account = useQuery({ queryKey: ["account"], queryFn: useServerFn(getMyAccount) });
  const tests = useQuery({ queryKey: ["my-tests"], queryFn: useServerFn(listMyTests) });

  return (
    <AppShell
      title="Test library"
      subtitle="Drafts stay private. Published tests are reachable by join code."
      isAdmin={account.data?.isAdmin ?? false}
      actions={
        <Button asChild>
          <Link to="/generate">
            <Sparkles className="size-4" /> New test
          </Link>
        </Button>
      }
    >
      {tests.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading library…
        </div>
      ) : (tests.data?.length ?? 0) === 0 ? (
        <div className="surface p-10 text-center">
          <p className="text-sm text-muted-foreground">Your library is empty.</p>
          <Button asChild className="mt-5">
            <Link to="/generate">Generate your first test</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tests.data!.map((t) => {
            const spec = t.spec as { meta?: { construct?: string; subscales?: string[] }; items?: unknown[] } | null;
            const parsed = specSchema.safeParse(t.spec);
            return (
              <div key={t.id} className="surface flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {parsed.success ? <TestIcon visuals={visualsOf(parsed.data)} size={40} /> : null}
                    <h2 className="font-display text-lg leading-snug font-semibold">{t.title}</h2>
                  </div>
                  {t.published ? (
                    <Badge className="shrink-0 font-mono">{t.access_code}</Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">
                      Draft
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{spec?.meta?.construct ?? "—"}</p>
                {t.listed ? (
                  <p className="mt-2 text-xs text-accent">Listed on the public marketplace</p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">
                  {spec?.items?.length ?? 0} items · {spec?.meta?.subscales?.length ?? 0} subscales ·{" "}
                  {t.attempt_count} attempts
                </p>
                <div className="mt-auto flex gap-2 pt-5">
                  <Button asChild size="sm" className="flex-1">
                    <Link to="/tests/$id" params={{ id: t.id }}>
                      Manage
                    </Link>
                  </Button>
                  {t.published && t.access_code ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/take/$code" params={{ code: t.access_code }}>
                        Preview
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
