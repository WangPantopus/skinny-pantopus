'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Check, Package } from 'lucide-react';
import Image from 'next/image';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

type TradeModalProps = {
  open: boolean;
  onClose: () => void;
  listing: any;
  onTradeProposed: () => void;
};

export default function TradeModal({ open, onClose, listing, onTradeProposed }: TradeModalProps) {
  const [myListings, setMyListings] = useState<any[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cashSupplement, setCashSupplement] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingListings(true);
    setSelectedIds(new Set());
    setCashSupplement('');
    setMessage('');
    api.listings.getMyListings({ status: 'active' as any })
      .then((result) => setMyListings(result?.listings || []))
      .catch(() => setMyListings([]))
      .finally(() => setLoadingListings(false));
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    try {
      const cash = cashSupplement ? parseFloat(cashSupplement) : undefined;
      await api.listings.proposeTrade(listing.id, {
        offeredListingIds: [...selectedIds],
        message: message.trim() || undefined,
        cashSupplement: cash && cash > 0 ? cash : undefined,
      });
      toast.success('Trade proposal sent!');
      onTradeProposed();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Could not send your trade proposal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [listing.id, selectedIds, message, cashSupplement, onTradeProposed, onClose]);

  if (!open) return null;

  const thumbnailUrl = listing.media_urls?.[0] || listing.image_url;
  const askingPrice = listing.price ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-app-surface rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-center px-4 py-3.5 border-b border-app-border relative">
          <h2 className="text-base font-semibold text-app-text">Propose a Trade</h2>
          <button onClick={onClose} className="absolute right-4 top-3.5 p-1 text-app-text-secondary hover:text-app-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target listing preview */}
        <div className="flex items-center gap-3 px-4 py-3 bg-app-surface-sunken border-b border-app-border">
          {thumbnailUrl ? (
            <Image src={thumbnailUrl} alt={listing.title} width={60} height={60} sizes="60px" quality={75} className="w-14 h-14 rounded-lg object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-app-surface flex items-center justify-center">
              <Package className="w-6 h-6 text-app-text-muted" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-app-text truncate">{listing.title}</p>
            <p className="text-sm text-app-text-secondary">
              {listing.is_free ? 'Free' : askingPrice > 0 ? `$${askingPrice}` : 'No price set'}
            </p>
          </div>
        </div>

        {/* Divider label */}
        <div className="px-4 pt-3 pb-2">
          <p className="text-sm font-semibold text-app-text-secondary">Your items to offer:</p>
        </div>

        {/* User's listings */}
        <div className="flex-1 overflow-y-auto px-4 min-h-0">
          {loadingListings ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full" />
            </div>
          ) : myListings.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-app-text-muted">You have no active listings to offer.</p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {myListings.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const itemThumb = item.media_urls?.[0] || item.image_url;
                return (
                  <button key={item.id} type="button" onClick={() => toggleSelect(item.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                      isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-app-border bg-app-surface hover:bg-app-hover'
                    }`}>
                    {itemThumb ? (
                      <Image src={itemThumb} alt={item.title} width={48} height={48} sizes="48px" quality={75} className="w-12 h-12 rounded-md object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-app-surface-sunken flex items-center justify-center">
                        <Package className="w-5 h-5 text-app-text-muted" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-app-text truncate">{item.title}</p>
                      <p className="text-xs text-app-text-secondary">{item.is_free ? 'Free' : item.price != null ? `$${item.price}` : ''}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-app-border'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cash supplement + message + submit */}
        <div className="border-t border-app-border px-4 py-3 space-y-3">
          {/* Cash */}
          <div>
            <p className="text-xs text-app-text-secondary mb-1.5">Add cash to sweeten the deal (optional)</p>
            <div className="flex items-center gap-1 max-w-[160px]">
              <span className="text-base font-bold text-app-text">$</span>
              <input type="text" inputMode="decimal" value={cashSupplement}
                onChange={(e) => setCashSupplement(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                className="flex-1 px-2 py-1.5 rounded-lg bg-app-surface-sunken text-base font-semibold text-app-text placeholder:text-app-text-muted outline-none" />
            </div>
          </div>

          {/* Message */}
          <textarea value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a note (optional)" maxLength={500} rows={2}
            className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />

          {/* Submit */}
          <button onClick={handleSubmit} disabled={selectedIds.size === 0 || submitting}
            className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 disabled:opacity-50 transition">
            {submitting ? 'Sending...' : `Propose Trade${selectedIds.size > 0 ? ` (${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
