'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { GigListItem } from '@pantopus/types';
import { formatTimeAgo, formatPrice, formatDistance } from '@pantopus/ui-utils';

function getImageUrl(gig: GigListItem): string | null {
  if (gig.first_image) return gig.first_image;
  if (gig.attachments?.[0]) return gig.attachments[0];
  return null;
}

interface FeaturedTaskCardProps {
  gig: GigListItem;
}

function getMatchReason(gig: GigListItem): string {
  const dist = gig.distance_meters;
  if (dist != null && dist < 1609) return 'Near your home';
  const age = gig.created_at ? Date.now() - new Date(gig.created_at).getTime() : Infinity;
  if (age < 2 * 3600000) return `Posted ${formatTimeAgo(gig.created_at!, 'full')}`;
  if (dist != null && dist < 8047) return `${formatDistance(dist)} away`;
  return 'Great match for you';
}

export default function FeaturedTaskCard({ gig }: FeaturedTaskCardProps) {
  const price = formatPrice(Number(gig.price) || 0);
  const distance = formatDistance(gig.distance_meters ?? undefined);
  const matchReason = getMatchReason(gig);
  const imageUrl = getImageUrl(gig);
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      href={`/app/gigs/${gig.id}`}
      aria-label={`Featured: ${gig.title}, ${price}`}
      className="block rounded-xl border border-app-border bg-app-surface overflow-hidden hover:shadow-md hover:border-primary-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {/* Hero image */}
      {imageUrl && !imgError && (
        <div className="relative w-full h-[120px]">
          <Image
            src={imageUrl}
            alt={`${gig.title} photo`}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            quality={80}
          />
        </div>
      )}

      <div className="p-4">
        {/* Match reason */}
        <p
          className="mb-1 text-[11px] italic text-primary-600 dark:text-primary-400"
          aria-hidden="true"
        >
          {matchReason}
        </p>

        {/* Title + Price */}
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h3 className="text-sm font-bold text-app-text truncate flex-1">{gig.title}</h3>
          <span className="shrink-0 text-sm font-bold text-green-600 dark:text-green-400">
            {price}
          </span>
        </div>

        {/* Category + Distance + Time */}
        <div className="flex items-center gap-2 text-xs text-app-text-secondary mb-1.5">
          {gig.category && (
            <span className="inline-flex items-center bg-app-surface-sunken text-app-text-secondary px-1.5 py-0.5 rounded text-[11px] font-medium">
              {gig.category}
            </span>
          )}
          {distance && (
            <>
              <span className="text-app-text-muted">·</span>
              <span>{distance}</span>
            </>
          )}
          {gig.created_at && (
            <>
              <span className="text-app-text-muted">·</span>
              <span>{formatTimeAgo(gig.created_at, 'full')}</span>
            </>
          )}
        </div>

        {/* Description snippet */}
        {gig.description && (
          <p className="text-xs text-app-text-muted line-clamp-2 leading-relaxed mb-2">
            {gig.description}
          </p>
        )}

        {/* CTA */}
        <span className="inline-block text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
          View Details →
        </span>
      </div>
    </Link>
  );
}
