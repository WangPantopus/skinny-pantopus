// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import {
  CalendarDays, DollarSign, Frown, MessageCircle, Clock, CheckCircle,
  XCircle, Ban, Hourglass, Handshake, Bell, PartyPopper, Rocket,
  CheckSquare, Mailbox,
} from 'lucide-react';
import SearchInput from '@/components/SearchInput';
import { BID_STATUS, statusClasses } from '@/components/statusColors';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import { ListArchetype } from '@/components/archetypes';
import { ProBadge } from '@/components/ProBadge';
import type { GigBidWithUser } from '@pantopus/types';

type FilterStatus = 'all' | 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn' | 'expired';

const WITHDRAW_REASONS = [
  { value: 'schedule_conflict', label: 'Schedule conflict', icon: CalendarDays },
  { value: 'underpriced', label: 'Underpriced my bid', icon: DollarSign },
  { value: 'mistake', label: 'Made a mistake', icon: Frown },
  { value: 'other', label: 'Other reason', icon: MessageCircle },
];

export default function MyBidsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [withdrawModal, setWithdrawModal] = useState<{ gigId: string; bidId: string } | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!getAuthToken()) router.push('/login');
  }, [router]);

  const bidsQuery = useQuery<GigBidWithUser[]>({
    queryKey: queryKeys.myBids(),
    queryFn: async () => {
      const response = await api.gigs.getMyBids({ limit: 200 });
      const resObj = response as Record<string, any>;
      return (resObj?.bids || resObj?.data || []) as GigBidWithUser[];
    },
    staleTime: 30_000,
  });

  const bids = bidsQuery.data ?? [];
  const loading = bidsQuery.isPending;
  const fetchError = bidsQuery.error ? 'Failed to load your bids. Please try again.' : null;

  // Shim so mutation handlers keep their imperative refetch behavior
  const loadBids = () => { void bidsQuery.refetch(); };

  const handleViewGig = (gigId: string) => router.push(`/app/gigs/${gigId}`);

  const openWithdrawModal = (gigId: string, bidId: string) => {
    setWithdrawReason('');
    setWithdrawModal({ gigId, bidId });
  };

  const handleWithdrawBid = async () => {
    if (!withdrawModal) return;
    setWithdrawing(true);
    try {
      await api.gigs.withdrawBid(withdrawModal.gigId, withdrawModal.bidId, withdrawReason || undefined);
      setWithdrawModal(null);
      loadBids();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to withdraw bid');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleAcceptCounter = async (gigId: string, bidId: string) => {
    const yes = await confirmStore.open({ title: 'Accept this counter-offer?', description: 'Your bid amount will be updated to match the counter-offer.', confirmLabel: 'Accept', variant: 'primary' });
    if (!yes) return;
    try {
      await api.gigs.acceptCounter(gigId, bidId);
      loadBids();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept counter-offer');
    }
  };

  const handleDeclineCounter = async (gigId: string, bidId: string) => {
    const yes = await confirmStore.open({ title: 'Decline this counter-offer?', description: 'Your original bid will remain active.', confirmLabel: 'Decline', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.gigs.declineCounter(gigId, bidId);
      loadBids();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to decline counter-offer');
    }
  };

  const handleStartWork = async (gigId: string) => {
    const yes = await confirmStore.open({ title: 'Start working on this gig?', description: 'The gig owner will be notified that you have started.', confirmLabel: 'Start', variant: 'primary' });
    if (!yes) return;
    try {
      await api.gigs.startGig(gigId);
      loadBids();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start gig');
    }
  };

  const handleMarkCompleted = async (gigId: string) => {
    const yes = await confirmStore.open({ title: 'Mark this gig as completed?', description: 'This will notify the gig owner for confirmation.', confirmLabel: 'Complete', variant: 'primary' });
    if (!yes) return;
    try {
      await api.gigs.markGigCompleted(gigId);
      loadBids();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark gig completed');
    }
  };

  const filteredBids = bids.filter(bid => {
    if (filter !== 'all' && bid.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const gig = bid.gig || {};
      const title = (gig.title || bid.gig_title || '').toLowerCase();
      const desc = (gig.description || '').toLowerCase();
      if (!title.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });

  const stats = {
    all: bids.length,
    pending: bids.filter(b => b.status === 'pending').length,
    accepted: bids.filter(b => b.status === 'accepted').length,
    rejected: bids.filter(b => b.status === 'rejected').length,
    countered: bids.filter(b => b.status === 'countered').length,
    withdrawn: bids.filter(b => b.status === 'withdrawn').length,
    expired: bids.filter(b => b.status === 'expired').length,
  };

  const totalEarnings = bids
    .filter(b => b.status === 'accepted')
    .reduce((sum, b) => {
      const amt = Number(b.amount ?? b.bid_amount ?? 0);
      return sum + (Number.isFinite(amt) ? amt : 0);
    }, 0);

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ListArchetype<GigBidWithUser>
          title={<span className="inline-flex items-center gap-2">My bids<ProBadge /></span>}
          subtitle={`${stats.pending} pending${stats.countered ? ` · ${stats.countered} countered` : ''} · $${totalEarnings} potential earnings`}
          primaryAction={{ label: 'Browse tasks', onClick: () => router.push('/app/gigs') }}
          headerFilters={
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search your bids…"
              className="max-w-sm"
            />
          }
          renderHeader={() => (
            <>
              {fetchError && <ErrorState message={fetchError} onRetry={() => loadBids()} />}

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <SummaryCard label="Total bids" value={stats.all} tone="neutral" />
                <SummaryCard label="Pending" value={stats.pending} tone="warning" />
                <SummaryCard label="Accepted" value={stats.accepted} tone="info" />
                <SummaryCard label="Potential earnings" value={`$${totalEarnings}`} tone="success" />
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-3">
                <StatPill label="All" count={stats.all} active={filter === 'all'} onClick={() => setFilter('all')} />
                <StatPill label="Pending" count={stats.pending} active={filter === 'pending'} onClick={() => setFilter('pending')} color="amber" />
                <StatPill label="Countered" count={stats.countered} active={filter === 'countered'} onClick={() => setFilter('countered')} color="purple" />
                <StatPill label="Accepted" count={stats.accepted} active={filter === 'accepted'} onClick={() => setFilter('accepted')} color="teal" />
                <StatPill label="Rejected" count={stats.rejected} active={filter === 'rejected'} onClick={() => setFilter('rejected')} color="red" />
                <StatPill label="Withdrawn" count={stats.withdrawn} active={filter === 'withdrawn'} onClick={() => setFilter('withdrawn')} color="gray" />
                <StatPill label="Expired" count={stats.expired} active={filter === 'expired'} onClick={() => setFilter('expired')} color="gray" />
              </div>
            </>
          )}
          loading={loading}
          loadingSlot={<LoadingSkeleton variant="gig-card" count={3} />}
          rows={filteredBids}
          rowSpacing={4}
          keyExtractor={(bid) => bid.id}
          renderRow={(bid) => (
            <BidCard
              bid={bid}
              onViewGig={() => handleViewGig(bid.gig_id || bid.gig?.id)}
              onWithdraw={() => openWithdrawModal(bid.gig_id || bid.gig?.id, bid.id)}
              onAcceptCounter={() => handleAcceptCounter(bid.gig_id || bid.gig?.id, bid.id)}
              onDeclineCounter={() => handleDeclineCounter(bid.gig_id || bid.gig?.id, bid.id)}
              onStartWork={() => handleStartWork(bid.gig_id || bid.gig?.id)}
              onMarkCompleted={() => handleMarkCompleted(bid.gig_id || bid.gig?.id)}
            />
          )}
          emptyState={{
            icon: Mailbox,
            headline: filter === 'all' ? 'No bids placed yet' : `No ${filter} bids`,
            subcopy: 'Browse tasks and place your first bid.',
            tone: 'personal',
            ctaLabel: 'Browse tasks',
            onCtaClick: () => router.push('/app/gigs'),
          }}
        />
      </main>

      {/* Withdraw modal */}
      {withdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setWithdrawModal(null)}>
          <div
            className="bg-app-surface rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-app-border-subtle">
              <h3 className="text-lg font-semibold text-app-text">Withdraw Bid</h3>
              <p className="text-sm text-app-text-secondary mt-1">What happened? This helps us improve the experience.</p>
            </div>

            <div className="px-6 py-4 space-y-2">
              {WITHDRAW_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setWithdrawReason(r.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition text-left ${
                    withdrawReason === r.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-app-border hover:border-app-border'
                  }`}
                >
                  <r.icon className="w-5 h-5" />
                  <span className="font-medium text-app-text">{r.label}</span>
                </button>
              ))}
            </div>

            <div className="px-6 py-4 bg-amber-50 border-t border-amber-100">
              <p className="text-sm text-amber-800">
                After withdrawing, you can re-bid after a 5-minute cooldown.
              </p>
            </div>

            <div className="px-6 py-4 flex gap-3 justify-end border-t border-app-border-subtle">
              <button
                onClick={() => setWithdrawModal(null)}
                className="px-4 py-2 text-app-text-strong hover:bg-app-hover rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawBid}
                disabled={withdrawing}
                className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
              >
                {withdrawing ? 'Withdrawing…' : 'Withdraw Bid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Summary Card ─── */
function SummaryCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'warning' | 'info' | 'success';
}) {
  const toneCls: Record<string, string> = {
    neutral: 'border-app-border text-app-text',
    warning: 'border-app-warning-light text-app-warning',
    info: 'border-app-info-light text-app-info',
    success: 'border-app-success-light text-app-success',
  };
  return (
    <div className={`bg-app-surface rounded-xl border ${toneCls[tone]} p-4`}>
      <p className="text-sm text-app-text-secondary">{label}</p>
      <p className={`text-2xl font-bold ${tone === 'neutral' ? 'text-app-text' : ''}`}>
        {value}
      </p>
    </div>
  );
}

/* ─── Stat Pill ─── */
function StatPill({
  label, count, active, onClick, color = 'gray',
}: {
  label: string; count: number; active: boolean; onClick: () => void; color?: string;
}) {
  if (count === 0 && !active && label !== 'All') return null;

  const colorMap: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-700',
    teal: 'bg-teal-100 text-teal-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-app-surface-sunken text-app-text-secondary',
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
        active
          ? 'bg-gray-900 text-white shadow-sm'
          : 'bg-app-surface border border-app-border text-app-text-strong hover:border-app-border'
      }`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${active ? 'bg-glass/20 text-white' : colorMap[color] || colorMap.gray}`}>
        {count}
      </span>
    </button>
  );
}

/* ─── Expiry Countdown ─── */
function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (h > 24) {
        setTimeLeft(`${Math.floor(h / 24)}d ${h % 24}h`);
      } else if (h > 0) {
        setTimeLeft(`${h}h ${m}m`);
      } else {
        setTimeLeft(`${m}m`);
      }
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!timeLeft) return null;

  const isUrgent = new Date(expiresAt).getTime() - Date.now() < 3600000; // < 1h

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isUrgent ? 'text-red-600' : 'text-app-text-secondary'}`}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {timeLeft === 'Expired' ? 'Expired' : `Expires in ${timeLeft}`}
    </span>
  );
}

/* ─── Bid Card ─── */
function BidCard({
  bid, onViewGig, onWithdraw, onAcceptCounter, onDeclineCounter, onStartWork, onMarkCompleted,
}: {
  bid: GigBidWithUser;
  onViewGig: () => void;
  onWithdraw: () => void;
  onAcceptCounter: () => void;
  onDeclineCounter: () => void;
  onStartWork: () => void;
  onMarkCompleted: () => void;
}) {
  const StatusIcon = ({ status }: { status: string }) => {
    const icons: Record<string, typeof Clock> = {
      pending: Clock, accepted: CheckCircle, rejected: XCircle, withdrawn: Ban,
      expired: Hourglass, countered: Handshake,
    };
    const Icon = icons[status] || Bell;
    return <Icon className="w-3.5 h-3.5" />;
  };

  const gig = bid.gig || {};
  const gigTitle = gig.title || bid.gig_title || 'Untitled Gig';
  const gigStatus = gig.status || '';

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-6 hover:shadow-md transition shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-semibold text-app-text">{gigTitle}</h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${statusClasses(BID_STATUS, bid.status)}`}>
              <StatusIcon status={bid.status} />
              <span>{(bid.status || 'pending').toUpperCase()}</span>
            </span>
          </div>

          {gig.description && (
            <p className="text-app-text-secondary text-sm mb-2 line-clamp-2">{gig.description}</p>
          )}

          {bid.message && (
            <div className="bg-app-surface-raised p-2.5 rounded-lg mb-2">
              <p className="text-sm text-app-text-strong">Your message: &ldquo;{bid.message}&rdquo;</p>
            </div>
          )}

          <div className="flex items-center flex-wrap gap-3 text-sm text-app-text-secondary">
            <span>Bid {timeAgo(bid.created_at || bid.createdAt)}</span>
            <span className="text-gray-300">•</span>
            <span className="font-semibold text-green-600 text-base">${bid.amount || bid.bid_amount}</span>
            {bid.proposed_time && (
              <>
                <span className="text-gray-300">•</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {bid.proposed_time}</span>
              </>
            )}
            {bid.expires_at && bid.status === 'pending' && (
              <>
                <span className="text-gray-300">•</span>
                <ExpiryCountdown expiresAt={bid.expires_at} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status-specific messages */}
      {bid.status === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-amber-800 inline-flex items-center gap-1"><Clock className="w-4 h-4" /> Waiting for poster to review your bid</p>
        </div>
      )}

      {bid.status === 'countered' && bid.counter_status === 'pending' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-3">
          <div className="flex items-start gap-3">
            <Handshake className="w-6 h-6 text-purple-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-purple-900 mb-1">Counter-offer received!</p>
              <p className="text-sm text-purple-800 mb-2">
                The poster countered your <span className="font-medium">${bid.bid_amount}</span> bid with{' '}
                <span className="font-bold text-purple-900">${bid.counter_amount}</span>
              </p>
              {bid.counter_message && (
                <p className="text-sm text-purple-700 italic mb-3">&ldquo;{bid.counter_message}&rdquo;</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={onAcceptCounter}
                  className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  Accept ${bid.counter_amount}
                </button>
                <button
                  onClick={onDeclineCounter}
                  className="px-4 py-1.5 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-100 text-sm font-medium"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bid.status === 'accepted' && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-teal-800">
            <PartyPopper className="w-4 h-4 inline-block" /> Congratulations! Your bid was accepted.
            {gigStatus === 'assigned' && ' Click "Start Work" when you\'re ready!'}
            {gigStatus === 'in_progress' && ' Mark as complete when you\'re done.'}
          </p>
        </div>
      )}

      {bid.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-red-800 inline-flex items-center gap-1"><XCircle className="w-4 h-4" /> Your bid was not accepted. Keep trying on other gigs!</p>
        </div>
      )}

      {bid.status === 'withdrawn' && (
        <div className="bg-app-surface-raised border border-app-border rounded-lg p-3 mb-3">
          <p className="text-sm text-app-text-secondary">
            <Ban className="w-4 h-4 inline-block" /> You withdrew this bid{bid.withdrawal_reason ? ` (${bid.withdrawal_reason.replace('_', ' ')})` : ''}.
          </p>
        </div>
      )}

      {bid.status === 'expired' && (
        <div className="bg-app-surface-raised border border-app-border rounded-lg p-3 mb-3">
          <p className="text-sm text-app-text-secondary inline-flex items-center gap-1"><Hourglass className="w-4 h-4" /> This bid expired. You can place a new bid if the gig is still open.</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onViewGig}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
        >
          View Gig
        </button>

        {(bid.status === 'pending' || bid.status === 'countered') && (
          <button
            onClick={onWithdraw}
            className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium text-sm"
          >
            Withdraw Bid
          </button>
        )}

        {bid.status === 'accepted' && gigStatus === 'assigned' && (
          <button
            onClick={onStartWork}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            <Rocket className="w-4 h-4" /> Start Work
          </button>
        )}

        {bid.status === 'accepted' && gigStatus === 'in_progress' && (
          <button
            onClick={onMarkCompleted}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
          >
            <CheckSquare className="w-4 h-4" /> Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}
