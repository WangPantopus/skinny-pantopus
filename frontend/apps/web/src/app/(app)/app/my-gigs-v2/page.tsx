// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import SearchInput from '@/components/SearchInput';
import { GIG_STATUS, statusClasses, statusLabel } from '@/components/statusColors';
import { Inbox } from 'lucide-react';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import type { GigListItem, GigBidWithUser } from '@pantopus/types';
import { ListArchetype } from '@/components/archetypes';

type FilterStatus = 'all' | 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

const ENGAGEMENT_CONFIG: Record<string, { label: string; cls: string }> = {
  instant_accept: { label: '⚡ Instant', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  curated_offers: { label: '📋 Offers', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  quotes: { label: '💼 Quotes', cls: 'bg-purple-50 text-purple-700 border border-purple-200' },
};

const formatUsd = (amount: number): string => `$${amount.toFixed(2)}`;
const getBidAmount = (bid?: GigBidWithUser | null): number | null => {
  const raw = (bid as unknown as Record<string, any> | null)?.amount ?? null;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
};

export default function MyGigsV2Page() {
  const router = useRouter();
  const [gigs, setGigs] = useState<GigListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedGig, setSelectedGig] = useState<GigListItem | null>(null);
  const [bids, setBids] = useState<GigBidWithUser[]>([]);
  const [loadingBids, setLoadingBids] = useState(false);
  const [bidsError, setBidsError] = useState<string | null>(null);

  const loadGigs = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        router.push('/login');
        return;
      }

      setFetchError(null);
      const response = await api.gigs.getMyGigs({
        limit: 100,
        status: filter === 'all' ? undefined : [filter]
      });

      const resObj = response as Record<string, any>;
      const gigsArray = (resObj.gigs || resObj.data || []) as GigListItem[];
      setGigs(gigsArray);
    } catch (err) {
      console.error('Failed to load gigs:', err);
      setGigs([]);
      setFetchError('Failed to load your gigs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filter, router]);

  useEffect(() => {
    loadGigs();
  }, [loadGigs]);

  const loadBidsForGig = async (gigId: string) => {
    setLoadingBids(true);
    setBidsError(null);
    try {
      const response = await api.gigs.getGigBids(gigId);
      setBids(response.bids || []);
    } catch {
      setBids([]);
      setBidsError('Failed to load bids');
    } finally {
      setLoadingBids(false);
    }
  };

  const handleViewGig = (gig: GigListItem) => {
    router.push(`/app/gigs-v2/${gig.id}`);
  };

  const handleViewBids = (gig: GigListItem) => {
    setBidsError(null);
    setSelectedGig(gig);
    loadBidsForGig(gig.id);
  };

  const handleAcceptBid = async (bidId: string) => {
    if (!selectedGig) return;
    const selectedBid = bids.find((bid) => String((bid as unknown as Record<string, any>)?.id) === String(bidId));
    const amount = getBidAmount(selectedBid || null);
    const yes = await confirmStore.open({
      title: amount != null && amount > 0 ? 'Authorize payment method?' : 'Accept this bid?',
      description:
        amount != null && amount > 0
          ? `Pantopus will place a temporary authorization hold of ${formatUsd(amount)}. You are charged only after you confirm the task is completed. If canceled per policy, the hold is released (or only applicable fees apply).`
          : 'This will close the gig to other bidders.',
      confirmLabel: amount != null && amount > 0 ? 'Continue to Payment' : 'Accept Bid',
      cancelLabel: amount != null && amount > 0 ? 'Not now' : 'Cancel',
      variant: 'primary',
    });
    if (!yes) return;

    try {
      setBidsError(null);
      const resp = await api.gigs.acceptBid(selectedGig.id, bidId) as Record<string, any>;
      const payment = (resp?.payment || {}) as Record<string, any>;
      const clientSecret = (resp?.clientSecret || payment?.clientSecret || null) as string | null;
      const setupIntentId = (resp?.setupIntentId || payment?.setupIntentId || null) as string | null;
      const isSetupIntent = Boolean((resp?.isSetupIntent as boolean | undefined) ?? setupIntentId);
      const requiresPaymentSetup = Boolean(resp?.requiresPaymentSetup || clientSecret);

      if (requiresPaymentSetup && clientSecret && typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          `gig_payment_setup_${selectedGig.id}`,
          JSON.stringify({
            clientSecret,
            isSetupIntent,
            roomId: (resp?.roomId as string | null) || null,
            rollbackOnAbort: true,
          })
        );
        toast.info('Bid accepted. Complete payment authorization to continue.');
        router.push(`/app/gigs-v2/${selectedGig.id}?action=payment_setup`);
        return;
      }

      toast.success('Bid accepted!');
      loadGigs();
      loadBidsForGig(selectedGig.id);

      const roomId = (resp?.roomId || null) as string | null;
      if (roomId) {
        router.push(`/app/chat/${roomId}`);
      }
    } catch (err: unknown) {
      setBidsError(err instanceof Error ? err.message : 'Failed to accept bid');
    }
  };

  const handleRejectBid = async (bidId: string) => {
    if (!selectedGig) return;
    const yes = await confirmStore.open({ title: 'Reject this bid?', description: 'This bidder will be notified of the rejection.', confirmLabel: 'Reject Bid', variant: 'destructive' });
    if (!yes) return;

    try {
      setBidsError(null);
      await api.gigs.rejectBid(selectedGig.id, bidId);
      toast.info('Bid rejected');
      loadBidsForGig(selectedGig.id);
    } catch (err: unknown) {
      setBidsError(err instanceof Error ? err.message : 'Failed to reject bid');
    }
  };

  const handleMarkComplete = async (gigId: string) => {
    const yes = await confirmStore.open({ title: 'Mark this gig as complete?', description: 'This will finalize the task and trigger payment processing.', confirmLabel: 'Complete', variant: 'primary' });
    if (!yes) return;

    try {
      await api.gigs.completeGig(gigId);
      toast.success('Gig marked as complete!');
      loadGigs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete gig');
    }
  };

  const filteredGigs = gigs.filter(gig => {
    if (filter !== 'all' && gig.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const title = (gig.title || '').toLowerCase();
      const desc = (gig.description || '').toLowerCase();
      const cat = (gig.category || '').toLowerCase();
      if (!title.includes(q) && !desc.includes(q) && !cat.includes(q)) return false;
    }
    return true;
  });

  const stats = {
    all: gigs.length,
    open: gigs.filter(g => g.status === 'open').length,
    assigned: gigs.filter(g => g.status === 'assigned').length,
    in_progress: gigs.filter(g => g.status === 'in_progress').length,
    completed: gigs.filter(g => g.status === 'completed').length,
    cancelled: gigs.filter(g => g.status === 'cancelled').length,
  };

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ListArchetype<GigListItem>
          title="My tasks"
          subtitle={`${gigs.length} total · ${stats.open} open`}
          primaryAction={{
            label: 'Quick post',
            onClick: () => router.push('/app/gigs-v2/new'),
          }}
          headerFilters={
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search your gigs…"
              className="max-w-sm"
            />
          }
          renderHeader={() => (
            <>
              {fetchError && (
                <div className="mb-4">
                  <ErrorState message={fetchError} onRetry={() => loadGigs()} />
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <StatCard label="All" count={stats.all} active={filter === 'all'} onClick={() => setFilter('all')} />
                <StatCard label="Open" count={stats.open} active={filter === 'open'} onClick={() => setFilter('open')} />
                <StatCard label="Assigned" count={stats.assigned} active={filter === 'assigned'} onClick={() => setFilter('assigned')} />
                <StatCard label="In progress" count={stats.in_progress} active={filter === 'in_progress'} onClick={() => setFilter('in_progress')} />
                <StatCard label="Completed" count={stats.completed} active={filter === 'completed'} onClick={() => setFilter('completed')} />
                <StatCard label="Cancelled" count={stats.cancelled} active={filter === 'cancelled'} onClick={() => setFilter('cancelled')} />
              </div>
            </>
          )}
          loading={loading}
          loadingSlot={<LoadingSkeleton variant="gig-card" count={3} />}
          rows={filteredGigs}
          rowSpacing={4}
          keyExtractor={(gig) => gig.id}
          renderRow={(gig) => (
            <GigCardV2
              gig={gig}
              onView={() => handleViewGig(gig)}
              onViewBids={() => handleViewBids(gig)}
              onClose={() => router.push(`/app/gigs-v2/${gig.id}?action=cancel`)}
              onComplete={() => handleMarkComplete(gig.id)}
            />
          )}
          emptyState={{
            icon: Inbox,
            headline: filter === 'all' ? 'No tasks posted yet' : `No ${filter.replace('_', ' ')} tasks`,
            subcopy: filter === 'all' ? 'Post your first task to get started.' : 'Try changing your filter.',
            tone: 'personal',
            ctaLabel: 'Quick post',
            onCtaClick: () => router.push('/app/gigs-v2/new'),
          }}
        />
      </main>

      {/* Bids Modal */}
      {selectedGig && (
        <BidsModal
          gig={selectedGig}
          bids={bids}
          loading={loadingBids}
          error={bidsError}
          onClose={() => {
            setSelectedGig(null);
            setBidsError(null);
          }}
          onAccept={handleAcceptBid}
          onReject={handleRejectBid}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border-2 transition ${
        active ? 'border-primary-600 bg-primary-50' : 'border-app-border bg-app-surface hover:border-app-border'
      }`}
    >
      <p className="text-3xl font-bold text-app-text">{count}</p>
      <p className="text-sm text-app-text-secondary mt-1">{label}</p>
    </button>
  );
}

function GigCardV2({
  gig,
  onView,
  onViewBids,
  onClose,
  onComplete,
}: {
  gig: GigListItem;
  onView: () => void;
  onViewBids: () => void;
  onClose: () => void;
  onComplete: () => void;
}) {
  const engMode = (gig as any).engagement_mode as string | undefined;
  const ec = engMode ? ENGAGEMENT_CONFIG[engMode] : null;
  const isAssignedInstant = engMode === 'instant_accept' && gig.status === 'assigned';

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-6 hover:shadow-md transition shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold text-app-text">{gig.title}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClasses(GIG_STATUS, gig.status)}`}>
              {statusLabel(GIG_STATUS, gig.status)}
            </span>
            {ec && (
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${ec.cls}`}>
                {ec.label}
              </span>
            )}
          </div>
          <p className="text-app-text-secondary mb-2">{gig.description}</p>
          <div className="flex items-center gap-4 text-sm text-app-text-secondary">
            <span>Posted {gig.created_at ? new Date(gig.created_at || gig.createdAt).toLocaleDateString() : ''}</span>
            <span>·</span>
            <span className="font-medium text-green-600">${gig.price || gig.budget_min}</span>
            <span>·</span>
            <span>{gig.category || 'General'}</span>
          </div>
          {gig.bid_count > 0 && (
            <span className="text-sm text-primary-600 font-medium mt-1 inline-block">
              {gig.bid_count} bid{gig.bid_count !== 1 ? 's' : ''}
            </span>
          )}
          {isAssignedInstant && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
              Helper assigned — check ETA
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onView}
          className="px-4 py-2 border border-app-border text-app-text-strong rounded-lg hover:bg-app-hover font-medium"
        >
          View Details
        </button>
        <button
          onClick={onViewBids}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          View Bids {gig.bid_count ? `(${gig.bid_count})` : ''}
        </button>
        {gig.status === 'open' && (
          <button
            onClick={onClose}
            className="px-4 py-2 border border-app-border text-app-text-strong rounded-lg hover:bg-app-hover font-medium"
          >
            Close Gig
          </button>
        )}
        {gig.status === 'in_progress' && (
          <button
            onClick={onComplete}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}

function BidsModal({
  gig,
  bids,
  loading,
  error,
  onClose,
  onAccept,
  onReject,
}: {
  gig: GigListItem;
  bids: GigBidWithUser[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onAccept: (bidId: string) => void;
  onReject: (bidId: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-app-surface rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-app-border flex items-center justify-between">
          <h2 className="text-xl font-semibold text-app-text">
            Bids for &quot;{gig.title}&quot;
          </h2>
          <button onClick={onClose} className="text-app-text-muted hover:text-app-text-secondary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-app-text-secondary">Loading bids...</p>
            </div>
          ) : bids.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-app-text-secondary">No bids yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bids.map((bid) => {
                const bidder = bid.bidder || {};
                const bidderDisplayName = bidder.name || [bidder.first_name, bidder.middle_name, bidder.last_name].filter(Boolean).join(' ') || bidder.username || bid.bidder_username || 'Anonymous';
                const bidderInitial = ((bidder.username || bidderDisplayName)?.[0] || '?').toUpperCase();

                return (
                  <div key={bid.id} className="border border-app-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                          {bidderInitial}
                        </div>
                        <div>
                          <p className="font-semibold text-app-text">{bidderDisplayName}</p>
                          <p className="text-sm text-app-text-secondary">
                            {new Date(bid.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">${bid.amount || bid.bid_amount}</p>
                        <p className={`text-xs px-2 py-1 rounded-full mt-1 font-semibold ${
                          bid.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          bid.status === 'accepted' ? 'bg-teal-50 text-teal-700' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {bid.status?.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    {bid.message && (
                      <p className="text-app-text-strong mb-3 bg-app-surface-raised p-3 rounded-lg">
                        &quot;{bid.message}&quot;
                      </p>
                    )}

                    {bid.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onAccept(bid.id)}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                        >
                          Accept Bid
                        </button>
                        <button
                          onClick={() => onReject(bid.id)}
                          className="flex-1 px-4 py-2 border border-app-border text-app-text-strong rounded-lg hover:bg-app-hover font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-app-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-app-border text-app-text-strong rounded-lg hover:bg-app-hover font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
