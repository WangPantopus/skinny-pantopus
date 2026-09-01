'use client';

import { useState, useCallback } from 'react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import * as api from '@pantopus/api';

interface PaymentFlowParams {
  clientSecret: string;
  isSetupIntent?: boolean;
  gigId: string;
}

function normalizeStripeError(message?: string): string {
  const msg = String(message || '').toLowerCase();
  if (
    msg.includes('you did not provide an api key') ||
    msg.includes('authorization header') ||
    msg.includes('api key') ||
    msg.includes('invalid api key')
  ) {
    return 'Stripe is not configured. Please verify the publishable key and try again.';
  }
  return message || 'Payment failed';
}

/**
 * Web equivalent of mobile's useGigPaymentFlow.
 *
 * Instead of the native PaymentSheet, this hook drives Stripe Elements
 * (PaymentElement) via useStripe/useElements. The component tree must
 * be wrapped in <StripeProvider clientSecret={...}>.
 *
 * Two entry points:
 *   - initiatePayment(gigId)  — fetches params from the API and confirms
 *   - confirmPayment(params)  — confirms with pre-fetched params
 *
 * Returns { initiatePayment, confirmPayment, isProcessing, error, paymentParams }.
 * paymentParams is populated after initiatePayment fetches them so the caller
 * can render <StripeProvider clientSecret={paymentParams.clientSecret}>.
 */
export function useGigPaymentFlow() {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentParams, setPaymentParams] = useState<{
    clientSecret: string;
    isSetupIntent: boolean;
    gigId: string;
  } | null>(null);

  /**
   * Fetch payment sheet params from the backend for a gig.
   * Stores them in state so the parent can render StripeProvider
   * with the clientSecret before calling confirmPayment.
   */
  const initiatePayment = useCallback(async (gigId: string): Promise<{
    clientSecret: string;
    isSetupIntent: boolean;
  } | null> => {
    setIsProcessing(true);
    setError(null);
    try {
      const params = await api.payments.getPaymentSheetParams(gigId);
      const result = {
        clientSecret: params.paymentIntent,
        isSetupIntent: params.isSetupIntent,
        gigId,
      };
      setPaymentParams(result);
      return result;
    } catch (err: any) {
      setError(normalizeStripeError(err?.message || 'Failed to set up payment'));
      setIsProcessing(false);
      return null;
    }
  }, []);

  /**
   * Confirm the payment/setup using Stripe Elements.
   * Must be called after Elements are mounted with the clientSecret.
   */
  const confirmPayment = useCallback(async (params?: PaymentFlowParams): Promise<boolean> => {
    const p = params || paymentParams;
    if (!p) {
      setError('No payment parameters available. Please try again.');
      return false;
    }

    if (!stripe || !elements) {
      setError('Payment system is loading. Please wait...');
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const returnUrl = `${window.location.origin}/app/gigs/${p.gigId}?payment=${p.isSetupIntent ? 'setup_complete' : 'authorized'}`;

      if (p.isSetupIntent) {
        const { error: setupError } = await stripe.confirmSetup({
          elements,
          confirmParams: { return_url: returnUrl },
          redirect: 'if_required',
        });

        if (setupError) {
          if (setupError.type === 'validation_error') {
            setError(setupError.message || 'Please check your card details.');
          } else {
            setError(normalizeStripeError(setupError.message));
          }
          return false;
        }

        // Card saved — notify backend
        try {
          await api.payments.completePaymentSetup(p.gigId);
        } catch {
          // Non-critical — webhook will handle it
        }

        return true;
      } else {
        const { error: confirmError } = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: returnUrl },
          redirect: 'if_required',
        });

        if (confirmError) {
          if (confirmError.type === 'validation_error') {
            setError(confirmError.message || 'Please check your card details.');
          } else {
            setError(normalizeStripeError(confirmError.message));
          }
          return false;
        }

        return true;
      }
    } catch (err: any) {
      setError(normalizeStripeError(err?.message || 'Payment failed unexpectedly'));
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [stripe, elements, paymentParams]);

  const reset = useCallback(() => {
    setError(null);
    setPaymentParams(null);
    setIsProcessing(false);
  }, []);

  return {
    initiatePayment,
    confirmPayment,
    isProcessing,
    error,
    paymentParams,
    reset,
  };
}
