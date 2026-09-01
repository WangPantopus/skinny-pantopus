'use client';

import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';

export default function BidModal({
  open,
  onClose,
  gig,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  gig: { id: string; title: string; price: number | null } | null;
  onCreated: () => void;
}) {
  const [bidAmount, setBidAmount] = useState('');
  const [message, setMessage] = useState('');
  const [proposedTime, setProposedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && gig) {
      setBidAmount(gig.price != null ? String(gig.price) : '');
      setMessage('');
      setProposedTime('');
      setError('');
      setLoading(false);
    }
  }, [open, gig]);

  if (!open || !gig) return null;

  const amountNum = Number(bidAmount);
  const canSubmit =
    !loading &&
    bidAmount.trim().length > 0 &&
    !Number.isNaN(amountNum) &&
    amountNum > 0 &&
    message.trim().length >= 10;

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await api.bids.createBid(gig.id, {
        bid_amount: amountNum,
        message: message.trim(),
        proposed_time: proposedTime.trim() ? proposedTime.trim() : null,
      });
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send offer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose()} />
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-app-surface border border-app-border shadow-xl">
        <div className="px-5 py-4 border-b border-app-border-subtle flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-app-text">Make an Offer</h2>
            <p className="text-sm text-app-text-secondary mt-1">Helping with: {gig.title}</p>
          </div>
          <button className="text-app-text-secondary hover:text-app-text" onClick={() => !loading && onClose()}>
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-text">Your offer</label>
            <div className="mt-2 flex items-center rounded-xl border border-app-border px-3 py-2">
              <span className="text-app-text-secondary">$</span>
              <input
                className="ml-2 w-full outline-none text-app-text"
                inputMode="decimal"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={gig.price != null ? String(gig.price) : 'Enter amount'}
              />
            </div>
            {gig.price != null && amountNum > 0 && amountNum !== gig.price ? (
              <p className="mt-2 text-xs text-app-text-secondary">
                The poster asked for <span className="font-semibold">${gig.price}</span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-app-text-secondary">You won’t be charged yet.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text">Message</label>
            <textarea
              className="mt-2 w-full min-h-[110px] rounded-xl border border-app-border px-3 py-2 outline-none"
              placeholder="Hey! I can do this today. I’ve done similar tasks and can be there at 4pm."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="mt-1 text-xs text-app-text-secondary">Min 10 characters.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text">When can you do this? (optional)</label>
            <input
              className="mt-2 w-full rounded-xl border border-app-border px-3 py-2 outline-none"
              placeholder="Today after 3pm"
              value={proposedTime}
              onChange={(e) => setProposedTime(e.target.value)}
            />
          </div>

          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-app-border-subtle flex justify-end gap-3">
          <button
            className="rounded-xl px-4 py-2 text-sm font-medium border border-app-border text-app-text hover:bg-app-hover"
            onClick={() => !loading && onClose()}
          >
            Cancel
          </button>
          <button
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
              canSubmit ? 'bg-gray-900 hover:bg-black' : 'bg-gray-300 cursor-not-allowed'
            }`}
            disabled={!canSubmit}
            onClick={submit}
          >
            {loading ? 'Sending…' : 'Send Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}
