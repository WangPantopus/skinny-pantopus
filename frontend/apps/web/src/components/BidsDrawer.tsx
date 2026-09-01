// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import { confirmStore } from '@/components/ui/confirm-store';

const formatUsd = (amount: number): string => `$${amount.toFixed(2)}`;

export default function BidsDrawer({
  open,
  onClose,
  gig,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  gig: { id: string; title: string; price: number | null; status: string } | null;
  onChanged: () => void;
}) {
  const [bids, setBids] = useState<api.bids.GigBid[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    if (!gig) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.bids.listBidsForGig(gig.id);
      setBids(res.bids || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gig?.id]);

  if (!open || !gig) return null;

  const accept = async (bidId: string) => {
    const selectedBid = bids.find((b) => String(b?.id) === String(bidId));
    const rawAmount = Number((selectedBid as Record<string, any> | undefined)?.amount ?? gig.price ?? NaN);
    const amount = Number.isFinite(rawAmount) ? rawAmount : null;
    const confirmed = await confirmStore.open({
      title: amount != null && amount > 0 ? 'Authorize payment method?' : 'Accept this bid?',
      description:
        amount != null && amount > 0
          ? `Pantopus will place a temporary authorization hold of ${formatUsd(amount)}. You are charged only after you confirm the task is completed. If canceled per policy, the hold is released (or only applicable fees apply).`
          : 'This will assign the gig to this bidder.',
      confirmLabel: amount != null && amount > 0 ? 'Continue to Payment' : 'Accept',
      cancelLabel: amount != null && amount > 0 ? 'Not now' : 'Cancel',
      variant: 'primary',
    });
    if (!confirmed) return;

    setBusyId(bidId);
    setError('');
    try {
      const resp = await api.gigs.acceptBid(gig.id, bidId) as Record<string, any>;
      await load();
      onChanged();

      const payment = (resp?.payment as Record<string, any>) || null;
      const clientSecret = (resp?.clientSecret as string) || (payment?.clientSecret as string) || null;
      const setupIntentId = (resp?.setupIntentId as string) || (payment?.setupIntentId as string) || null;
      const roomId = (resp?.roomId as string) || null;
      const isSetupIntent = Boolean(resp?.isSetupIntent ?? setupIntentId);
      const requiresPaymentSetup = Boolean(resp?.requiresPaymentSetup || clientSecret);

      if (requiresPaymentSetup && clientSecret) {
        window.sessionStorage.setItem(
          `gig_payment_setup_${gig.id}`,
          JSON.stringify({
            clientSecret,
            isSetupIntent,
            roomId,
            createdAt: Date.now(),
          })
        );
        onClose();
        window.location.href = `/app/gigs/${gig.id}?action=payment_setup`;
        return;
      }

      if (roomId) {
        onClose();
        window.location.href = `/app/chat/${roomId}`;
      }
    } catch (e: unknown) {
      const apiErr = e as any;
      if (apiErr?.data?.code === 'payer_payment_required') {
        setError('Add a payment method to accept this bid');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to accept offer');
      }
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (bidId: string) => {
    setBusyId(bidId);
    setError('');
    try {
      await api.gigs.rejectBid(gig.id, bidId);
      await load();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reject offer');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-app-surface border-l border-app-border shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-app-border-subtle flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-app-text">Offers</h2>
            <p className="text-sm text-app-text-secondary mt-1">for “{gig.title}”</p>
            <p className="text-xs text-app-text-secondary mt-1">
              {gig.price != null ? `$${gig.price} asked` : 'No asking price'} • Status: {gig.status}
            </p>
          </div>
          <button className="text-app-text-secondary hover:text-app-text" onClick={onClose}>✕</button>
        </div>

        <div className="px-5 py-3 text-sm text-app-text-secondary">
          {loading ? 'Loading…' : `${bids.length} offer(s)`}
        </div>

        {error ? (
          <div className="mx-5 mb-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex-1 overflow-auto px-5 pb-6 space-y-3">
          {bids.map((b) => {
            const isBusy = busyId === b.id;

            const badge =
              b.status === 'accepted' ? 'Accepted' :
              b.status === 'pending' ? 'Pending' :
              b.status === 'rejected' ? 'Not selected' :
              b.status;

            const badgeClass =
              b.status === 'accepted' ? 'bg-green-100 text-green-700' :
              b.status === 'pending' ? 'bg-app-surface-sunken text-app-text-strong' :
              'bg-app-surface-raised text-app-text-secondary';

            return (
              <div key={b.id} className="rounded-2xl border border-app-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-app-text">
                      ${b.bid_amount}{' '}
                      <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                        {badge}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-app-text-strong whitespace-pre-wrap">{b.message}</div>
                    {b.proposed_timeline ? (
                      <div className="mt-2 text-xs text-app-text-secondary">
                        <span className="font-semibold">When:</span> {b.proposed_timeline}
                      </div>
                    ) : null}
                  </div>
                </div>

                {b.status === 'pending' ? (
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      className="rounded-xl px-3 py-2 text-sm font-medium border border-app-border text-app-text hover:bg-app-hover"
                      disabled={isBusy}
                      onClick={() => reject(b.id)}
                    >
                      {isBusy ? 'Working…' : 'Reject'}
                    </button>
                    <button
                      className="rounded-xl px-3 py-2 text-sm font-semibold bg-gray-900 text-white hover:bg-black disabled:bg-gray-300"
                      disabled={isBusy}
                      onClick={() => accept(b.id)}
                    >
                      {isBusy ? 'Working…' : 'Accept'}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          {!loading && bids.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-app-border p-6 text-center text-sm text-app-text-secondary">
              No offers yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
