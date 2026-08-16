import { createFileRoute } from "@tanstack/react-router";
import { RESULTS_STYLES, type TestVisuals } from "@/lib/spec";
import { ResultsVisual } from "@/components/visuals/ResultsVisual";

export const Route = createFileRoute("/visualcheck")({ component: Check });

const base: TestVisuals = {
  icon: { type: "emoji", value: "🧭", style: "" },
  banner: { gradient: ["#12263F", "#2E6B8A"], pattern: "waves", accent: "#4FD1C5", caption: "" },
  results: { style: "radar", theme: "compass", description: "" },
};

const subs = [
  { subscale: "Reflection", score: 4.2, band: "high", items: 5 },
  { subscale: "Recovery", score: 2.8, band: "moderate", items: 5 },
  { subscale: "Avoidance", score: 1.6, band: "low", items: 5 },
  { subscale: "Drive", score: 3.6, band: "moderate", items: 4 },
];

function Check() {
  return (
    <div className="space-y-10 p-8">
      {RESULTS_STYLES.map((style) => (
        <section key={style} data-style={style}>
          <h2 className="mb-3 font-semibold">{style}</h2>
          <ResultsVisual
            visuals={{ ...base, results: { ...base.results, style } }}
            subscales={subs}
            scale={{ min: 1, max: 5 }}
          />
        </section>
      ))}
    </div>
  );
}
