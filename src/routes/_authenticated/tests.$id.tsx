import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteTest,
  getMyAccount,
  getMyTest,
  listTestAttempts,
  setPublished,
} from "@/lib/tests.functions";
import { specSchema } from "@/lib/spec";
import { VisualsPanel } from "@/components/visuals/VisualsPanel";
import { MarketplacePanel } from "@/components/MarketplacePanel";
import { EmbedPanel } from "@/components/EmbedPanel";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/tests/$id")({
  head: () => ({
    meta: [
      { title: "Manage test — Psych Lab" },
      { name: "description", content: "Review items, scoring, interpretation bands and responses for this test." },
      { property: "og:title", content: "Manage test — Psych Lab" },
      { property: "og:description", content: "Publish, share and analyse a generated psychological test." },
    ],
  }),
  component: TestDetail,
});

function TestDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const account = useQuery({ queryKey: ["account"], queryFn: useServerFn(getMyAccount) });
  const fetchTest = useServerFn(getMyTest);
  const fetchAttempts = useServerFn(listTestAttempts);
  const publish = useServerFn(setPublished);
  const remove = useServerFn(deleteTest);
  const [tab, setTab] = useState("items");

  const test = useQuery({ queryKey: ["test", id], queryFn: () => fetchTest({ data: { id } }) });
  const attempts = useQuery({
    queryKey: ["test-attempts", id],
    queryFn: () => fetchAttempts({ data: { testId: id } }),
  });

  const publishMutation = useMutation({
    mutationFn: (vars: { published: boolean; regenerateCode?: boolean }) =>
      publish({ data: { id, published: vars.published, regenerateCode: vars.regenerateCode ?? false } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.reason ?? "Publishing is not available on your plan.");
        return;
      }
      toast.success(res.code ? `Live with code ${res.code}` : "Test unpublished.");
      await qc.invalidateQueries({ queryKey: ["test", id] });
      await qc.invalidateQueries({ queryKey: ["my-tests"] });
    },
    onError: () => toast.error("Could not update publishing."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => remove({ data: { id } }),
    onSuccess: async () => {
      toast.success("Test deleted.");
      await qc.invalidateQueries({ queryKey: ["my-tests"] });
      await router.navigate({ to: "/tests" });
    },
    onError: () => toast.error("Could not delete the test."),
  });

  const parsed = test.data ? specSchema.safeParse(test.data.spec) : null;
  const spec = parsed?.success ? parsed.data : null;

  if (test.isLoading) {
    return (
      <AppShell title="Loading test…" isAdmin={account.data?.isAdmin ?? false}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Fetching spec…
        </div>
      </AppShell>
    );
  }

  if (!test.data || !spec) {
    return (
      <AppShell title="Test unavailable" isAdmin={account.data?.isAdmin ?? false}>
        <div className="surface p-8">
          <p className="text-sm text-muted-foreground">
            This test could not be loaded, or its spec no longer matches the schema.
          </p>
          <Button asChild className="mt-5">
            <Link to="/tests">Back to library</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const shareUrl =
    typeof window !== "undefined" && test.data.access_code
      ? `${window.location.origin}/take/${test.data.access_code}`
      : "";

  return (
    <AppShell
      title={test.data.title}
      subtitle={`${spec.meta.construct} · ${spec.meta.theory_framework}`}
      isAdmin={account.data?.isAdmin ?? false}
      actions={
        <>
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <Switch
              id="published"
              checked={test.data.published}
              onCheckedChange={(checked) => publishMutation.mutate({ published: checked })}
            />
            <Label htmlFor="published" className="text-sm">
              {test.data.published ? "Live" : "Draft"}
            </Label>
          </div>
          <Button variant="outline" size="icon" onClick={() => deleteMutation.mutate()} aria-label="Delete test">
            <Trash2 className="size-4" />
          </Button>
        </>
      }
    >
      {test.data.published && test.data.access_code ? (
        <div className="surface flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Join code</p>
            <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.2em]">{test.data.access_code}</p>
            <p className="mt-1 text-xs text-muted-foreground">{shareUrl}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl);
                toast.success("Link copied.");
              }}
            >
              <Copy className="size-4" /> Copy link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => publishMutation.mutate({ published: true, regenerateCode: true })}
            >
              <RefreshCw className="size-4" /> New code
            </Button>
          </div>
        </div>
      ) : (
        <div className="surface p-5">
          <p className="text-sm text-muted-foreground">
            This test is a private draft.{" "}
            {account.data?.plan?.canPublish
              ? "Flip the switch above to publish it and get a join code."
              : "Publishing requires the Pro plan."}
          </p>
          {!account.data?.plan?.canPublish ? (
            <Button asChild size="sm" className="mt-4">
              <Link to="/billing">See plans</Link>
            </Button>
          ) : null}
        </div>
      )}

      <div className="surface mt-5 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">Marketplace listing</h2>
            <Badge variant={test.data.listed ? "default" : "secondary"}>
              {test.data.listed ? "Listed on Explore" : "Not listed"}
            </Badge>
            {test.data.listed && test.data.sale_mode !== "free" && test.data.price_cents ? (
              <Badge variant="outline">${(test.data.price_cents / 100).toFixed(2)}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {test.data.listed
              ? "Anyone can find this questionnaire on the public Explore page."
              : test.data.published
                ? "List it on Explore to make it public, and set a price if you sell access."
                : "Publish the test first, then list it on the public Explore page."}
          </p>
        </div>
        <Button
          variant={test.data.listed ? "outline" : "default"}
          size="sm"
          onClick={() => {
            setTab("marketplace");
            document.getElementById("test-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          {test.data.listed ? "Manage listing & price" : "List on marketplace"}
        </Button>
      </div>

      <div className="mt-5">
        <EmbedPanel
          testId={id}
          code={test.data.access_code}
          published={test.data.published}
          hideAttribution={test.data.hide_attribution ?? false}
          isPaidPlan={(account.data?.plan?.id ?? "free") !== "free"}
          onChanged={() => void qc.invalidateQueries({ queryKey: ["test", id] })}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-8" id="test-tabs">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="visuals">Visuals</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace &amp; pricing</TabsTrigger>
          <TabsTrigger value="items">Items ({spec.items.length})</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
          <TabsTrigger value="interpretation">Interpretation</TabsTrigger>
          <TabsTrigger value="responses">Responses ({attempts.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="json">Spec JSON</TabsTrigger>
        </TabsList>


        <TabsContent value="visuals" className="mt-6">
          <VisualsPanel testId={id} spec={spec} />
        </TabsContent>

        <TabsContent value="marketplace" className="mt-6">
          <MarketplacePanel
            test={{
              id: test.data.id,
              published: test.data.published,
              listed: test.data.listed,
              featured: test.data.featured,
              verified: test.data.verified,
              tagline: test.data.tagline,
              listing_description: test.data.listing_description,
              price_cents: test.data.price_cents,
              sale_mode: test.data.sale_mode,
            }}
          />
        </TabsContent>

        <TabsContent value="items" className="mt-6">
          <div className="surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Subscale</TableHead>
                  <TableHead className="w-32">Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spec.items.map((item, i) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="max-w-md">{item.text}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.subscale}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.reverse_scored ? (
                          <Badge variant="outline" className="text-xs">
                            reverse
                          </Badge>
                        ) : null}
                        {item.is_attention_check ? (
                          <Badge variant="secondary" className="text-xs">
                            check
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="scoring" className="mt-6 space-y-5">
          <div className="surface p-6">
            <h2 className="font-display text-lg font-semibold">Method</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {spec.scoring.method === "sum" ? "Sum" : "Mean"} scoring · {spec.scoring.reverse_logic} · scale{" "}
              {spec.instructions.response_scale.min}–{spec.instructions.response_scale.max}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Validity check {spec.scoring.validity_check.enabled ? "on" : "off"}
              {spec.scoring.validity_check.enabled ? ` — action: ${spec.scoring.validity_check.action}` : ""}
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="surface p-6">
              <h3 className="font-medium">Subscale bands</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {Object.entries(spec.scoring.subscale_scores.ranges).map(([band, r]) => (
                  <li key={band} className="flex justify-between gap-4">
                    <span className="capitalize">{band}</span>
                    <span className="font-mono text-xs">
                      {r.min} – {r.max}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="surface p-6">
              <h3 className="font-medium">Overall bands</h3>
              {spec.scoring.overall_score.enabled ? (
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {Object.entries(spec.scoring.overall_score.ranges).map(([band, r]) => (
                    <li key={band} className="flex justify-between gap-4">
                      <span className="capitalize">{band}</span>
                      <span className="font-mono text-xs">
                        {r.min} – {r.max}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No overall score — this instrument is interpreted per subscale.
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="interpretation" className="mt-6 space-y-5">
          {spec.meta.subscales.map((sub) => (
            <div key={sub} className="surface p-6">
              <h3 className="font-display text-lg font-semibold">{sub}</h3>
              <dl className="mt-3 space-y-3">
                {Object.entries(spec.interpretation.per_subscale[sub] ?? {}).map(([band, text]) => (
                  <div key={band}>
                    <dt className="text-xs tracking-wide text-muted-foreground uppercase">{band}</dt>
                    <dd className="mt-1 text-sm text-muted-foreground">{text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <div className="surface p-6">
            <h3 className="font-medium">Disclaimer</h3>
            <p className="mt-2 text-sm text-muted-foreground">{spec.interpretation.disclaimer}</p>
            {spec.meta.licensing_caution ? (
              <p className="mt-3 text-sm text-destructive">{spec.meta.licensing_caution}</p>
            ) : null}
            {spec.meta.references.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {spec.meta.references.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="responses" className="mt-6">
          {(attempts.data?.length ?? 0) === 0 ? (
            <div className="surface p-8 text-center text-sm text-muted-foreground">No responses yet.</div>
          ) : (
            <div className="surface overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Overall</TableHead>
                    <TableHead>Validity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.data!.map((a) => {
                    const scores = a.scores as {
                      overall?: { score: number | null; band: string | null };
                      validity?: { passed: boolean };
                    };
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(a.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>{a.participant_name ?? "Anonymous"}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {scores.overall?.score ?? "—"}
                          {scores.overall?.band ? ` (${scores.overall.band})` : ""}
                        </TableCell>
                        <TableCell>
                          {scores.validity?.passed === false ? (
                            <Badge variant="destructive">failed</Badge>
                          ) : (
                            <Badge variant="secondary">ok</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="json" className="mt-6">
          <pre className="surface max-h-[32rem] overflow-auto p-5 font-mono text-xs">
            {JSON.stringify(spec, null, 2)}
          </pre>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
