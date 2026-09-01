'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

type AnyObj = Record<string, any>;

/** Extended gig API methods not in base type definitions */
interface GigsBidApiExt {
  updateBid?: (gigId: string, bidId: string, data: Record<string, any>) => Promise<unknown>;
  cancelBid?: (gigId: string, bidId: string) => Promise<unknown>;
  deleteBid?: (gigId: string, bidId: string) => Promise<unknown>;
}

interface BidPanelProps {
  gigId: string;
  gigStatus: string;
  gigPrice: number;
  isOwner: boolean;
  currentUserId: string | undefined;
  onBidChange?: () => void;
  onOpenChat: () => void;
}

export default function BidPanel({
  gigId,
  gigStatus,
  gigPrice,
  isOwner,
  currentUserId,
  onBidChange,
  onOpenChat,
}: BidPanelProps) {
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [myBid, setMyBid] = useState<AnyObj | null>(null);
  const [, setLoadingMyBid] = useState(false);

  const isOpen = gigStatus === 'open';
  const canBid = !isOwner && isOpen;
  const hasMyBid = Boolean(myBid?.id);
  const myBidStatus = String(myBid?.status || '');
  const canEditMyBid = canBid && hasMyBid && ['pending', 'countered'].includes(myBidStatus);
  const hasPendingCounter = myBidStatus === 'countered' && myBid?.counter_status === 'pending';

  useEffect(() => {
    if (!currentUserId || isOwner) return;
    void loadMyBid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId, currentUserId, isOwner]);

  const loadMyBid = async () => {
    setLoadingMyBid(true);
    try {
      const resp = await api.gigs.getMyBids({ limit: 200 });
      const bids = (resp as Record<string, any>)?.bids ?? [];
      const mine = (Array.isArray(bids) ? bids : []).find((b: Record<string, any>) => b.gig_id === gigId || b.gigId === gigId);
      setMyBid(mine || null);
      if (mine?.amount != null) setBidAmount(String(mine.amount));
      else if (mine?.bid_amount != null) setBidAmount(String(mine.bid_amount));
      if (mine?.message != null) setBidMessage(String(mine.message));
    } catch (e) {
      console.error('Failed to load my bid for gig:', e);
      setMyBid(null);
    } finally {
      setLoadingMyBid(false);
    }
  };

  const placeBidMutation = useMutation({
    mutationFn: async ({ amount, message }: { amount: number; message: string }) => {
      if (canEditMyBid) {
        if (!myBid?.id) throw new Error('No editable bid found');
        const bidsApi = api.gigs as unknown as GigsBidApiExt;
        if (typeof bidsApi.updateBid === 'function') {
          await bidsApi.updateBid(gigId, String(myBid.id), { amount, message: message || null });
          return;
        }
      }
      await api.gigs.placeBid({ gig_id: gigId, amount, message: message || undefined });
    },
    onMutate: () => setSubmittingBid(true),
    onSuccess: async () => {
      await loadMyBid();
      toast.success(canEditMyBid ? 'Bid updated' : 'Bid submitted');
      onBidChange?.();
    },
    onError: (err: any) => {
      console.error('Failed to submit bid:', err);
      if (
        err?.data?.code === 'payout_onboarding_required' ||
        (err?.message || '').includes('payout onboarding')
      ) {
        toast.warning(
          React.createElement('span', null,
            'To bid on paid gigs, set up payouts first. ',
            React.createElement('a', {
              href: '/app/settings/payments',
              className: 'underline font-semibold hover:opacity-80',
            }, 'Go to Wallet'),
            ' to complete Stripe setup.'
          ),
          8000,
        );
      } else {
        toast.error(err?.message || 'Failed to submit bid. Please try again.');
      }
    },
    onSettled: () => setSubmittingBid(false),
  });

  const handlePlaceOrUpdateBid = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(bidAmount);
    if (!bidAmount || Number.isNaN(amt) || amt <= 0) {
      toast.warning('Please enter a valid bid amount');
      return;
    }
    placeBidMutation.mutate({ amount: amt, message: bidMessage });
  };

  const handleCancelMyBid = async () => {
    if (!myBid?.id) return;

    const confirmed = await confirmStore.open({
      title: 'Cancel your bid?',
      description: 'This will withdraw your bid from this gig.',
      confirmLabel: 'Cancel Bid',
      cancelLabel: 'Keep Bid',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      const bidsApi = api.gigs as unknown as GigsBidApiExt;
      if (typeof bidsApi.cancelBid === 'function') {
        await bidsApi.cancelBid(gigId, String(myBid.id));
      } else if (typeof bidsApi.deleteBid === 'function') {
        await bidsApi.deleteBid(gigId, String(myBid.id));
      } else {
        toast.error('Cancel bid endpoint not implemented yet.');
        return;
      }

      setMyBid(null);
      setBidAmount('');
      setBidMessage('');
      toast.success('Bid cancelled');
      onBidChange?.();
    } catch (e: unknown) {
      console.error('Cancel bid failed:', e);
      toast.error(e instanceof Error ? e.message : 'Failed to cancel bid');
    }
  };

  const handleAcceptCounter = async () => {
    if (!myBid?.id) return;
    try {
      await api.gigs.acceptCounter(gigId, String(myBid.id));
      toast.success('Counter offer accepted!');
      await loadMyBid();
      onBidChange?.();
    } catch (e: unknown) {
      console.error('Accept counter failed:', e);
      toast.error(e instanceof Error ? e.message : 'Failed to accept counter');
    }
  };

  const handleDeclineCounter = async () => {
    if (!myBid?.id) return;
    const confirmed = await confirmStore.open({
      title: 'Decline counter-offer?',
      description: 'Your original bid will remain active.',
      confirmLabel: 'Decline',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await api.gigs.declineCounter(gigId, String(myBid.id));
      toast.success('Counter offer declined');
      await loadMyBid();
      onBidChange?.();
    } catch (e: unknown) {
      console.error('Decline counter failed:', e);
      toast.error(e instanceof Error ? e.message : 'Failed to decline counter');
    }
  };

  // Non-owner, gig not open, not the worker — nothing to show
  if (isOwner) return null;

  // Counter-offer received — show accept/decline first
  if (hasPendingCounter) {
    return (
      <div className="bg-app-surface rounded-xl p-6 border border-purple-200">
        <h3 className="text-lg font-semibold text-app-text mb-1">Your Bid</h3>
        <p className="text-sm text-app-text-secondary mb-2">
          Status: <span className="font-semibold text-purple-700">Countered</span>
        </p>
        <p className="text-2xl font-bold text-app-text mb-2">${myBid.bid_amount ?? myBid.amount}</p>
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-4">
          <p className="text-sm text-purple-700">
            The task owner sent a counter-offer of <strong>${myBid.counter_amount}</strong>.
            {myBid.counter_message && <span className="italic"> — "{myBid.counter_message}"</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDeclineCounter}
            className="flex-1 bg-app-surface border border-app-border text-app-text py-3 rounded-lg hover:bg-app-hover font-medium"
          >
            Decline
          </button>
          <button
            onClick={handleAcceptCounter}
            className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-semibold"
          >
            Accept ${myBid.counter_amount}
          </button>
        </div>
      </div>
    );
  }

  // Existing bid card (editable)
  if (isOpen && hasMyBid && canEditMyBid) {
    return (
      <div className="bg-app-surface rounded-xl p-6 border border-app-border">
        <h3 className="text-lg font-semibold text-app-text mb-1">Your Bid</h3>
        <p className="text-sm text-app-text-secondary mb-4">
          Status: <span className="font-semibold">{String(myBid?.status || 'pending')}</span>
        </p>

        <form onSubmit={handlePlaceOrUpdateBid} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-2">Bid Amount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="w-full px-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-2">Message</label>
            <textarea
              value={bidMessage}
              onChange={(e) => setBidMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancelMyBid}
              className="flex-1 bg-app-surface border border-app-border text-app-text py-3 rounded-lg hover:bg-app-hover font-medium"
            >
              Cancel Bid
            </button>
            <button
              type="submit"
              disabled={submittingBid}
              className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50"
            >
              {submittingBid ? 'Saving...' : 'Update Bid'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Existing bid card (non-editable — accepted, rejected, etc.)
  if (hasMyBid && !canEditMyBid) {
    return (
      <div className="bg-app-surface rounded-xl p-6 border border-app-border">
        <h3 className="text-lg font-semibold text-app-text mb-1">Your Bid</h3>
        <p className="text-sm text-app-text-secondary mb-4">
          Status: <span className="font-semibold capitalize">{myBidStatus || 'pending'}</span>
        </p>
        <div className="flex gap-2">
          {myBidStatus === 'accepted' && (
            <button
              onClick={onOpenChat}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-semibold"
            >
              Open Chat
            </button>
          )}
          <button
            onClick={onBidChange}
            className="flex-1 bg-app-surface-sunken text-app-text py-2 rounded-lg hover:bg-app-hover font-medium"
          >
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  // Place bid form (no existing bid)
  if (isOpen && !hasMyBid) {
    return (
      <div className="bg-app-surface rounded-xl p-6 border border-app-border">
        <h3 className="text-lg font-semibold text-app-text mb-4">Place Your Bid</h3>
        <p className="text-xs text-app-text-secondary mb-3 flex items-center gap-1">
          <MessageCircle className="w-4 h-4 inline-block" /> Have questions? You can <button type="button" onClick={onOpenChat} className="text-primary-600 hover:underline font-medium">send up to 3 messages</button> before bidding.
        </p>
        <form onSubmit={handlePlaceOrUpdateBid} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-2">Bid Amount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder={`Min: $${gigPrice}`}
              className="w-full px-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-2">Message (Optional)</label>
            <textarea
              value={bidMessage}
              onChange={(e) => setBidMessage(e.target.value)}
              rows={3}
              placeholder="Tell them why you're the best choice..."
              className="w-full px-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={submittingBid}
            className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50"
          >
            {submittingBid ? 'Submitting...' : 'Submit Bid'}
          </button>
        </form>
      </div>
    );
  }

  return null;
}
