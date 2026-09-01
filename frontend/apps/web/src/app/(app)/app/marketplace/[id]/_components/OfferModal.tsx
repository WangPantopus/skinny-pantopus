'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import * as api from '@pantopus/api';
import type { ListingOffer } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

interface OfferModalProps {
  listing: {
    id: string;
    title: string;
    price?: number | null;
    is_free?: boolean;
    media_urls?: string[];
  };
  existingOffer: ListingOffer | null;
  onOfferSent: (offer: any) => void;
  onClose: () => void;
}

export default function OfferModal({ listing, existingOffer, onOfferSent, onClose }: OfferModalProps) {
  const isFree = listing.is_free === true;
  const askingPrice = listing.price ?? 0;

  const [amount, setAmount] = useState(askingPrice > 0 ? String(askingPrice) : '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [counterActing, setCounterActing] = useState(false);

  const handleAmountChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
  }, []);

  const applyQuickFill = useCallback((multiplier: number) => {
    if (askingPrice > 0) {
      const val = Math.round(askingPrice * multiplier * 100) / 100;
      setAmount(String(val));
    }
  }, [askingPrice]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const offerAmount = isFree ? null : (amount ? parseFloat(amount) : null);
      const { offer } = await api.listings.createOffer(listing.id, {
        amount: offerAmount,
        message: message.trim() || undefined,
      });
      onOfferSent(offer);
      onClose();
      toast.success(isFree ? 'Interest sent!' : 'Offer sent!');
    } catch (err: any) {
      toast.error(err?.message || 'Could not send your offer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [listing.id, amount, message, isFree, onOfferSent, onClose]);

  const handleAcceptCounter = useCallback(async () => {
    if (!existingOffer) return;
    setCounterActing(true);
    try {
      const { offer } = await api.listings.acceptOffer(listing.id, existingOffer.id);
      onOfferSent(offer);
      onClose();
      toast.success('Counter offer accepted!');
    } catch (err: any) {
      toast.error(err?.message || 'Could not accept counter offer.');
    } finally {
      setCounterActing(false);
    }
  }, [existingOffer, listing.id, onOfferSent, onClose]);

  const handleDeclineCounter = useCallback(async () => {
    if (!existingOffer) return;
    setCounterActing(true);
    try {
      await api.listings.withdrawOffer(listing.id, existingOffer.id);
      onClose();
      toast.success('Counter offer declined.');
    } catch (err: any) {
      toast.error(err?.message || 'Could not decline counter offer.');
    } finally {
      setCounterActing(false);
    }
  }, [existingOffer, listing.id, onClose]);

  const isCountered = existingOffer?.status === 'countered';
  const canSubmit = isFree || (amount && parseFloat(amount) > 0);
  const thumbnailUri = listing.media_urls?.[0];

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-app-surface rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
          <h3 className="text-lg font-semibold text-app-text">
            {isFree ? "I'm Interested" : 'Make an Offer'}
          </h3>
          <button onClick={onClose} className="text-app-text-muted hover:text-app-text-secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Listing preview */}
        <div className="flex items-center gap-3 px-6 py-4 bg-app-surface-sunken border-b border-app-border">
          {thumbnailUri ? (
            <Image src={thumbnailUri} alt="" width={60} height={60} sizes="60px" quality={75} className="w-[60px] h-[60px] rounded-lg object-cover" />
          ) : (
            <div className="w-[60px] h-[60px] rounded-lg bg-app-surface flex items-center justify-center text-2xl">
              📦
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-app-text truncate">{listing.title}</p>
            <p className="text-sm text-app-text-secondary">
              {isFree ? 'Free' : askingPrice > 0 ? `$${askingPrice}` : 'No price set'}
            </p>
          </div>
        </div>

        {/* Counter offer section */}
        {isCountered && existingOffer && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm text-app-text-secondary">Seller countered with</p>
            <p className="text-2xl font-bold text-app-text mt-1">${existingOffer.counter_amount}</p>
            {existingOffer.counter_message && (
              <p className="text-sm text-app-text-secondary italic mt-2">&ldquo;{existingOffer.counter_message}&rdquo;</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleAcceptCounter}
                disabled={counterActing}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-semibold text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                {counterActing ? 'Accepting...' : 'Accept'}
              </button>
              <button
                onClick={handleDeclineCounter}
                disabled={counterActing}
                className="flex-1 px-4 py-2.5 bg-app-surface border border-app-border text-app-text-strong rounded-lg font-semibold text-sm hover:bg-app-hover disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Amount input (non-free, non-countered) */}
        {!isFree && !isCountered && (
          <div className="px-6 pt-5">
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-app-text">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="flex-1 text-2xl font-bold text-app-text bg-transparent border-none outline-none placeholder:text-app-text-muted"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => applyQuickFill(1)} className="px-3 py-1.5 rounded-full bg-app-surface-sunken text-xs font-semibold text-app-text-secondary hover:bg-app-hover">
                Full Price
              </button>
              <button onClick={() => applyQuickFill(0.9)} className="px-3 py-1.5 rounded-full bg-app-surface-sunken text-xs font-semibold text-app-text-secondary hover:bg-app-hover">
                −10%
              </button>
              <button onClick={() => applyQuickFill(0.8)} className="px-3 py-1.5 rounded-full bg-app-surface-sunken text-xs font-semibold text-app-text-secondary hover:bg-app-hover">
                −20%
              </button>
            </div>
          </div>
        )}

        {/* Free items label */}
        {isFree && !isCountered && (
          <div className="px-6 pt-5">
            <p className="text-sm text-app-text-secondary">Express your interest in this item</p>
          </div>
        )}

        {/* Message input */}
        {!isCountered && (
          <div className="px-6 pt-4">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add a note (optional)"
              maxLength={500}
              rows={3}
              className="w-full border border-app-border rounded-lg p-3 text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none placeholder:text-app-text-muted"
            />
          </div>
        )}

        {/* Submit button */}
        {!isCountered && (
          <div className="px-6 py-5">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full px-4 py-3 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? 'Sending...' : isFree ? "I'm Interested" : 'Send Offer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
