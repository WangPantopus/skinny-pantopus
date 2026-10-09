import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import type { StripeAccount } from '@pantopus/types';

const errorMessage = (err: unknown, fallback: string) =>
  (err as { message?: string } | null)?.message || fallback;

/**
 * The business's own Stripe payout account. Once Stripe enables its payouts, invoice payments go to it and its balance
 * and payouts are in Stripe's dashboard; until then they go to the primary owner's personal wallet.
 */
export default function PaymentsTab({ businessId }: { businessId: string }) {
  const [stripeAccount, setStripeAccount] = useState<StripeAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const result = await api.businesses.getBusinessStripeAccount(businessId);
        setStripeAccount(result.account || null);
      } catch {
        // 404: the business has no payout account yet.
        setStripeAccount(null);
      }
      setLoading(false);
    })();
  }, [businessId]);

  const openOnboarding = async () => {
    const result = await api.businesses.refreshBusinessStripeLink(businessId);
    if (result.accountLink) window.location.href = result.accountLink;
  };

  const handleConnect = async () => {
    setError('');
    try {
      try {
        await api.businesses.connectBusinessStripe(businessId);
      } catch (err) {
        // An account that already exists goes on to its setup link.
        if ((err as { statusCode?: number } | null)?.statusCode !== 400) throw err;
      }
      await openOnboarding();
    } catch (err) {
      setError(errorMessage(err, "Couldn't start Stripe setup. Please try again."));
    }
  };

  const handleContinue = async () => {
    setError('');
    try {
      await openOnboarding();
    } catch (err) {
      setError(errorMessage(err, "Couldn't open Stripe setup. Please try again."));
    }
  };

  const handleDashboard = async () => {
    setError('');
    try {
      const result = await api.businesses.getBusinessStripeDashboardLink(businessId);
      if (result.dashboardUrl) {
        window.open(result.dashboardUrl, '_blank');
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't open the Stripe dashboard. Please try again."));
    }
  };

  if (loading) {
    return <div className="text-center py-10 text-app-secondary">Loading payment settings...</div>;
  }

  const isOnboarded = stripeAccount?.payouts_enabled && stripeAccount?.charges_enabled;
  const hasAccount = !!stripeAccount;
  const needsInfo = hasAccount && !stripeAccount.details_submitted;

  return (
    <div className="space-y-6">
      {/* Payout Account */}
      <div className="bg-surface rounded-xl border border-app p-6">
        <h3 className="text-lg font-semibold text-app mb-1">Business Payout Account</h3>
        <p className="text-sm text-app-secondary mb-4">
          Where this business&apos;s invoice payments go
        </p>

        {error ? (
          <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {isOnboarded ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-green-800">Stripe account connected</p>
                <p className="text-sm text-green-600">
                  Invoice payments go to this account. Its balance and payouts are in Stripe.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-surface-raised rounded-lg">
                <p className="text-xs text-app-secondary uppercase tracking-wider">Card Payments</p>
                <p className="mt-1 font-medium text-app">
                  {stripeAccount.charges_enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className="p-4 bg-surface-raised rounded-lg">
                <p className="text-xs text-app-secondary uppercase tracking-wider">Payouts</p>
                <p className="mt-1 font-medium text-app">
                  {stripeAccount.payouts_enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>

            <button
              onClick={handleDashboard}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-app-strong rounded-lg text-sm font-medium text-app-strong hover:bg-surface-raised transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Stripe Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${
              !hasAccount
                ? 'bg-amber-50 border-amber-200'
                : needsInfo
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-blue-50 border-blue-200'
            }`}>
              <p className={`font-medium ${
                !hasAccount ? 'text-amber-800' : needsInfo ? 'text-orange-800' : 'text-blue-800'
              }`}>
                {!hasAccount
                  ? 'No payout account yet'
                  : needsInfo
                    ? 'Account setup incomplete'
                    : 'Account verification in progress'}
              </p>
              <p className={`text-sm mt-1 ${
                !hasAccount ? 'text-amber-600' : needsInfo ? 'text-orange-600' : 'text-blue-600'
              }`}>
                {!hasAccount
                  ? "Until you set one up, invoice payments go to your personal wallet. Stripe asks for the business's details: its EIN, or your SSN as a sole proprietor."
                  : needsInfo
                    ? 'Stripe needs more information before it can pay this business.'
                    : 'Stripe is verifying the business. This usually takes 1-2 business days.'}
              </p>
            </div>

            {!hasAccount ? (
              <button
                onClick={handleConnect}
                className="w-full px-4 py-3 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition"
              >
                Set up payouts
              </button>
            ) : needsInfo ? (
              <button
                onClick={handleContinue}
                className="w-full px-4 py-3 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition"
              >
                Continue Setup
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-blue-600 justify-center py-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verification pending...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> Only the business&apos;s primary owner can set this up. The account signs in to Stripe
          with the owner&apos;s email.
        </p>
      </div>
    </div>
  );
}
