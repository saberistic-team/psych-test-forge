import { useState } from "react";
import { toast } from "sonner";

import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export type CheckoutOptions = {
  priceId: string;
  quantity?: number | undefined;
  customerEmail?: string | undefined;
  customData?: Record<string, string> | undefined;
  successUrl?: string | undefined;
};

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: CheckoutOptions) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: options.quantity ?? 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl || `${window.location.origin}/`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } catch (error) {
      console.error(error);
      toast.error("Could not open checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
