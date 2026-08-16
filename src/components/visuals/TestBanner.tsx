import type { BannerPattern, TestVisuals } from "@/lib/spec";
import { cn } from "@/lib/utils";
import { TestIcon } from "./TestIcon";

function Pattern({ pattern, color }: { pattern: BannerPattern; color: string }) {
  if (pattern === "none") return null;
  const common = { stroke: color, fill: "none", strokeWidth: 1.2, opacity: 0.55 } as const;
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 400 160"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {pattern === "waves"
        ? [0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M0 ${40 + i * 30} C 60 ${20 + i * 30}, 120 ${60 + i * 30}, 200 ${40 + i * 30} S 340 ${20 + i * 30}, 400 ${44 + i * 30}`}
              {...common}
            />
          ))
        : null}
      {pattern === "grid"
        ? [
            ...Array.from({ length: 13 }, (_, i) => <line key={`v${i}`} x1={i * 32} y1={0} x2={i * 32} y2={160} {...common} opacity={0.28} />),
            ...Array.from({ length: 6 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 32} x2={400} y2={i * 32} {...common} opacity={0.28} />),
          ]
        : null}
      {pattern === "dots"
        ? Array.from({ length: 90 }, (_, i) => (
            <circle key={i} cx={(i % 15) * 28 + 14} cy={Math.floor(i / 15) * 28 + 14} r={2.2} fill={color} opacity={0.4} stroke="none" />
          ))
        : null}
      {pattern === "mountains" ? (
        <>
          <path d="M0 160 L90 60 L150 120 L220 40 L300 130 L400 70 L400 160 Z" fill={color} opacity={0.18} stroke="none" />
          <path d="M0 160 L70 100 L140 150 L230 90 L320 160 Z" fill={color} opacity={0.3} stroke="none" />
        </>
      ) : null}
      {pattern === "stars"
        ? Array.from({ length: 46 }, (_, i) => {
            const x = ((i * 97) % 397) + 3;
            const y = ((i * 53) % 152) + 4;
            const r = (i % 4) * 0.6 + 0.9;
            return <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.25 + (i % 5) * 0.13} stroke="none" />;
          })
        : null}
    </svg>
  );
}

export function TestBanner({
  visuals,
  title,
  subtitle,
  className,
  height = 160,
  showIcon = true,
}: {
  visuals: TestVisuals;
  title?: string;
  subtitle?: string;
  className?: string;
  height?: number;
  showIcon?: boolean;
}) {
  const g = visuals.banner.gradient;
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl", className)}
      style={{
        minHeight: height,
        background:
          g.length >= 3
            ? `linear-gradient(135deg, ${g[0]}, ${g[1]}, ${g[2]})`
            : `linear-gradient(135deg, ${g[0]}, ${g[1]})`,
      }}
    >
      <Pattern pattern={visuals.banner.pattern} color={visuals.banner.accent} />
      <div className="relative flex h-full flex-col justify-end gap-2 p-5">
        {showIcon ? <TestIcon visuals={visuals} size={44} className="shadow-lg" /> : null}
        {title ? (
          <h2 className="font-display text-xl font-semibold text-white drop-shadow-sm">{title}</h2>
        ) : null}
        {subtitle ?? visuals.banner.caption ? (
          <p className="max-w-2xl text-sm text-white/80">{subtitle ?? visuals.banner.caption}</p>
        ) : null}
      </div>
    </div>
  );
}
