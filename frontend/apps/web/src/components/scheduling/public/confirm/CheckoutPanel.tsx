// W6 · D2 (paid) — the checkout panel. Behind webFeatureFlags.schedulingPaid +
// Stripe TEST mode. Reuses the read-only components/payments/StripeProvider and
// the Stripe PaymentElement (the web equivalent of the native PaymentSheet — we
// never hand-draw a card form). The booking is created first (status pending
// payment); this panel confirms the PaymentIntent with the returned
// clientSecret. We NEVER mark paid client-side — on success/processing we route
// to the confirmed screen, which reads payment state from the server.

"use client";

import { useState } from "react";
import { CloudOff, Lock, RotateCcw } from "lucide-react";
import clsx from "clsx";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import StripeProvider from "@/components/payments/StripeProvider";
import { pillarTokens, type Pillar } from "@/components/scheduling";

interface CheckoutInnerProps {
  payLabel: string;
  pillar: Pillar;
  onPaid: () => void;
  cardError: string | null;
  setCardError: (v: string | null) => void;
}

function CheckoutInner({
  payLabel,
  pillar,
  onPaid,
  cardError,
  setCardError,
}: CheckoutInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const tk = pillarTokens(pillar);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setCardError(null);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (error) {
        setCardError(
          error.message || "We couldn't confirm the payment. Try another card.",
        );
        setSubmitting(false);
        return;
      }
      const status = paymentIntent?.status;
      if (
        status === "succeeded" ||
        status === "processing" ||
        status === "requires_capture"
      ) {
        onPaid();
        return;
      }
      // requires_action handled by Stripe (3DS) within confirmPayment; any
      // other terminal state → surface a retry.
      setCardError(
        "Your card needs another step. Check the card or try a different one.",
      );
      setSubmitting(false);
    } catch {
      setCardError(
        "Something went wrong taking the payment. Your time is still held.",
      );
      setSubmitting(false);
    }
  };

  return (
    <section>
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
        Payment
      </p>

      {cardError && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-app-warning-light bg-app-warning-bg px-3 py-2.5">
          <RotateCcw
            className="mt-0.5 h-4 w-4 shrink-0 text-app-warning"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-app-warning">
              Your card needs another step
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-app-warning">
              {cardError}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-app-border bg-app-surface p-3">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || !elements || submitting}
        className={clsx(
          "mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-bold transition",
          submitting || !stripe
            ? "cursor-not-allowed bg-app-surface-sunken text-app-text-muted"
            : clsx(tk.bg, tk.textOn, "shadow-sm hover:opacity-95"),
        )}
      >
        {submitting ? (
          "Confirming your booking…"
        ) : (
          <>
            <Lock className="h-4 w-4" aria-hidden />
            {payLabel}
          </>
        )}
      </button>

      <div className="mt-2.5 flex items-center justify-center gap-1.5">
        <Lock className="h-3 w-3 text-app-text-muted" aria-hidden />
        <span className="text-[10.5px] font-medium text-app-text-muted">
          Payments secured by Stripe
        </span>
      </div>
    </section>
  );
}

export default function CheckoutPanel({
  clientSecret,
  payLabel,
  pillar,
  onPaid,
}: {
  clientSecret: string;
  payLabel: string;
  pillar: Pillar;
  onPaid: () => void;
}) {
  const [cardError, setCardError] = useState<string | null>(null);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    // Stripe unavailable / not configured — your time is held; don't dead-end.
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-app-info-light bg-app-info-bg px-3 py-3">
        <CloudOff
          className="mt-0.5 h-4 w-4 shrink-0 text-app-info"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-app-info">
            Card payments are briefly unavailable
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-app-text-secondary">
            Your time is held — we&rsquo;ll keep it while you wait. Try again in
            a moment, no need to start over.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StripeProvider clientSecret={clientSecret}>
      <CheckoutInner
        payLabel={payLabel}
        pillar={pillar}
        onPaid={onPaid}
        cardError={cardError}
        setCardError={setCardError}
      />
    </StripeProvider>
  );
}
