'use client';

import { useState } from 'react';
import { MapPin, CheckCircle, Loader2 } from 'lucide-react';
import * as api from '@pantopus/api';

interface ListingChatActionsProps {
  room: any;
  currentUserId: string | undefined;
}

export default function ListingChatActions({ room, currentUserId }: ListingChatActionsProps) {
  const [sending, setSending] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listingId = room?.listing_id || room?.metadata?.listing_id || room?.metadata?.listingId;
  if (!listingId) return null;

  const isOwner = room?.listing_poster_id === currentUserId ||
    room?.metadata?.listing_poster_id === currentUserId ||
    room?.metadata?.listing_owner_id === currentUserId;
  if (!isOwner) return null;

  const participants = room?.participants || [];
  const otherParticipant = participants.find(
    (p: any) => (p.user_id || p.user?.id) !== currentUserId,
  );
  const otherUserId = otherParticipant?.user_id || otherParticipant?.user?.id;
  if (!otherUserId) return null;

  const handleShare = async () => {
    if (sending || shared) return;
    setSending(true);
    setError(null);
    try {
      await api.listings.revealAddress(listingId, otherUserId);
      setShared(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to share address');
    } finally {
      setSending(false);
    }
  };

  if (shared) {
    return (
      <div className="px-3 py-2 bg-app-surface-sunken border-t border-app-border flex items-center justify-center gap-1.5">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span className="text-sm font-semibold text-green-600">Address shared</span>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 bg-app-surface-sunken border-t border-app-border">
      <button onClick={handleShare} disabled={sending}
        className="flex items-center justify-center gap-1.5 w-full py-2 px-4 bg-emerald-50 border border-emerald-500 text-emerald-600 rounded-full text-sm font-semibold hover:bg-emerald-100 disabled:opacity-50 transition">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
        {sending ? 'Sharing\u2026' : 'Share Address'}
      </button>
      {error && <p className="text-xs text-red-600 text-center mt-1">{error}</p>}
    </div>
  );
}
