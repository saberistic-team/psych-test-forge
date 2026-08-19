import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calculator, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TEMPLATES } from "@/lib/templates";

const TITLE = "Questionnaire templates with scoring — free, ready to use";
const DESCRIPTION =
  "Free questionnaire templates for engagement, course feedback, wellbeing, customer satisfaction and team culture — with items, response scales, reverse scoring and score-range wording.";
const URL = "https://getpsychlab.app/templates";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: TITLE,
          description: DESCRIPTION,
          url: URL,
          publisher: { "@type": "Organization", name: "Psych Lab" },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: TEMPLATES.map((t, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: t.title,
              url: `https://getpsychlab.app/templates/${t.slug}`,
            })),
          },
        }),
      },
    ],
  }),
  component: TemplatesIndex,
});

function TemplatesIndex() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FlaskConical className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold">Psych Lab</span>
          </Link>
          <Button asChild size="sm" variant="secondary">
            <Link to="/tools/likert-scoring-calculator">
              <Calculator className="mr-2 size-4" /> Scoring calculator
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
          Free templates
        </Badge>
        <h1 className="mt-5 text-3xl leading-tight font-semibold sm:text-4xl">Questionnaire templates with scoring</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Each template gives you the full item list, the response scale, which items are reverse-scored, how the
          subscales are calculated and the wording for each score range. Copy them, or open one in Psych Lab and start
          collecting responses with a join code.
        </p>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <li key={t.slug} className="surface flex flex-col p-5">
              <span className="text-xs font-medium text-muted-foreground">{t.audience}</span>
              <h2 className="mt-2 font-display text-xl font-semibold">
                <Link to="/templates/$slug" params={{ slug: t.slug }} className="hover:underline">
                  {t.title}
                </Link>
              </h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{t.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2.5 py-1">{t.items.length} items</span>
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {t.scale.min}–{t.scale.max} scale
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1">{t.subscales.length} subscales</span>
              </div>
              <Button asChild variant="secondary" size="sm" className="mt-5 self-start">
                <Link to="/templates/$slug" params={{ slug: t.slug }}>
                  View template <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>

        <section className="surface mt-12 p-6">
          <h2 className="font-display text-xl font-semibold">Not sure how to score yours?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the free Likert scoring calculator to check sums, means and reverse-scored items before you send a
            questionnaire out.
          </p>
          <Button asChild className="mt-4">
            <Link to="/tools/likert-scoring-calculator">Open the calculator</Link>
          </Button>
        </section>
      </main>
    </div>
  );
}
