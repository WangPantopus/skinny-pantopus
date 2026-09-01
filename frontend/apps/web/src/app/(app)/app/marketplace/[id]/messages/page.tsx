'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { Camera, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import { formatTimestamp } from '@pantopus/ui-utils';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import type { ListingDetail, ListingMessage } from '@pantopus/types';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending_pickup: 'bg-amber-100 text-amber-700',
  sold: 'bg-app-surface-sunken text-app-text-secondary',
  archived: 'bg-app-surface-sunken text-app-text-secondary',
  draft: 'bg-blue-100 text-blue-700',
};

export default function ListingMessagesPage() {
  const router = useRouter();
  const params = useParams();
  const listingId = params.id as string;

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [messages, setMessages] = useState<ListingMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = getAuthToken();
    if (!token) { router.push('/login'); return; }

    try {
      const [listingResult, userResult] = await Promise.all([
        api.listings.getListing(listingId),
        api.users.getMyProfile(),
      ]);

      const listingData = ((listingResult as Record<string, any>)?.listing ?? listingResult) as ListingDetail;
      const user = userResult as { id?: string | number };

      // Guard: only owner can view messages
      if (!listingData || !user?.id || String(user.id) !== String(listingData.user_id)) {
        router.replace(`/app/marketplace/${listingId}`);
        return;
      }

      setListing(listingData);

      // Fetch messages
      try {
        const msgResult = await api.listings.getMessages(listingId);
        setMessages(msgResult?.messages || []);
      } catch {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load listing messages:', err);
      router.replace(`/app/marketplace/${listingId}`);
    } finally {
      setLoading(false);
    }
  }, [listingId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-app-text-secondary">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  const coverUrl = listing.media_urls?.[0];
  const statusClass = STATUS_BADGE[listing.status] || 'bg-app-surface-sunken text-app-text-secondary';

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Breadcrumb ──────────────────────────────────────── */}
        <button
          onClick={() => router.push(`/app/marketplace/${listingId}`)}
          className="flex items-center gap-1.5 text-sm text-app-text-secondary hover:text-app-text mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Listing
        </button>

        {/* ── Listing info card ────────────────────────────────── */}
        <div
          className="bg-app-surface rounded-xl border border-app-border p-4 mb-6 flex items-center gap-4 cursor-pointer hover:shadow-sm transition"
          onClick={() => router.push(`/app/marketplace/${listingId}`)}
        >
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-app-surface-sunken flex-shrink-0">
            {coverUrl ? (
              <Image src={coverUrl} alt={listing.title} width={64} height={64} sizes="64px" quality={75} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300"><Camera className="w-6 h-6" /></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-base font-semibold text-app-text truncate">{listing.title}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex-shrink-0 ${statusClass}`}>
                {(listing.status || 'active').replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-sm text-app-text-secondary">
              {listing.is_free ? 'FREE' : listing.price != null ? `$${Number(listing.price).toFixed(0)}` : '—'}
              {' · '}
              {listing.message_count || messages.length} message{(listing.message_count || messages.length) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-app-text">Messages</h1>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-app-border bg-app-surface text-app-text-secondary rounded-lg hover:bg-app-hover text-sm font-medium disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ── Messages list ───────────────────────────────────── */}
        {messages.length === 0 ? (
          <div className="text-center py-16 bg-app-surface rounded-xl border border-app-border">
            <div className="mb-4 flex justify-center"><MessageCircle className="w-12 h-12 text-app-text-muted" /></div>
            <h3 className="text-lg font-semibold text-app-text mb-2">No messages yet for this listing</h3>
            <p className="text-app-text-secondary">
              When buyers message you about this listing, their messages will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <MessageRow
                key={msg.id}
                message={msg}
                onReply={(userId) => router.push(`/app/chat/conversation/${userId}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Message Row ─────────────────────────────────────────────────
function MessageRow({
  message,
  onReply,
}: {
  message: ListingMessage;
  onReply: (userId: string) => void;
}) {
  const buyer = message.buyer;
  const buyerName =
    buyer?.name ||
    buyer?.first_name ||
    buyer?.username ||
    'Anonymous';
  const buyerInitial = (String(buyerName)[0] || '?').toUpperCase();
  const buyerId: string = buyer?.id || message.buyer_id;

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-4">
      <div className="flex gap-3">
        {/* Avatar */}
        {buyer?.profile_picture_url ? (
          <Image
            src={buyer.profile_picture_url}
            alt=""
            width={40}
            height={40}
            sizes="40px"
            quality={75}
            className="rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {buyerInitial}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <UserIdentityLink
              userId={buyerId}
              username={buyer?.username || ''}
              displayName={String(buyerName)}
              avatarUrl={buyer?.profile_picture_url || ''}
              textClassName="text-sm font-semibold text-app-text hover:text-primary-600"
            />
            {message.created_at && (
              <span className="text-xs text-app-text-muted ml-auto flex-shrink-0">
                {formatTimestamp(message.created_at, 'medium')}
              </span>
            )}
          </div>

          {/* Message bubble */}
          <div className="bg-app-surface-raised rounded-lg rounded-tl-sm px-3.5 py-2.5 inline-block max-w-full">
            {message.offer_amount != null && (
              <p className="text-xs font-semibold text-green-600 mb-1">
                Offer: ${Number(message.offer_amount).toFixed(0)}
              </p>
            )}
            <p className="text-sm text-app-text whitespace-pre-wrap break-words">
              {message.message || ''}
            </p>
          </div>

          {/* Reply action */}
          {buyerId && (
            <button
              onClick={() => onReply(buyerId)}
              className="flex items-center gap-1 mt-2 text-xs text-primary-600 font-medium hover:underline"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Reply in Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
