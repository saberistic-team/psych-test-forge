import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, FlaskConical, Loader2, Lock, ShieldCheck, Sparkles, History } from "lucide-react";
import { toast } from "sonner";
import { getAttemptResult } from "@/lib/participant.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { PRICE_IDS } from "@/lib/paddle-catalog";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { getParticipantId } from "@/lib/participant-id";
import { PARTICIPANT_PRICING } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ResultsVisual } from "@/components/visuals/ResultsVisual";
import { TestBanner } from "@/components/visuals/TestBanner";
import { visualsOf } from "@/lib/visuals";

export const Route = createFileRoute("/results/$attemptId")({
  head: () => ({
    meta: [
      { title: "Your results — Psych Lab" },
      {
        name: "description",
        content:
          "Your own section scores and the score-range text the creator wrote in advance for this questionnaire.",
      },
      { property: "og:title", content: "Your results — Psych Lab" },
      {
        property: "og:description",
        content: "Arithmetic scores from your own answers, with the creator's pre-written score-range text.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },

      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { attemptId } = Route.useParams();
  const fetchResult = useServerFn(getAttemptResult);
  const environment = getPaddleEnvironment();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [participantId, setParticipantId] = useState("");

  useEffect(() => setParticipantId(getParticipantId()), []);

  const query = useQuery({
    queryKey: ["attempt-result", attemptId, participantId],
    queryFn: () => fetchResult({ data: { attemptId, participantId, environment } }),
    enabled: Boolean(participantId),
  });

  const buy = (priceId: string) =>
    openCheckout({
      priceId,
      customData: { participantId, attemptId },
      successUrl: `${window.location.origin}/results/${attemptId}?checkout=success`,
    });

  const result = query.data?.found ? query.data.result : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FlaskConical className="size-4" />
            </span>
            <span className="font-display font-semibold">Psych Lab</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/history">
              <History className="size-4" /> My results
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10">
        {query.isLoading || !participantId ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Scoring your responses…
          </div>
        ) : !result ? (
          <div className="surface p-8 text-center">
            <h1 className="font-display text-2xl font-semibold">Result not available</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Results are tied to the device that submitted them. If you cleared your browser data, the link can no
              longer be opened.
            </p>
            <Button asChild className="mt-6">
              <Link to="/take">Take a test</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Badge variant="secondary" className="rounded-full">
                  {result.spec.meta.construct}
                </Badge>
                <h1 className="mt-3 font-display text-3xl font-semibold">{result.testTitle}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {result.participantName ? `${result.participantName} · ` : ""}
                  {new Date(result.createdAt).toLocaleString()}
                  {result.creatorOrg ? ` · administered by ${result.creatorOrg}` : ""}
                </p>
              </div>
              {result.cohortSize > 1 ? (
                <p className="text-sm text-muted-foreground">
                  Compared against {result.cohortSize} responses
                </p>
              ) : null}
            </div>

            {result.scores.validity.enabled && !result.scores.validity.passed ? (
              <div className="mt-6 flex gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <p className="text-sm text-foreground">{result.scores.validity.message}</p>
              </div>
            ) : result.scores.validity.enabled ? (
              <div className="mt-6 flex gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" />
                <p className="text-sm text-muted-foreground">{result.scores.validity.message}</p>
              </div>
            ) : null}

            {result.scores.overall.enabled ? (
              <div className="surface mt-6 p-6">
                <h2 className="text-sm tracking-wide text-muted-foreground uppercase">Overall</h2>
                {result.scores.overall.score === null ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Withheld because the attention checks were not passed.
                  </p>
                ) : (
                  <>
                    <div className="mt-2 flex items-baseline gap-3">
                      <span className="font-display text-4xl font-semibold">{result.scores.overall.score}</span>
                      <Badge className="capitalize">{result.scores.overall.band}</Badge>
                    </div>
                    {result.scores.overall.band &&
                    result.spec.interpretation.overall[result.scores.overall.band] ? (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {result.spec.interpretation.overall[result.scores.overall.band]}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            <div className="surface mt-8 overflow-hidden">
              <TestBanner
                visuals={visualsOf(result.spec)}
                title={result.spec.instructions.title}
                height={140}
                className="rounded-none"
              />
              <div className="p-6">
                <ResultsVisual
                  visuals={visualsOf(result.spec)}
                  subscales={result.scores.subscales}
                  overall={result.scores.overall}
                  scale={result.spec.instructions.response_scale}
                />
              </div>
            </div>

            <h2 className="mt-10 text-sm tracking-wide text-muted-foreground uppercase">Subscales</h2>
            <div className="mt-4 space-y-4">
              {result.scores.subscales.map((s) => {
                const scale = result.spec.instructions.response_scale;
                const pct = Math.max(
                  0,
                  Math.min(100, ((s.score - scale.min) / Math.max(1, scale.max - scale.min)) * 100),
                );
                const narrative = result.spec.interpretation.per_subscale[s.subscale]?.[s.band];
                const cohort = result.cohortAverages[s.subscale];
                return (
                  <div key={s.subscale} className="surface p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-lg font-semibold">{s.subscale}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {s.band}
                        </Badge>
                        <span className="font-mono text-sm">{s.score}</span>
                      </div>
                    </div>
                    <Progress value={pct} className="mt-3 h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {s.items} items{cohort !== undefined ? ` · cohort average ${cohort}` : ""}
                    </p>
                    {result.premium ? (
                      narrative ? (
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{narrative}</p>
                      ) : null
                    ) : (
                      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Lock className="size-3.5" /> The creator's pre-written text for this score range is part of the
                        extended write-up
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {!result.premium ? (
              <div className="surface mt-8 p-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 size-5 text-accent" />
                  <div>
                    <h2 className="font-display text-xl font-semibold">Unlock the extended write-up</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      See the text the creator wrote in advance for each section's score range, how your score compares
                      with everyone else who answered, and the reflection prompts they included. Nothing here is
                      generated about you — everyone in the same range sees the same words.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={() => void buy(PRICE_IDS.premiumReport)} disabled={checkoutLoading}>
                    {checkoutLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                    Unlock write-ups — ${(PARTICIPANT_PRICING.premiumReportCents / 100).toFixed(2)} once
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void buy(PRICE_IDS.resultsPlusMonthly)}
                    disabled={checkoutLoading}
                  >
                    Results+ — ${(PARTICIPANT_PRICING.resultsPlusCents / 100).toFixed(2)}/month
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Payments are handled by Paddle.com as Merchant of Record. 30-day money-back guarantee — see our{" "}
                  <a href="/legal/refunds" className="underline">
                    Refund Policy
                  </a>
                  . A one-time unlock covers the extended write-up and PDF for every result on this device, and unlocks
                  as soon as the payment is confirmed.
                </p>
              </div>
            ) : null}

            <div className="mt-10 rounded-xl bg-secondary/60 p-5 text-xs leading-relaxed text-muted-foreground">
              <p>{result.spec.interpretation.disclaimer}</p>
              <p className="mt-3">
                These scores are fixed arithmetic summaries of the answers you gave about yourself, and the wording you
                see was written by the creator before you started. No AI read or analysed your answers, nothing here is
                a diagnosis, screening result or professional advice, and no decision about you is made or influenced by
                any of it. Read our{" "}
                <a href="/legal/acceptable-use" className="underline">
                  AI Use &amp; No Automated Decisions Policy
                </a>
                .{result.watermark ? " · Created with Psych Lab (free plan)" : ""}
              </p>

            </div>
          </>
        )}
      </main>
    </div>
  );
}
