'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { STATUS_OPTIONS } from './listing-detail.types';
import type { ListingDetail } from '@pantopus/types';

interface ListingActionsProps {
  listing: ListingDetail;
  listingId: string;
  isOwner: boolean;
  canRefresh: boolean;
  refreshing: boolean;
  onSave: () => void;
  onShare: () => void;
  onShareToFeed: () => void;
  onRefresh: () => void;
  onStatusChange: (status: string) => void;
  onMessageSeller: () => void;
  onReport: () => void;
  onMakeOffer?: () => void;
  activeOfferCount?: number;
  listingIsFree?: boolean;
  hasExistingOffer?: boolean;
}

export default function ListingActions({
  listing,
  listingId,
  isOwner,
  canRefresh,
  refreshing,
  onSave,
  onShare,
  onShareToFeed,
  onRefresh,
  onStatusChange,
  onMessageSeller,
  onReport,
  onMakeOffer,
  activeOfferCount,
  listingIsFree,
  hasExistingOffer,
}: ListingActionsProps) {
  const router = useRouter();
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const handleStatusChange = (status: string) => {
    setShowStatusMenu(false);
    onStatusChange(status);
  };

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-4 mb-6">
      <div className="flex flex-wrap gap-2">
        {/* Save */}
        <button onClick={onSave} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition ${
          listing.userHasSaved ? 'bg-primary-50 border-primary-200 text-primary-700' : 'border-app-border text-app-text-strong hover:bg-app-hover'
        }`}>
          {listing.userHasSaved ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
          )}
          {listing.userHasSaved ? 'Saved' : 'Save'}
        </button>

        {/* Make Offer / View Offer (non-owner, active/reserved listing) */}
        {!isOwner && onMakeOffer && (listing.status === 'active' || listing.status === 'reserved') && (
          <button onClick={onMakeOffer} className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {hasExistingOffer ? 'View Offer' : listingIsFree ? "I'm Interested" : 'Make Offer'}
          </button>
        )}

        {/* View Offers badge (owner) */}
        {isOwner && activeOfferCount != null && activeOfferCount > 0 && (
          <button onClick={onMakeOffer} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            View Offers ({activeOfferCount})
          </button>
        )}

        {/* Message Seller (non-owner) */}
        {!isOwner && (
          <button onClick={onMessageSeller} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${onMakeOffer ? 'border border-app-border text-app-text-strong hover:bg-app-hover' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Message Seller
          </button>
        )}

        {/* Share */}
        <button onClick={onShare} className="flex items-center gap-1.5 px-4 py-2 border border-app-border text-app-text-strong rounded-lg text-sm font-medium hover:bg-app-hover">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          Share
        </button>

        {/* Owner: Edit */}
        {isOwner && (
          <button onClick={() => router.push(`/app/marketplace/${listingId}/edit`)} className="flex items-center gap-1.5 px-4 py-2 border border-app-border text-app-text-strong rounded-lg text-sm font-medium hover:bg-app-hover">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit
          </button>
        )}

        {/* Owner: Status */}
        {isOwner && (
          <div className="relative">
            <button onClick={() => setShowStatusMenu(!showStatusMenu)} className="flex items-center gap-1.5 px-4 py-2 border border-app-border text-app-text-strong rounded-lg text-sm font-medium hover:bg-app-hover">
              Status: {(listing.status || 'active').replace(/_/g, ' ')}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showStatusMenu && (
              <div className="absolute top-full left-0 mt-1 bg-app-surface border border-app-border rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => handleStatusChange(s)} className={`w-full text-left px-4 py-2 text-sm hover:bg-app-hover ${listing.status === s ? 'text-primary-600 font-semibold' : 'text-app-text-strong'}`}>
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Owner: Share to Neighborhood */}
        {isOwner && (
          <button onClick={onShareToFeed} className="flex items-center gap-1.5 px-4 py-2 border border-green-200 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50">
            <Megaphone className="w-4 h-4" /> Share to Neighborhood
          </button>
        )}

        {/* Owner: Refresh listing */}
        {isOwner && canRefresh && (
          <button onClick={onRefresh} disabled={refreshing} className="flex items-center gap-1.5 px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50">
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {refreshing ? 'Refreshing...' : 'Refresh Listing'}
          </button>
        )}

        {/* Non-owner: Report */}
        {!isOwner && (
          <button onClick={onReport} className="flex items-center gap-1.5 px-4 py-2 border border-app-border text-app-text-secondary rounded-lg text-sm font-medium hover:bg-app-hover">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            Report
          </button>
        )}
      </div>
    </div>
  );
}
