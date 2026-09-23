'use client';

import { useState, useEffect, useRef } from 'react';
import { AUTH_SESSION_CHANGE_KEY, getApiBaseUrl, getAuthToken, onTokenChange, payments } from '@pantopus/api';
import type { GigTipTerms, GigTipPreview, GigTipRequest, GigTipProgress, GigTipCheckout } from '@pantopus/api';
import { ProtectedRecoverySlot, type ProtectedRecoverySnapshot } from '../home/tasks/TaskRecoveryStorage';
import StripeProvider from './StripeProvider';
import GigPaymentSetup from './GigPaymentSetup';

function sessionMarker() {
  try { return localStorage.getItem(AUTH_SESSION_CHANGE_KEY); } catch { return undefined; }
}

const PRESET_TIPS = [
  { label: '$5', amount: 500 },
  { label: '$10', amount: 1000 },
  { label: '$20', amount: 2000 },
];


const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const tipId = (v: unknown): v is string => typeof v === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const providerId = (v: unknown, prefix: string) => typeof v === 'string' && new RegExp(`^${prefix}_[a-zA-Z0-9]+$`).test(v);
const optionalId = (v: unknown) => v === null || tipId(v);
const termsKeys: (keyof GigTipTerms)[] = ['gigId', 'payerId', 'payeeId', 'ownerConfirmedAt'];
const originalKeys: (keyof GigTipRequest)[] = ['requestId', 'paymentId', 'gigId', 'payerId', 'payeeId', 'amountCents', 'currency', 'terms', 'paymentMethodId'];
const terminal = (status: string) => status === 'succeeded' || status === 'canceled';
function validTerms(v: unknown, gigId: string, actorId: string, ready = false): v is GigTipTerms {
  return object(v) && Object.keys(v).length === 4 && v.gigId === gigId && tipId(gigId) && v.payerId === actorId && tipId(actorId)
    && (tipId(v.payeeId) || !ready && v.payeeId === null)
    && (typeof v.ownerConfirmedAt === 'string' && Number.isFinite(Date.parse(v.ownerConfirmedAt)) || !ready && v.ownerConfirmedAt === null);
}
function validOriginal(v: unknown, gigId: string, actorId: string): v is GigTipRequest {
  const legacy = object(v) && v.source === 'legacy';
  return object(v) && (v.source === undefined || legacy)
    && Object.keys(v).length === originalKeys.length + (legacy ? 1 : 0) && tipId(v.requestId) && v.paymentId === v.requestId
    && v.gigId === gigId && v.payerId === actorId && tipId(v.payeeId) && v.payeeId !== actorId && v.currency === 'usd'
    && typeof v.amountCents === 'number' && Number.isSafeInteger(v.amountCents) && v.amountCents >= 50 && v.amountCents <= 99999999
    && validTerms(v.terms, gigId, actorId, !legacy) && v.terms.payeeId === v.payeeId
    && (!legacy || v.terms.ownerConfirmedAt === null && v.paymentMethodId === null)
    && (v.paymentMethodId === null || providerId(v.paymentMethodId, 'pm'));
}
const sameTerms = (a: GigTipTerms, b: GigTipTerms) => termsKeys.every(key => a[key] === b[key]);
const sameOriginal = (a: GigTipRequest, b: GigTipRequest) => a.source === b.source
  && originalKeys.every(key => key === 'terms' ? sameTerms(a.terms, b.terms) : a[key] === b[key]);
function originalOnly(value: GigTipRequest): GigTipRequest {
  return { requestId: value.requestId, paymentId: value.paymentId, gigId: value.gigId, payerId: value.payerId,
    ...(value.source === 'legacy' ? { source: 'legacy' as const } : {}),
    payeeId: value.payeeId, amountCents: value.amountCents, currency: 'usd', paymentMethodId: value.paymentMethodId,
    terms: { gigId: value.terms.gigId, payerId: value.terms.payerId, payeeId: value.terms.payeeId, ownerConfirmedAt: value.terms.ownerConfirmedAt } };
}
export function tipRecoverySlot(origin: string, actorId: string, gigId: string) {
  return new ProtectedRecoverySlot<GigTipRequest>(['gig-tip-original-v1', origin, actorId, gigId], value => validOriginal(value, gigId, actorId));
}
function verifyScope(value: { actorId: string; sessionScope: string }, actorId: string, session: string | null) {
  if (value.actorId !== actorId || typeof value.sessionScope !== 'string' || !/^[a-f0-9]{64}$/.test(value.sessionScope)
    || session !== null && value.sessionScope !== session) throw new Error('Your session changed. Close and reopen the original tip.');
}
export function verifyTipPreview(value: GigTipPreview, gigId: string, actorId: string, session: string | null) {
  if (!value || !validTerms(value.terms, gigId, actorId, value.eligible) || typeof value.eligible !== 'boolean'
    || !optionalId(value.activeRequestId) || !optionalId(value.legacyPaymentId) || value.activeRequestId && value.legacyPaymentId
    || !(value.unavailableReason === null || typeof value.unavailableReason === 'string')
    || value.minimumAmountCents !== 50 || value.maximumAmountCents !== 99999999
    || !Number.isInteger(value.remainingTipSlots) || value.remainingTipSlots < 0 || value.remainingTipSlots > 3
    || value.eligible && (value.activeRequestId !== null || value.legacyPaymentId !== null || value.remainingTipSlots === 0 || value.unavailableReason !== null)) {
    throw new Error('The tip details could not be verified. Reopen the task before continuing.');
  }
  verifyScope(value, actorId, session); return value;
}
export function verifyTipProgress(value: GigTipProgress, gigId: string, actorId: string, requestId: string,
  session: string | null, expected?: GigTipRequest) {
  if (!value || !validOriginal(value.request, gigId, actorId) || value.request.requestId !== requestId
    || expected && !sameOriginal(value.request, expected) || !['pending', 'requires_action', 'needs_review', 'succeeded', 'canceled'].includes(value.status)
    || typeof value.paymentStatus !== 'string' || typeof value.canRetry !== 'boolean' || typeof value.canCancel !== 'boolean'
    || value.request.source === 'legacy' && (value.canRetry || value.checkout)
    || !(value.paymentIntentId === null || providerId(value.paymentIntentId, 'pi'))
    || !(value.providerStatus === null || typeof value.providerStatus === 'string')) throw new Error('The original tip result could not be verified. Keep the same request.');
  verifyScope(value, actorId, session);
  if (terminal(value.status)) {
    const receipt = value.receipt, original = value.request;
    if (!receipt || value.canRetry || value.canCancel || value.checkout
      || receipt.requestId !== requestId || receipt.paymentId !== original.paymentId || receipt.gigId !== gigId
      || receipt.payerId !== actorId || receipt.payeeId !== original.payeeId || receipt.amountCents !== original.amountCents
      || receipt.currency !== 'usd' || receipt.status !== value.status || receipt.paymentIntentId !== value.paymentIntentId
      || !(receipt.chargeId === null || providerId(receipt.chargeId, 'ch'))
      || receipt.amountChargedCents !== (value.status === 'succeeded' ? original.amountCents : 0)
      || value.status === 'succeeded' && (!providerId(receipt.paymentIntentId, 'pi') || !providerId(receipt.chargeId, 'ch')
        || !['captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred', 'refund_pending', 'refunded_partial', 'refunded_full', 'disputed'].includes(value.paymentStatus))
      || value.status === 'canceled' && value.paymentStatus !== 'canceled') throw new Error('The tip receipt is inconsistent. Check its original status.');
  } else if (value.receipt !== null) throw new Error('The tip receipt is not confirmed. Keep the original request.');
  if (value.checkout) {
    const checkout = value.checkout;
    if (!['pending', 'requires_action'].includes(value.status)
      || !['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(value.providerStatus || '')
      || checkout.paymentIntentId !== value.paymentIntentId || !providerId(checkout.paymentIntentId, 'pi')
      || typeof checkout.clientSecret !== 'string' || !checkout.clientSecret.startsWith(`${checkout.paymentIntentId}_secret_`)
      || !providerId(checkout.customer, 'cus') || !(checkout.ephemeralKey === null || typeof checkout.ephemeralKey === 'string')
      || !(checkout.publishableKey === null || typeof checkout.publishableKey === 'string')) throw new Error('Checkout does not match the original tip. Check its status.');
  }
  return value;
}

interface TipModalProps {
  actorId: string;
  workerId: string | null;
  recoveryRequestId?: string;
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
export default function TipModal({ actorId, workerId, recoveryRequestId, gigId, workerName, onSuccess, onClose, paymentMethodId }: TipModalProps) {
  type Saved = ProtectedRecoverySnapshot<GigTipRequest>;
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GigTipPreview | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [progress, setProgress] = useState<GigTipProgress | null>(null);
  const [checkout, setCheckout] = useState<GigTipCheckout | null>(null);
  const [conflict, setConflict] = useState<GigTipProgress | null>(null);
  const [mayResume, setMayResume] = useState(false);
  const opening = useRef({ actorId, gigId, workerId, token: getAuthToken(), origin: getApiBaseUrl(), marker: sessionMarker(), recoveryRequestId });
  const latest = useRef({ actorId, gigId, workerId }); latest.current = { actorId, gigId, workerId };
  const mounted = useRef(false), invalidated = useRef(false), confirmed = useRef(false);
  const sequence = useRef(0), working = useRef<number | null>(null), savedRef = useRef<Saved | null>(null);
  const serverSession = useRef<string | null>(null);
  const slot = useRef(tipRecoverySlot(opening.current.origin, actorId, gigId));
  const onDone = useRef(onSuccess), onDismiss = useRef(onClose); onDone.current = onSuccess; onDismiss.current = onClose;
  const current = () => mounted.current && !invalidated.current && opening.current.token !== null
    && getAuthToken() === opening.current.token && getApiBaseUrl() === opening.current.origin && sessionMarker() === opening.current.marker
    && latest.current.actorId === opening.current.actorId && latest.current.gigId === opening.current.gigId && latest.current.workerId === opening.current.workerId;
  const retired = invalidated.current || actorId !== opening.current.actorId || gigId !== opening.current.gigId || workerId !== opening.current.workerId;
  const tipAmount = saved?.value.amountCents ?? selectedPreset ?? (customAmount ? Math.round(parseFloat(customAmount) * 100) : 0);
  const isValid = Number.isSafeInteger(tipAmount) && tipAmount >= 50 && tipAmount <= 99999999;
  const attempted = saved !== null;
  const createdTip = saved ? { paymentId: saved.value.paymentId, amount: saved.value.amountCents } : null;
  const complete = progress !== null && terminal(progress.status);
  const pendingWorkerName = saved && saved.value.payeeId !== workerId ? 'the original worker' : workerName;

  function close() { invalidated.current = true; sequence.current++; onDismiss.current(); }
  function remember(value: Saved) {
    savedRef.current = value; setSaved(value);
    if (PRESET_TIPS.some(tip => tip.amount === value.value.amountCents)) { setSelectedPreset(value.value.amountCents); setCustomAmount(''); }
    else { setSelectedPreset(null); setCustomAmount((value.value.amountCents / 100).toFixed(2)); }
  }
  function begin() {
    if (!current()) {
      if (mounted.current) { invalidated.current = true; setCheckout(null); setError('Your session or task changed. Close and reopen the original tip.'); }
      return null;
    }
    if (working.current !== null || confirmed.current) return null;
    const ticket = ++sequence.current; working.current = ticket; setProcessing(true); setError(null);
    return { valid: () => current() && sequence.current === ticket,
      finish: () => { if (working.current === ticket) { working.current = null; if (mounted.current) setProcessing(false); } } };
  }
  async function accept(value: GigTipProgress, original: Saved, valid: () => boolean, exposeCheckout = false) {
    const verified = verifyTipProgress(value, gigId, actorId, original.value.requestId, serverSession.current, original.value);
    serverSession.current = verified.sessionScope;
    const retained = await slot.current.load();
    if (!valid()) return null;
    if (!retained || retained.revision !== original.revision || !sameOriginal(retained.value, original.value)) {
      throw new Error('Another tab changed the saved tip. Reopen its status before continuing.');
    }
    if (terminal(verified.status)) {
      await slot.current.clear(original, valid);
      if (!valid()) return null;
      setProgress(verified); setCheckout(null); setMayResume(false); confirmed.current = true;
      if (verified.status === 'canceled') close();
      else if (['refund_pending', 'refunded_partial', 'refunded_full', 'disputed'].includes(verified.paymentStatus)) {
        setError('This tip already has a payment record. Check payment history for its current refund or dispute status.');
      } else { sequence.current++; onDone.current(original.value.amountCents); }
      return verified;
    }
    setProgress(verified); setMayResume(verified.canRetry && verified.paymentIntentId === null);
    if (exposeCheckout) setCheckout(verified.checkout || null);
    setError(verified.request.source === 'legacy' ? 'This earlier tip keeps its original amount and worker. Check its status or cancel it before sending another.'
      : verified.status === 'needs_review' ? 'This original tip needs review. Check payment history before continuing.'
      : verified.checkout && exposeCheckout ? null : 'This tip is not confirmed as paid. Continue or check the same tip before sending another.');
    return verified;
  }
  async function initialize(valid: () => boolean) {
    let original = await slot.current.load();
    if (!valid()) return;
    if (original) {
      remember(original);
      try {
        const value = await payments.getTipRequest(original.value.requestId);
        if (valid()) await accept(value, original, valid);
        return;
      } catch (cause) { if ((cause as { statusCode?: number }).statusCode !== 404) throw cause; }
    } else if (opening.current.recoveryRequestId) {
      const value = await payments.getTipRequest(opening.current.recoveryRequestId);
      if (!valid()) return;
      verifyTipProgress(value, gigId, actorId, opening.current.recoveryRequestId, serverSession.current);
      serverSession.current = value.sessionScope;
      original = await slot.current.retain(originalOnly(value.request), valid);
      if (!valid()) return; remember(original); await accept(value, original, valid); return;
    }
    const next = await payments.getTipPreview(gigId);
    if (!valid()) return;
    verifyTipPreview(next, gigId, actorId, serverSession.current); serverSession.current = next.sessionScope; setPreview(next);
    if (original) {
      setMayResume(original.value.source !== 'legacy' && next.eligible && sameTerms(original.value.terms, next.terms));
      setError('The original request is not yet confirmed. Keep its amount and request when retrying.'); return;
    }
    const existingId = next.activeRequestId || next.legacyPaymentId;
    if (existingId) {
      const value = await payments.getTipRequest(existingId);
      if (!valid()) return;
      verifyTipProgress(value, gigId, actorId, existingId, serverSession.current);
      if (next.legacyPaymentId && value.request.source !== 'legacy') throw new Error('The earlier tip identity could not be verified.');
      original = await slot.current.retain(originalOnly(value.request), valid);
      if (!valid()) return; remember(original); await accept(value, original, valid);
    } else if (next.unavailableReason === 'TIP_LIMIT') setError("You've reached the 3-tip limit for this task.");
    else if (!next.eligible || next.terms.payeeId !== workerId) setError('The current task is not available for this tip. Reopen its details before continuing.');
  }

  useEffect(() => {
    mounted.current = true;
    const retire = () => { invalidated.current = true; sequence.current++; setCheckout(null); setProcessing(false);
      setError('Your session or task changed. Close and reopen the original tip before continuing.'); };
    if (!current()) retire();
    else {
      const work = begin();
      if (work) void initialize(work.valid).catch(cause => { if (work.valid()) setError(cause instanceof Error ? cause.message : 'Tip recovery is unavailable. Reopen this screen.'); }).finally(work.finish);
    }
    const unsubscribe = onTokenChange(retire);
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === AUTH_SESSION_CHANGE_KEY) retire(); };
    window.addEventListener('storage', changed);
    return () => { mounted.current = false; sequence.current++; working.current = null; unsubscribe(); window.removeEventListener('storage', changed); };
    // One opening owns the scope and callbacks; changed props retire it above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, gigId, workerId]);

  async function perform(mode: 'resume' | 'check' | 'cancel', exposeCheckout = true) {
    const work = begin(); if (!work) return null;
    let original = savedRef.current;
    try {
      if (!serverSession.current) throw new Error('Reopen the tip details to verify your current session.');
      if (!original) {
        if (mode !== 'resume' || !preview?.eligible || !isValid || !workerId || preview.terms.payeeId !== workerId) return null;
        const requestId = crypto.randomUUID();
        const value: GigTipRequest = { requestId, paymentId: requestId, gigId, payerId: actorId, payeeId: workerId,
          amountCents: tipAmount, currency: 'usd', terms: preview.terms, paymentMethodId: paymentMethodId || null };
        original = await slot.current.retain(originalOnly(value), work.valid);
        if (!work.valid()) return null; remember(original);
      } else {
        const retained = await slot.current.load();
        if (!work.valid()) return null;
        if (!retained || retained.revision !== original.revision || !sameOriginal(retained.value, original.value)) {
          throw new Error('The saved tip changed. Reopen it before continuing.');
        }
      }
      const value = original.value;
      if (value.source === 'legacy' && mode === 'resume') throw new Error('This earlier tip can only be checked or canceled.');
      const result = await payments.createTip({ requestId: value.requestId, gigId: value.gigId, amount: value.amountCents,
        paymentMethodId: value.paymentMethodId, expectedActorId: actorId, expectedSessionScope: serverSession.current,
        expectedTerms: value.terms, mode });
      if (!work.valid()) return null;
      return await accept(result, original, work.valid, exposeCheckout);
    } catch (cause) {
      if (!work.valid()) return null;
      const failure = cause as { statusCode?: number; data?: { code?: string; activeRequestId?: string } };
      if (original && failure.statusCode === 409 && failure.data?.code === 'TIP_ACTIVE'
        && tipId(failure.data.activeRequestId) && failure.data.activeRequestId !== original.value.requestId) {
        try {
          const other = await payments.getTipRequest(failure.data.activeRequestId);
          if (!work.valid()) return null;
          verifyTipProgress(other, gigId, actorId, failure.data.activeRequestId, serverSession.current);
          setConflict(other); setError('Another original tip is already pending. View its status before continuing.'); return null;
        } catch { /* Preserve the old original if the other receipt cannot be verified. */ }
      }
      if (work.valid()) {
        if (original && original.value.source !== 'legacy' && mode === 'resume') setMayResume(true);
        setError(cause instanceof Error ? cause.message : 'The tip result is unknown. Keep and check the same request.');
      }
      return null;
    } finally { work.finish(); }
  }
  async function adoptConflict() {
    const work = begin(), original = savedRef.current; if (!work || !original || !conflict) { work?.finish(); return; }
    try {
      const result = await payments.getTipRequest(conflict.request.requestId);
      if (!work.valid()) return;
      verifyTipProgress(result, gigId, actorId, conflict.request.requestId, serverSession.current, conflict.request);
      const adopted = await slot.current.retain(originalOnly(result.request), work.valid, original);
      if (!work.valid()) return; remember(adopted); setConflict(null); await accept(result, adopted, work.valid);
    } catch (cause) { if (work.valid()) setError(cause instanceof Error ? cause.message : 'The other original could not be recovered.'); }
    finally { work.finish(); }
  }
  const handlePresetClick = (amount: number) => { if (!savedRef.current) { setSelectedPreset(amount); setCustomAmount(''); } };
  const handleCustomChange = (value: string) => { if (!savedRef.current && (value === '' || /^\d*\.?\d{0,2}$/.test(value))) { setCustomAmount(value); setSelectedPreset(null); } };
  const handleSubmit = () => conflict ? adoptConflict() : perform(savedRef.current && !mayResume ? 'check' : 'resume');
  const handleCancel = () => retired || complete || !savedRef.current || progress?.canCancel === false ? close() : void perform('cancel', false);
  const actionLabel = complete ? 'Tip recorded' : conflict ? 'View pending tip' : saved ? mayResume ? 'Retry same tip' : 'Check tip status'
    : isValid ? `Tip $${(tipAmount / 100).toFixed(2)}` : 'Enter amount';

  if (checkout && saved && !retired) {
    const shown = checkout, original = saved.value;
    return <StripeProvider clientSecret={shown.clientSecret}>
      <GigPaymentSetup clientSecret={shown.clientSecret} isSetupIntent={false} intentPurpose="tip" tipRequestId={original.requestId}
        gigId={gigId} amount={original.amountCents} isCurrent={current}
        beforeConfirm={async () => {
          const result = await perform('check', false);
          const matching = current() && result?.checkout?.paymentIntentId === shown.paymentIntentId
            && result.checkout.customer === shown.customer && result.checkout.clientSecret === shown.clientSecret;
          if (!matching && current()) { setCheckout(null); setError('The tip changed or is not ready. Check its original status before confirming.'); }
          return !!matching;
        }}
        onSuccess={async () => { if (current()) { setCheckout(null); await perform('check', false); } }}
        onError={() => { if (current()) setError('The tip is not confirmed. Check the original before trying again.'); }}
        onClose={() => { if (current()) { setCheckout(null); setError('The tip is not confirmed as paid. Check or cancel the same tip before another.'); } }} />
    </StripeProvider>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-app-surface rounded-2xl shadow-xl max-w-sm w-full">
        {/* Header */}
        <div className="p-6 text-center border-b border-app-border-subtle">
          <div className="text-3xl mb-2">🎉</div>
          <h2 className="text-lg font-semibold text-app-text">
            Leave a tip for {pendingWorkerName}?
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
                disabled={attempted || processing}
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
                disabled={attempted || processing}
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
              onClick={handleCancel}
              disabled={processing}
              className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-app-text-strong font-medium hover:bg-app-hover transition disabled:opacity-50"
            >
              {attempted ? complete || progress?.canCancel === false ? 'Close' : 'Cancel tip' : 'Skip'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={retired || processing || complete || !serverSession.current || (!saved && (!isValid || !preview?.eligible || preview.terms.payeeId !== workerId))}
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
              ) : actionLabel}

            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
