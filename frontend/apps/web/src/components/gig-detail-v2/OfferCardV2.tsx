'use client';

import Image from 'next/image';
import TrustCapsule from './TrustCapsule';

interface OfferCardV2Props {
  offer: any;
  onAccept: (offerId: string) => void;
  onDecline: (offerId: string) => void;
  gig?: any;
}

export default function OfferCardV2({ offer, onAccept, onDecline }: OfferCardV2Props) {
  const user = offer.user || offer.bidder || {};
  const trust = offer.trust_capsule || {};
  const isRecommended = offer.is_recommended || offer.match_rank === 1;
  const displayName = user.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user.name || user.username || 'Helper';

  return (
    <div
      className={`bg-app-surface rounded-xl border p-4 space-y-3 ${
        isRecommended
          ? 'border-l-4 border-l-green-500 border-app-border'
          : 'border-app-border'
      }`}
    >
      {/* Header: avatar + name + price */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {user.profile_picture_url ? (
            <Image
              src={user.profile_picture_url}
              alt={displayName}
              width={36}
              height={36}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              sizes="36px"
              quality={75}
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 flex-shrink-0">
              {(displayName[0] || '?').toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-app-text truncate">{displayName}</span>
        </div>
        <span className="text-lg font-bold text-app-text flex-shrink-0">
          ${Number(offer.amount || offer.price || 0).toFixed(0)}
        </span>
      </div>

      {/* Trust capsule */}
      <TrustCapsule
        verified={trust.verified ?? user.verified ?? false}
        rating={trust.average_rating ?? user.average_rating ?? null}
        reviewCount={trust.review_count ?? user.review_count ?? 0}
        reliabilityScore={trust.reliability_score ?? user.reliability_score ?? 0}
        gigsCompleted={trust.gigs_completed ?? user.gigs_completed ?? 0}
        distanceMiles={trust.distance_miles ?? offer.distance_miles}
        isRecommended={isRecommended}
        isLicensed={trust.is_licensed ?? user.is_licensed}
        isInsured={trust.is_insured ?? user.is_insured}
      />

      {/* Message preview */}
      {offer.message && (
        <p className="text-sm text-app-text-secondary line-clamp-2">{offer.message}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onAccept(offer.id)}
          className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition"
        >
          Accept
        </button>
        <button
          onClick={() => onDecline(offer.id)}
          className="text-sm text-app-text-secondary hover:text-app-text"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
