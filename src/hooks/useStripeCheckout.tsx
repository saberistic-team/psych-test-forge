import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { StripeCheckoutDialog } from "@/components/StripeCheckoutDialog";
import { getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

export type CheckoutOptions = {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  userId?: string;
  metadata?: Record<string, string>;
  returnUrl?: string;
  title?: string;
};

/**
 * Opens Stripe's embedded checkout in a dialog. Render `checkoutElement`
 * somewhere in the page so the form can mount.
 */
export function useStripeCheckout() {
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [loading, setLoading] = useState(false);

  const openCheckout = useCallback((next: CheckoutOptions) => {
    setOptions(next);
  }, []);

  const closeCheckout = useCallback(() => setOptions(null), []);

  const checkoutElement = useMemo(() => {
    if (!options) return null;
    const fetchClientSecret = async () => {
      setLoading(true);
      try {
        const result = await createCheckoutSession({
          data: {
            priceId: options.priceId,
            quantity: options.quantity ?? 1,
            ...(options.customerEmail ? { customerEmail: options.customerEmail } : {}),
            ...(options.userId ? { userId: options.userId } : {}),
            metadata: options.metadata ?? {},
            returnUrl: options.returnUrl || window.location.href,
            environment: getStripeEnvironment(),
          },
        });
        if ("error" in result) throw new Error(result.error);
        if (!result.clientSecret) throw new Error("Checkout could not be started.");
        return result.clientSecret;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not start checkout.");
        throw error;
      } finally {
        setLoading(false);
      }
    };

    return (
      <StripeCheckoutDialog
        open
        onOpenChange={(next) => {
          if (!next) setOptions(null);
        }}
        {...(options.title ? { title: options.title } : {})}
        fetchClientSecret={fetchClientSecret}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  return { openCheckout, closeCheckout, loading, isOpen: Boolean(options), checkoutElement };
}
