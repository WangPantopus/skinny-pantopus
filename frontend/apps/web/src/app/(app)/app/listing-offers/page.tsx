'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Clock, CheckCircle, XCircle, ArrowLeftRight, Timer, Undo2, Trophy, Loader2, Inbox } from 'lucide-react';
import { ListArchetype } from '@/components/archetypes';
import Image from 'next/image';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import { formatTimeAgo } from '@pantopus/ui-utils';

const STATUS_META: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending:   { icon: Clock,         color: '#f59e0b', label: 'Pending' },
  accepted:  { icon: CheckCircle,   color: '#10b981', label: 'Accepted' },
  declined:  { icon: XCircle,       color: '#ef4444', label: 'Declined' },
  countered: { icon: ArrowLeftRight, color: '#6366f1', label: 'Countered' },
  expired:   { icon: Timer,         color: '#9ca3af', label: 'Expired' },
  withdrawn: { icon: Undo2,         color: '#9ca3af', label: 'Withdrawn' },
  completed: { icon: Trophy,        color: '#10b981', label: 'Completed' },
};

function ListingOffersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listingId = searchParams.get('listingId') || '';
  const listingTitle = searchParams.get('title') || 'Listing';

  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchOffers = useCallback(async () => {
    if (!listingId) return;
    try {
      const res = await api.listings.getListingOffers(listingId);
      setOffers(res.offers || []);
    } catch { toast.error('Failed to load offers'); }
  }, [listingId]);

  useEffect(() => { setLoading(true); fetchOffers().finally(() => setLoading(false)); }, [fetchOffers]);

  const handleAccept = useCallback(async (offer: any) => {
    const yes = await confirmStore.open({
      title: 'Accept Offer',
      description: offer.amount != null ? `Accept this offer for $${Number(offer.amount).toFixed(2)}?` : 'Accept this offer?',
      confirmLabel: 'Accept', variant: 'primary',
    });
    if (!yes) return;
    setActionLoading(offer.id);
    try {
      await api.listings.acceptOffer(listingId, offer.id);
      toast.success('Offer accepted!');
      await fetchOffers();
    } catch (err: any) { toast.error(err?.message || 'Failed to accept offer'); }
    finally { setActionLoading(null); }
  }, [listingId, fetchOffers]);

  const handleDecline = useCallback(async (offer: any) => {
    const yes = await confirmStore.open({
      title: 'Decline Offer', description: 'Are you sure you want to decline this offer?',
      confirmLabel: 'Decline', variant: 'destructive',
    });
    if (!yes) return;
    setActionLoading(offer.id);
    try {
      await api.listings.declineOffer(listingId, offer.id);
      toast.success('Offer declined');
      await fetchOffers();
    } catch (err: any) { toast.error(err?.message || 'Failed to decline offer'); }
    finally { setActionLoading(null); }
  }, [listingId, fetchOffers]);

  const handleCounter = useCallback(async (offerId: string) => {
    const amt = parseFloat(counterAmount);
    if (!amt || amt <= 0) { toast.warning('Enter a valid amount'); return; }
    setActionLoading(offerId);
    try {
      await api.listings.counterOffer(listingId, offerId, { counterAmount: amt });
      toast.success('Counter offer sent!');
      setCounteringId(null);
      setCounterAmount('');
      await fetchOffers();
    } catch (err: any) { toast.error(err?.message || 'Failed to send counter offer'); }
    finally { setActionLoading(null); }
  }, [listingId, counterAmount, fetchOffers]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <ListArchetype<any>
        title="Offers"
        subtitle={listingTitle}
        secondaryActions={[
          {
            label: 'Back',
            icon: ArrowLeft,
            onClick: () => router.back(),
          },
        ]}
        loading={loading}
        rows={offers}
        rowSpacing={3}
        keyExtractor={(offer) => offer.id}
        renderRow={(offer: any) => {
          const buyer = offer.buyer || {};
          const buyerName = buyer.first_name || buyer.name || buyer.username || 'Anonymous';
          const avatarUrl = buyer.profile_picture_url;
          const meta = STATUS_META[offer.status] || STATUS_META.pending;
          const StatusIcon = meta.icon;
          const isPending = offer.status === 'pending';
          const isActioning = actionLoading === offer.id;

          return (
            <div className="bg-app-surface border border-app-border rounded-xl p-4">
              {/* Buyer + amount */}
              <div className="flex items-center gap-3 mb-2">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={buyerName} width={40} height={40} sizes="40px" quality={75} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-emerald-700">{(buyerName || '?')[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-app-text">{buyerName}</p>
                  <p className="text-xs text-app-text-muted">{formatTimeAgo(offer.created_at)}</p>
                </div>
                <span className="text-lg font-bold text-app-text">
                  {offer.amount != null ? `$${Number(offer.amount).toFixed(2)}` : 'Interested'}
                </span>
              </div>

              {offer.message && (
                <p className="text-sm text-app-text-secondary italic line-clamp-3 mb-2">&ldquo;{offer.message}&rdquo;</p>
              )}

              {offer.counter_amount != null && (
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 mb-2">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Counter: ${Number(offer.counter_amount).toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 mb-3">
                <StatusIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
              </div>

              {isPending && !isActioning && counteringId !== offer.id && (
                <div className="flex items-center gap-2">
                  <button onClick={() => handleAccept(offer)} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition">Accept</button>
                  <button onClick={() => { setCounteringId(offer.id); setCounterAmount(offer.amount != null ? String(offer.amount) : ''); }}
                    className="flex-1 py-2 border border-indigo-500 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition">Counter</button>
                  <button onClick={() => handleDecline(offer)} className="flex-1 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 transition">Decline</button>
                </div>
              )}

              {counteringId === offer.id && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1 border border-app-border rounded-lg px-3 bg-app-surface">
                    <span className="text-sm font-bold text-app-text">$</span>
                    <input type="text" inputMode="decimal" value={counterAmount}
                      onChange={(e) => setCounterAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="Amount" autoFocus
                      className="flex-1 py-2 pl-1 text-sm text-app-text bg-transparent outline-none" />
                  </div>
                  <button onClick={() => handleCounter(offer.id)} disabled={isActioning}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition">Send</button>
                  <button onClick={() => { setCounteringId(null); setCounterAmount(''); }}
                    className="text-sm text-app-text-secondary hover:text-app-text">Cancel</button>
                </div>
              )}

              {isActioning && (
                <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 text-emerald-600 animate-spin" /></div>
              )}
            </div>
          );
        }}
        emptyState={{
          icon: Inbox,
          headline: 'No offers yet',
          subcopy: "When buyers make offers on this listing, they'll appear here.",
          tone: 'personal',
        }}
      />
    </div>
  );
}

export default function ListingOffersPage() { return <Suspense><ListingOffersContent /></Suspense>; }
