import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Calculator, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { templateBySlug } from "@/lib/templates";

export const Route = createFileRoute("/templates/$slug")({
  loader: ({ params }) => {
    const template = templateBySlug(params.slug);
    if (!template) throw notFound();
    return { template };
  },
  head: ({ params, loaderData }) => {
    const url = `https://getpsychlab.app/templates/${params.slug}`;
    if (!loaderData) {
      return { meta: [{ title: "Template not found — Psych Lab" }, { name: "robots", content: "noindex" }] };
    }
    const t = loaderData.template;
    return {
      meta: [
        { title: t.metaTitle },
        { name: "description", content: t.metaDescription },
        { property: "og:title", content: t.metaTitle },
        { property: "og:description", content: t.metaDescription },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: t.metaTitle,
            description: t.metaDescription,
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            publisher: { "@type": "Organization", name: "Psych Lab" },
          }),
        },
      ],
    };
  },
  notFoundComponent: TemplateNotFound,
  component: TemplateDetail,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FlaskConical className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold">Psych Lab</span>
          </Link>
          <Button asChild size="sm" variant="secondary">
            <Link to="/templates">All templates</Link>
          </Button>
        </div>
      </header>
      {children}
    </div>
  );
}

function TemplateNotFound() {
  return (
    <Shell>
      <main className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h1 className="text-2xl font-semibold">Template not found</h1>
        <p className="mt-3 text-muted-foreground">That template does not exist or has been renamed.</p>
        <Button asChild className="mt-6">
          <Link to="/templates">Browse all templates</Link>
        </Button>
      </main>
    </Shell>
  );
}

function TemplateDetail() {
  const { template: t } = Route.useLoaderData();

  return (
    <Shell>
      <article className="mx-auto max-w-4xl px-5 py-12">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
          Template · {t.audience}
        </Badge>
        <h1 className="mt-5 text-3xl leading-tight font-semibold sm:text-4xl">{t.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{t.summary}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/generate" search={{ prompt: t.prompt }}>
              Use this template <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/tools/likert-scoring-calculator">
              <Calculator className="mr-2 size-4" /> Score it manually
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          "Use this template" opens the Psych Lab builder with this brief pre-filled — you review and edit every item
          before it goes out.
        </p>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Response scale</h2>
          <div className="surface mt-4 p-5">
            <p className="text-sm text-muted-foreground">
              {t.scale.min}–{t.scale.max} agreement scale, scored as a {t.method} per subscale.
            </p>
            <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {t.scale.labels.map((label, i) => (
                <li key={label} className="flex gap-2">
                  <span className="font-medium tabular-nums">{t.scale.min + i}</span>
                  <span className="text-muted-foreground">{label}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Items ({t.items.length})</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Items marked <strong className="text-foreground">reverse</strong> are flipped before scoring with new = (max
            + min) − raw.
          </p>
          <div className="surface mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Subscale</th>
                  <th className="px-4 py-3 font-medium">Scoring</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {t.items.map((item, i) => (
                  <tr key={item.text}>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3">{item.text}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.subscale}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.reverse ? "Reverse" : "Direct"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Score ranges</h2>
          <div className="mt-4 space-y-3">
            {t.bands.map((b) => (
              <div key={b.name} className="surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold">{b.name}</h3>
                  <span className="text-sm tabular-nums text-muted-foreground">{b.range}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">How to score and run it</h2>
          <ul className="mt-4 space-y-3">
            {t.scoringNotes.map((note) => (
              <li key={note} className="surface p-4 text-sm text-muted-foreground">
                {note}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            This is a self-report questionnaire template for feedback and reflection. It is not a clinical or diagnostic
            instrument, and scores should not be used to make decisions about an individual on their own.
          </p>
        </section>

        <section className="surface mt-12 p-6">
          <h2 className="font-display text-xl font-semibold">Run this with automatic scoring</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Psych Lab handles the reverse scoring, subscale bands, join codes and CSV export for you — and you can list
            the finished questionnaire publicly.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/generate" search={{ prompt: t.prompt }}>
                Use this template
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/templates">Other templates</Link>
            </Button>
          </div>
        </section>
      </article>
    </Shell>
  );
}
