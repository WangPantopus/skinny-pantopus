'use client';

import { useState, useCallback } from 'react';
import { wallet as walletApi } from '@pantopus/api';
import { getErrorMessage } from '@pantopus/utils';

interface WithdrawModalProps {
  balance: number; // in cents
  onClose: () => void;
  onSuccess: () => void;
}

export default function WithdrawModal({ balance, onClose, onSuccess }: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountCents = Math.round(parseFloat(amount || '0') * 100);
  const isValid = amountCents >= 100 && amountCents <= balance;

  const handleWithdrawAll = () => {
    setAmount((balance / 100).toFixed(2));
    setError(null);
  };

  const handleWithdraw = useCallback(async () => {
    if (!isValid) return;

    setProcessing(true);
    setError(null);

    try {
      const idempotencyKey = crypto.randomUUID();
      await walletApi.withdraw(amountCents, idempotencyKey);
      setSuccess(true);
      setTimeout(() => onSuccess(), 2000);
    } catch (err: unknown) {
      const message = getErrorMessage(err).trim();
      setError(message || 'Withdrawal failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [amountCents, isValid, onSuccess]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-app-surface rounded-2xl max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-app-border-subtle">
          <h2 className="text-lg font-semibold text-app-text">Withdraw Funds</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-app-hover flex items-center justify-center text-app-text-muted hover:text-app-text-secondary transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full mx-auto flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-semibold text-app-text text-lg">Withdrawal Initiated</h3>
              <p className="text-sm text-app-text-secondary mt-2">
                ${(amountCents / 100).toFixed(2)} is on its way to your bank account.
                Expect it within 2-3 business days.
              </p>
            </div>
          ) : (
            <>
              {/* Available balance */}
              <div className="bg-app-surface-raised rounded-lg p-4 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-app-text-secondary">Available balance</span>
                  <span className="text-lg font-bold text-app-text">
                    ${(balance / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Amount input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-app-text-strong mb-2">
                  Withdrawal amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-secondary font-medium">$</span>
                  <input
                    type="number"
                    min="1"
                    max={(balance / 100).toFixed(2)}
                    step="0.01"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setError(null); }}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-app-border rounded-lg text-lg font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-app-text-muted">Min: $1.00</span>
                  <button
                    onClick={handleWithdrawAll}
                    className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
                  >
                    Withdraw all
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                <p className="text-xs text-blue-700">
                  Funds will be sent to your connected Stripe account and then to your bank.
                  Expect arrival within 2-3 business days.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                  {error}
                </div>
              )}

              <button
                onClick={handleWithdraw}
                disabled={!isValid || processing}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  `Withdraw $${amountCents >= 100 ? (amountCents / 100).toFixed(2) : '0.00'}`
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
