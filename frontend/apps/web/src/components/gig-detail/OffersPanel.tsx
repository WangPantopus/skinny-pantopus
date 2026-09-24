'use client';

import { gigBidCheckoutUrl } from '@/components/gig-detail/GigBidCheckout';

import { useEffect, useRef, useState } from 'react';
import { Star, Medal, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import { confirmStore } from '@/components/ui/confirm-store';
import { toast } from '@/components/ui/toast-store';

type AnyObj = Record<string, any>;

/** Extended gig API methods not in base type definitions */
interface GigsOffersApiExt {
  getGigBids?: (gigId: string) => Promise<{ bids?: AnyObj[] } | AnyObj[]>;
  rejectBid?: (gigId: string, bidId: string) => Promise<unknown>;
  counterBid?: (gigId: string, bidId: string, data: Record<string, any>) => Promise<unknown>;
  withdrawCounter?: (gigId: string, bidId: string) => Promise<unknown>;
}

interface OffersPanelProps {
  actorId?: string;
  gigId: string;
  gigStatus: string;
  gigPrice: number;
  isOwner: boolean;
  paymentStatus: string;
  onStatusChange?: () => void;
  onOpenChat: () => void;
  /** Increment to force a re-fetch of offers (e.g. on socket events). */
  refreshKey?: number;
}

export default function OffersPanel(props: OffersPanelProps) {
  if (!props.actorId || !props.isOwner) return null;
  return <ScopedOffersPanel key={`${props.actorId}:${props.gigId}`} {...props} />;
}

function ScopedOffersPanel({
  gigId,
  gigStatus,
  isOwner,
  refreshKey,
}: OffersPanelProps) {
  const router = useRouter();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [offers, setOffers] = useState<AnyObj[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [counterOffer, setCounterOffer] = useState<AnyObj | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [counterError, setCounterError] = useState<string | null>(null);
  const [sendingCounter, setSendingCounter] = useState(false);
  const counterPending = useRef(false);

  useEffect(() => {
    if (!isOwner) return;
    void loadOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId, gigStatus, isOwner, refreshKey]);

  const loadOffers = async () => {
    if (!mounted.current) return;
    setLoadingOffers(true);
    setReadError(null);

    try {
      const gigsExt = api.gigs as unknown as GigsOffersApiExt;
      const list = await gigsExt.getGigBids?.(gigId);
      if (!mounted.current) return;
      const bids = ((list as Record<string, any>)?.bids ?? list ?? []) as AnyObj[];
      setOffers(bids);
      setOffersLoaded(true);
    } catch (e: unknown) {
      console.error('Failed to load offers:', e);
      if (mounted.current) setReadError(e instanceof Error ? e.message : 'Failed to load offers');
    } finally {
      if (mounted.current) setLoadingOffers(false);
    }
  };

  const handleAcceptBid = (bidId: string) => router.push(gigBidCheckoutUrl(gigId, bidId));

  const handleRejectBid = async (bidId: string) => {
    const confirmed = await confirmStore.open({
      title: 'Reject this bid?',
      description: 'The bidder will be notified that their offer was declined.',
      confirmLabel: 'Reject',
      variant: 'destructive',
    });
    if (!confirmed || !mounted.current) return;

    try {
      setOffersError(null);
  
      const bidsApi = api.gigs as unknown as GigsOffersApiExt;
      if (typeof bidsApi.rejectBid === 'function') {
        await bidsApi.rejectBid(gigId, bidId);
        await loadOffers();
      } else {
        setOffersError('Reject bid endpoint not implemented yet.');
      }
    } catch (e: unknown) {
      console.error('Reject failed:', e);
      const eData = e && typeof e === 'object' ? (e as Record<string, any>) : null;
      setOffersError(e instanceof Error ? e.message : 'Failed to reject bid');
    }
  };

  const handleCounterBid = async () => {
    if (!counterOffer || counterPending.current) return;
    const amount = Number(counterAmount);
    if (!counterAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setCounterError('Enter a counter amount greater than $0.');
      return;
    }
    counterPending.current = true;
    setSendingCounter(true);
    setCounterError(null);
    try {
      const data = await api.gigs.counterBid(gigId, String(counterOffer.id), { amount, message: counterMessage });
      if (!mounted.current) return;
      setOffers((current) => current.map((offer) => offer.id === counterOffer.id
        ? { ...offer, ...data.bid } : offer));
      setCounterOffer(null);
      toast.success('Counter-offer sent');
      await loadOffers();
    } catch (e: unknown) {
      if (mounted.current) setCounterError(e instanceof Error ? e.message : 'Failed to send counter-offer');
    } finally {
      counterPending.current = false;
      if (mounted.current) setSendingCounter(false);
    }
  };

  const handleWithdrawCounter = async (bidId: string) => {
    const confirmed = await confirmStore.open({
      title: 'Withdraw counter-offer?',
      description: 'The bid will revert to its original amount. You can accept, reject, or send a new counter.',
      confirmLabel: 'Withdraw',
      variant: 'destructive',
    });
    if (!confirmed || !mounted.current) return;

    try {
      setOffersError(null);
      await (api.gigs as unknown as GigsOffersApiExt).withdrawCounter?.(gigId, bidId);
      await loadOffers();
    } catch (e: unknown) {
      console.error('Withdraw counter failed:', e);
      setOffersError(e instanceof Error ? e.message : 'Failed to withdraw counter');
    }
  };

  if (!isOwner) return null;

  return (
    <>
      {/* Offers list */}
      <div id="gig-offers" className="bg-app-surface rounded-xl p-6 border border-app-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-app-text">Offers</h3>
          <button
            onClick={loadOffers}
            className="text-sm text-app-text-secondary hover:text-app-text"
            disabled={loadingOffers}
          >
            {loadingOffers && offersLoaded ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {offersError && (
          <p role="alert" className="text-sm text-red-600 mb-2">{offersError}</p>
        )}

        {readError && (
          <div role="alert" className="text-sm text-red-600 mb-2">
            <p>{readError}</p>
            {offersLoaded && <p className="text-app-text-secondary">Showing the last loaded offers.</p>}
            <button onClick={loadOffers} disabled={loadingOffers} className="mt-1 underline font-medium">Retry</button>
          </div>
        )}

        {loadingOffers && !offersLoaded ? (
          <p className="text-sm text-app-text-secondary">Loading offers...</p>
        ) : offers.length === 0 ? (
          offersLoaded && !readError && <p className="text-sm text-app-text-secondary">No offers yet.</p>
        ) : (
          <div className="space-y-3">
            {offers.map((o) => {
              const bidder = o.bidder || {};
              const bidderName = bidder.displayName || bidder.handle || 'Anonymous';
              const bidderUsername = typeof bidder.handle === 'string' && bidder.handle
                && !bidder.handle.startsWith('/') && bidder.href === `/${bidder.handle}`
                ? bidder.handle : null;

              const statusColor: Record<string, string> = {
                accepted: 'bg-green-100 text-green-800',
                pending_payment: 'bg-amber-100 text-amber-800',
                rejected: 'bg-app-surface-sunken text-app-text-strong',
                withdrawn: 'bg-app-surface-sunken text-app-text-secondary',
                expired: 'bg-app-surface-sunken text-app-text-muted',
                countered: 'bg-purple-100 text-purple-800',
                pending: 'bg-yellow-100 text-yellow-800',
              };

              return (
                <div key={o.id} className="border border-app-border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-app-text">
                      ${o.bid_amount ?? o.amount}
                      {o.counter_status === 'pending' && o.counter_amount && (
                        <span className="text-sm text-purple-600 ml-2">
                          → countered ${o.counter_amount}
                        </span>
                      )}
                      {o.counter_status === 'accepted' && o.counter_amount && (
                        <span className="text-sm text-green-600 ml-2">
                          (counter accepted)
                        </span>
                      )}
                      {o.counter_status === 'declined' && (
                        <span className="text-sm text-red-500 ml-2">
                          (counter declined)
                        </span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColor[o.status] || statusColor.pending}`}>
                      {o.status === 'pending_payment' ? 'AUTHORIZING' : String(o.status || 'pending').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {bidderUsername ? (
                      <UserIdentityLink
                        userId={bidder?.id || null}
                        username={bidderUsername}
                        displayName={bidderName}
                        avatarUrl={bidder?.avatarUrl || null}
                        city={bidder?.locality?.city || null}
                        state={bidder?.locality?.state || null}
                        textClassName="text-sm text-primary-600 hover:underline"
                      />
                    ) : (
                      <span className="text-sm text-app-text-secondary">{bidderName}</span>
                    )}
                    {/* Reliability badge */}
                    {bidder.reliability_score != null && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          (bidder.reliability_score >= 95 && (bidder.gigs_completed || 0) >= 5)
                            ? 'bg-yellow-100 text-yellow-800'
                            : (bidder.reliability_score >= 85 && (bidder.gigs_completed || 0) >= 3)
                            ? 'bg-app-surface-sunken text-app-text-strong'
                            : (bidder.no_show_count || 0) > 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-app-surface-raised text-app-text-secondary'
                        }`}
                        title={`Reliability: ${bidder.reliability_score}% · ${bidder.gigs_completed || 0} completed · ${bidder.no_show_count || 0} no-shows`}
                      >
                        {(bidder.reliability_score >= 95 && (bidder.gigs_completed || 0) >= 5)
                          ? <><Star className="w-3 h-3 inline-block" /> Top Rated</>
                          : (bidder.reliability_score >= 85 && (bidder.gigs_completed || 0) >= 3)
                          ? <><Medal className="w-3 h-3 inline-block" /> Reliable</>
                          : (bidder.no_show_count || 0) > 0
                          ? <><AlertTriangle className="w-3 h-3 inline-block" /> {bidder.no_show_count} no-show{bidder.no_show_count > 1 ? 's' : ''}</>
                          : `${bidder.gigs_completed || 0} jobs`}
                      </span>
                    )}
                    {/* Rating */}
                    {bidder.average_rating > 0 && (
                      <span className="text-[10px] text-app-text-secondary">
                        ★ {Number(bidder.average_rating).toFixed(1)} ({bidder.review_count || 0})
                      </span>
                    )}
                  </div>
                  {o.message && <p className="text-sm text-app-text-strong mt-2">{o.message}</p>}

                  {/* Expiry countdown */}
                  {o.expires_at && o.status === 'pending' && (
                    <p className="text-xs text-app-text-muted mt-1">
                      Expires: {new Date(o.expires_at).toLocaleString()}
                    </p>
                  )}

                  {o.status === 'pending_payment' && (
                    <button onClick={() => handleAcceptBid(o.id)} className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-white">
                      Resume payment
                    </button>
                  )}

                  {/* Actions for pending bids (no prior counter or counter was declined) */}
                  {gigStatus === 'open' && (o.status === 'pending' || !o.status) && o.counter_status !== 'accepted' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleRejectBid(o.id)}
                        disabled={sendingCounter}
                        className="flex-1 bg-app-surface border border-app-border text-app-text py-2 rounded-lg hover:bg-app-hover font-medium text-sm"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          setCounterOffer(o);
                          setCounterAmount(String(o.bid_amount ?? o.amount ?? ''));
                          setCounterMessage('');
                          setCounterError(null);
                        }}
                        disabled={sendingCounter}
                        className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 font-medium text-sm"
                      >
                        Counter
                      </button>
                      <button
                        onClick={() => handleAcceptBid(o.id)}
                        disabled={sendingCounter}
                        className="flex-1 bg-gray-900 text-white py-2 rounded-lg hover:bg-black font-semibold text-sm"
                      >
                        Accept
                      </button>
                    </div>
                  )}

                  {counterOffer?.id === o.id && (
                    <form onSubmit={(event) => { event.preventDefault(); void handleCounterBid(); }} className="mt-3 border border-app-border rounded-lg p-3 space-y-3">
                      <p className="text-sm font-medium text-app-text">Counter-offer</p>
                      <label className="block text-sm text-app-text-secondary">
                        Amount ($)
                        <input type="number" step="any" value={counterAmount} onChange={(event) => setCounterAmount(event.target.value)} disabled={sendingCounter} className="mt-1 w-full border border-app-border rounded-lg px-3 py-2 text-sm" />
                      </label>
                      <label className="block text-sm text-app-text-secondary">
                        Message (optional)
                        <textarea value={counterMessage} onChange={(event) => setCounterMessage(event.target.value)} disabled={sendingCounter} rows={2} className="mt-1 w-full border border-app-border rounded-lg px-3 py-2 text-sm" />
                      </label>
                      {counterError && <p role="alert" className="text-sm text-red-600">{counterError}</p>}
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setCounterOffer(null)} disabled={sendingCounter} className="px-3 py-2 text-sm text-app-text-secondary disabled:opacity-50">Cancel</button>
                        <button type="submit" disabled={sendingCounter} className="px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium disabled:opacity-50">{sendingCounter ? 'Sending…' : 'Send counter-offer'}</button>
                      </div>
                    </form>
                  )}

                  {/* Counter accepted — prompt owner to accept or reject the bid */}
                  {gigStatus === 'open' && o.status === 'pending' && o.counter_status === 'accepted' && (
                    <div className="mt-3">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                        <p className="text-sm text-green-700">
                          Bidder accepted your counter of <strong>${o.counter_amount}</strong>. Accept to assign the gig.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRejectBid(o.id)}
                          className="flex-1 bg-app-surface border border-app-border text-app-text py-2 rounded-lg hover:bg-app-hover font-medium text-sm"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleAcceptBid(o.id)}
                          className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-semibold text-sm"
                        >
                          Accept Bid
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Waiting for counter response — owner can withdraw or reject */}
                  {o.status === 'countered' && o.counter_status === 'pending' && (
                    <div className="mt-3">
                      <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-3">
                        <p className="text-sm text-purple-700">
                          Waiting for bidder to respond to your counter of <strong>${o.counter_amount}</strong>
                          {o.counter_message && <span className="italic"> — &ldquo;{o.counter_message}&rdquo;</span>}
                        </p>
                      </div>
                      {gigStatus === 'open' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRejectBid(o.id)}
                            className="flex-1 bg-app-surface border border-app-border text-app-text py-2 rounded-lg hover:bg-app-hover font-medium text-sm"
                          >
                            Reject Bid
                          </button>
                          <button
                            onClick={() => handleWithdrawCounter(o.id)}
                            className="flex-1 bg-purple-100 text-purple-700 border border-purple-200 py-2 rounded-lg hover:bg-purple-200 font-medium text-sm"
                          >
                            Withdraw Counter
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </>
  );
}
