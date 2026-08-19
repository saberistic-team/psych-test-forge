import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getAdminPayouts, markPayoutPaid } from "@/lib/earnings.functions";
import { setPlatformRevenueShare } from "@/lib/admin.functions";
import { centsToUsd } from "@/lib/plans";
import { getPaddleEnvironment } from "@/lib/paddle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function PayoutsPanel() {
  const qc = useQueryClient();
  const environment = getPaddleEnvironment();
  const fetchPayouts = useServerFn(getAdminPayouts);
  const payouts = useQuery({
    queryKey: ["admin-payouts", environment],
    queryFn: () => fetchPayouts({ data: { environment } }),
  });

  const [refs, setRefs] = useState<Record<string, string>>({});
  const [defaultFee, setDefaultFee] = useState("");

  const markFn = useServerFn(markPayoutPaid);
  const mark = useMutation({
    mutationFn: (vars: { payoutId: string; paid: boolean; reference?: string | null }) =>
      markFn({ data: { payoutId: vars.payoutId, paid: vars.paid, reference: vars.reference ?? null } }),
    onSuccess: async () => {
      toast.success("Payout updated.");
      await qc.invalidateQueries({ queryKey: ["admin-payouts", environment] });
    },
    onError: () => toast.error("Could not update the payout."),
  });

  const platformFeeFn = useServerFn(setPlatformRevenueShare);
  const platformFee = useMutation({
    mutationFn: (bps: number) => platformFeeFn({ data: { bps } }),
    onSuccess: async () => {
      toast.success("Platform revenue share updated.");
      setDefaultFee("");
      await qc.invalidateQueries({ queryKey: ["admin-payouts", environment] });
    },
    onError: () => toast.error("Could not update the platform revenue share."),
  });

  const rows = payouts.data?.payouts ?? [];

  return (
    <>
      <h2 className="mt-12 text-lg font-semibold">Creator settlements</h2>
      <div className="surface mt-4 flex flex-wrap items-end gap-3 p-5">
        <div>
          <Label htmlFor="platform-fee">Platform revenue share (%)</Label>
          <Input
            id="platform-fee"
            className="mt-1.5 w-32"
            inputMode="decimal"
            placeholder={((payouts.data?.defaultRevenueShareBps ?? 2000) / 100).toFixed(1)}
            value={defaultFee}
            onChange={(e) => setDefaultFee(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          disabled={platformFee.isPending || !defaultFee.trim()}
          onClick={() => platformFee.mutate(Math.round(Number(defaultFee) * 100))}
        >
          Save default
        </Button>
        <p className="text-xs text-muted-foreground">
          Applies to new sales from creators without a custom rate. Existing earnings keep the rate they were booked
          at.
        </p>
      </div>

      {payouts.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading settlements…
        </div>
      ) : !rows.length ? (
        <div className="surface mt-4 p-6 text-sm text-muted-foreground">
          No closed months yet. Settlements appear once a month with marketplace sales has ended.
        </div>
      ) : (
        <div className="surface mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Payable</TableHead>
                <TableHead>Payout details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.creator}</TableCell>
                  <TableCell className="font-mono text-sm">{p.month}</TableCell>
                  <TableCell>{centsToUsd(p.grossCents)}</TableCell>
                  <TableCell>{centsToUsd(p.feeCents)}</TableCell>
                  <TableCell className="font-medium">{centsToUsd(p.netCents)}</TableCell>
                  <TableCell className="max-w-56 text-xs text-muted-foreground">
                    {p.payoutDetails ? (
                      <>
                        <span className="font-medium">{p.payoutMethod}</span> · {p.payoutHolder ?? "—"}
                        <br />
                        {p.payoutDetails}
                      </>
                    ) : (
                      "Creator has not added payout details"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {p.status === "paid" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={mark.isPending}
                        onClick={() => mark.mutate({ payoutId: p.id, paid: false })}
                      >
                        Reopen
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-8 w-32"
                          placeholder="Transfer ref"
                          value={refs[p.id] ?? ""}
                          onChange={(e) => setRefs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          disabled={mark.isPending}
                          onClick={() => mark.mutate({ payoutId: p.id, paid: true, reference: refs[p.id] ?? null })}
                        >
                          Mark paid
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
