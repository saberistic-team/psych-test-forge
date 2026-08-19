import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Banknote, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { getMyEarnings, saveMyPayoutAccount } from "@/lib/earnings.functions";
import { getMyAccount } from "@/lib/tests.functions";
import { centsToUsd } from "@/lib/plans";
import { getPaddleEnvironment } from "@/lib/paddle";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/earnings")({
  head: () => ({
    meta: [
      { title: "Earnings & payouts — Psych Lab" },
      {
        name: "description",
        content: "Track marketplace sales per questionnaire, see the platform fee, and follow monthly payouts.",
      },
      { property: "og:title", content: "Earnings & payouts — Psych Lab" },
      { property: "og:description", content: "Marketplace revenue and monthly settlements for Psych Lab creators." },
    ],
  }),
  component: Earnings,
});

function monthLabel(month: string) {
  const [year, m] = month.split("-");
  if (!year || !m) return month;
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function Earnings() {
  const qc = useQueryClient();
  const environment = getPaddleEnvironment();
  const account = useQuery({ queryKey: ["account"], queryFn: useServerFn(getMyAccount) });

  const fetchEarnings = useServerFn(getMyEarnings);
  const earnings = useQuery({
    queryKey: ["my-earnings", environment],
    queryFn: () => fetchEarnings({ data: { environment } }),
  });

  const [method, setMethod] = useState<"bank" | "paypal" | "wise" | "other">("bank");
  const [details, setDetails] = useState("");
  const [holder, setHolder] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    const account = earnings.data?.account;
    if (!account) return;
    setMethod((account.method as "bank" | "paypal" | "wise" | "other") ?? "bank");
    setDetails(account.details ?? "");
    setHolder(account.holder_name ?? "");
    setCountry(account.country ?? "");
  }, [earnings.data?.account]);

  const savePayout = useServerFn(saveMyPayoutAccount);
  const save = useMutation({
    mutationFn: () =>
      savePayout({
        data: {
          method,
          details,
          holderName: holder || null,
          country: country || null,
        },
      }),
    onSuccess: () => {
      toast.success("Payout details saved.");
      void qc.invalidateQueries({ queryKey: ["my-earnings", environment] });
    },
    onError: () => toast.error("Could not save your payout details."),
  });

  const summary = earnings.data?.summary;
  const canSell = earnings.data?.canSell ?? false;

  return (
    <AppShell
      title="Earnings & payouts"
      subtitle="Marketplace sales, the platform fee, and what we owe you. Settlements run once a month after the month closes."
      isAdmin={account.data?.isAdmin ?? false}
    >
      {earnings.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your earnings…
        </div>
      ) : (
        <>
          {!canSell ? (
            <div className="surface mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-medium">Selling questionnaires is a Business feature</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upgrade to Business to put a price on your public listings and collect revenue through Psych Lab.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to="/billing">See plans</Link>
              </Button>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="surface p-5">
              <p className="text-sm text-muted-foreground">This month, your share</p>
              <p className="mt-2 font-display text-3xl font-semibold">
                {centsToUsd(summary?.currentMonth.netCents ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary?.currentMonth.sales ?? 0} sales · {centsToUsd(summary?.currentMonth.grossCents ?? 0)} gross
              </p>
            </div>
            <div className="surface p-5">
              <p className="text-sm text-muted-foreground">Platform fee</p>
              <p className="mt-2 font-display text-3xl font-semibold">{((summary?.feeBps ?? 0) / 100).toFixed(1)}%</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {centsToUsd(summary?.currentMonth.feeCents ?? 0)} deducted this month
              </p>
            </div>
            <div className="surface p-5">
              <p className="text-sm text-muted-foreground">Lifetime</p>
              <p className="mt-2 font-display text-3xl font-semibold">{centsToUsd(summary?.lifetime.netCents ?? 0)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{summary?.lifetime.sales ?? 0} sales all time</p>
            </div>
          </div>

          <h2 className="mt-10 flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="size-4" /> Per questionnaire
          </h2>
          <div className="surface mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Questionnaire</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Sales</th>
                  <th className="px-4 py-3 font-medium">Gross</th>
                  <th className="px-4 py-3 font-medium">Your share</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.perTest ?? []).map((row) => (
                  <tr key={row.testId} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <Link to="/tests/$id" params={{ id: row.testId }} className="hover:underline">
                        {row.title}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.saleMode === "take" ? "pay to take" : row.saleMode === "results" ? "pay for results" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">{centsToUsd(row.priceCents)}</td>
                    <td className="px-4 py-3">{row.sales}</td>
                    <td className="px-4 py-3">{centsToUsd(row.grossCents)}</td>
                    <td className="px-4 py-3 font-medium">{centsToUsd(row.netCents)}</td>
                  </tr>
                ))}
                {!summary?.perTest.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No sales yet. Price a listed questionnaire from its management page to start selling.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <h2 className="mt-10 flex items-center gap-2 text-lg font-semibold">
            <Banknote className="size-4" /> Monthly settlements
          </h2>
          <div className="surface mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Month</th>
                  <th className="px-4 py-3 font-medium">Gross</th>
                  <th className="px-4 py-3 font-medium">Fee</th>
                  <th className="px-4 py-3 font-medium">Payable to you</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.months ?? []).map((row) => (
                  <tr key={row.month} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">{monthLabel(row.month)}</td>
                    <td className="px-4 py-3">{centsToUsd(row.grossCents)}</td>
                    <td className="px-4 py-3">{centsToUsd(row.feeCents)}</td>
                    <td className="px-4 py-3 font-medium">{centsToUsd(row.netCents)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={row.status === "paid" ? "default" : "secondary"}>
                        {row.status === "open" ? "In progress" : row.status === "paid" ? "Paid" : "Awaiting payout"}
                      </Badge>
                      {row.reference ? (
                        <span className="ml-2 text-xs text-muted-foreground">ref {row.reference}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!summary?.months.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Settlements appear here once a month with sales has closed.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <h2 className="mt-10 text-lg font-semibold">Where should we send your payouts?</h2>
          <div className="surface mt-4 grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="payout-method">Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger id="payout-method" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="wise">Wise</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payout-holder">Account holder</Label>
              <Input
                id="payout-holder"
                className="mt-1.5"
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                placeholder="Full legal name"
              />
            </div>
            <div>
              <Label htmlFor="payout-country">Country</Label>
              <Input
                id="payout-country"
                className="mt-1.5"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Germany"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="payout-details">Payout details</Label>
              <Textarea
                id="payout-details"
                className="mt-1.5"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="IBAN, PayPal email or other instructions"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Only you and Psych Lab admins can see these details. We use them to send your monthly settlement.
              </p>
            </div>
            <div>
              <Button onClick={() => save.mutate()} disabled={save.isPending || details.trim().length < 3}>
                {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save payout details
              </Button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
