'use client';

import { useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import type { Payment } from '@pantopus/types';
import {
  centsInput, isPending, money, readAttempt, receiptText, recoveryKey, saveAttempt, sameTerms,
  validRequest, validSummary,
  type RefundAttempt, type RefundRequest, type RefundSummary,
} from './refundRecovery';

interface Props {
  actorId: string;
  payment: Payment;
  onPaymentChanged?: (payment: RefundSummary) => void;
}

export default function GigPaymentRefundPanel(props: Props) {
  return <ScopedRefundPanel key={`${props.actorId}:${props.payment.id}`} {...props} />;
}

function ScopedRefundPanel({ actorId, payment, onPaymentChanged }: Props) {
  const initialApi = useRef(api.getApiBaseUrl());
  const key = recoveryKey(actorId, payment.id, initialApi.current);
  const [summary, setSummary] = useState<RefundSummary>(payment);
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [attempt, setAttempt] = useState<RefundAttempt | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [invalidated, setInvalidated] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<RefundAttempt['reason']>('requested_by_customer');
  const mounted = useRef(false);
  const working = useRef(false);
  const sessionChanged = useRef(false);
  const currentAttempt = useRef<RefundAttempt | null>(null);
  const onChanged = useRef(onPaymentChanged);
  onChanged.current = onPaymentChanged;

  function validScope(): boolean {
    if (!mounted.current) return false;
    if (sessionChanged.current || api.getApiBaseUrl() !== initialApi.current) {
      sessionChanged.current = true;
      setInvalidated(true);
      return false;
    }
    return true;
  }

  function remember(next: RefundAttempt | null) {
    currentAttempt.current = next;
    setAttempt(next);
  }

  async function loadHistory() {
    if (working.current || !validScope()) return;
    working.current = true;
    setBusy(true);
    setReady(false);
    setError('');
    try {
      const stored = currentAttempt.current ?? readAttempt(key);
      if (mounted.current) remember(stored);
      const result = await api.payments.getPaymentRefunds(payment.id);
      if (!validScope()) return;
      if (!validSummary(result.payment, payment.id, payment.amount_total)
        || !Array.isArray(result.requests)
        || !result.requests.every((r) => validRequest(r, payment.id, payment.amount_total))) {
        throw new Error('Refund recovery could not be verified.');
      }
      const pending = result.requests.filter(isPending);
      if (pending.length > 1) throw new Error('Refund recovery needs support.');
      const exact = stored && result.requests.find((r) => r.requestId === stored.requestId);
      if (stored && exact && !sameTerms(stored, exact)) {
        throw new Error('Saved refund terms do not match the server request.');
      }
      if (exact && !isPending(exact)) {
        localStorage.removeItem(key);
        remember(pending[0] ?? null);
      } else {
        // An empty read never discards a locally sent, uncertain operation.
        remember(exact || stored || pending[0] || null);
      }
      setRequests(result.requests);
      setSummary(result.payment);
      setReady(true);
    } catch {
      if (mounted.current) setError('Could not confirm refund status. Check again before starting another request.');
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    const invalidate = () => { sessionChanged.current = true; setInvalidated(true); };
    const unsubscribe = api.onTokenChange(invalidate);
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) invalidate();
    };
    window.addEventListener('storage', storageChanged);
    void loadHistory();
    return () => {
      mounted.current = false;
      unsubscribe();
      window.removeEventListener('storage', storageChanged);
    };
    // The wrapper remounts for each actor/payment; no request crosses that scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = summary.amount_total - (summary.refunded_amount || 0);
  const releasing = summary.payment_status === 'authorized' && !summary.captured_at;
  const mayRequest = ['authorized', 'captured_hold', 'transfer_scheduled', 'refunded_partial'].includes(summary.payment_status)
    && remaining > 0 && summary.currency.toLowerCase() === 'usd';
  const activeReceipt = attempt && requests.find((r) => r.requestId === attempt.requestId);

  async function submit(existing?: RefundAttempt) {
    if (working.current || !ready || !validScope()) return;
    let next = existing;
    if (!next) {
      if (currentAttempt.current || !mayRequest) return;
      const requested = releasing || !amount.trim() ? null : centsInput(amount);
      if (requested !== null && (requested < 50 || requested > remaining)) {
        setError(`Enter an amount from $0.50 to ${money(remaining)}.`);
        return;
      }
      if (!releasing && amount.trim() && requested === null) {
        setError('Enter a dollar amount with at most two decimal places.');
        return;
      }
      if (typeof crypto.randomUUID !== 'function') {
        setError('A secure connection is required to request a refund.');
        return;
      }
      next = { requestId: crypto.randomUUID(), requestedAmountCents: requested, reason, description: null };
    }
    try { saveAttempt(key, next); } catch {
      setError('Allow local storage before submitting so this request can recover after an interruption.');
      return;
    }
    working.current = true;
    setBusy(true);
    setError('');
    remember(next);
    setEditing(false);
    try {
      const result = await api.payments.refundPayment(payment.id, next.reason, next.requestedAmountCents ?? undefined, {
        requestId: next.requestId, ...(next.description ? { description: next.description } : {}),
      });
      if (!validScope()) return;
      if (!validRequest(result.refundRequest, payment.id, payment.amount_total)
        || result.refundRequest.requestId !== next.requestId
        || !sameTerms(result.refundRequest, next)
        || !validSummary(result.payment, payment.id, payment.amount_total)) {
        throw new Error('Unverified refund result.');
      }
      const receipt = result.refundRequest;
      setRequests((rows) => [receipt, ...rows.filter((r) => r.requestId !== receipt.requestId)]);
      setSummary(result.payment);
      if (!isPending(receipt)) {
        localStorage.removeItem(key);
        remember(null);
      } else remember(receipt);
      onChanged.current?.(result.payment);
    } catch (err: unknown) {
      if (!validScope()) return;
      const result = err as { data?: { refundRequest?: unknown; code?: string }; statusCode?: number };
      const receipt = result.data?.refundRequest;
      if (validRequest(receipt, payment.id, payment.amount_total)) {
        if (receipt.requestId === next.requestId && sameTerms(receipt, next)) {
          setRequests((rows) => [receipt, ...rows.filter((r) => r.requestId !== receipt.requestId)]);
          remember(receipt);
        } else if (receipt.requestId !== next.requestId && result.statusCode === 409 && result.data?.code === 'REFUND_ACTIVE') {
          // The protected reservation explicitly rejected this new operation
          // in favor of the current one. Recover that existing request.
          try { localStorage.removeItem(key); } catch {
            setReady(false);
            setError('Could not update saved recovery details. Check status before continuing.');
            return;
          }
          remember(receipt);
        }
      }
      setReady(false);
      setError('The result is not confirmed. Check status to recover this request.');
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (invalidated) return <p role="alert" className="text-sm">Your session or connection changed. Reopen this payment to continue safely.</p>;
  if (ready && !requests.length && !attempt && !mayRequest) return null;

  return (
    <section className="rounded-xl border border-app-border bg-app-surface p-4 space-y-3" aria-label="Refunds and hold releases">
      <h4 className="font-semibold text-app-text">Refunds and hold releases</h4>
      {requests.map((r) => <p key={r.requestId} className="text-sm text-app-text-secondary">{receiptText(r)}</p>)}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {attempt && !activeReceipt && <p className="text-sm">This request has not been confirmed yet.</p>}
      {(!ready || attempt || requests.length > 0) && <button type="button" onClick={() => void loadHistory()} disabled={busy}
        className="text-sm font-medium text-app-primary disabled:opacity-50">{busy ? 'Checking…' : 'Check status'}</button>}
      {ready && attempt && (!activeReceipt || (isPending(activeReceipt) && activeReceipt.canRetry)) && (
        <button type="button" onClick={() => void submit(attempt)} disabled={busy}
          className="block text-sm font-medium text-app-primary disabled:opacity-50">Retry this request</button>
      )}
      {ready && !attempt && mayRequest && !editing && <button type="button" disabled={busy} onClick={() => setEditing(true)}
        className="text-sm font-medium text-app-primary">{releasing ? 'Release authorization hold' : 'Request a refund'}</button>}
      {ready && !attempt && editing && mayRequest && (
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <p className="text-sm">{releasing
            ? `Release the ${money(remaining)} hold. No captured charge will be refunded. This does not cancel the task.`
            : `Up to ${money(remaining)} is available to request. This does not cancel the task.`}</p>
          {!releasing && <label className="block text-sm">Amount (USD; leave blank for the remaining amount)
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" disabled={busy}
              className="mt-1 block w-full rounded-lg border border-app-border bg-app-surface p-2" />
          </label>}
          <label className="block text-sm">Reason
            <select value={reason} onChange={(e) => setReason(e.target.value as RefundAttempt['reason'])} disabled={busy}
              className="mt-1 block w-full rounded-lg border border-app-border bg-app-surface p-2">
              <option value="requested_by_customer">Requested by me</option>
              <option value="duplicate">Duplicate payment</option>
              <option value="work_not_completed">Work not completed</option>
              <option value="other">Other</option>
            </select>
          </label>
          <button type="submit" disabled={busy} className="rounded-lg bg-app-primary px-3 py-2 text-white disabled:opacity-50">
            {releasing ? 'Confirm hold release' : 'Confirm refund request'}
          </button>
          <button type="button" disabled={busy} onClick={() => setEditing(false)} className="ml-3 text-sm">Cancel</button>
        </form>
      )}
    </section>
  );
}
