import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { BANNER_PATTERNS, RESULTS_STYLES, type BannerPattern, type ResultsStyle, type TestSpec } from "@/lib/spec";
import { PATTERN_LABELS, RESULTS_STYLE_LABELS, visualsOf } from "@/lib/visuals";
import { regenerateVisuals, saveVisuals } from "@/lib/visuals.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TestBanner } from "./TestBanner";
import { TestIcon } from "./TestIcon";
import { ResultsVisual } from "./ResultsVisual";

/** Live visuals preview + art-direction controls for one test. */
export function VisualsPanel({ testId, spec }: { testId: string; spec: TestSpec }) {
  const qc = useQueryClient();
  const regenerate = useServerFn(regenerateVisuals);
  const save = useServerFn(saveVisuals);
  const [visuals, setVisuals] = useState(() => visualsOf(spec));
  const hadVisuals = Boolean(spec.visuals);

  useEffect(() => setVisuals(visualsOf(spec)), [spec]);

  const regenMutation = useMutation({
    mutationFn: () => regenerate({ data: { testId } }),
    onSuccess: async (res) => {
      if (!res.ok || !res.visuals) {
        toast.error(res.errors?.[0] ?? "Could not regenerate the visuals.");
        return;
      }
      setVisuals(res.visuals);
      toast.success(res.generated ? "New art direction generated." : "Applied a fallback art direction.");
      await qc.invalidateQueries({ queryKey: ["test", testId] });
    },
    onError: () => toast.error("Could not regenerate the visuals."),
  });

  const saveMutation = useMutation({
    mutationFn: (next: typeof visuals) => save({ data: { testId, visuals: next } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.errors?.[0] ?? "Could not save the visuals.");
        return;
      }
      toast.success("Visuals saved.");
      await qc.invalidateQueries({ queryKey: ["test", testId] });
    },
    onError: () => toast.error("Could not save the visuals."),
  });

  // Sample scores across bands so the results widget previews realistically.
  const scale = spec.instructions.response_scale;
  const bands = Object.keys(spec.scoring.subscale_scores.ranges);
  const sample = spec.meta.subscales.map((subscale, i) => {
    const band = bands[i % bands.length] ?? "moderate";
    const range = spec.scoring.subscale_scores.ranges[band];
    const score = range ? Number(((range.min + range.max) / 2).toFixed(2)) : (scale.min + scale.max) / 2;
    return { subscale, score, band, items: spec.items.filter((it) => it.subscale === subscale).length };
  });

  const update = (next: typeof visuals) => {
    setVisuals(next);
    saveMutation.mutate(next);
  };

  return (
    <div className="space-y-6">
      <div className="surface flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Art direction</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hadVisuals
              ? "Chosen by the model that wrote this instrument. Regenerate or override it below."
              : "This spec was imported without visuals — a fallback is shown. Generate one to make it marketplace-ready."}
          </p>
          {visuals.results.description ? (
            <p className="mt-2 max-w-xl text-xs text-muted-foreground">{visuals.results.description}</p>
          ) : null}
        </div>
        <Button onClick={() => regenMutation.mutate()} disabled={regenMutation.isPending}>
          {regenMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          Regenerate visuals
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface p-5">
          <h3 className="text-xs tracking-wide text-muted-foreground uppercase">Icon</h3>
          <div className="mt-4 flex flex-wrap items-end gap-5">
            {[24, 40, 64, 96].map((size) => (
              <div key={size} className="text-center">
                <TestIcon visuals={visuals} size={size} />
                <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{size}px</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            <Badge variant="secondary" className="mr-2 uppercase">
              {visuals.icon.type}
            </Badge>
            {visuals.icon.style || "No style note provided."}
          </p>
        </div>

        <div className="surface p-5">
          <h3 className="text-xs tracking-wide text-muted-foreground uppercase">Banner</h3>
          <TestBanner visuals={visuals} title={spec.instructions.title} className="mt-4" />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {visuals.banner.gradient.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <span className="size-4 rounded border border-border" style={{ background: c }} />
                {c}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <span className="size-4 rounded border border-border" style={{ background: visuals.banner.accent }} />
              accent
            </span>
          </div>
          <div className="mt-4 max-w-[220px]">
            <Label className="text-xs">Pattern</Label>
            <Select
              value={visuals.banner.pattern}
              onValueChange={(v) => update({ ...visuals, banner: { ...visuals.banner, pattern: v as BannerPattern } })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANNER_PATTERNS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PATTERN_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xs tracking-wide text-muted-foreground uppercase">Results widget</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <Sparkles className="mr-1 inline size-3.5 text-accent" />
              Sample scores across your bands, rendered exactly as participants will see them.
            </p>
          </div>
          <div className="w-[200px]">
            <Label className="text-xs">Style</Label>
            <Select
              value={visuals.results.style}
              onValueChange={(v) => update({ ...visuals, results: { ...visuals.results, style: v as ResultsStyle } })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESULTS_STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {RESULTS_STYLE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-6">
          <ResultsVisual key={visuals.results.style} visuals={visuals} subscales={sample} scale={scale} />
        </div>
        {saveMutation.isPending ? (
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Saving…
          </p>
        ) : null}
      </div>
    </div>
  );
}
