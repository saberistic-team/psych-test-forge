import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { createListingCheckout } from "@/lib/listings.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { StripeCheckoutDialog } from "@/components/StripeCheckoutDialog";
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchClientSecret = useCallback(async () => {
    setBusy(true);
    try {
      const res = await start({
        data: {
          testId,
          participantId,
          returnUrl: window.location.href,
          environment: getStripeEnvironment(),
        },
      });
      if (res.alreadyPaid || !res.clientSecret) {
        setOpen(false);
        toast.success("You already have access.");
        onAlreadyPaid?.();
        throw new Error("Access already granted.");
      }
      return res.clientSecret;
    } catch (error) {
      setOpen(false);
      const message = error instanceof Error ? error.message : "Could not start the payment.";
      if (message !== "Access already granted.") toast.error(message);
      throw error;
    } finally {
      setBusy(false);
    }
  }, [start, testId, participantId, onAlreadyPaid]);

  const price = `$${(priceCents / 100).toFixed(2)}`;

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
      <Button size="lg" className="mt-6" onClick={() => setOpen(true)} disabled={busy || !participantId}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null} Pay {price}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        Payments and receipts are handled by Stripe. 30-day money-back guarantee — see our{" "}
        <a href="/legal/refunds" className="underline">
          Refund Policy
        </a>
        .
      </p>
      <StripeCheckoutDialog
        open={open}
        onOpenChange={setOpen}
        title="Unlock this questionnaire"
        fetchClientSecret={fetchClientSecret}
      />
    </div>
  );
}
