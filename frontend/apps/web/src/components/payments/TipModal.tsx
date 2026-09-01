'use client';

import { useState, useCallback } from 'react';
import { payments } from '@pantopus/api';
const { createTip } = payments;

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
    if (!isValid) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await createTip(gigId, tipAmount, paymentMethodId);

      if (result.success || result.clientSecret) {
        // For off-session tips, the payment completes automatically.
        // For on-session, the clientSecret would need Stripe.js confirmation.
        // For MVP, we handle off-session (saved card) tips.
        onSuccess(tipAmount);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process tip.';
      setError(message);
    } finally {
      setProcessing(false);
    }
  }, [gigId, tipAmount, paymentMethodId, isValid, onSuccess]);

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
              disabled={!isValid || processing}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </span>
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
