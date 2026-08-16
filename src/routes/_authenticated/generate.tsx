import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Sparkles, Upload, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { startGeneration } from "@/lib/generation.functions";
import { getMyAccount, importTestSpec } from "@/lib/tests.functions";
import { GENERATION_MODELS } from "@/lib/plans";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/generate")({
  head: () => ({
    meta: [
      { title: "Generate a test — Psych Lab" },
      { name: "description", content: "Describe an established instrument or a novel construct and generate a validated test spec." },
      { property: "og:title", content: "Generate a test — Psych Lab" },
      { property: "og:description", content: "AI-drafted items, subscales, scoring and interpretation bands." },
    ],
  }),
  component: GeneratePage,
});

const EXAMPLES = [
  "Recreate the Rosenberg Self-Esteem Scale with its original 10 items and scoring.",
  "A test that measures how someone handles uncertainty at work.",
  "Build the Big Five (IPIP-50 style) with all five factors and reverse-scored items.",
  "Something that tells me whether I'm avoidant or anxious in friendships.",
];

function GeneratePage() {
  const router = useRouter();
  const account = useQuery({ queryKey: ["account"], queryFn: useServerFn(getMyAccount) });
  const generate = useServerFn(startGeneration);
  const importSpec = useServerFn(importTestSpec);

  const [request, setRequest] = useState("");
  const [pathHint, setPathHint] = useState<"auto" | "established" | "novel">("auto");
  const [model, setModel] = useState(GENERATION_MODELS[0]!.id);
  const [temperature, setTemperature] = useState(0.7);
  const [errors, setErrors] = useState<string[]>([]);
  const [raw, setRaw] = useState("");

  const genMutation = useMutation({
    mutationFn: () => generate({ data: { request, pathHint, model, temperature } }),
    onSuccess: async (res) => {
      if (res.blocked) {
        toast.error(res.reason ?? "Your plan limit has been reached.");
        return;
      }
      if (!res.testId) {
        setErrors(res.errors ?? []);
        toast.error("The generator could not produce a valid test spec.");
        return;
      }
      setErrors([]);
      toast.success("Test generated.");
      await router.navigate({ to: "/tests/$id", params: { id: res.testId } });
    },
    onError: () => toast.error("Generation failed. Please try again."),
  });

  const importMutation = useMutation({
    mutationFn: () => importSpec({ data: { raw } }),
    onSuccess: async (res) => {
      if (!res.ok || !res.testId) {
        setErrors(res.errors);
        toast.error("That spec did not pass validation.");
        return;
      }
      setErrors([]);
      toast.success("Spec imported.");
      await router.navigate({ to: "/tests/$id", params: { id: res.testId } });
    },
    onError: () => toast.error("Import failed."),
  });

  const plan = account.data?.plan;
  const usage = account.data?.usage;

  return (
    <AppShell
      title="Generate a test"
      subtitle="Name an instrument you know, or describe the thing you actually want to measure — the generator decides which path to take."
      isAdmin={account.data?.isAdmin ?? false}
      actions={
        plan ? (
          <Badge variant="secondary">
            {usage?.generations ?? 0} / {plan.generations === null ? "∞" : plan.generations} generations used
          </Badge>
        ) : null
      }
    >
      <Tabs defaultValue="ai" className="max-w-3xl">
        <TabsList>
          <TabsTrigger value="ai">
            <WandSparkles className="size-4" /> AI generator
          </TabsTrigger>
          <TabsTrigger value="import">
            <Upload className="size-4" /> Import spec JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-6 space-y-6">
          <div className="surface space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="request">What should this test measure?</Label>
              <Textarea
                id="request"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                rows={5}
                placeholder="e.g. Recreate the PSS-10 perceived stress scale, or: a test that shows whether someone is a people-pleaser at work"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setRequest(ex)}
                    className="rounded-full border border-input px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {ex.length > 46 ? `${ex.slice(0, 46)}…` : ex}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Decision path</Label>
                <Select value={pathHint} onValueChange={(v) => setPathHint(v as typeof pathHint)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Let the model decide</SelectItem>
                    <SelectItem value="established">Established instrument</SelectItem>
                    <SelectItem value="novel">Novel construct</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENERATION_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Creativity</Label>
                <span className="font-mono text-sm text-muted-foreground">{temperature.toFixed(1)}</span>
              </div>
              <Slider
                min={0}
                max={1.2}
                step={0.1}
                value={[temperature]}
                onValueChange={([v]) => setTemperature(v ?? 0.7)}
              />
              <p className="text-xs text-muted-foreground">
                Lower is better for reproducing established instruments; higher helps when inventing a new construct.
              </p>
            </div>

            <Button
              size="lg"
              onClick={() => genMutation.mutate()}
              disabled={request.trim().length < 8 || genMutation.isPending}
            >
              {genMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Drafting and validating…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Generate test
                </>
              )}
            </Button>
            {genMutation.isPending ? (
              <p className="text-xs text-muted-foreground">
                The spec is validated after each attempt; invalid drafts are sent back to the model for repair, so this
                can take up to a minute.
              </p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="import" className="mt-6">
          <div className="surface space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="raw">Paste a test spec JSON</Label>
              <Textarea
                id="raw"
                rows={12}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                className="font-mono text-xs"
                placeholder='{ "meta": { ... }, "items": [ ... ] }'
              />
            </div>
            <Button onClick={() => importMutation.mutate()} disabled={raw.trim().length < 20 || importMutation.isPending}>
              {importMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Validate and import
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {errors.length ? (
        <div className="mt-6 max-w-3xl rounded-xl border border-destructive/40 bg-destructive/5 p-5">
          <h2 className="font-medium">Validation problems</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {errors.map((e) => (
              <li key={e} className="font-mono text-xs">
                {e}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AppShell>
  );
}
