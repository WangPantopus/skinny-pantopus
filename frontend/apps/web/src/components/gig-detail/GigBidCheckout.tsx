'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import StripeProvider from '@/components/payments/StripeProvider';
import GigPaymentSetup from '@/components/payments/GigPaymentSetup';

type Bid = { id: string; user_id?: string; bid_amount: number; status: string; counter_status?: string; counter_amount?: number };

export const gigBidCheckoutUrl = (gigId: string, bidId: string): string =>
  `/app/gigs/${encodeURIComponent(gigId)}?action=payment_setup&bid=${encodeURIComponent(bidId)}#payment-checkout`;

/** The backend retains checkout identity. URLs carry only the selected bid;
 * payment secrets are fetched after current owner authorization and kept in memory. */
type Props = {
  gigId: string;
  actorId: string;
  onAccepted?: () => void;
};

export default function GigBidCheckout(props: Props) {
  const search = useSearchParams();
  const requestedBid = search.get('bid');
  useEffect(() => {
    // The provider appends its secret to redirect URLs. Recover by bid identity
    // through our API, then remove those parameters from history and share URLs.
    const url = new URL(window.location.href);
    const providerKeys = ['payment_intent', 'payment_intent_client_secret', 'setup_intent', 'setup_intent_client_secret', 'redirect_status'];
    if (providerKeys.some((key) => url.searchParams.has(key))) {
      providerKeys.forEach((key) => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [search]);
  return <Checkout key={`${props.actorId}:${props.gigId}:${requestedBid ?? ''}`} {...props} requestedBid={requestedBid} />;
}

function Checkout({ gigId, actorId, onAccepted, requestedBid }: Props & { requestedBid: string | null }) {
  const [bid, setBid] = useState<Bid | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [needsFinalize, setNeedsFinalize] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const flight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    // Retire the old unscoped secret cache without reading or reusing it.
    try { window.sessionStorage.removeItem(`gig_payment_setup_${gigId}`); } catch { /* Storage may be disabled. */ }
    void api.gigs.getGigBids(gigId).then(({ bids }) => {
      if (!active) return;
      const rows = bids as unknown as Bid[];
      const pending = rows.filter((row) => row.status === 'pending_payment');
      const chosen = requestedBid ? rows.find((row) => row.id === requestedBid) : pending.length === 1 ? pending[0] : null;
      if (requestedBid && !chosen) setError('This bid is no longer available. Refresh the offers.');
      else if (!requestedBid && pending.length > 1) setError('Payment progress needs review before another bid can be accepted.');
      else if (chosen?.status === 'accepted') setCompleted(true);
      else if (chosen && ['pending', 'countered', 'pending_payment'].includes(chosen.status)) setBid(chosen);
      else if (chosen) setError('This bid cannot be accepted. Refresh the offers.');
      setLoaded(true);
    }).catch(() => {
      if (active) { setError('Could not load payment progress. Refresh to retry.'); setLoaded(true); }
    });
    return () => { active = false; };
  }, [gigId, actorId, requestedBid]);

  const finish = async (bidId: string) => {
    if (!mounted.current) return;
    const result = await api.gigs.finalizeAccept(gigId, bidId);
    if (result.bid?.id !== bidId || result.bid.status !== 'accepted') {
      throw new Error('Payment confirmation is incomplete. Continue to retry the same bid.');
    }
    if (!mounted.current) return;
    setCompleted(true);
    setNeedsFinalize(false);
    setSecret(null);
    onAccepted?.();
  };

  const continueCheckout = async () => {
    if (!mounted.current || !bid || flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (needsFinalize) {
        await finish(bid.id);
        return;
      }
      const result = await api.gigs.acceptBid(gigId, bid.id);
      if (!mounted.current) return;
      if (result.bid?.id !== bid.id) throw new Error('Could not confirm this selected bid. Refresh to check its progress.');
      if (result.authorizationReady === true) {
        setNeedsFinalize(true);
        await finish(bid.id);
        return;
      }
      if (result.bid?.id === bid.id && result.bid.status === 'accepted') {
        setCompleted(true);
        onAccepted?.();
        return;
      }
      const exactAmount = result.amountCents;
      const clientSecret = result.clientSecret ?? result.payment?.clientSecret;
      if (!Number.isSafeInteger(exactAmount) || (exactAmount ?? 0) < 50
        || result.currency?.toLowerCase() !== 'usd' || !clientSecret || result.isSetupIntent === true) {
        throw new Error('Could not confirm the agreed payment. Continue to retry the same bid.');
      }
      setBid({ ...bid, bid_amount: exactAmount! / 100, counter_status: undefined, status: 'pending_payment' });
      setAmountCents(exactAmount!);
      setSecret(clientSecret);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Payment progress is unconfirmed. Please retry.');
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const authorizationFinished = async () => {
    if (!mounted.current || !bid || flight.current) return;
    flight.current = true;
    setBusy(true);
    setSecret(null);
    setNeedsFinalize(true);
    try { await finish(bid.id); }
    catch {
      if (mounted.current) setError('Authorization may be complete. Continue to confirm this same bid.');
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const cancelCheckout = async () => {
    if (!mounted.current || !bid || flight.current) return;
    flight.current = true;
    setBusy(true);
    setSecret(null);
    setError(null);
    try {
      const result = await api.gigs.abortAccept(gigId, bid.id);
      if (result.bid?.id !== bid.id || result.bid.status !== 'pending') throw new Error('Cancellation is not confirmed.');
      if (!mounted.current) return;
      setBid(null);
      setNeedsFinalize(false);
      onAccepted?.();
    } catch {
      if (mounted.current) setError('Cancellation could not be confirmed. Retry canceling to check the same payment.');
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  if (!loaded || (!bid && !error && !completed)) return null;
  const selectedAmount = bid?.counter_status === 'accepted' ? bid.counter_amount : bid?.bid_amount;
  return (
    <section id="payment-checkout" aria-label="Bid payment" className="rounded-xl border border-app-border bg-app-surface p-5 space-y-3">
      <h3 className="font-semibold text-app-text">{completed ? 'Bid accepted' : 'Confirm this bid'}</h3>
      {completed ? <p>Bid acceptance is confirmed. See the current gig status above.</p> : bid && (
        <>
          <p>{Number.isFinite(Number(selectedAmount)) && Number(selectedAmount) > 0
            ? `The selected bid is $${Number(selectedAmount).toFixed(2)}. Authorize the agreed amount before the worker starts; capture follows your completion confirmation.`
            : 'Confirm the selected bid to assign this gig.'}</p>
          <button disabled={busy} onClick={() => void continueCheckout()} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">
            {busy ? 'Confirming…' : needsFinalize ? 'Confirm authorization' : bid.status === 'pending_payment' ? 'Resume payment' : 'Continue'}
          </button>
          {(bid.status === 'pending_payment' || needsFinalize) && (
            <button disabled={busy} onClick={() => void cancelCheckout()} className="ml-3 rounded-lg border border-app-border px-4 py-2 disabled:opacity-50">
              Cancel payment setup
            </button>
          )}
        </>
      )}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {secret && amountCents !== null && bid && (
        <StripeProvider clientSecret={secret}>
          <GigPaymentSetup clientSecret={secret} isSetupIntent={false} gigId={gigId} bidId={bid.id}
            amount={amountCents} onSuccess={authorizationFinished} onClose={cancelCheckout}
            onError={() => setError('Payment authorization is unconfirmed. You can retry or cancel this setup.')} />
        </StripeProvider>
      )}
    </section>
  );
}
