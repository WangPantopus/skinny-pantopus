"use client";

// Minimal Stripe checkout used by the one-off paid path (TEST mode, behind
// webFeatureFlags.schedulingPaid). Reuses the platform StripeProvider; card
// entry stays in the native Stripe PaymentElement (never a hand-drawn form).
// On failure it raises onError so the caller can show the D6 PaymentRetryPanel.

import { useState } from "react";
import { Lock, CreditCard } from "lucide-react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import StripeProvider from "@/components/payments/StripeProvider";

function CheckoutInner({
  payLabel,
  onPaid,
  onError,
}: {
  payLabel: string;
  onPaid: () => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const pay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (error) {
        onError(error.message || "Your payment didn’t go through.");
        return;
      }
      if (
        paymentIntent &&
        (paymentIntent.status === "succeeded" ||
          paymentIntent.status === "processing")
      ) {
        onPaid();
      } else {
        onError("Your payment didn’t go through. Try another card.");
      }
    } catch {
      onError("We couldn’t reach the payment service. Check again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <PaymentElement />
      <button
        type="button"
        onClick={pay}
        disabled={!stripe || submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-personal px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        <CreditCard className="h-4 w-4" aria-hidden />
        {submitting ? "Confirming…" : payLabel}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-app-text-muted">
        <Lock className="h-3 w-3" aria-hidden />
        Payments secured by Stripe · test mode
      </p>
    </div>
  );
}

export default function CheckoutPanel({
  clientSecret,
  payLabel = "Pay and confirm",
  onPaid,
  onError,
}: {
  clientSecret: string;
  payLabel?: string;
  onPaid: () => void;
  onError: (message: string) => void;
}) {
  return (
    <StripeProvider clientSecret={clientSecret}>
      <CheckoutInner payLabel={payLabel} onPaid={onPaid} onError={onError} />
    </StripeProvider>
  );
}
