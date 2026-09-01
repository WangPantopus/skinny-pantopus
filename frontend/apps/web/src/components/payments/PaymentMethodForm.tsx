'use client';

import { useState, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { payments } from '@pantopus/api';
const { addPaymentMethod } = payments;

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
    invalid: {
      color: '#ef4444',
    },
  },
  hidePostalCode: false,
};

interface PaymentMethodFormProps {
  /** Called when a card is successfully added. */
  onSuccess: () => void;
  /** Called to cancel / close the form. */
  onCancel?: () => void;
  /** Show as inline form (no card border) vs card style. */
  inline?: boolean;
}

/**
 * Form for adding a new payment method using Stripe CardElement.
 * Must be wrapped in <StripeProvider>.
 */
export default function PaymentMethodForm({
  onSuccess,
  onCancel,
  inline = false,
}: PaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!stripe || !elements) {
        setError('Payment system is loading...');
        return;
      }

      setProcessing(true);
      setError(null);

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError('Card element not found.');
        setProcessing(false);
        return;
      }

      try {
        const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
        });

        if (stripeError) {
          setError(stripeError.message || 'Failed to create payment method.');
          setProcessing(false);
          return;
        }

        if (!paymentMethod) {
          setError('No payment method returned.');
          setProcessing(false);
          return;
        }

        // Save to backend
        await addPaymentMethod({ paymentMethodId: paymentMethod.id });
        onSuccess();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to add card.';
        setError(message);
      } finally {
        setProcessing(false);
      }
    },
    [stripe, elements, onSuccess]
  );

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-2">
          Card details
        </label>
        <div className="border border-app-border rounded-lg p-3 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-app-text-strong font-medium hover:bg-app-hover transition disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!stripe || processing}
          className={`${onCancel ? 'flex-1' : 'w-full'} px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Adding...
            </span>
          ) : (
            'Add Card'
          )}
        </button>
      </div>

      <p className="text-center text-xs text-app-text-muted">
        <Lock className="w-4 h-4 inline-block align-text-bottom" /> Secured by Stripe
      </p>
    </form>
  );

  if (inline) return content;

  return (
    <div className="bg-app-surface border border-app-border rounded-xl p-5">
      <h4 className="font-semibold text-app-text mb-4">Add Payment Method</h4>
      {content}
    </div>
  );
}
