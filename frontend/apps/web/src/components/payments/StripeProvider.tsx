'use client';

import { ReactNode, useMemo } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type Appearance } from '@stripe/stripe-js';

const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/**
 * Singleton Stripe.js instance — loaded once, reused across the app.
 */
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

const appearance: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#10b981', // emerald-500
    colorBackground: '#ffffff',
    colorText: '#1f2937',
    colorDanger: '#ef4444',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    borderRadius: '8px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      border: '1px solid #d1d5db',
      boxShadow: 'none',
      padding: '10px 12px',
    },
    '.Input:focus': {
      border: '1px solid #10b981',
      boxShadow: '0 0 0 1px #10b981',
    },
    '.Label': {
      fontSize: '14px',
      fontWeight: '500',
      marginBottom: '6px',
    },
  },
};

interface StripeProviderProps {
  children: ReactNode;
  /** Optional clientSecret for PaymentIntent or SetupIntent. */
  clientSecret?: string;
  /** Optional: override default appearance. */
  customAppearance?: Appearance;
}

/**
 * Wraps children with Stripe Elements provider.
 *
 * Usage:
 * - Without clientSecret: provides Stripe.js context for creating tokens, etc.
 * - With clientSecret: provides full Elements context for PaymentElement/CardElement.
 */
export default function StripeProvider({
  children,
  clientSecret,
  customAppearance,
}: StripeProviderProps) {
  const options = useMemo(() => {
    const opts: Record<string, any> = {
      appearance: customAppearance || appearance,
    };
    if (clientSecret) {
      opts.clientSecret = clientSecret;
    }
    return opts;
  }, [clientSecret, customAppearance]);

  if (!stripePromise) {
    // No Stripe key configured — show setup message instead of crashing
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
        <p className="text-sm text-yellow-800 font-medium">Stripe is not configured</p>
        <p className="text-xs text-yellow-600 mt-1">
          Set <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> in your environment to enable payments.
        </p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}

/**
 * Export the stripePromise for use outside of React context
 * (e.g., for confirmPayment calls).
 */
export { stripePromise };
