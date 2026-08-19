import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Code2, Copy } from "lucide-react";
import { toast } from "sonner";
import { setHideAttribution } from "@/lib/embed.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Props = {
  testId: string;
  code: string | null;
  published: boolean;
  hideAttribution: boolean;
  isPaidPlan: boolean;
  onChanged?: () => void;
};

/**
 * Embed snippet for a published questionnaire. The "Powered by Psych Lab" link is
 * always shown on the free plan; paid plans may switch it off.
 */
export function EmbedPanel({ testId, code, published, hideAttribution, isPaidPlan, onChanged }: Props) {
  const [hide, setHide] = useState(hideAttribution);
  const save = useServerFn(setHideAttribution);
  const mutation = useMutation({
    mutationFn: (next: boolean) => save({ data: { id: testId, hide: next } }),
    onSuccess: (res) => {
      setHide(res.hide);
      if (!res.ok) toast.error(res.reason);
      else toast.success(res.hide ? "Attribution link removed." : "Attribution link shown.");
      onChanged?.();
    },
    onError: () => toast.error("Could not save that setting."),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "https://getpsychlab.app";
  const snippet = code
    ? `<iframe src="${origin}/embed/${code}" title="Questionnaire" width="100%" height="320" style="border:0;max-width:480px" loading="lazy"></iframe>`
    : "";

  if (!published || !code) {
    return (
      <div className="surface p-5">
        <p className="text-sm text-muted-foreground">
          Publish this questionnaire to get an embed snippet for your own site.
        </p>
      </div>
    );
  }

  return (
    <div className="surface space-y-4 p-5">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          <Code2 className="size-4" /> Embed on your site
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Drop this into any page. Visitors see the intro card and open the questionnaire in a new tab.
        </p>
      </div>

      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
        <code>{snippet}</code>
      </pre>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(snippet);
            toast.success("Embed code copied.");
          }}
        >
          <Copy className="size-4" /> Copy embed code
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={`/embed/${code}`} target="_blank" rel="noopener">
            Preview widget
          </a>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
        <div>
          <Label htmlFor="hide-attribution" className="text-sm">
            Remove the “Powered by Psych Lab” link
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {isPaidPlan
              ? "Available on your plan. The link comes back if you move to Free."
              : "Included with Pro and Business."}
          </p>
        </div>
        {isPaidPlan ? (
          <Switch
            id="hide-attribution"
            checked={hide}
            disabled={mutation.isPending}
            onCheckedChange={(next) => mutation.mutate(next)}
          />
        ) : (
          <Button size="sm" asChild>
            <Link to="/billing">Upgrade</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
