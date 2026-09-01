'use client';

import { useState, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { payments } from '@pantopus/api';
const { completePaymentSetup } = payments;

interface GigPaymentSetupProps {
  /** The clientSecret from the backend (PaymentIntent or SetupIntent). */
  clientSecret: string;
  /** Whether this is a SetupIntent (save card) vs PaymentIntent (authorize now). */
  isSetupIntent: boolean;
  /** Gig ID for the payment setup flow. */
  gigId: string;
  /** Amount in cents (for display). */
  amount: number;
  /** Called on success. */
  onSuccess: () => void;
  /** Called on error. */
  onError?: (error: string) => void;
  /** Called to close the modal/flow. */
  onClose: () => void;
}

/**
 * Orchestrates the Stripe payment/setup flow after bid acceptance.
 *
 * Two modes:
 * 1. PaymentIntent (gig starts within 5 days) — authorizes payment hold
 * 2. SetupIntent (gig starts beyond 5 days) — saves card for future auth
 *
 * Must be wrapped in <StripeProvider clientSecret={...}>.
 */
export default function GigPaymentSetup({
  isSetupIntent,
  gigId,
  amount,
  onSuccess,
  onError,
  onClose,
}: GigPaymentSetupProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!stripe || !elements) {
        setErrorMessage('Payment system is loading. Please wait...');
        return;
      }

      setProcessing(true);
      setErrorMessage(null);

      try {
        if (isSetupIntent) {
          // ─── SetupIntent flow: save card for future authorization ───
          const { error: setupError } = await stripe.confirmSetup({
            elements,
            confirmParams: {
              return_url: `${window.location.origin}/app/gigs/${gigId}?payment=setup_complete`,
            },
            redirect: 'if_required',
          });

          if (setupError) {
            setErrorMessage(setupError.message || 'Failed to save your card.');
            onError?.(setupError.message || 'Setup failed');
            setProcessing(false);
            return;
          }

          // Card saved — notify backend
          try {
            await completePaymentSetup(gigId);
          } catch {
            // Non-critical — webhook will handle it
          }

          onSuccess();
        } else {
          // ─── PaymentIntent flow: authorize payment hold now ───
          const { error: confirmError } = await stripe.confirmPayment({
            elements,
            confirmParams: {
              return_url: `${window.location.origin}/app/gigs/${gigId}?payment=authorized`,
            },
            redirect: 'if_required',
          });

          if (confirmError) {
            setErrorMessage(confirmError.message || 'Payment authorization failed.');
            onError?.(confirmError.message || 'Authorization failed');
            setProcessing(false);
            return;
          }

          onSuccess();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setErrorMessage(message);
        onError?.(message);
      } finally {
        setProcessing(false);
      }
    },
    [stripe, elements, isSetupIntent, gigId, onSuccess, onError]
  );

  const amountFormatted = `$${(amount / 100).toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-app-surface rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-app-border-subtle">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-app-text">
              {isSetupIntent ? 'Save Payment Method' : 'Authorize Payment'}
            </h2>
            <button
              onClick={onClose}
              className="text-app-text-muted hover:text-app-text-secondary transition"
              disabled={processing}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Info banner */}
          <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            {isSetupIntent ? (
              <>
                <p className="font-medium">Your card will be saved securely.</p>
                <p className="mt-1 text-blue-600">
                  We&apos;ll authorize {amountFormatted} automatically 24 hours before the gig starts.
                  You won&apos;t be charged until the work is confirmed complete.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">{amountFormatted} will be held on your card.</p>
                <p className="mt-1 text-blue-600">
                  This is an authorization hold, not a charge. You&apos;ll only be charged when
                  you confirm the work is complete.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Payment form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <PaymentElement
            options={{
              layout: 'tabs',
            }}
          />

          {/* Error message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-app-text-strong font-medium hover:bg-app-hover transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!stripe || processing}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : isSetupIntent ? (
                'Save Card'
              ) : (
                `Authorize ${amountFormatted}`
              )}
            </button>
          </div>

          {/* Security note */}
          <p className="text-center text-xs text-app-text-muted pt-1">
            <Lock className="w-4 h-4 inline-block align-text-bottom" /> Secured by Stripe. Your card details are never stored on our servers.
          </p>
        </form>
      </div>
    </div>
  );
}
