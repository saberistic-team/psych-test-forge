import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMyAccount, listMyTests, listTestAttempts } from "@/lib/tests.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Results — Psych Lab" },
      { name: "description", content: "Response volume, subscale averages and validity rates across your tests." },
      { property: "og:title", content: "Results — Psych Lab" },
      { property: "og:description", content: "Aggregate results and cohort averages for your published tests." },
    ],
  }),
  component: Analytics,
});

function Analytics() {
  const account = useQuery({ queryKey: ["account"], queryFn: useServerFn(getMyAccount) });
  const tests = useQuery({ queryKey: ["my-tests"], queryFn: useServerFn(listMyTests) });
  const fetchAttempts = useServerFn(listTestAttempts);
  const [testId, setTestId] = useState("all");

  const attempts = useQuery({
    queryKey: ["attempts", testId],
    queryFn: () => fetchAttempts({ data: { testId: testId === "all" ? null : testId } }),
  });

  const rows = attempts.data ?? [];
  const titleFor = useMemo(
    () => new Map((tests.data ?? []).map((t) => [t.id, t.title])),
    [tests.data],
  );

  const subscaleAverages = useMemo(() => {
    const sums = new Map<string, { total: number; n: number }>();
    for (const r of rows) {
      const subs = (r.scores as { subscales?: { subscale: string; score: number }[] })?.subscales ?? [];
      for (const s of subs) {
        const cur = sums.get(s.subscale) ?? { total: 0, n: 0 };
        cur.total += s.score;
        cur.n += 1;
        sums.set(s.subscale, cur);
      }
    }
    return [...sums.entries()].map(([subscale, v]) => ({
      subscale,
      average: Number((v.total / Math.max(1, v.n)).toFixed(2)),
      n: v.n,
    }));
  }, [rows]);

  const failed = rows.filter(
    (r) => (r.scores as { validity?: { passed?: boolean } })?.validity?.passed === false,
  ).length;

  function exportCsv() {
    if (!account.data?.plan?.pdfExport) {
      toast.error("CSV export is available on Pro and Business plans.");
      return;
    }
    const header = ["attempt_id", "test", "participant", "when", "overall", "band", "validity_passed"];
    const lines = rows.map((r) => {
      const s = r.scores as {
        overall?: { score: number | null; band: string | null };
        validity?: { passed?: boolean };
      };
      return [
        r.id,
        `"${(titleFor.get(r.test_id) ?? "").replace(/"/g, '""')}"`,
        `"${(r.participant_name ?? "Anonymous").replace(/"/g, '""')}"`,
        r.created_at,
        s.overall?.score ?? "",
        s.overall?.band ?? "",
        s.validity?.passed === false ? "no" : "yes",
      ].join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "psychlab-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Results"
      subtitle="Everything participants have submitted, aggregated across your library."
      isAdmin={account.data?.isAdmin ?? false}
      actions={
        <>
          <Select value={testId} onValueChange={setTestId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tests</SelectItem>
              {(tests.data ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> CSV
          </Button>
        </>
      }
    >
      {attempts.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading responses…
        </div>
      ) : rows.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="text-sm text-muted-foreground">No responses yet. Share a join code to get started.</p>
          <Button asChild className="mt-5">
            <Link to="/tests">Open test library</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="surface p-5">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Responses</p>
              <p className="mt-2 font-display text-3xl font-semibold">{rows.length}</p>
            </div>
            <div className="surface p-5">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Failed attention checks</p>
              <p className="mt-2 font-display text-3xl font-semibold">{failed}</p>
            </div>
            <div className="surface p-5">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Subscales measured</p>
              <p className="mt-2 font-display text-3xl font-semibold">{subscaleAverages.length}</p>
            </div>
          </div>

          <h2 className="mt-10 text-lg font-semibold">Subscale averages</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {subscaleAverages.map((s) => (
              <div key={s.subscale} className="surface flex items-center justify-between p-5">
                <div>
                  <p className="font-medium">{s.subscale}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.n} responses</p>
                </div>
                <span className="font-display text-2xl font-semibold">{s.average}</span>
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-lg font-semibold">Recent responses</h2>
          <div className="surface mt-4 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Validity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((r) => {
                  const s = r.scores as {
                    overall?: { score: number | null; band: string | null };
                    validity?: { passed?: boolean };
                  };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{titleFor.get(r.test_id) ?? "—"}</TableCell>
                      <TableCell>{r.participant_name ?? "Anonymous"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {s.overall?.score ?? "—"}
                        {s.overall?.band ? ` (${s.overall.band})` : ""}
                      </TableCell>
                      <TableCell>
                        {s.validity?.passed === false ? (
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
        </>
      )}
    </AppShell>
  );
}
