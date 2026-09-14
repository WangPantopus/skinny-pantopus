'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AUTH_SESSION_CHANGE_KEY, getApiBaseUrl, getAuthToken, onTokenChange, payments } from '@pantopus/api';
const { createTip, refreshTipPaymentStatus } = payments;

function sessionMarker() {
  try { return localStorage.getItem(AUTH_SESSION_CHANGE_KEY); } catch { return undefined; }
}

const PRESET_TIPS = [
  { label: '$5', amount: 500 },
  { label: '$10', amount: 1000 },
  { label: '$20', amount: 2000 },
];

interface TipModalProps {
  gigId: string;
  workerName: string;
  /** Called on success with the tip amount. */
  onSuccess: (amount: number) => void;
  /** Called to close the modal. */
  onClose: () => void;
  /** Optional: Stripe payment method ID for off-session tips. */
  paymentMethodId?: string;
}

/**
 * Modal for tipping a worker after gig completion.
 * Shows preset amounts + custom input.
 */
export default function TipModal({
  gigId,
  workerName,
  onSuccess,
  onClose,
  paymentMethodId,
}: TipModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTip, setCreatedTip] = useState<{ paymentId: string; amount: number } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const working = useRef(false);
  const confirmed = useRef(false);
  const mounted = useRef(false);
  const openingGig = useRef(gigId);
  const openingSession = useRef({ token: getAuthToken(), origin: getApiBaseUrl(), marker: sessionMarker() });
  const latestGig = useRef(gigId);
  latestGig.current = gigId;
  const invalidated = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const retire = () => {
      invalidated.current = true;
      setError('Your session or task changed. Close and reopen its payment details before continuing.');
    };
    if (gigId !== openingGig.current) {
      retire();
    }
    const unsubscribe = onTokenChange(retire);
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === AUTH_SESSION_CHANGE_KEY) retire();
    };
    window.addEventListener('storage', changed);
    return () => { mounted.current = false; unsubscribe(); window.removeEventListener('storage', changed); };
  }, [gigId]);
  const isCurrent = useCallback(() => mounted.current && !invalidated.current
    && latestGig.current === openingGig.current && openingSession.current.token !== null
    && getAuthToken() === openingSession.current.token && getApiBaseUrl() === openingSession.current.origin
    && sessionMarker() === openingSession.current.marker, []);
  const retired = invalidated.current || gigId !== openingGig.current;

  const tipAmount = selectedPreset ?? (customAmount ? Math.round(parseFloat(customAmount) * 100) : 0);
  const isValid = tipAmount >= 50; // Minimum $0.50

  const handlePresetClick = (amount: number) => {
    setSelectedPreset(amount);
    setCustomAmount('');
  };

  const handleCustomChange = (value: string) => {
    // Allow only valid dollar amounts
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setCustomAmount(value);
      setSelectedPreset(null);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!isCurrent()) {
      invalidated.current = true;
      setError('Your session or task changed. Close and reopen its payment details before continuing.');
      return;
    }
    if (!isValid || working.current || confirmed.current || (attempted && !createdTip)) return;

    working.current = true;
    setProcessing(true);
    setError(null);

    try {
      let tip = createdTip;
      if (!tip) {
        setAttempted(true);
        const result = await createTip(gigId, tipAmount, paymentMethodId);
        if (!isCurrent()) return;
        if (typeof result.paymentId !== 'string' || !result.paymentId) throw new Error('Missing payment identity');
        tip = { paymentId: result.paymentId, amount: tipAmount };
        setCreatedTip(tip);
      }
      // Creation success and a client secret do not establish payment. Reuse
      // the existing reconciliation endpoint, retaining this payment for checks.
      const status = await refreshTipPaymentStatus(tip.paymentId);
      if (!isCurrent()) return;
      // Already reconciled payments intentionally skip a second provider read
      // and return null provider status. Their recorded paid state still counts.
      if ((status.stripeStatus === 'succeeded' || status.stripeStatus === null)
        && ['captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred'].includes(status.paymentStatus)) {
        confirmed.current = true;
        onSuccess(tip.amount);
      } else {
        setError('This tip has not been confirmed as paid. Check its status before trying another tip.');
      }
    } catch {
      if (isCurrent()) setError('The tip result is not confirmed. Check its status or payment history before trying another tip.');
    } finally {
      working.current = false;
      if (mounted.current) setProcessing(false);
    }
  }, [gigId, tipAmount, paymentMethodId, isValid, onSuccess, attempted, createdTip, isCurrent]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-app-surface rounded-2xl shadow-xl max-w-sm w-full">
        {/* Header */}
        <div className="p-6 text-center border-b border-app-border-subtle">
          <div className="text-3xl mb-2">🎉</div>
          <h2 className="text-lg font-semibold text-app-text">
            Leave a tip for {workerName}?
          </h2>
          <p className="text-sm text-app-text-secondary mt-1">
            Tips go 100% to the worker.
          </p>
        </div>

        {/* Tip options */}
        <div className="p-6 space-y-4">
          {/* Preset amounts */}
          <div className="flex gap-3">
            {PRESET_TIPS.map(({ label, amount }) => (
              <button
                key={amount}
                disabled={attempted}
                onClick={() => handlePresetClick(amount)}
                className={`flex-1 py-3 rounded-xl text-center font-semibold transition ${
                  selectedPreset === amount
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                    : 'bg-app-surface-sunken text-app-text-strong hover:bg-app-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div>
            <label className="block text-sm font-medium text-app-text-secondary mb-1">
              Custom amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted font-medium">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={customAmount}
                disabled={attempted}
                onChange={(e) => handleCustomChange(e.target.value)}
                className={`w-full pl-7 pr-4 py-2.5 border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  customAmount ? 'border-emerald-300' : 'border-app-border'
                }`}
              />
            </div>
            {customAmount && tipAmount < 50 && (
              <p className="text-xs text-red-500 mt-1">Minimum tip is $0.50</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={processing}
              className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-app-text-strong font-medium hover:bg-app-hover transition disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={retired || !isValid || processing || (attempted && !createdTip)}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {createdTip ? 'Checking...' : 'Sending...'}
                </span>
              ) : createdTip ? (
                'Check tip status'
              ) : isValid ? (
                `Tip $${(tipAmount / 100).toFixed(2)}`
              ) : (
                'Enter amount'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
