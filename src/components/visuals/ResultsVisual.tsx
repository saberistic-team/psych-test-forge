import { useEffect, useState, type ReactElement } from "react";
import type { ResultsStyle, TestVisuals } from "@/lib/spec";
import { bandColor, effectiveResultsStyle } from "@/lib/visuals";
import { cn } from "@/lib/utils";

export type VisualSubscale = { subscale: string; score: number; band: string; items: number };

export type ResultsVisualProps = {
  visuals: TestVisuals;
  subscales: VisualSubscale[];
  overall?: { enabled: boolean; score: number | null; band: string | null };
  scale: { min: number; max: number };
  className?: string;
  compact?: boolean;
};

function norm(score: number, scale: { min: number; max: number }) {
  const span = Math.max(1, scale.max - scale.min);
  return Math.max(0, Math.min(1, (score - scale.min) / span));
}

/** Small mount flag so every visual animates in once, without a library. */
function useReveal(delay = 60) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return on;
}

function Legend({ visuals }: { visuals: TestVisuals }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {[
        { label: "Low", color: bandColor("low") },
        { label: "Moderate", color: bandColor("moderate") },
        { label: "High", color: bandColor("high") },
      ].map((b) => (
        <span key={b.label} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: b.color }} />
          {b.label}
        </span>
      ))}
      {visuals.results.theme ? <span className="italic">{visuals.results.theme}</span> : null}
    </div>
  );
}

/* ---------------------------------- radar --------------------------------- */

function Radar({ subscales, scale }: ResultsVisualProps) {
  const on = useReveal();
  const size = 320;
  const c = size / 2;
  const r = c - 54;
  const n = subscales.length;
  const point = (i: number, value: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * value, c + Math.sin(a) * r * value] as const;
  };
  const rings = [0.25, 0.5, 0.75, 1];
  const polygon = subscales
    .map((s, i) => point(i, on ? Math.max(0.06, norm(s.score, scale)) : 0.06).join(","))
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[360px]" role="img" aria-label="Radar chart of subscale scores">
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={subscales.map((_, i) => point(i, ring).join(",")).join(" ")}
          className="fill-none stroke-border"
          strokeWidth={1}
        />
      ))}
      {subscales.map((s, i) => {
        const [x, y] = point(i, 1);
        return <line key={s.subscale} x1={c} y1={c} x2={x} y2={y} className="stroke-border" strokeWidth={1} />;
      })}
      <polygon
        points={polygon}
        fill={bandColor(subscales[0]?.band)}
        fillOpacity={0.22}
        stroke={bandColor(subscales[0]?.band)}
        strokeWidth={2}
        style={{ transition: "all 900ms cubic-bezier(.2,.8,.2,1)" }}
      />
      {subscales.map((s, i) => {
        const [x, y] = point(i, on ? Math.max(0.06, norm(s.score, scale)) : 0.06);
        const [lx, ly] = point(i, 1.18);
        return (
          <g key={s.subscale}>
            <circle cx={x} cy={y} r={4.5} fill={bandColor(s.band)} style={{ transition: "all 900ms cubic-bezier(.2,.8,.2,1)" }} />
            <text
              x={lx}
              y={ly}
              textAnchor={lx > c + 6 ? "start" : lx < c - 6 ? "end" : "middle"}
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {s.subscale.length > 18 ? `${s.subscale.slice(0, 17)}…` : s.subscale}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* --------------------------------- gauges --------------------------------- */

function Gauges({ subscales, scale }: ResultsVisualProps) {
  const on = useReveal();
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {subscales.map((s, idx) => {
        const value = norm(s.score, scale);
        const r = 52;
        const circumference = Math.PI * r; // half circle
        const offset = circumference * (1 - (on ? value : 0));
        return (
          <div key={s.subscale} className="text-center">
            <svg viewBox="0 0 140 84" className="mx-auto w-full max-w-[180px]" role="img" aria-label={`${s.subscale} gauge`}>
              <path d="M18 74 A52 52 0 0 1 122 74" className="fill-none stroke-border" strokeWidth={10} strokeLinecap="round" />
              <path
                d="M18 74 A52 52 0 0 1 122 74"
                fill="none"
                stroke={bandColor(s.band)}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: `stroke-dashoffset 900ms ${idx * 80}ms cubic-bezier(.2,.8,.2,1)` }}
              />
              <text x="70" y="66" textAnchor="middle" className="fill-foreground font-mono text-[18px]">
                {s.score}
              </text>
            </svg>
            <p className="mt-1 text-sm font-medium">{s.subscale}</p>
            <p className="text-xs capitalize text-muted-foreground">{s.band}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- bars ---------------------------------- */

function Bars({ subscales, scale }: ResultsVisualProps) {
  const on = useReveal();
  return (
    <div className="space-y-4">
      {subscales.map((s, idx) => {
        const pct = norm(s.score, scale) * 100;
        return (
          <div key={s.subscale}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{s.subscale}</span>
              <span className="font-mono text-sm text-muted-foreground">
                {s.score} · <span className="capitalize">{s.band}</span>
              </span>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${on ? pct : 0}%`,
                  background: `linear-gradient(90deg, ${bandColor(s.band)}99, ${bandColor(s.band)})`,
                  transition: `width 900ms ${idx * 70}ms cubic-bezier(.2,.8,.2,1)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- rings --------------------------------- */

function Rings({ subscales, scale }: ResultsVisualProps) {
  const on = useReveal();
  const size = 300;
  const c = size / 2;
  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[320px]" role="img" aria-label="Concentric rings of subscale scores">
        {subscales.map((s, i) => {
          const r = c - 22 - i * (Math.min(26, (c - 40) / Math.max(1, subscales.length)));
          if (r <= 8) return null;
          const circ = 2 * Math.PI * r;
          const value = norm(s.score, scale);
          return (
            <g key={s.subscale} transform={`rotate(-90 ${c} ${c})`}>
              <circle cx={c} cy={c} r={r} className="fill-none stroke-border" strokeWidth={11} />
              <circle
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={bandColor(s.band)}
                strokeWidth={11}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - (on ? value : 0))}
                style={{ transition: `stroke-dashoffset 1000ms ${i * 90}ms cubic-bezier(.2,.8,.2,1)` }}
              />
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {subscales.map((s) => (
          <span key={s.subscale} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: bandColor(s.band) }} />
            {s.subscale} <span className="font-mono text-muted-foreground">{s.score}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- terrain -------------------------------- */

function Terrain({ subscales, scale, visuals }: ResultsVisualProps) {
  const on = useReveal();
  const w = 400;
  const h = 200;
  const step = w / Math.max(1, subscales.length - 1 || 1);
  const pts = subscales.map((s, i) => {
    const x = subscales.length === 1 ? w / 2 : i * step;
    const y = h - 24 - norm(s.score, scale) * (h - 60);
    return [x, on ? y : h - 24] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${path} L${w} ${h} L0 ${h} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Terrain profile of subscale scores">
        <defs>
          <linearGradient id="terrain-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={visuals.banner.accent} stopOpacity={0.55} />
            <stop offset="100%" stopColor={visuals.banner.gradient[0]} stopOpacity={0.08} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#terrain-fill)" style={{ transition: "d 1000ms cubic-bezier(.2,.8,.2,1)" }} />
        <path
          d={path}
          fill="none"
          stroke={visuals.banner.accent}
          strokeWidth={2.5}
          strokeLinejoin="round"
          style={{ transition: "d 1000ms cubic-bezier(.2,.8,.2,1)" }}
        />
        {pts.map(([x, y], i) => (
          <g key={subscales[i]!.subscale}>
            <circle cx={x} cy={y} r={5} fill={bandColor(subscales[i]!.band)} style={{ transition: "all 1000ms cubic-bezier(.2,.8,.2,1)" }} />
            <text x={x} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {subscales[i]!.subscale.length > 14 ? `${subscales[i]!.subscale.slice(0, 13)}…` : subscales[i]!.subscale}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------ constellation ----------------------------- */

function Constellation({ subscales, scale, visuals }: ResultsVisualProps) {
  const on = useReveal();
  const size = 340;
  const c = size / 2;
  const nodes = subscales.map((s, i) => {
    const a = (Math.PI * 2 * i) / Math.max(1, subscales.length) - Math.PI / 2;
    const radius = 40 + norm(s.score, scale) * (c - 70);
    return { s, x: c + Math.cos(a) * radius, y: c + Math.sin(a) * radius, r: 4 + norm(s.score, scale) * 8 };
  });
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto w-full max-w-[360px]"
      style={{ background: `radial-gradient(circle at 50% 50%, ${visuals.banner.gradient[0]}22, transparent 70%)` }}
      role="img"
      aria-label="Constellation of subscale scores"
    >
      {Array.from({ length: 60 }, (_, i) => (
        <circle
          key={`bg${i}`}
          cx={((i * 79) % (size - 8)) + 4}
          cy={((i * 47) % (size - 8)) + 4}
          r={(i % 3) * 0.5 + 0.6}
          fill={visuals.banner.accent}
          opacity={on ? 0.15 + (i % 4) * 0.08 : 0}
          style={{ transition: `opacity 1200ms ${i * 8}ms ease-out` }}
        />
      ))}
      {nodes.map((n, i) => {
        const next = nodes[(i + 1) % nodes.length]!;
        return (
          <line
            key={`l${n.s.subscale}`}
            x1={n.x}
            y1={n.y}
            x2={next.x}
            y2={next.y}
            stroke={visuals.banner.accent}
            strokeWidth={1}
            opacity={on ? 0.45 : 0}
            style={{ transition: `opacity 900ms ${300 + i * 90}ms ease-out` }}
          />
        );
      })}
      {nodes.map((n, i) => (
        <g key={n.s.subscale} opacity={on ? 1 : 0} style={{ transition: `opacity 700ms ${i * 110}ms ease-out` }}>
          <circle cx={n.x} cy={n.y} r={n.r + 6} fill={bandColor(n.s.band)} opacity={0.18} />
          <circle cx={n.x} cy={n.y} r={n.r} fill={bandColor(n.s.band)} />
          <text x={n.x} y={n.y - n.r - 8} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {n.s.subscale.length > 16 ? `${n.s.subscale.slice(0, 15)}…` : n.s.subscale} ({n.s.score})
          </text>
        </g>
      ))}
    </svg>
  );
}

const RENDERERS: Record<ResultsStyle, (p: ResultsVisualProps) => ReactElement> = {
  radar: Radar,
  gauges: Gauges,
  bars: Bars,
  rings: Rings,
  terrain: Terrain,
  constellation: Constellation,
};

/** Renders the score visual chosen by the test's own AI (spec.visuals.results.style). */
export function ResultsVisual(props: ResultsVisualProps) {
  const style = effectiveResultsStyle(props.visuals.results.style, props.subscales.length);
  const Renderer = RENDERERS[style];
  if (!props.subscales.length) return null;
  return (
    <div className={cn("w-full", props.className)}>
      <Renderer {...props} />
      {props.compact ? null : <Legend visuals={props.visuals} />}
    </div>
  );
}
