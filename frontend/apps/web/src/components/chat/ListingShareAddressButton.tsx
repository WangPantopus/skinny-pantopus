'use client';

import { useState, useCallback } from 'react';
import * as api from '@pantopus/api';

interface ListingShareAddressButtonProps {
  listingId: string;
  otherUserId: string;
  currentUserId: string | null;
  listingOwnerId?: string;
}

/**
 * "Share Address" button shown in listing-topic chats.
 * Only visible to the listing owner. Calls the reveal-address
 * endpoint which creates a grant & posts a system message.
 */
export default function ListingShareAddressButton({
  listingId,
  otherUserId,
  currentUserId,
  listingOwnerId,
}: ListingShareAddressButtonProps) {
  const [sending, setSending] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentUserId && listingOwnerId && currentUserId === listingOwnerId;

  const handleShare = useCallback(async () => {
    if (sending || shared) return;
    setSending(true);
    setError(null);
    try {
      await api.listings.revealAddress(listingId, otherUserId);
      setShared(true);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || 'Failed to share address');
    } finally {
      setSending(false);
    }
  }, [listingId, otherUserId, sending, shared]);

  if (!isOwner) return null;

  if (shared) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs text-green-700 font-medium">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Address shared
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleShare}
        disabled={sending}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-full text-xs text-primary-700 font-medium transition disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {sending ? 'Sharing…' : 'Share Address'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
