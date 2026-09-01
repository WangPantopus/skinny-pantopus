'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CATEGORY_MAP } from './constants';
import type { DiscoverySearchResult, CatalogPreviewItem } from '@pantopus/api';
import { EndorsementBadge } from '@/components/endorsement';

function formatDistance(miles: number): string {
  if (miles < 0.1) return '< 0.1 mi';
  return `${miles.toFixed(1)} mi`;
}

function formatResponseTime(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `Typically responds in ~${Math.round(minutes)} min`;
  const hrs = Math.round(minutes / 60);
  return `Typically responds in ~${hrs} hr${hrs !== 1 ? 's' : ''}`;
}

function formatCatalogPrice(item: CatalogPreviewItem): string {
  if (item.price_cents == null) return item.name;
  const dollars = (item.price_cents / 100).toFixed(0);
  const unit = item.price_unit ? `/${item.price_unit}` : '';
  return `${item.name} from $${dollars}${unit}`;
}

function HoursBadge({ isOpen }: { isOpen: boolean | null }) {
  if (isOpen === null) return null;
  return isOpen ? (
    <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full" aria-label="Currently open">Open</span>
  ) : (
    <span className="text-[11px] font-semibold text-app-secondary bg-surface-muted px-2 py-0.5 rounded-full" aria-label="Currently closed">Closed</span>
  );
}

export default function BusinessResultCard({
  result,
  onContact,
}: {
  result: DiscoverySearchResult;
  onContact?: (businessUserId: string) => void;
}) {
  const router = useRouter();

  const rating = result.average_rating;
  const reviewCount = result.review_count;
  const distance = formatDistance(result.distance_miles);
  const responseTime = formatResponseTime(result.avg_response_minutes);
  const showNeighborCount = result.neighbor_count >= 2;
  const showEndorsement = result.endorsement_count >= 2;
  const categoryLabels = (result.categories || [])
    .slice(0, 3)
    .map((c: string) => CATEGORY_MAP[c] || c);

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-app p-4 hover:shadow-md transition-shadow">
      {/* Row 1: Logo + Name + Category Tags */}
      <div className="flex items-start gap-3 mb-3">
        {/* Logo / avatar */}
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-surface-muted flex items-center justify-center overflow-hidden">
          {result.profile_picture_url ? (
            <Image
              src={result.profile_picture_url}
              alt={result.name}
              className="w-full h-full object-cover"
              width={44}
              height={44}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              quality={80}
            />
          ) : (
            <span className="text-lg font-bold text-app-muted">
              {result.name?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-app text-sm truncate">{result.name}</h3>
            {result.is_new_business && (
              <span className="text-[10px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full leading-none">
                New
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {categoryLabels.map((label) => (
              <span
                key={label}
                className="text-[10px] font-medium bg-surface-muted text-app-secondary px-1.5 py-0.5 rounded"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <HoursBadge isOpen={result.is_open_now} />
      </div>

      {/* Row 2: Trust signals */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-app-secondary mb-2.5">
        {rating != null && (
          <span className="flex items-center gap-0.5">
            <span className="text-yellow-500" aria-hidden="true">★</span>
            <span className="font-semibold text-app-strong">{rating.toFixed(1)}</span>
            {reviewCount > 0 && (
              <span className="text-app-muted">({reviewCount})</span>
            )}
          </span>
        )}
        <span className="text-app-muted">·</span>
        <span>{distance}</span>

        {showNeighborCount && (
          <>
            <span className="text-app-muted">·</span>
            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full text-[11px] font-medium">
              <span aria-hidden="true">🏨</span> {result.neighbor_count} nearby
            </span>
          </>
        )}

        {showEndorsement && (
          <>
            <span className="text-app-muted">·</span>
            <EndorsementBadge
              businessId={result.business_user_id}
              preloadedCount={result.endorsement_count}
              minCount={2}
              compact
            />
          </>
        )}
      </div>

      {/* Row 3: Catalog previews */}
      {result.catalog_preview && result.catalog_preview.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {result.catalog_preview.slice(0, 2).map((item, i) => (
            <span
              key={i}
              className="text-[11px] bg-surface-raised border border-app text-app-secondary px-2 py-0.5 rounded-full"
            >
              {formatCatalogPrice(item)}
            </span>
          ))}
        </div>
      )}

      {/* Row 4: Response time */}
      {responseTime && (
        <p className="text-[11px] text-app-muted mb-3"><span aria-hidden="true">⏱</span> {responseTime}</p>
      )}

      {/* Row 5: CTAs */}
      <div className="flex gap-2">
        <button
          onClick={() => onContact?.(result.business_user_id)}
          className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 transition"
          aria-label={`Contact ${result.name}`}
        >
          Contact
        </button>
        <button
          onClick={() => router.push(`/b/${result.username}`)}
          className="flex-1 py-2 bg-surface-muted text-app-strong rounded-lg text-xs font-semibold hover:bg-surface-raised transition"
          aria-label={`View ${result.name} profile`}
        >
          View Profile
        </button>
      </div>
    </div>
  );
}

/**
 * Skeleton card for loading state
 */
export function BusinessResultCardSkeleton() {
  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-app p-4 animate-pulse">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-surface-muted" />
        <div className="flex-1 space-y-2">
          <div className="w-32 h-3.5 rounded bg-surface-muted" />
          <div className="flex gap-1">
            <div className="w-14 h-3 rounded bg-surface-muted" />
            <div className="w-10 h-3 rounded bg-surface-muted" />
          </div>
        </div>
        <div className="w-12 h-5 rounded-full bg-surface-muted" />
      </div>
      {/* Trust row */}
      <div className="flex gap-2 mb-3">
        <div className="w-10 h-3 rounded bg-surface-muted" />
        <div className="w-12 h-3 rounded bg-surface-muted" />
        <div className="w-20 h-3 rounded bg-surface-muted" />
      </div>
      {/* CTAs */}
      <div className="flex gap-2">
        <div className="flex-1 h-8 rounded-lg bg-surface-muted" />
        <div className="flex-1 h-8 rounded-lg bg-surface-muted" />
      </div>
    </div>
  );
}
