import { createFileRoute, Link } from "@tanstack/react-router";
import { FlaskConical, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const TITLE = "What is the Big Five personality test? A plain-English guide";
const DESCRIPTION =
  "The Big Five (OCEAN) measures openness, conscientiousness, extraversion, agreeableness and neuroticism. How it is scored, what it does and doesn't tell you, and how to take one.";
const URL = "https://getpsychlab.app/guides/what-is-the-big-five-personality-test";

const TRAITS = [
  {
    name: "Openness to experience",
    high: "Curious, imaginative, drawn to abstract ideas, art and novelty.",
    low: "Practical, conventional, prefers the familiar and concrete.",
  },
  {
    name: "Conscientiousness",
    high: "Organised, dependable, plans ahead, follows through on commitments.",
    low: "Flexible, spontaneous, less bound by schedules and structure.",
  },
  {
    name: "Extraversion",
    high: "Energised by people, talkative, seeks stimulation and social reward.",
    low: "Reserved, energised by quiet, prefers depth over breadth socially.",
  },
  {
    name: "Agreeableness",
    high: "Trusting, cooperative, quick to consider other people's needs.",
    low: "Direct, sceptical, comfortable with conflict and blunt feedback.",
  },
  {
    name: "Neuroticism",
    high: "Reacts strongly to stress, more frequent worry and mood shifts.",
    low: "Even-keeled, recovers quickly, low baseline emotional reactivity.",
  },
];

const FAQS = [
  {
    q: "Is the Big Five the same as Myers-Briggs (MBTI)?",
    a: "No. MBTI sorts you into one of 16 types; the Big Five places you on five continuous dimensions and reports where you fall on each. Because the Big Five reports degree rather than type, repeat scores tend to be more stable than a type label that can flip when you are near a cut-off.",
  },
  {
    q: "How is a Big Five test scored?",
    a: "Each item belongs to one of the five traits. Some items are reverse-scored, so a low agreement means a high trait score. The items for each trait are then summed or averaged, and that score is placed in an interpretation band such as low, average or high relative to the wording of the scale.",
  },
  {
    q: "How long does it take?",
    a: "Short public inventories run roughly 20 to 60 items, which is about 5 to 10 minutes. Longer research inventories can run to several hundred items. More items generally means a more reliable score per trait.",
  },
  {
    q: "Can a Big Five score diagnose anything?",
    a: "No. Trait scores describe tendencies in how you typically think, feel and behave. They are not clinical instruments and cannot diagnose or treat a condition. If something in your results concerns you, speak to a qualified professional.",
  },
  {
    q: "Do my results change over time?",
    a: "Slowly. Trait scores are fairly stable across months, but they do drift over years and across major life changes. Taking the same test again after a while and comparing bands is more informative than comparing single item answers.",
  },
];

export const Route = createFileRoute("/guides/what-is-the-big-five-personality-test")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          mainEntityOfPage: { "@type": "WebPage", "@id": URL },
          publisher: { "@type": "Organization", name: "Psych Lab" },
        }),
      },
    ],
  }),
  component: BigFiveGuide,
});

function BigFiveGuide() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FlaskConical className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold">Psych Lab</span>
          </Link>
          <Button asChild size="sm" variant="secondary">
            <Link to="/explore">Explore tests</Link>
          </Button>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-14">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
          Guide · Personality
        </Badge>
        <h1 className="mt-5 text-3xl leading-tight font-semibold sm:text-4xl">
          What is the Big Five personality test?
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          The Big Five is the model most personality researchers actually use. Instead of sorting you into a type, it
          places you on five independent dimensions — openness, conscientiousness, extraversion, agreeableness and
          neuroticism, often remembered as <strong className="text-foreground">OCEAN</strong> — and reports how high or
          low you sit on each one.
        </p>

        <h2 className="mt-12 text-2xl font-semibold">The five traits</h2>
        <p className="mt-3 text-muted-foreground">
          Each trait is scored separately, so there is no “good” or “bad” profile — only a description of where your
          tendencies sit relative to the scale's wording.
        </p>
        <div className="mt-6 space-y-4">
          {TRAITS.map((t) => (
            <div key={t.name} className="surface p-5">
              <h3 className="font-display text-lg font-semibold">{t.name}</h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium">Scoring high</dt>
                  <dd className="mt-1 text-muted-foreground">{t.high}</dd>
                </div>
                <div>
                  <dt className="font-medium">Scoring low</dt>
                  <dd className="mt-1 text-muted-foreground">{t.low}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-semibold">How the scoring actually works</h2>
        <ol className="mt-4 space-y-3 text-muted-foreground">
          <li>
            <strong className="text-foreground">1. Items map to subscales.</strong> Every statement belongs to exactly
            one of the five traits, so your answers are grouped before anything is added up.
          </li>
          <li>
            <strong className="text-foreground">2. Reverse-scored items are flipped.</strong> “I keep my things tidy”
            and “I leave my belongings around” both measure conscientiousness — the second one has to be inverted before
            it can be summed with the first.
          </li>
          <li>
            <strong className="text-foreground">3. Each trait is summed or averaged.</strong> A mean keeps the score on
            the same 1–5 scale as the items, which makes traits with different item counts comparable.
          </li>
          <li>
            <strong className="text-foreground">4. Scores are placed in bands.</strong> A number on its own means
            little, so each trait score falls into a band — typically low, average or high — with a short interpretation
            written for that band.
          </li>
          <li>
            <strong className="text-foreground">5. Validity is checked.</strong> Well-built inventories include
            attention checks and flag a response set that looks careless, because a straight-lined questionnaire
            produces a meaningless profile.
          </li>
        </ol>

        <h2 className="mt-12 text-2xl font-semibold">What it can and can't tell you</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="surface p-5">
            <h3 className="font-semibold">It can</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>Describe how you typically behave across situations.</li>
              <li>Give you language for tendencies you already sense.</li>
              <li>Show change when you retake it months or years later.</li>
              <li>Compare your profile with a cohort taking the same test.</li>
            </ul>
          </div>
          <div className="surface p-5">
            <h3 className="font-semibold">It can't</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>Diagnose or treat any condition.</li>
              <li>Predict how you will act in a single specific moment.</li>
              <li>Screen candidates fairly on its own.</li>
              <li>Fix a profile in place — traits drift over years.</li>
            </ul>
          </div>
        </div>

        <div className="surface mt-12 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-display text-xl font-semibold">Take a Big Five style test</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse public tests on Psych Lab, or enter the join code a researcher or creator gave you. Every result
              includes your subscale scores and interpretation bands for free.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/explore">
                Find a test <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/take">I have a code</Link>
            </Button>
          </div>
        </div>

        <h2 className="mt-12 text-2xl font-semibold">Common questions</h2>
        <Accordion type="single" collapsible className="mt-4">
          {FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="mt-12 text-sm text-muted-foreground">
          Psych Lab is not a diagnostic service. Personality results describe tendencies and invite reflection; they
          never diagnose or treat.{" "}
          <Link to="/legal/terms" className="underline">
            Terms
          </Link>{" "}
          ·{" "}
          <Link to="/legal/privacy" className="underline">
            Privacy
          </Link>
        </p>
      </article>
    </div>
  );
}
