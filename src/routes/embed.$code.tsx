import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, ListChecks } from "lucide-react";
import { getEmbedConfig } from "@/lib/embed.functions";

export const Route = createFileRoute("/embed/$code")({
  head: () => ({
    meta: [
      { title: "Questionnaire — Psych Lab" },
      { name: "description", content: "Embedded self-report questionnaire powered by Psych Lab." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmbedWidget,
});

function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function EmbedWidget() {
  const { code } = Route.useParams();
  const fetchConfig = useServerFn(getEmbedConfig);
  const q = useQuery({
    queryKey: ["embed", code],
    queryFn: () => fetchConfig({ data: { code } }),
  });

  const embed = q.data?.embed ?? null;
  const takeUrl = `/take/${code.toUpperCase()}`;

  return (
    <div className="min-h-[220px] bg-background p-4">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-5 shadow-sm">
        {q.isLoading ? (
          <div className="space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-9 w-32 animate-pulse rounded bg-muted" />
          </div>
        ) : !embed ? (
          <div>
            <h1 className="font-display text-lg font-semibold">Questionnaire unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This questionnaire is not open right now. Check the code with whoever shared it.
            </p>
          </div>
        ) : (
          <div>
            <h1 className="font-display text-lg font-semibold leading-snug">{embed.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{embed.tagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ListChecks className="size-3.5" /> {embed.itemCount} questions
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> ~{embed.minutes} min
              </span>
              {embed.saleMode !== "free" && embed.priceCents > 0 ? (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                  {money(embed.priceCents)}{" "}
                  {embed.saleMode === "take" ? "to take" : "to unlock results"}
                </span>
              ) : null}
            </div>
            {embed.author ? (
              <p className="mt-3 text-xs text-muted-foreground">By {embed.author}</p>
            ) : null}
            <a
              href={takeUrl}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Start the questionnaire <ArrowRight className="size-4" />
            </a>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Answers are scored with fixed arithmetic set by the author. Not a diagnosis and not
              professional advice.
            </p>
            {embed.showAttribution ? (
              <p className="mt-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                Powered by{" "}
                <a
                  href="https://getpsychlab.app/?ref=embed"
                  target="_blank"
                  rel="noopener"
                  className="underline hover:text-foreground"
                >
                  Psych Lab
                </a>
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
