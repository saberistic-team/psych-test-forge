import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

import { getStripe } from "@/lib/stripe";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Stable across renders — changing it would remount the Stripe iframe. */
  fetchClientSecret: () => Promise<string>;
};

/** Renders Stripe's embedded payment form inside a dialog. */
export function StripeCheckoutDialog({ open, onOpenChange, title, fetchClientSecret }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title ?? "Checkout"}</DialogTitle>
        </DialogHeader>
        {open ? (
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
