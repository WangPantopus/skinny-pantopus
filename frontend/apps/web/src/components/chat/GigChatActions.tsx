'use client';

import { useState } from 'react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

const formatUsd = (amount: number): string => `$${amount.toFixed(2)}`;

interface GigChatActionsProps {
  room: any;
  currentUserId: string | undefined;
}

export default function GigChatActions({ room, currentUserId }: GigChatActionsProps) {
  const [adjustingPrice, setAdjustingPrice] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const gigId = room?.gig_id || room?.metadata?.gig_id || room?.metadata?.gigId;
  if (!gigId) return null;

  const gigStatus = room?.gig_status || room?.metadata?.gig_status;
  if (gigStatus === 'completed' || gigStatus === 'cancelled') return null;

  const isOwner = room?.gig_poster_id === currentUserId || room?.metadata?.gig_poster_id === currentUserId;

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      const bidsRes = await api.gigs.getGigBids(gigId);
      const bids = (bidsRes as any)?.bids || [];
      const pending = bids.find((b: any) => b.status === 'pending');
      if (!pending) { toast.info('No pending bids to accept.'); return; }

      const rawAmount = Number(pending?.amount ?? pending?.bid_amount ?? room?.gig_price ?? NaN);
      const amount = Number.isFinite(rawAmount) ? rawAmount : null;

      const proceed = await confirmStore.open(
        amount != null && amount > 0
          ? { title: 'Authorize payment method?', description: `Pantopus will place a temporary authorization hold of ${formatUsd(amount)}. You are charged only after you confirm the task is completed.`, confirmLabel: 'Continue to Payment', cancelLabel: 'Not now', variant: 'primary' }
          : { title: 'Accept this bid?', description: 'This will assign the gig to this bidder.', confirmLabel: 'Accept', variant: 'primary' },
      );
      if (!proceed) return;

      await api.gigs.acceptBid(gigId, pending.id);
      toast.success('Bid accepted!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept bid');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustPrice = async () => {
    if (!newPrice.trim()) return;
    setSubmitting(true);
    try {
      const bidsRes = await api.gigs.getGigBids(gigId);
      const bids = (bidsRes as any)?.bids || [];
      const pending = bids.find((b: any) => b.status === 'pending');
      if (pending) {
        await api.gigs.counterBid(gigId, pending.id, { amount: Number(newPrice) });
        toast.success('Counter offer sent');
      }
      setAdjustingPrice(false);
      setNewPrice('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to adjust price');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-3 py-2 bg-app-surface-sunken border-t border-app-border">
      {adjustingPrice ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="New price"
            className="flex-1 px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button onClick={handleAdjustPrice} disabled={submitting}
            className="px-3.5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition">
            Send
          </button>
          <button onClick={() => setAdjustingPrice(false)} className="text-sm text-app-text-secondary hover:text-app-text">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {isOwner && (
            <button onClick={handleAccept} disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
              Accept
            </button>
          )}
          <button onClick={() => setAdjustingPrice(true)}
            className="px-4 py-2 border border-emerald-500 text-emerald-600 text-sm font-semibold rounded-lg hover:bg-emerald-50 transition">
            Adjust Price
          </button>
        </div>
      )}
    </div>
  );
}
