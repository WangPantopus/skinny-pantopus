'use client';

import { useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import StripeProvider from './StripeProvider';
import GigPaymentSetup from './GigPaymentSetup';
import { termsFor, verifyProgress, type Progress, type Terms } from './assignedAuthorization';

type Props = { gigId: string; actorId: string; payeeId: string | null; onAuthorized?: () => void };

/** Assigned-gig recovery shares one exact payment snapshot across status, SDK
 * confirmation and receipt verification. Only an explicit continue can mutate. */
export default function AssignedGigAuthorization({ gigId, actorId, payeeId, onAuthorized }: Props) {
  const [terms, setTerms] = useState<Terms | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [checkout, setCheckout] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invalidated, setInvalidated] = useState(false);
  const opening = useRef({ token: api.getAuthToken(), origin: api.getApiBaseUrl(), gigId, actorId, payeeId });
  const latest = useRef({ gigId, actorId, payeeId }); latest.current = { gigId, actorId, payeeId };
  const mounted = useRef(false);
  const retired = useRef(false);
  const working = useRef(false);
  const confirmed = useRef(new Set<string>());
  const serverSession = useRef<string | null>(null);
  const onReady = useRef(onAuthorized); onReady.current = onAuthorized;

  function current(): boolean {
    const original = opening.current;
    if (!mounted.current || retired.current) return false;
    if (original.token === null || api.getAuthToken() !== original.token || api.getApiBaseUrl() !== original.origin
      || latest.current.gigId !== original.gigId || latest.current.actorId !== original.actorId
      || latest.current.payeeId !== original.payeeId) {
      retired.current = true;
      return false;
    }
    return true;
  }

  function acceptProgress(next: Progress, snapshot: Terms) {
    if (!current()) return;
    const verified = verifyProgress(next, gigId, actorId, snapshot, serverSession.current);
    serverSession.current = verified.sessionScope;
    setProgress(verified);
    if (verified.authorizationReady && !confirmed.current.has(verified.authorizationAttemptId)) {
      confirmed.current.add(verified.authorizationAttemptId);
      onReady.current?.();
    }
  }

  async function check(snapshot?: Terms, afterSDK?: Progress) {
    if (!current() || working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      let exact = snapshot ?? terms;
      if (!exact) {
        const { payment } = await api.payments.getPaymentForGig(gigId);
        if (!current()) return;
        exact = termsFor(payment, gigId, payeeId);
        setTerms(exact);
      }
      const result = verifyProgress(await api.payments.refreshPaymentStatus(gigId), gigId, actorId, exact, serverSession.current);
      if (!current()) return;
      if (afterSDK && (result.authorizationAttemptId !== afterSDK.authorizationAttemptId
        || result.paymentIntentId !== afterSDK.paymentIntentId)) {
        throw new Error('The payment operation changed. Reopen payment details to check the current authorization.');
      }
      acceptProgress(result, exact);
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : 'Payment status is unconfirmed. Check again before continuing.');
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function resume() {
    if (!current() || !terms || !serverSession.current || !progress?.canRetry || working.current || checkout) return;
    working.current = true; setBusy(true); setError('');
    try {
      const result = verifyProgress(await api.payments.continueAuthorization(gigId, {
        ...terms, expectedActorId: actorId, expectedSessionScope: serverSession.current,
      }), gigId, actorId, terms, serverSession.current);
      if (!current()) return;
      acceptProgress(result, terms);
      if (result.recoveryState === 'action_required') setCheckout(result);
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : 'Authorization is unconfirmed. Check its status before retrying.');
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function prepareSDK(selected: Progress, snapshot: Terms): Promise<boolean> {
    if (!current() || working.current) return false;
    const result = verifyProgress(await api.payments.refreshPaymentStatus(gigId), gigId, actorId, snapshot, serverSession.current);
    if (!current()) return false;
    if (result.authorizationAttemptId !== selected.authorizationAttemptId || result.paymentIntentId !== selected.paymentIntentId) {
      throw new Error('The payment operation changed. Reopen payment details before authorizing.');
    }
    acceptProgress(result, snapshot);
    if (result.recoveryState !== 'action_required') { setCheckout(null); return false; }
    return current();
  }

  useEffect(() => {
    mounted.current = true;
    const invalidate = () => { retired.current = true; setInvalidated(true); setCheckout(null); setTerms(null); setProgress(null); };
    const unsubscribe = api.onTokenChange(invalidate);
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) invalidate();
    };
    window.addEventListener('storage', storageChanged);
    if (current()) void check();
    else invalidate();
    return () => { mounted.current = false; unsubscribe(); window.removeEventListener('storage', storageChanged); };
    // This panel is bound to its opening identities; replacement props cannot rebind a request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (invalidated || !current() && mounted.current) {
    return <p role="status">Your session or assignment changed. Reopen payment details to continue.</p>;
  }

  return (
    <section aria-label="Assigned payment authorization" className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <h4 className="font-semibold text-amber-900">Payment authorization</h4>
      {terms && <p>Task amount: ${(terms.expectedAmountCents / 100).toFixed(2)} USD.</p>}
      <p className="text-sm text-amber-900">
        {progress?.authorizationReady ? 'The payment hold is authorized. The worker can start.'
          : progress?.cancellationPending ? 'The authorization is being canceled. Check its status before continuing.'
          : progress?.authorizationAvailableAt ? `Authorization opens ${new Date(progress.authorizationAvailableAt).toLocaleString()}. No new hold will be created before then.`
          : progress?.recoveryState === 'needs_review' ? progress.canRetry
            ? 'The previous authorization ended. Continue to authorize the same task amount.'
            : 'This payment needs review before another authorization can be started.'
          : progress?.recoveryState === 'pending' ? 'Authorization is pending. Check its status before continuing.'
          : 'Complete the card authorization before the worker starts.'}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || checkout !== null} onClick={() => void check()}
          className="rounded-lg border px-3 py-2 disabled:opacity-50">{busy ? 'Checking…' : 'Check payment status'}</button>
        {terms && progress?.canRetry && !progress.authorizationReady && (
          <button type="button" disabled={busy || checkout !== null} onClick={() => void resume()}
            className="rounded-lg bg-amber-700 text-white px-3 py-2 disabled:opacity-50">Continue authorization</button>
        )}
      </div>
      {checkout?.clientSecret && terms && (
        <StripeProvider clientSecret={checkout.clientSecret}>
          <GigPaymentSetup clientSecret={checkout.clientSecret} isSetupIntent={false} gigId={gigId}
            amount={terms.expectedAmountCents} isCurrent={current}
            beforeConfirm={() => prepareSDK(checkout, terms)}
            onSuccess={async () => {
              if (!current()) return;
              const selected = checkout; setCheckout(null);
              await check(terms, selected);
            }}
            onClose={() => { if (current()) { setCheckout(null); setError('Authorization has not been confirmed. Check its status before continuing.'); } }}
            onError={() => { if (current()) setError('Authorization has not been confirmed. You can retry the same payment or check its status.'); }} />
        </StripeProvider>
      )}
    </section>
  );
}
