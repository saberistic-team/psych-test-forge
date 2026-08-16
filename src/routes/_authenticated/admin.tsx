import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getAdminOverview, getMyAccount } from "@/lib/tests.functions";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Psych Lab" },
      { name: "description", content: "Platform-wide creators, tests, attempts and revenue for Psych Lab admins." },
      { property: "og:title", content: "Admin — Psych Lab" },
      { property: "og:description", content: "System overview across every creator on Psych Lab." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const account = useQuery({ queryKey: ["account"], queryFn: useServerFn(getMyAccount) });
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: useServerFn(getAdminOverview) });

  return (
    <AppShell
      title="Platform admin"
      subtitle="Every creator, test and attempt on Psych Lab."
      isAdmin={account.data?.isAdmin ?? false}
    >
      {overview.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading platform data…
        </div>
      ) : overview.isError || !overview.data ? (
        <div className="surface p-8 text-sm text-muted-foreground">
          You don't have permission to view platform admin data.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Creators", value: overview.data.totals.creators },
              { label: "Tests", value: overview.data.totals.tests },
              { label: "Attempts", value: overview.data.totals.attempts },
              { label: "Creator MRR", value: `$${(overview.data.totals.mrrCents / 100).toFixed(0)}` },
              { label: "Report revenue", value: `$${Number(overview.data.totals.reportRevenue).toFixed(2)}` },
            ].map((s) => (
              <div key={s.label} className="surface p-5">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">{s.label}</p>
                <p className="mt-2 font-display text-3xl font-semibold">{s.value}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-lg font-semibold">Creators</h2>
          <div className="surface mt-4 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Tests</TableHead>
                  <TableHead>Live</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.data.creators.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.org ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.plan === "free" ? "secondary" : "default"}>{c.plan}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.tests}</TableCell>
                    <TableCell className="font-mono text-sm">{c.live}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </AppShell>
  );
}
