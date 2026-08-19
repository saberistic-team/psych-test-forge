import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  getCreatorAdminDetail,
  grantCreatorCredits,
  removeCreatorGrant,
  setCreatorPlanOverride,
  setCreatorRevenueShare,
} from "@/lib/admin.functions";
import { limitLabel } from "@/lib/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Metric = "generations" | "attempts" | "listings";

export function CreatorAdminDialog({
  userId,
  name,
  open,
  onOpenChange,
}: {
  userId: string | null;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getCreatorAdminDetail);
  const detail = useQuery({
    queryKey: ["creator-admin", userId],
    queryFn: () => fetchDetail({ data: { userId: userId! } }),
    enabled: Boolean(userId) && open,
  });

  const [metric, setMetric] = useState<Metric>("generations");
  const [amount, setAmount] = useState("25");
  const [recurring, setRecurring] = useState(false);
  const [note, setNote] = useState("");
  const [feeInput, setFeeInput] = useState("");

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["creator-admin", userId] });
    await qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const overrideFn = useServerFn(setCreatorPlanOverride);
  const override = useMutation({
    mutationFn: (plan: "free" | "pro" | "business" | null) =>
      overrideFn({ data: { userId: userId!, plan, reason: note || null } }),
    onSuccess: async () => {
      toast.success("Plan updated.");
      await refresh();
    },
    onError: () => toast.error("Could not change the plan."),
  });

  const grantFn = useServerFn(grantCreatorCredits);
  const grant = useMutation({
    mutationFn: () =>
      grantFn({
        data: {
          userId: userId!,
          metric,
          amount: Number(amount),
          recurring,
          note: note || null,
        },
      }),
    onSuccess: async () => {
      toast.success("Credits applied.");
      setNote("");
      await refresh();
    },
    onError: () => toast.error("Could not apply the credits."),
  });

  const removeFn = useServerFn(removeCreatorGrant);
  const remove = useMutation({
    mutationFn: (grantId: string) => removeFn({ data: { grantId } }),
    onSuccess: async (res) => {
      if (!res.ok) return toast.error(res.reason);
      toast.success("Grant removed.");
      await refresh();
    },
    onError: () => toast.error("Could not remove the grant."),
  });

  const feeFn = useServerFn(setCreatorRevenueShare);
  const fee = useMutation({
    mutationFn: (bps: number | null) => feeFn({ data: { userId: userId!, bps } }),
    onSuccess: async () => {
      toast.success("Revenue share updated.");
      await refresh();
    },
    onError: () => toast.error("Could not update the revenue share."),
  });

  const data = detail.data;
  const planOverride = data?.profile?.plan_override ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage {name}</DialogTitle>
          <DialogDescription>
            Change the plan, grant extra monthly credits, and set this creator's revenue share. Every action is
            written to the audit log.
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading || !data ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading creator…
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h3 className="text-sm font-semibold">Plan</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Subscription plan: <span className="font-medium">{data.profile?.plan ?? "free"}</span>. An override
                wins over the subscription until you clear it.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(["free", "pro", "business"] as const).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={planOverride === p ? "default" : "outline"}
                    disabled={override.isPending}
                    onClick={() => override.mutate(p)}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={override.isPending || !planOverride}
                  onClick={() => override.mutate(null)}
                >
                  Clear override
                </Button>
                <Badge variant="secondary">Effective: {data.planId}</Badge>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold">This month's usage</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {([
                  ["generations", "AI generations", data.usage.generations],
                  ["attempts", "Responses", data.usage.attempts],
                  ["listings", "Listings", data.usage.listings],
                ] as const).map(([key, label, used]) => (
                  <div key={key} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 font-mono text-sm">
                      {used} / {limitLabel(data.limits[key])}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      +{data.grantTotals[key].total} extra ({data.grantTotals[key].purchased} bought)
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold">Add credits</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="grant-metric">Metric</Label>
                  <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
                    <SelectTrigger id="grant-metric" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generations">AI generations</SelectItem>
                      <SelectItem value="attempts">Responses</SelectItem>
                      <SelectItem value="listings">Marketplace listings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="grant-amount">Amount</Label>
                  <Input
                    id="grant-amount"
                    className="mt-1.5"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Negative numbers take credits away.</p>
                </div>
                <div>
                  <Label htmlFor="grant-note">Note</Label>
                  <Input
                    id="grant-note"
                    className="mt-1.5"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Support ticket #123"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={recurring} onCheckedChange={setRecurring} aria-label="Repeat every month" />
                  Repeat every month
                </label>
                <Button
                  size="sm"
                  disabled={grant.isPending || !Number(amount)}
                  onClick={() => grant.mutate()}
                >
                  {grant.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Apply
                </Button>
              </div>

              {data.grants.length ? (
                <ul className="mt-4 space-y-2">
                  {data.grants.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span>
                        {g.amount > 0 ? "+" : ""}
                        {g.amount} {g.metric}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {g.period ?? "every month"} · {g.source}
                          {g.note ? ` · ${g.note}` : ""}
                        </span>
                      </span>
                      {g.source === "admin" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(g.id)}
                          aria-label="Remove grant"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section>
              <h3 className="text-sm font-semibold">Revenue share</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Platform fee on this creator's marketplace sales. Currently {(data.feeBps / 100).toFixed(1)}%
                {data.profile?.revenue_share_bps === null
                  ? ` (platform default ${(data.defaultRevenueShareBps / 100).toFixed(1)}%)`
                  : " (custom)"}
                .
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <Label htmlFor="fee-input">Fee %</Label>
                  <Input
                    id="fee-input"
                    className="mt-1.5 w-28"
                    inputMode="decimal"
                    placeholder={(data.feeBps / 100).toFixed(1)}
                    value={feeInput}
                    onChange={(e) => setFeeInput(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={fee.isPending || !feeInput.trim()}
                  onClick={() => fee.mutate(Math.round(Number(feeInput) * 100))}
                >
                  Set custom fee
                </Button>
                <Button size="sm" variant="ghost" disabled={fee.isPending} onClick={() => fee.mutate(null)}>
                  Use platform default
                </Button>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
