'use client';

import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Wallet } from 'lucide-react';
import { payments } from '@pantopus/api';
const {
  getStripeAccount,
  connectStripeAccount,
  refreshStripeAccountLink,
  connectStripeDashboard,
} = payments;
import type { StripeAccount } from '@pantopus/types';

interface StripeConnectOnboardingProps {
  /** Variant: 'banner' shows a slim CTA, 'card' shows a detailed card. */
  variant?: 'banner' | 'card';
  /** Called when onboarding is complete (account is active). */
  onComplete?: () => void;
}

/**
 * CTA for providers to set up or complete their Stripe Express account.
 * Shows different UI depending on onboarding status.
 */
export default function StripeConnectOnboarding({
  variant = 'card',
  onComplete,
}: StripeConnectOnboardingProps) {
  const [account, setAccount] = useState<StripeAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      const result = await getStripeAccount();
      setAccount(result.account || null);
      if (result.account?.payouts_enabled && result.account?.charges_enabled) {
        onComplete?.();
      }
    } catch {
      // No account yet — that's fine
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [onComplete]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = account
        ? await refreshStripeAccountLink()
        : await connectStripeAccount();

      const link = 'accountLink' in result ? result.accountLink : '';
      if (link) {
        window.location.href = link;
      } else {
        setError('Failed to get onboarding link.');
      }
    } catch (err: unknown) {
      const errData = (err as Record<string, any>)?.data as Record<string, any> | undefined;
      const code = errData?.code;
      let message: string;
      
      if (code === 'connect_not_enabled') {
        message = 'Stripe Connect is not enabled yet. The platform admin needs to set this up in the Stripe Dashboard.';
      } else {
        message = (err as Record<string, any>)?.message as string || (err instanceof Error ? err.message : 'Connection failed. Please try again.');
      }
      
      console.error('Stripe Connect error:', err);
      setError(message);
    } finally {
      setConnecting(false);
    }
  }, [account]);

  const handleDashboard = useCallback(async () => {
    setOpeningDashboard(true);
    setError(null);
    try {
      const result = await connectStripeDashboard();
      if (result.dashboardUrl) {
        window.open(result.dashboardUrl, '_blank', 'noopener,noreferrer');
      } else {
        setError('Could not open Stripe Dashboard.');
      }
    } catch (err: unknown) {
      const message =
        (err as Record<string, any>)?.message as string ||
        (err instanceof Error ? err.message : 'Could not open Stripe Dashboard.');
      setError(message);
    } finally {
      setOpeningDashboard(false);
    }
  }, []);

  if (loading) return null;

  // Already fully onboarded — show nothing
  if (account?.payouts_enabled && account?.charges_enabled) {
    return null;
  }

  // Determine status
  const hasAccount = !!account;
  const needsInfo = hasAccount && !account.details_submitted;
  const pendingVerification = hasAccount && account.details_submitted && !account.payouts_enabled;

  if (variant === 'banner') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
        <span className="flex-shrink-0 text-amber-600"><CreditCard className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            {!hasAccount
              ? 'Set up payouts to get paid for your work.'
              : needsInfo
                ? 'Complete your account setup to receive payouts.'
                : 'Your account is being verified.'}
          </p>
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition disabled:opacity-50 flex-shrink-0"
        >
          {connecting
            ? '...'
            : !hasAccount
              ? 'Set Up'
              : pendingVerification
                ? 'Update details'
                : 'Continue Setup'}
        </button>
      </div>
    );
  }

  // Card variant
  return (
    <div className="bg-app-surface border border-app-border rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 text-emerald-600">
          <Wallet className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-app-text">
            {!hasAccount
              ? 'Start receiving payouts'
              : needsInfo
                ? 'Complete your payout setup'
                : 'Account verification in progress'}
          </h4>
          <p className="text-sm text-app-text-secondary mt-1">
            {!hasAccount
              ? 'Connect your bank account through Stripe to get paid for completed gigs. Setup takes about 5 minutes.'
              : needsInfo
                ? 'Your Stripe account needs more information before you can receive payouts.'
                : 'Stripe is verifying your identity. This usually takes 1-2 business days. You can still return to Stripe to update documents, your bank account, or anything Stripe requests.'}
          </p>

          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}

          {pendingVerification && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
              <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Verification pending…</span>
            </div>
          )}

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center justify-center"
            >
              {connecting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Opening Stripe…
                </span>
              ) : !hasAccount ? (
                'Connect with Stripe'
              ) : pendingVerification ? (
                'Update details in Stripe'
              ) : (
                'Continue setup'
              )}
            </button>
            {hasAccount && (
              <button
                type="button"
                onClick={handleDashboard}
                disabled={openingDashboard || connecting}
                className="px-4 py-2 border border-app-border text-app-text-strong text-sm font-medium rounded-lg hover:bg-app-hover transition disabled:opacity-50 inline-flex items-center justify-center"
              >
                {openingDashboard ? 'Opening…' : 'Open Stripe Dashboard'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
