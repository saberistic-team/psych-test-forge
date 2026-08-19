import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getTestByCode, submitAttempt } from "@/lib/participant.functions";
import { getParticipantId, getParticipantName, setParticipantName } from "@/lib/participant-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TestBanner } from "@/components/visuals/TestBanner";
import { visualsOf } from "@/lib/visuals";

export const Route = createFileRoute("/take/$code")({
  head: () => ({
    meta: [
      { title: "Answer the questionnaire — Psych Lab" },
      {
        name: "description",
        content: "Answer each statement about yourself. Your answers are added up and the scores are shown to you.",
      },
      { property: "og:title", content: "Answer the questionnaire — Psych Lab" },
      {
        property: "og:description",
        content: "A short self-report questionnaire with your own arithmetic scores shown back to you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },

    ],
  }),
  component: TakePage,
});

function Shell({ children }: { children: React.ReactNode }) {
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
          <Button asChild variant="ghost" size="sm">
            <Link to="/take">Different code</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">{children}</main>
    </div>
  );
}

function TakePage() {
  const { code } = Route.useParams();
  const router = useRouter();
  const fetchTest = useServerFn(getTestByCode);
  const submit = useServerFn(submitAttempt);

  const [participantId, setParticipantId] = useState("");
  const [name, setName] = useState("");
  const [started, setStarted] = useState(false);
  const [page, setPage] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [issues, setIssues] = useState<Record<string, string>>({});

  useEffect(() => {
    setParticipantId(getParticipantId());
    setName(getParticipantName());
  }, []);

  const query = useQuery({
    queryKey: ["test-by-code", code],
    queryFn: () => fetchTest({ data: { code } }),
  });

  const mutation = useMutation({
    mutationFn: (vars: { testId: string }) =>
      submit({
        data: {
          testId: vars.testId,
          participantId,
          participantName: name || null,
          responses,
        },
      }),
    onSuccess: async (res) => {
      if (!res.ok) {
        setIssues(res.issues ?? {});
        toast.error(res.message || "Please check your answers.");
        const firstUnanswered = Object.keys(res.issues ?? {})[0];
        if (firstUnanswered) {
          const idx = items.findIndex((i) => i.id === firstUnanswered);
          if (idx >= 0) setPage(Math.floor(idx / PER_PAGE));
        }
        return;
      }
      if (name) setParticipantName(name);
      await router.navigate({ to: "/results/$attemptId", params: { attemptId: res.attemptId! } });
    },
    onError: () => toast.error("Something went wrong submitting your answers."),
  });

  const test = query.data?.found ? query.data.test : null;
  const spec = test?.spec;
  const items = useMemo(() => spec?.items ?? [], [spec]);
  const PER_PAGE = 6;
  const pageCount = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const pageItems = items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const answered = items.filter((i) => responses[i.id] !== undefined).length;

  if (query.isLoading) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Looking up code {code}…
        </div>
      </Shell>
    );
  }

  if (!test || !spec) {
    return (
      <Shell>
        <div className="surface p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <h1 className="mt-4 font-display text-2xl font-semibold">No open test for “{code}”</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The code may be mistyped, or the creator has closed this test.
          </p>
          <Button asChild className="mt-6">
            <Link to="/take">Try another code</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  const scale = spec.instructions.response_scale;
  const scaleValues: number[] = [];
  for (let v = scale.min; v <= scale.max; v++) scaleValues.push(v);

  if (!started) {
    return (
      <Shell>
        <div className="surface overflow-hidden">
          <TestBanner visuals={visualsOf(spec)} height={150} className="rounded-none" />
        </div>
        <div className="surface mt-6 p-6 sm:p-8">
          <Badge variant="secondary" className="rounded-full">
            {spec.meta.construct}
          </Badge>
          <h1 className="mt-3 font-display text-3xl font-semibold">{spec.instructions.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{spec.instructions.prompt_text}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs tracking-wide text-muted-foreground uppercase">Questions</dt>
              <dd className="mt-1 text-lg font-semibold">{items.length}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-muted-foreground uppercase">Time</dt>
              <dd className="mt-1 text-lg font-semibold">~{spec.meta.time_to_complete_minutes} min</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-muted-foreground uppercase">Measures</dt>
              <dd className="mt-1 text-lg font-semibold">{spec.meta.subscales.length} subscales</dd>
            </div>
          </dl>
          <div className="mt-6 space-y-2">
            <Label htmlFor="pname">Your first name (optional)</Label>
            <Input
              id="pname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Used only on your own result page"
              maxLength={40}
              className="max-w-xs"
            />
          </div>
          <div className="mt-6 rounded-lg bg-secondary/60 p-4 text-xs leading-relaxed text-muted-foreground">
            <p>{spec.interpretation.disclaimer}</p>
            <p className="mt-3">
              A human creator wrote and approved this questionnaire before publishing it, using AI only to help draft
              the wording. Your answers are added up with fixed arithmetic and shown to you with text the creator wrote
              in advance — no AI reads, analyses, rates or profiles you. It is for self-reflection, research, education
              or entertainment: no diagnosis or screening is performed, no professional advice is given, and no decision
              about you is made or influenced by the result. See our{" "}
              <a href="/legal/acceptable-use" className="underline">
                AI Use &amp; No Automated Decisions Policy
              </a>
              .
            </p>

          </div>
          <Button size="lg" className="mt-6" onClick={() => setStarted(true)}>
            Begin <ArrowRight className="size-4" />
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="sticky top-0 z-10 -mx-5 mb-6 border-b border-border/60 bg-background/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{spec.instructions.title}</span>
          <span>
            {answered} / {items.length} answered
          </span>
        </div>
        <Progress value={(answered / items.length) * 100} className="mt-2 h-1.5" />
      </div>

      <ol className="space-y-4">
        {pageItems.map((item, i) => (
          <li key={item.id} className="surface p-5">
            <div className="flex gap-3">
              <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                {page * PER_PAGE + i + 1}
              </span>
              <p className="text-base font-medium">{item.text}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {scaleValues.map((v) => {
                const selected = responses[item.id] === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setResponses((r) => ({ ...r, [item.id]: v }));
                      setIssues(({ [item.id]: _drop, ...rest }) => rest);
                    }}
                    className={
                      selected
                        ? "rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                        : "rounded-lg border border-input bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    }
                  >
                    <span className="font-mono">{v}</span>
                    <span className="ml-2">{scale.labels[String(v)]}</span>
                  </button>
                );
              })}
            </div>
            {issues[item.id] ? (
              <p className="mt-3 text-xs font-medium text-destructive">{issues[item.id]}</p>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page + 1} of {pageCount}
        </span>
        {page < pageCount - 1 ? (
          <Button onClick={() => setPage((p) => p + 1)}>
            Next <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={() => mutation.mutate({ testId: test.id })}
            disabled={mutation.isPending || !participantId}
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            See my results
          </Button>
        )}
      </div>
    </Shell>
  );
}
