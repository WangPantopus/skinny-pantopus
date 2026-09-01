'use client';

import { useState } from 'react';
import OfferCardV2 from './OfferCardV2';

interface OffersPanelV2Props {
  offers: any[];
  gig: any;
  onAcceptOffer: (offerId: string) => void;
  onDeclineOffer: (offerId: string) => void;
  loading: boolean;
}

const INITIAL_SHOW = 3;

export default function OffersPanelV2({
  offers,
  gig,
  onAcceptOffer,
  onDeclineOffer,
  loading,
}: OffersPanelV2Props) {
  const [expanded, setExpanded] = useState(false);

  // Don't show for instant_accept gigs
  if (gig.engagement_mode === 'instant_accept') return null;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-app-text-secondary font-medium">Waiting for offers</p>
        <div className="flex justify-center gap-1.5 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse [animation-delay:75ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse [animation-delay:150ms]" />
        </div>
      </div>
    );
  }

  // Sort by match_rank (lower is better)
  const sorted = [...offers].sort(
    (a, b) => (a.match_rank ?? 999) - (b.match_rank ?? 999),
  );

  const visible = expanded ? sorted : sorted.slice(0, INITIAL_SHOW);
  const remaining = sorted.length - INITIAL_SHOW;

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-app-text">
        {gig.engagement_mode === 'quotes' ? 'Quotes' : 'Offers'} ({sorted.length})
      </h3>

      <div className="space-y-3 transition-all duration-300">
        {visible.map((offer) => (
          <OfferCardV2
            key={offer.id}
            offer={offer}
            gig={gig}
            onAccept={onAcceptOffer}
            onDecline={onDeclineOffer}
          />
        ))}
      </div>

      {remaining > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mx-auto block px-4 py-2 text-sm font-semibold text-emerald-600 border border-emerald-500 rounded-full hover:bg-emerald-50 transition"
        >
          {expanded ? 'Show less' : `See more offers (${remaining})`}
        </button>
      )}
    </div>
  );
}
