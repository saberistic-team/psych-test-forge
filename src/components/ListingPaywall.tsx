import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { createListingCheckout } from "@/lib/listings.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { Button } from "@/components/ui/button";

type Props = {
  testId: string;
  participantId: string;
  priceCents: number;
  mode: "take" | "results";
  onAlreadyPaid?: () => void;
};

/** Payment gate for questionnaires a creator sells on the marketplace. */
export function ListingPaywall({ testId, participantId, priceCents, mode, onAlreadyPaid }: Props) {
  const start = useServerFn(createListingCheckout);
  const { openTransaction, loading } = usePaddleCheckout();

  const mutation = useMutation({
    mutationFn: () =>
      start({ data: { testId, participantId, environment: getPaddleEnvironment() } }),
    onSuccess: async (res) => {
      if (res.alreadyPaid || !res.transactionId) {
        toast.success("You already have access.");
        onAlreadyPaid?.();
        return;
      }
      await openTransaction(res.transactionId);
    },
    onError: () => toast.error("Could not start the payment. Please try again."),
  });

  const price = `$${(priceCents / 100).toFixed(2)}`;
  const busy = mutation.isPending || loading;

  return (
    <div className="surface p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 size-5 text-accent" />
        <div>
          <h2 className="font-display text-xl font-semibold">
            {mode === "take" ? "This questionnaire is paid" : "Unlock your full results"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {mode === "take"
              ? `The creator charges ${price} once for access to this questionnaire. After paying you can answer it and see your scores.`
              : `Answering was free. The creator charges ${price} once for the full score breakdown and the text they wrote in advance for each score range.`}
          </p>
        </div>
      </div>
      <Button size="lg" className="mt-6" onClick={() => mutation.mutate()} disabled={busy || !participantId}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null} Pay {price}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        Payments are handled by Paddle.com as Merchant of Record. 30-day money-back guarantee — see our{" "}
        <a href="/legal/refunds" className="underline">
          Refund Policy
        </a>
        .
      </p>
    </div>
  );
}
