import { createFileRoute, Link } from "@tanstack/react-router";
import { FlaskConical, Sparkles, ShieldCheck, LineChart, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CREATOR_PLANS, PARTICIPANT_PRICING } from "@/lib/plans";
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Psych Lab — build and publish self-report questionnaires" },
      {
        name: "description",
        content:
          "Authoring software for self-report questionnaires: draft items with AI assistance, edit and approve them yourself, publish behind a join code, and show respondents their own scores.",
      },
      { property: "og:title", content: "Psych Lab — build and publish self-report questionnaires" },
      {
        property: "og:description",
        content:
          "Draft questionnaire items with AI assistance, approve them yourself, publish with a join code, and let respondents see their own arithmetic scores. For research, education and self-reflection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },

    ],
  }),
  component: Landing,
});

function JoinBox() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      className="flex w-full max-w-sm gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim().length >= 4) router.navigate({ to: "/take/$code", params: { code: code.trim().toUpperCase() } });
      }}
    >
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Join code, e.g. K7M2QP"
        aria-label="Test join code"
        maxLength={8}
        className="h-11 bg-card font-mono tracking-[0.18em] uppercase"
      />
      <Button type="submit" size="lg" variant="secondary" className="h-11 shrink-0">
        Take test
      </Button>
    </form>
  );
}

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FlaskConical className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold">Psych Lab</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/explore">Explore tests</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/take">Take a test</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">Start creating</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="hero-wash relative overflow-hidden border-b border-border/60">
        <div className="lab-grid absolute inset-0 opacity-70" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <Badge variant="secondary" className="mb-5 rounded-full px-3 py-1 text-xs font-medium">
            Questionnaire authoring software
          </Badge>
          <h1 className="max-w-3xl text-4xl leading-[1.05] font-semibold sm:text-6xl">
            Draft a self-report questionnaire in a single prompt.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Describe the topic you want to explore. Psych Lab drafts the question wording, the response scale,
            reverse-scoring flags and the score-range text — you edit and approve every word, then publish it behind a
            six-character join code.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Draft your first questionnaire <ArrowRight className="size-4" />
              </Link>
            </Button>
            <JoinBox />
          </div>
          <p className="mt-8 max-w-2xl rounded-xl border border-border/60 bg-secondary/50 p-4 text-xs leading-relaxed text-muted-foreground">
            For research, education, entertainment and self-reflection only. AI is used at authoring time to write
            question wording — it never reads, analyses, rates or profiles a respondent. Scores are fixed arithmetic
            (sum or mean) over answers a person voluntarily gives about themselves, and the text they see is written and
            approved in advance by the human creator. Psych Lab is not a clinical, diagnostic, screening or
            professional-advice service, and it must never be used to make or influence decisions about anyone. See our{" "}
            <Link to="/legal/acceptable-use" className="underline">
              AI Use &amp; No Automated Decisions Policy
            </Link>
            .
          </p>

        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-semibold">How it works</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Two drafting paths",
              body: "Name a questionnaire format you already know and get a draft in that shape, or describe an open topic and get a themed draft with 3–6 sections. Either way it is a starting document you edit.",
            },
            {
              icon: ShieldCheck,
              title: "You approve every word",
              body: "Drafts are checked against a strict schema so they load and add up, then wait in your library until you review, edit and choose to publish. Nothing is published automatically.",
            },
            {
              icon: LineChart,
              title: "Fixed arithmetic scoring",
              body: "Sum or mean of the response scale with reverse-scored items and attention checks. Each score range shows the text you wrote in advance — no AI looks at anyone's answers.",
            },

          ].map((f) => (
            <div key={f.title} className="surface p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-y border-border/60 bg-secondary/40 px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold">Creator plans</h2>
          <p className="mt-2 text-sm text-muted-foreground">Generate, publish and measure. Cancel any time.</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {CREATOR_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={
                  plan.id === "pro"
                    ? "surface relative p-6 ring-2 ring-primary"
                    : "surface p-6"
                }
              >
                {plan.id === "pro" ? (
                  <Badge className="absolute -top-3 left-6">Most popular</Badge>
                ) : null}
                <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                <p className="mt-2">
                  <span className="text-4xl font-semibold">{plan.priceLabel}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full" variant={plan.id === "pro" ? "default" : "outline"}>
                  <Link to="/auth">{plan.priceCents === 0 ? "Start free" : `Choose ${plan.name}`}</Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="surface mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">For respondents</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Free results always show your section scores and score ranges. Unlock the creator's extended write-up —
                text written in advance, the same for everyone in that range — for $
                {(PARTICIPANT_PRICING.premiumReportCents / 100).toFixed(2)} per questionnaire, or subscribe to Results+
                at ${(PARTICIPANT_PRICING.resultsPlusCents / 100).toFixed(2)}/month for unlimited unlocks, history and
                your own trends over time.
              </p>

            </div>
            <Button asChild variant="secondary">
              <Link to="/take">I have a join code</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20">
        <h2 className="text-3xl font-semibold">Questions</h2>
        <Accordion type="single" collapsible className="mt-6">
          <AccordionItem value="a">
            <AccordionTrigger>Are these clinical instruments?</AccordionTrigger>
            <AccordionContent>
              No. Every generated test carries a non-clinical disclaimer — results indicate tendencies and invite
              reflection, they never diagnose or treat. Established instruments are reproduced for research and
              educational use, with a licensing caution when commercial use is plausible.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>What exactly does the AI produce?</AccordionTrigger>
            <AccordionContent>
              A single validated JSON spec: metadata and theory framing, instructions and response scale, every item with
              its subscale and reverse-scoring flag, attention checks, the scoring method with interpretation bands, and
              per-subscale narrative interpretations.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="c">
            <AccordionTrigger>Can I bring a test I already have?</AccordionTrigger>
            <AccordionContent>
              Yes — paste or upload a spec JSON in the generator and it is validated and added to your library like any
              generated test.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="d">
            <AccordionTrigger>Do participants need an account?</AccordionTrigger>
            <AccordionContent>
              Never. They enter a join code and a first name. Results are tied to their device until they choose to
              unlock a premium report.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <footer className="border-t border-border/60 px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Psych Lab. Not a diagnostic service.</span>
          <div className="flex gap-4">
            <Link to="/explore" className="hover:text-foreground">
              Explore
            </Link>
            <Link to="/guides/what-is-the-big-five-personality-test" className="hover:text-foreground">
              Big Five guide
            </Link>
            <Link to="/take" className="hover:text-foreground">
              Take a test
            </Link>
            <Link to="/auth" className="hover:text-foreground">
              Creator sign in
            </Link>
            <Link to="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/legal/refunds" className="hover:text-foreground">
              Refunds
            </Link>
            <Link to="/legal/acceptable-use" className="hover:text-foreground">
              AI use
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
