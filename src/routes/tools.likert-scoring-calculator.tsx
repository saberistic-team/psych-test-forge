import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Calculator, FlaskConical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TITLE = "Likert scale scoring calculator (with reverse scoring)";
const DESCRIPTION =
  "Paste your Likert items, mark the reverse-scored ones and get sum, mean and subscale scores instantly. Free, runs in your browser, nothing stored.";
const URL = "https://getpsychlab.app/tools/likert-scoring-calculator";

export const Route = createFileRoute("/tools/likert-scoring-calculator")({
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
          "@type": "WebApplication",
          name: "Likert scale scoring calculator",
          description: DESCRIPTION,
          url: URL,
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Any",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          publisher: { "@type": "Organization", name: "Psych Lab" },
        }),
      },
    ],
  }),
  component: LikertCalculator,
});

const SAMPLE = `I feel confident tackling new problems | Confidence
I often doubt my own judgement | Confidence
I keep going when a task gets difficult | Persistence
I give up sooner than most people | Persistence`;

const SCALE_OPTIONS = [
  { value: "1-5", min: 1, max: 5, label: "1 – 5 (5-point)" },
  { value: "1-7", min: 1, max: 7, label: "1 – 7 (7-point)" },
  { value: "0-4", min: 0, max: 4, label: "0 – 4 (5-point, zero-based)" },
  { value: "0-6", min: 0, max: 6, label: "0 – 6 (7-point, zero-based)" },
  { value: "1-4", min: 1, max: 4, label: "1 – 4 (forced choice)" },
  { value: "1-10", min: 1, max: 10, label: "1 – 10" },
];

type Row = { text: string; subscale: string; reverse: boolean; answer: string };

function parseRows(text: string, previous: Row[]): Row[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [rawText, rawSub] = line.split("|");
      const prev = previous[index];
      return {
        text: (rawText ?? "").trim(),
        subscale: (rawSub ?? "").trim() || "Total",
        reverse: prev?.reverse ?? false,
        answer: prev?.answer ?? "",
      };
    });
}

function round(n: number) {
  return Number(n.toFixed(2));
}

function LikertCalculator() {
  const [itemsText, setItemsText] = useState(SAMPLE);
  const [rows, setRows] = useState<Row[]>(() => parseRows(SAMPLE, []));
  const [scaleKey, setScaleKey] = useState("1-5");

  const scale = SCALE_OPTIONS.find((s) => s.value === scaleKey)!;

  const updateItems = (text: string) => {
    setItemsText(text);
    setRows((prev) => parseRows(text, prev));
  };

  const setRow = (index: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const result = useMemo(() => {
    const scored = rows.map((r) => {
      const raw = r.answer === "" ? null : Number(r.answer);
      const valid = raw !== null && !Number.isNaN(raw) && raw >= scale.min && raw <= scale.max;
      const value = valid ? (r.reverse ? scale.max + scale.min - raw! : raw!) : null;
      return { ...r, raw, valid, value, outOfRange: raw !== null && !Number.isNaN(raw) && !valid };
    });

    const answered = scored.filter((s) => s.value !== null);
    const groups = new Map<string, number[]>();
    for (const s of answered) {
      const list = groups.get(s.subscale) ?? [];
      list.push(s.value!);
      groups.set(s.subscale, list);
    }

    const subscales = [...groups.entries()].map(([name, values]) => ({
      name,
      items: values.length,
      sum: round(values.reduce((a, b) => a + b, 0)),
      mean: round(values.reduce((a, b) => a + b, 0) / values.length),
      possible: `${values.length * scale.min} – ${values.length * scale.max}`,
    }));

    const all = answered.map((s) => s.value!);
    return {
      scored,
      subscales,
      answered: answered.length,
      missing: rows.length - answered.length,
      total: all.length
        ? {
            sum: round(all.reduce((a, b) => a + b, 0)),
            mean: round(all.reduce((a, b) => a + b, 0) / all.length),
            possible: `${all.length * scale.min} – ${all.length * scale.max}`,
          }
        : null,
    };
  }, [rows, scale]);

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
            <Link to="/templates">Questionnaire templates</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
          Free tool · No sign-up
        </Badge>
        <h1 className="mt-5 text-3xl leading-tight font-semibold sm:text-4xl">
          Likert scale scoring calculator
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Paste your items, mark which ones are reverse-scored, enter the answers and get sum, mean and per-subscale
          scores. Everything runs in your browser — nothing is uploaded or saved.
        </p>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="surface p-5">
              <Label htmlFor="items" className="text-sm font-medium">
                Your items — one per line, optionally <code className="text-xs">text | subscale</code>
              </Label>
              <Textarea
                id="items"
                value={itemsText}
                onChange={(e) => updateItems(e.target.value)}
                rows={6}
                className="mt-3 font-mono text-sm"
                placeholder={"I feel confident tackling new problems | Confidence"}
              />
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div>
                  <Label className="text-sm font-medium">Response scale</Label>
                  <Select value={scaleKey} onValueChange={setScaleKey}>
                    <SelectTrigger className="mt-2 w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCALE_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows((prev) => prev.map((r) => ({ ...r, answer: "", reverse: false })))}
                >
                  <RotateCcw className="mr-2 size-4" /> Clear answers
                </Button>
              </div>
            </div>

            <div className="surface overflow-hidden">
              <div className="border-b border-border/60 px-5 py-3 text-sm font-medium">
                Items ({rows.length})
              </div>
              <ul className="divide-y divide-border/60">
                {result.scored.map((row, index) => (
                  <li key={index} className="flex flex-wrap items-center gap-4 px-5 py-3">
                    <div className="min-w-[200px] flex-1">
                      <p className="text-sm">{row.text || <span className="text-muted-foreground">(empty)</span>}</p>
                      <p className="text-xs text-muted-foreground">{row.subscale}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`rev-${index}`}
                        checked={row.reverse}
                        onCheckedChange={(v) => setRow(index, { reverse: v })}
                      />
                      <Label htmlFor={`rev-${index}`} className="text-xs text-muted-foreground">
                        Reverse
                      </Label>
                    </div>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={scale.min}
                      max={scale.max}
                      value={row.answer}
                      onChange={(e) => setRow(index, { answer: e.target.value })}
                      className="w-20"
                      aria-label={`Answer for item ${index + 1}`}
                    />
                    <span
                      className={`w-16 text-right text-sm tabular-nums ${row.outOfRange ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {row.outOfRange ? "range" : row.value === null ? "—" : row.value}
                    </span>
                  </li>
                ))}
                {rows.length === 0 && (
                  <li className="px-5 py-6 text-sm text-muted-foreground">Add at least one item above.</li>
                )}
              </ul>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="surface p-5">
              <h2 className="font-display text-lg font-semibold">Scores</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {result.answered} answered · {result.missing} missing
              </p>
              {result.total ? (
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total sum</dt>
                    <dd className="font-medium tabular-nums">{result.total.sum}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total mean</dt>
                    <dd className="font-medium tabular-nums">{result.total.mean}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Possible range</dt>
                    <dd className="tabular-nums">{result.total.possible}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Enter answers to see scores.</p>
              )}
            </div>

            {result.subscales.length > 1 && (
              <div className="surface p-5">
                <h2 className="font-display text-lg font-semibold">Subscales</h2>
                <ul className="mt-3 space-y-3 text-sm">
                  {result.subscales.map((s) => (
                    <li key={s.name}>
                      <div className="flex justify-between font-medium">
                        <span>{s.name}</span>
                        <span className="tabular-nums">{s.mean}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        sum {s.sum} · {s.items} items · possible {s.possible}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="surface p-5">
              <h2 className="font-display text-base font-semibold">Turn this into a real questionnaire</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Psych Lab does this scoring automatically for every respondent, with join codes, subscale bands and CSV
                export.
              </p>
              <Button asChild className="mt-4 w-full">
                <Link to="/auth">
                  Build it in Psych Lab <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </aside>
        </section>

        <section className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-semibold">How Likert scoring works</h2>
          <p className="mt-3 text-muted-foreground">
            A Likert item gives a number — usually 1 to 5 or 1 to 7 — for how strongly someone agrees. Scoring a scale
            means three steps.
          </p>
          <ol className="mt-6 space-y-5">
            <li className="surface p-5">
              <h3 className="font-display text-lg font-semibold">1. Reverse the negatively worded items</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                If a high answer means a <em>low</em> amount of the thing you are measuring, flip it with{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">new = (max + min) − raw</code>. On a 1–5 scale a
                raw 2 becomes 4. Skipping this step is the single most common scoring mistake.
              </p>
            </li>
            <li className="surface p-5">
              <h3 className="font-display text-lg font-semibold">2. Aggregate by subscale, not just overall</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Sum or average the items belonging to each subscale. Means are easier to compare when subscales have
                different numbers of items; sums are conventional when you are reproducing a published scoring key.
              </p>
            </li>
            <li className="surface p-5">
              <h3 className="font-display text-lg font-semibold">3. Map the score to a band</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                A raw number means nothing on its own. Define ranges — low, average, high — and write the wording for
                each one in advance, so every respondent gets the same interpretation for the same score.
              </p>
            </li>
          </ol>
          <div className="surface mt-8 p-5">
            <h3 className="font-display text-lg font-semibold">Sum or mean — which should I use?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Use a <strong className="text-foreground">sum</strong> when you are following an existing scoring key or
              published cut-offs. Use a <strong className="text-foreground">mean</strong> when subscales have unequal
              item counts, when some answers may be missing, or when you want scores that stay on the original 1–5
              language. This calculator shows both.
            </p>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            This calculator does arithmetic on numbers you type in. It is not a diagnostic tool and does not interpret
            results for any individual.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link to="/templates">Browse questionnaire templates</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/guides/what-is-the-big-five-personality-test">Read the Big Five guide</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
