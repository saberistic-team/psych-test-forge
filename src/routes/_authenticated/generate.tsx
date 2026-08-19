import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Pencil, RotateCcw, Sparkles, Upload, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { getGenerationJob, listGenerationJobs, retryGeneration, startGeneration } from "@/lib/generation.functions";
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
  validateSearch: (search: Record<string, unknown>): { prompt?: string } => ({
    prompt: typeof search.prompt === "string" ? search.prompt.slice(0, 2000) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Generate a questionnaire — Psych Lab" },
      { name: "description", content: "Describe an established instrument or a novel construct and generate a validated questionnaire spec." },
      { property: "og:title", content: "Generate a questionnaire — Psych Lab" },
      { property: "og:description", content: "AI-drafted items, subscales, scoring and score-range text you approve." },
    ],
  }),
  component: GeneratePage,
});

const EXAMPLES = [
  "Recreate the Rosenberg Self-Esteem Scale with its original 10 items and scoring.",
  "A questionnaire about how someone handles uncertainty at work.",
  "Build the Big Five (IPIP-50 style) with all five factors and reverse-scored items.",
  "Something that reflects whether I'm avoidant or anxious in friendships.",
];

const STALE_MS = 10 * 60 * 1000;
const ACTIVE_JOB_KEY = "psychlab.activeGenerationJob";

type Progress = {
  stage?: string;
  attempt?: number;
  history?: string[][];
  message?: string;
  details?: string[];
  counted?: boolean;
};

type JobRow = {
  id: string;
  status: string;
  request: string;
  model: string;
  temperature?: number | string | null;
  path_hint?: string | null;
  test_id: string | null;
  errors?: unknown;
  created_at: string;
  updated_at?: string | null;
};

function readProgress(errors: unknown): Progress {
  return errors && typeof errors === "object" && !Array.isArray(errors) ? (errors as Progress) : {};
}

function isStale(job: JobRow): boolean {
  const at = new Date(job.updated_at ?? job.created_at).getTime();
  return job.status === "running" && Date.now() - at > STALE_MS;
}

function GeneratePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const account = useQuery({ queryKey: ["account"], queryFn: useServerFn(getMyAccount) });
  const generate = useServerFn(startGeneration);
  const retry = useServerFn(retryGeneration);
  const importSpec = useServerFn(importTestSpec);
  const fetchJob = useServerFn(getGenerationJob);
  const fetchJobs = useServerFn(listGenerationJobs);

  const [request, setRequest] = useState("");
  const [pathHint, setPathHint] = useState<"auto" | "established" | "novel">("auto");
  const [model, setModel] = useState(GENERATION_MODELS[0]!.id);
  const [temperature, setTemperature] = useState(0.7);
  const [errors, setErrors] = useState<string[]>([]);
  const [notCharged, setNotCharged] = useState(false);
  const [raw, setRaw] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Reattach to an in-flight run after a reload or navigation.
  useEffect(() => {
    const stored = window.localStorage.getItem(ACTIVE_JOB_KEY);
    if (stored) setActiveJobId(stored);
  }, []);

  useEffect(() => {
    if (activeJobId) window.localStorage.setItem(ACTIVE_JOB_KEY, activeJobId);
    else window.localStorage.removeItem(ACTIVE_JOB_KEY);
  }, [activeJobId]);

  const jobs = useQuery({
    queryKey: ["generation-jobs"],
    queryFn: () => fetchJobs() as Promise<JobRow[]>,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((j) => j.status === "running" && !isStale(j)) ? 3000 : false,
  });

  const activeJob = useQuery({
    queryKey: ["generation-job", activeJobId],
    enabled: !!activeJobId,
    queryFn: () => fetchJob({ data: { id: activeJobId! } }) as Promise<JobRow | null>,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 2000 : false),
  });

  useEffect(() => {
    const job = activeJob.data;
    if (!job) return;
    if (job.status === "running" && !isStale(job)) return;
    setActiveJobId(null);
    void queryClient.invalidateQueries({ queryKey: ["generation-jobs"] });
    if (job.status === "done" && job.test_id) {
      toast.success("Questionnaire generated.");
      void router.navigate({ to: "/tests/$id", params: { id: job.test_id } });
    } else if (job.status === "error") {
      const progress = readProgress(job.errors);
      setErrors([progress.message ?? "The generator could not produce a valid spec.", ...(progress.details ?? [])]);
      setNotCharged(true);
      toast.error("Generation failed — the attempt was not counted against your plan.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob.data?.status, activeJob.data?.id]);

  const genMutation = useMutation({
    mutationFn: () => generate({ data: { request, pathHint, model, temperature } }),
    onMutate: () => {
      setErrors([]);
      setNotCharged(false);
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["generation-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      if (res.blocked) {
        toast.error(res.reason ?? "Your plan limit has been reached.");
        return;
      }
      if (res.jobId) setActiveJobId(res.jobId);
      if (!res.testId) {
        setErrors(res.errors ?? []);
        setNotCharged(true);
        toast.error("The generator could not produce a valid spec — this attempt was not charged.");
        setActiveJobId(null);
        return;
      }
      setErrors([]);
      setActiveJobId(null);
      toast.success("Questionnaire generated.");
      await router.navigate({ to: "/tests/$id", params: { id: res.testId } });
    },
    onError: () => toast.error("Generation failed. Your run is saved below — you can try again."),
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => retry({ data: { jobId } }),
    onMutate: (jobId) => {
      setErrors([]);
      setNotCharged(false);
      setActiveJobId(jobId);
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["generation-jobs"] });
      setActiveJobId(null);
      if (res.ok && res.testId) {
        toast.success("Questionnaire generated.");
        await router.navigate({ to: "/tests/$id", params: { id: res.testId } });
        return;
      }
      setErrors(res.errors);
      setNotCharged(true);
      toast.error("That retry did not pass validation either.");
    },
    onError: () => {
      setActiveJobId(null);
      toast.error("Retry failed. Please try again.");
    },
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

  function editJob(job: JobRow) {
    setRequest(job.request);
    if (job.path_hint === "established" || job.path_hint === "novel") setPathHint(job.path_hint);
    else setPathHint("auto");
    if (job.model) setModel(job.model);
    const t = Number(job.temperature);
    if (Number.isFinite(t)) setTemperature(t);
    setErrors([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Request loaded — adjust it and generate again.");
  }

  const plan = account.data?.plan;
  const usage = account.data?.usage;
  const running =
    genMutation.isPending || retryMutation.isPending || activeJob.data?.status === "running";
  const progress = readProgress(activeJob.data?.errors);
  const recent = (jobs.data ?? []).filter((j) => j.id !== activeJobId || j.status !== "running");

  return (
    <AppShell
      title="Generate a questionnaire"
      subtitle="Name an instrument you know, or describe the thing you want to measure — you review and approve every drafted item before publishing."
      isAdmin={account.data?.isAdmin ?? false}
      actions={
        plan ? (
          <Badge variant="secondary">
            {usage?.generations ?? 0} / {plan.generations === null ? "∞" : plan.generations} generations used
          </Badge>
        ) : null
      }
    >
      {running ? (
        <div className="mb-6 max-w-3xl rounded-xl border border-primary/40 bg-primary/5 p-5">
          <div className="flex items-center gap-2 font-medium">
            <Loader2 className="size-4 animate-spin" />
            {progress.stage ?? "Drafting the questionnaire"}
            {progress.attempt && progress.attempt > 1 ? ` — attempt ${progress.attempt}` : ""}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            This run is saved, so you can leave this page and come back — it will still be here.
          </p>
        </div>
      ) : null}

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
              <Label htmlFor="request">What should this questionnaire measure?</Label>
              <Textarea
                id="request"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                rows={5}
                placeholder="e.g. Recreate the PSS-10 perceived stress scale, or: a questionnaire about people-pleasing at work"
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
              disabled={request.trim().length < 8 || running}
            >
              {running ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Working…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Generate questionnaire
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Failed runs are never counted against your plan, and every run stays listed below so you can retry or
              edit the request.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="import" className="mt-6">
          <div className="surface space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="raw">Paste a spec JSON</Label>
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
          <h2 className="font-medium">What went wrong</h2>
          {notCharged ? (
            <p className="mt-1 text-sm text-muted-foreground">
              This attempt was not counted against your plan.
            </p>
          ) : null}
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {errors.map((e) => (
              <li key={e} className="font-mono text-xs">
                {e}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recent.length ? (
        <section className="mt-8 max-w-3xl space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Recent runs</h2>
          <div className="space-y-3">
            {recent.map((job) => {
              const p = readProgress(job.errors);
              const stale = isStale(job);
              const status = stale ? "error" : job.status;
              return (
                <div key={job.id} className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {status === "done" ? (
                        <CheckCircle2 className="size-4 text-primary" />
                      ) : status === "running" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <AlertTriangle className="size-4 text-destructive" />
                      )}
                      <span className="truncate">{job.request}</span>
                    </div>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {new Date(job.created_at).toLocaleString()} · {job.model}
                      {status === "running" ? ` · ${p.stage ?? "working"}` : ""}
                      {stale ? " · timed out" : ""}
                    </p>
                    {status === "error" && p.message ? (
                      <p className="text-xs text-destructive/90">{p.message}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {status === "done" && job.test_id ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/tests/$id" params={{ id: job.test_id }}>
                          Open
                        </Link>
                      </Button>
                    ) : status === "error" ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={running}
                          onClick={() => retryMutation.mutate(job.id)}
                        >
                          <RotateCcw className="size-4" /> Try again
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => editJob(job)}>
                          <Pencil className="size-4" /> Edit request
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
