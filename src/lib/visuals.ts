import type { BannerPattern, ResultsStyle, TestSpec, TestVisuals } from "./spec";

/** Band → color mapping used by every results visual so bands stay distinguishable. */
export const BAND_COLORS: { key: string; color: string; label: string }[] = [
  { key: "low", color: "#D9A03A", label: "Low" },
  { key: "moderate", color: "#3B7BD8", label: "Moderate" },
  { key: "high", color: "#2FA36B", label: "High" },
];

export function bandColor(band: string | null | undefined): string {
  if (!band) return "#7C8695";
  const key = band.toLowerCase();
  const hit = BAND_COLORS.find((b) => key.includes(b.key));
  if (hit) return hit.color;
  if (key.includes("very high") || key.includes("elevated")) return "#2FA36B";
  if (key.includes("average") || key.includes("mid")) return "#3B7BD8";
  return "#7C8695";
}

/** Deterministic fallback visuals so a spec without a visuals block still renders. */
export function fallbackVisuals(spec: TestSpec): TestVisuals {
  const seed = [...spec.meta.construct].reduce((a, c) => a + c.charCodeAt(0), 0);
  const palettes: [string, string, string][] = [
    ["#12263F", "#2E6B8A", "#4FD1C5"],
    ["#1B1B3A", "#4B2E83", "#B57BFF"],
    ["#0F2E22", "#25664A", "#68D391"],
    ["#2B1B12", "#8A4B2E", "#F6AD55"],
    ["#101828", "#1D4ED8", "#60A5FA"],
  ];
  const palette = palettes[seed % palettes.length]!;
  const styles: ResultsStyle[] = ["radar", "gauges", "bars", "rings", "terrain", "constellation"];
  const patterns: BannerPattern[] = ["waves", "dots", "grid", "mountains", "stars"];
  const style: ResultsStyle = spec.meta.subscales.length >= 3 ? styles[seed % styles.length]! : "bars";
  return {
    icon: { type: "emoji", value: "🧠", style: "generated placeholder mark" },
    banner: {
      gradient: [palette[0], palette[1]],
      pattern: patterns[seed % patterns.length]!,
      accent: palette[2],
      caption: spec.meta.construct,
    },
    results: {
      style,
      theme: spec.meta.theory_framework,
      description:
        "Each subscale is drawn as its own element; warmer muted tones mark lower bands, blue marks moderate and green marks high.",
    },
  };
}

/** Visuals for any spec, falling back when the block is missing. */
export function visualsOf(spec: TestSpec): TestVisuals {
  return spec.visuals ?? fallbackVisuals(spec);
}

/** Radar needs at least three axes; anything less falls back to bars. */
export function effectiveResultsStyle(style: ResultsStyle, subscaleCount: number): ResultsStyle {
  if (style === "radar" && subscaleCount < 3) return "bars";
  return style;
}

export const PATTERN_LABELS: Record<BannerPattern, string> = {
  waves: "Waves",
  dots: "Dots",
  grid: "Grid",
  mountains: "Mountains",
  stars: "Stars",
  none: "None",
};

export const RESULTS_STYLE_LABELS: Record<ResultsStyle, string> = {
  radar: "Radar",
  gauges: "Gauges",
  bars: "Bars",
  rings: "Rings",
  terrain: "Terrain",
  constellation: "Constellation",
};
