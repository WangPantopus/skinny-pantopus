'use client';

import { useEffect, useState } from 'react';
import { Star, Medal, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import AuthorizationRetryBanner from '@/components/payments/AuthorizationRetryBanner';
import StripeProvider from '@/components/payments/StripeProvider';
import GigPaymentSetup from '@/components/payments/GigPaymentSetup';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

type AnyObj = Record<string, any>;

const formatUsd = (amount: number): string => `$${amount.toFixed(2)}`;
const getOfferAmount = (offer: AnyObj | undefined): number | null => {
  const raw = offer?.amount ?? offer?.bid_amount ?? null;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
};

/** Extended gig API methods not in base type definitions */
interface GigsOffersApiExt {
  getGigBids?: (gigId: string) => Promise<{ bids?: AnyObj[] } | AnyObj[]>;
  rejectBid?: (gigId: string, bidId: string) => Promise<unknown>;
  counterBid?: (gigId: string, bidId: string, data: Record<string, any>) => Promise<unknown>;
  withdrawCounter?: (gigId: string, bidId: string) => Promise<unknown>;
}

interface OffersPanelProps {
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

export default function OffersPanel({
  gigId,
  gigStatus,
  gigPrice,
  isOwner,
  paymentStatus,
  onStatusChange,
  onOpenChat,
  refreshKey,
}: OffersPanelProps) {
  const router = useRouter();
  const [offers, setOffers] = useState<AnyObj[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);

  // Payment setup state (triggered by accept bid)
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentIsSetupIntent, setPaymentIsSetupIntent] = useState(false);
  const [pendingChatRoomId, setPendingChatRoomId] = useState<string | null>(null);
  const [pendingAcceptBidId, setPendingAcceptBidId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    void loadOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId, isOwner, refreshKey]);

  const loadOffers = async () => {
    setLoadingOffers(true);
    setOffersError(null);

    try {
      const gigsExt = api.gigs as unknown as GigsOffersApiExt;
      const list = await gigsExt.getGigBids?.(gigId);
      const bids = ((list as Record<string, any>)?.bids ?? list ?? []) as AnyObj[];
      setOffers(bids);
    } catch (e: unknown) {
      console.error('Failed to load offers:', e);
      setOffers([]);
      setOffersError(e instanceof Error ? e.message : 'Failed to load offers');
    } finally {
      setLoadingOffers(false);
    }
  };

  const handleAcceptBid = async (bidId: string) => {
    const selectedOffer = offers.find((offer) => String(offer?.id) === String(bidId));
    const amount = getOfferAmount(selectedOffer);
    const confirmed = await confirmStore.open({
      title: amount != null && amount > 0 ? 'Secure payment hold' : 'Accept this bid?',
      description:
        amount != null && amount > 0
          ? `Your card will be authorized for ${formatUsd(amount)} as a secure hold. You will NOT be charged until you confirm the task is completed. This protects both you and the worker — think of it as a secure escrow.`
          : 'This will assign the gig to this bidder.',
      confirmLabel: amount != null && amount > 0 ? 'Continue to Payment' : 'Accept',
      cancelLabel: amount != null && amount > 0 ? 'Not now' : 'Cancel',
      variant: 'primary',
    });
    if (!confirmed) return;

    try {
      setOffersError(null);
      const resp = await api.gigs.acceptBid(gigId, bidId) as Record<string, any>;
      const payment = (resp?.payment || null) as Record<string, any> | null;
      const clientSecret = (resp?.clientSecret || payment?.clientSecret || null) as string | null;
      const setupIntentId = (resp?.setupIntentId || payment?.setupIntentId || null) as string | null;
      const roomId = resp?.roomId || null;
      const isSetup = Boolean(resp?.isSetupIntent ?? setupIntentId);
      const requiresPaymentSetup = Boolean(resp?.requiresPaymentSetup || clientSecret);

      if (requiresPaymentSetup && clientSecret) {
        setPendingAcceptBidId(bidId);
        setPaymentClientSecret(clientSecret);
        setPaymentIsSetupIntent(isSetup);
        setShowPaymentSetup(true);
      } else {
        // Free gig — already fully accepted
        setPendingChatRoomId(roomId);
        toast.success('Bid accepted! Gig assigned.');
        onStatusChange?.();
        await loadOffers();
        if (roomId) router.push(`/app/chat/${roomId}`);
      }
    } catch (err: unknown) {
      console.error('Accept failed:', err);
      const errData = err && typeof err === 'object' ? (err as Record<string, any>) : null;
      const errCode = errData?.data ? String((errData.data as Record<string, any>)?.code || '') : null;
      if (errCode === 'payer_payment_required') {
        setOffersError('Add a payment method to accept this bid');
      } else if (errCode === 'pending_payment_conflict') {
        setOffersError('This bid is already being processed. Please wait.');
      } else {
        setOffersError(err instanceof Error ? err.message : 'Failed to accept bid');
      }
    }
  };

  const handleRejectBid = async (bidId: string) => {
    const confirmed = await confirmStore.open({
      title: 'Reject this bid?',
      description: 'The bidder will be notified that their offer was declined.',
      confirmLabel: 'Reject',
      variant: 'destructive',
    });
    if (!confirmed) return;

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

  const handleCounterBid = async (offer: AnyObj) => {
    const amt = prompt(`Counter-offer amount (original: $${offer.bid_amount ?? offer.amount}):`);
    if (!amt || isNaN(Number(amt)) || Number(amt) <= 0) return;
    const msg = prompt('Optional message:') || '';
    try {
      await (api.gigs as unknown as GigsOffersApiExt).counterBid?.(gigId, String(offer.id), { amount: Number(amt), message: msg });
      await loadOffers();
    } catch (e: unknown) {
      const eData = e && typeof e === 'object' ? (e as Record<string, any>) : null;
      setOffersError(e instanceof Error ? e.message : 'Failed to counter');
    }
  };

  const handleWithdrawCounter = async (bidId: string) => {
    const confirmed = await confirmStore.open({
      title: 'Withdraw counter-offer?',
      description: 'The bid will revert to its original amount. You can accept, reject, or send a new counter.',
      confirmLabel: 'Withdraw',
      variant: 'destructive',
    });
    if (!confirmed) return;

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
      {/* Authorization Retry Banner (owner only) */}
      {paymentStatus === 'authorization_failed' && (
        <AuthorizationRetryBanner
          gigId={gigId}
          onRetryClientSecret={(cs) => {
            setPaymentClientSecret(cs);
            setPaymentIsSetupIntent(false);
            setShowPaymentSetup(true);
          }}
          onRetrySuccess={() => {
            onStatusChange?.();
          }}
        />
      )}

      {/* Offers list */}
      <div className="bg-app-surface rounded-xl p-6 border border-app-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-app-text">Offers</h3>
          <button
            onClick={loadOffers}
            className="text-sm text-app-text-secondary hover:text-app-text"
            disabled={loadingOffers}
          >
            Refresh
          </button>
        </div>

        {offersError && (
          <p className="text-sm text-red-600 mb-2">{offersError}</p>
        )}

        {loadingOffers ? (
          <p className="text-sm text-app-text-secondary">Loading offers...</p>
        ) : offers.length === 0 ? (
          <p className="text-sm text-app-text-secondary">No offers yet.</p>
        ) : (
          <div className="space-y-3">
            {offers.map((o) => {
              const bidder = o.bidder || {};
              const bidderName = bidder.name || [bidder.first_name, bidder.middle_name, bidder.last_name].filter(Boolean).join(' ') || bidder.username || 'Anonymous';
              const bidderUsername = bidder.username;

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
                        avatarUrl={bidder?.profile_picture_url || null}
                        city={bidder?.city || null}
                        state={bidder?.state || null}
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

                  {/* Actions for pending bids (no prior counter or counter was declined) */}
                  {gigStatus === 'open' && (o.status === 'pending' || !o.status) && o.counter_status !== 'accepted' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleRejectBid(o.id)}
                        className="flex-1 bg-app-surface border border-app-border text-app-text py-2 rounded-lg hover:bg-app-hover font-medium text-sm"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleCounterBid(o)}
                        className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 font-medium text-sm"
                      >
                        Counter
                      </button>
                      <button
                        onClick={() => handleAcceptBid(o.id)}
                        className="flex-1 bg-gray-900 text-white py-2 rounded-lg hover:bg-black font-semibold text-sm"
                      >
                        Accept
                      </button>
                    </div>
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

      {/* Payment Setup Modal (triggered by accept bid) */}
      {showPaymentSetup && paymentClientSecret && (
        <StripeProvider clientSecret={paymentClientSecret}>
          <GigPaymentSetup
            clientSecret={paymentClientSecret}
            isSetupIntent={paymentIsSetupIntent}
            gigId={gigId}
            amount={gigPrice * 100 || 0}
            onSuccess={async () => {
              setShowPaymentSetup(false);
              setPaymentClientSecret(null);
              if (pendingAcceptBidId) {
                try {
                  const result = await api.gigs.finalizeAccept(gigId, pendingAcceptBidId) as Record<string, any>;
                  const roomId = result?.roomId || null;
                  toast.success(
                    paymentIsSetupIntent
                      ? 'Card saved! Payment will be authorized before the gig starts.'
                      : 'Payment authorized! The worker can now start.'
                  );
                  onStatusChange?.();
                  await loadOffers();
                  if (roomId) router.push(`/app/chat/${roomId}`);
                } catch (err) {
                  console.error('Finalize accept failed:', err);
                  toast.error('Payment authorized but failed to finalize. Please refresh.');
                }
              }
              setPendingAcceptBidId(null);
            }}
            onError={(err) => {
              console.error('Payment setup error:', err);
            }}
            onClose={async () => {
              setShowPaymentSetup(false);
              setPaymentClientSecret(null);
              if (pendingAcceptBidId) {
                try {
                  await api.gigs.abortAccept(gigId, pendingAcceptBidId);
                } catch (err) {
                  // Cleanup job handles stale pending_payment bids
                  console.error('Abort accept failed:', err);
                }
                toast.error('Payment is required to accept this bid. No changes were made.');
                onStatusChange?.();
                await loadOffers();
              }
              setPendingAcceptBidId(null);
            }}
          />
        </StripeProvider>
      )}
    </>
  );
}
