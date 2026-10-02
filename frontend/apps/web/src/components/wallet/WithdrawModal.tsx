'use client';

import { useState, useCallback, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { wallet as walletApi, AUTH_SESSION_CHANGE_KEY, getApiBaseUrl, onTokenChange } from '@pantopus/api';
import { getErrorMessage } from '@pantopus/utils';

type PendingWithdrawal = {
  key: string | null;
  amountCents: number;
  marker: string | null;
  origin: string;
  createdAt: number;
};
const PENDING_WITHDRAWAL_KEY = 'pantopus_pending_withdrawal';
// Stripe may prune idempotency keys after 24 hours. Never turn an aged retry into a new transfer.
const MAX_RETRY_AGE = 23 * 60 * 60 * 1000;

function clearPendingWithdrawal(key?: string): void {
  try {
    if (key && JSON.parse(sessionStorage.getItem(PENDING_WITHDRAWAL_KEY) || 'null')?.key !== key) return;
    sessionStorage.removeItem(PENDING_WITHDRAWAL_KEY);
  } catch { /* Storage failure must not change a verified financial result. */ }
}

function readPendingWithdrawal(): PendingWithdrawal | null {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_WITHDRAWAL_KEY) || 'null') as PendingWithdrawal | null;
    if (!pending) return null;
    if (pending.marker !== localStorage.getItem(AUTH_SESSION_CHANGE_KEY) || pending.origin !== getApiBaseUrl()) {
      clearPendingWithdrawal();
      return null;
    }
    if (typeof pending.key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pending.key)
      || !Number.isSafeInteger(pending.amountCents) || pending.amountCents < 100
      || !Number.isFinite(pending.createdAt) || pending.createdAt <= 0 || pending.createdAt > Date.now()) {
      throw new Error('Invalid pending withdrawal');
    }
    return pending;
  } catch { throw new Error('Cannot restore this withdrawal safely in this browser. Please contact support.'); }
}

interface WithdrawModalProps {
  balance: number; // in cents
  onClose: () => void;
  onSuccess: () => void;
  /** The outcome is unknown (no reply, a timeout, a 5xx, a held debit): re-read the balance behind the modal. */
  onUnsettled?: () => void;
}

export default function WithdrawModal({ balance, onClose, onSuccess, onUnsettled }: WithdrawModalProps) {
  const amountInputId = useId();
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<PendingWithdrawal | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);

  useEffect(() => {
    let retired = false;
    const restore = async () => {
      let saved: PendingWithdrawal | null = null;
      let storageError = false;
      try { saved = readPendingWithdrawal(); } catch { storageError = true; }
      try {
        const result = await walletApi.getTransactions({ type: 'withdrawal', unsettledWithdrawal: true, limit: 1 });
        if (retired) return;
        const recovery = result.withdrawalRecovery;
        const pending = recovery ? {
          key: recovery.idempotencyKey, amountCents: recovery.amountCents,
          marker: localStorage.getItem(AUTH_SESSION_CHANGE_KEY), origin: getApiBaseUrl(),
          createdAt: recovery.createdAt ? Date.parse(recovery.createdAt) : 0,
        } : saved;
        if (!pending && storageError) throw new Error('Cannot restore this withdrawal safely in this browser. Please contact support.');
        if (recovery?.retryable && pending?.key) {
          sessionStorage.setItem(PENDING_WITHDRAWAL_KEY, JSON.stringify(pending));
          if (readPendingWithdrawal()?.key !== pending.key) throw new Error('Pending withdrawal was not saved');
        }
        setPendingWithdrawal(pending);
        setPendingCount(result.total);
        setNeedsReview(Boolean(recovery && !recovery.retryable));
        if (pending) setAmount((pending.amountCents / 100).toFixed(2));
        if (recovery && !recovery.retryable) setError('This withdrawal needs support review before it can be retried. Please contact support.');
        setRecoveryReady(true);
      } catch {
        if (!retired) {
          setError('Cannot check for an existing withdrawal safely. Retry the check or contact support.');
          setRecoveryFailed(true);
        }
      }
    };
    void restore();
    const retire = () => { retired = true; clearPendingWithdrawal(); setPendingWithdrawal(null); setRecoveryReady(false); };
    const changed = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_CHANGE_KEY || event.key === null) retire();
    };
    const unsubscribe = onTokenChange(retire);
    window.addEventListener('storage', changed);
    return () => { retired = true; unsubscribe(); window.removeEventListener('storage', changed); };
  }, [readAttempt]);

  const amountCents = Math.round(parseFloat(amount || '0') * 100);
  // A retry of the withdrawal in progress may exceed the refreshed balance: its held debit is that money.
  const isValid = amountCents >= 100 && (pendingWithdrawal ? pendingWithdrawal.amountCents === amountCents : amountCents <= balance);
  const pendingNotice = pendingWithdrawal && pendingWithdrawal.amountCents !== amountCents
    ? `A withdrawal of $${(pendingWithdrawal.amountCents / 100).toFixed(2)} is pending. Retry that amount before starting another withdrawal.`
    : pendingCount > 1 ? `${pendingCount} withdrawals are pending. Resolve this oldest withdrawal before starting another.` : null;

  const handleWithdrawAll = () => {
    setAmount((balance / 100).toFixed(2));
    setError(null);
  };

  const handleWithdraw = useCallback(async () => {
    if (!recoveryReady) {
      if (recoveryFailed) {
        setRecoveryFailed(false);
        setError(null);
        setReadAttempt(attempt => attempt + 1);
      }
      return;
    }
    if (!isValid) return;

    setProcessing(true);
    setError(null);

    let intent: PendingWithdrawal | null = null;
    try {
      if (needsReview) {
        setError('This withdrawal needs support review before it can be retried. Please contact support.');
        return;
      }
      const stored = readPendingWithdrawal();
      intent = stored || pendingWithdrawal;
      if (intent && intent.amountCents !== amountCents) {
        setPendingWithdrawal(intent);
        setError(`A withdrawal of $${(intent.amountCents / 100).toFixed(2)} is pending. Retry that amount before starting another withdrawal.`);
        return;
      }
      if (intent && (!intent.key || Date.now() - intent.createdAt >= MAX_RETRY_AGE)) {
        setError('This withdrawal needs support review before it can be retried. Please contact support.');
        return;
      }
      try {
        intent ??= { key: crypto.randomUUID(), amountCents, marker: localStorage.getItem(AUTH_SESSION_CHANGE_KEY), origin: getApiBaseUrl(), createdAt: Date.now() };
        sessionStorage.setItem(PENDING_WITHDRAWAL_KEY, JSON.stringify(intent));
        if (readPendingWithdrawal()?.key !== intent.key) throw new Error('Pending withdrawal was not saved');
      } catch {
        setError('Cannot save this withdrawal safely in this browser. Enable browser storage and try again.');
        return;
      }
      setPendingWithdrawal(intent);
      if (!intent.key) return;
      await walletApi.withdraw(amountCents, intent.key);
      clearPendingWithdrawal(intent.key);
      setPendingWithdrawal(null);
      setSuccess(true);
      setTimeout(() => onSuccess(), 2000);
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      const terminal = code === 'withdrawal_not_completed' || code === 'withdrawal_key_reused';
      if (terminal && intent?.key) { clearPendingWithdrawal(intent.key); setPendingWithdrawal(null); }
      const message = getErrorMessage(err).trim();
      setError(message || 'Withdrawal failed. Please try again.');
      if (!terminal) onUnsettled?.();
    } finally {
      setProcessing(false);
    }
  }, [amountCents, isValid, pendingWithdrawal, recoveryReady, recoveryFailed, needsReview, onSuccess, onUnsettled]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-app-surface rounded-2xl max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-app-border-subtle">
          <h2 className="text-lg font-semibold text-app-text">Withdraw Funds</h2>
          <button
            type="button"
            aria-label="Close withdrawal dialog"
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
                <label htmlFor={amountInputId} className="block text-sm font-medium text-app-text-strong mb-2">
                  Withdrawal amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-secondary font-medium">$</span>
                  <input
                    id={amountInputId}
                    type="number"
                    min="1"
                    max={(Math.max(balance, pendingWithdrawal?.amountCents === amountCents ? amountCents : 0) / 100).toFixed(2)}
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

              {(error || pendingNotice) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                  {error || pendingNotice}
                </div>
              )}

              <button
                onClick={handleWithdraw}
                aria-busy={(!recoveryReady && !recoveryFailed) || processing}
                disabled={(!recoveryReady && !recoveryFailed) || (recoveryReady && !isValid) || processing}
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
                ) : !recoveryReady ? (recoveryFailed ? 'Retry withdrawal check' : 'Checking withdrawal…') : (
                  `Withdraw $${amountCents >= 100 ? (amountCents / 100).toFixed(2) : '0.00'}`
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
