import type { TestVisuals } from "@/lib/spec";
import { cn } from "@/lib/utils";

/** Strips anything executable from a model-authored inline SVG before rendering. */
function sanitizeSvg(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export function TestIcon({
  visuals,
  size = 48,
  className,
}: {
  visuals: TestVisuals;
  size?: number;
  className?: string;
}) {
  const { icon, banner } = visuals;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-xl", className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${banner.gradient[0]}, ${banner.gradient[banner.gradient.length - 1]})`,
        color: banner.accent,
        fontSize: Math.round(size * 0.52),
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {icon.type === "svg" ? (
        <span
          className="flex items-center justify-center [&_svg]:size-[62%]"
          style={{ width: "100%", height: "100%" }}
          // Model-authored SVG, sanitized above.
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(icon.value) }}
        />
      ) : (
        icon.value
      )}
    </span>
  );
}
