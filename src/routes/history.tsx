import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { getMyHistory } from "@/lib/participant.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { getParticipantId } from "@/lib/participant-id";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "My past results — Psych Lab" },
      { name: "description", content: "Every assessment you have completed on this device, with scores over time." },
      { property: "og:title", content: "My past results — Psych Lab" },
      { property: "og:description", content: "Your Psych Lab assessment history and score trends." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const fetchHistory = useServerFn(getMyHistory);
  const environment = getStripeEnvironment();
  const [participantId, setParticipantId] = useState("");
  useEffect(() => setParticipantId(getParticipantId()), []);

  const query = useQuery({
    queryKey: ["participant-history", participantId],
    queryFn: () => fetchHistory({ data: { participantId, environment } }),
    enabled: Boolean(participantId),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FlaskConical className="size-4" />
            </span>
            <span className="font-display font-semibold">Psych Lab</span>
          </Link>
          <Button asChild size="sm" variant="ghost">
            <Link to="/take">Take a test</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-3xl font-semibold">My results</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Stored on this device only — no account, no email.
          {query.data?.resultsPlus ? " Results+ is active." : ""}
        </p>

        {query.isLoading || !participantId ? (
          <div className="mt-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (query.data?.attempts.length ?? 0) === 0 ? (
          <div className="surface mt-8 p-8 text-center">
            <p className="text-sm text-muted-foreground">You haven't completed a test on this device yet.</p>
            <Button asChild className="mt-5">
              <Link to="/take">Enter a join code</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {query.data!.attempts.map((a) => (
              <li key={a.id} className="surface flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <h2 className="font-display text-lg font-semibold">{a.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.scores.subscales.slice(0, 4).map((s) => (
                      <Badge key={s.subscale} variant="secondary" className="text-xs">
                        {s.subscale}: {s.score}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/results/$attemptId" params={{ attemptId: a.id }}>
                    View report
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
