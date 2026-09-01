'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight, MapPin, Train } from 'lucide-react';
import { formatTimeAgo } from '@pantopus/ui-utils';
import type { NearbySupportTrainListItem } from '@pantopus/types';

function formatDistanceMeters(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(Number(meters))) return null;
  const m = Number(meters);
  if (m < 1609) return `${Math.round(m)}m`;
  return `${(m / 1609).toFixed(1)}mi`;
}

interface SupportTrainRowProps {
  train: NearbySupportTrainListItem;
}

export default function SupportTrainRow({ train }: SupportTrainRowProps) {
  const router = useRouter();
  const distance = formatDistanceMeters(train.distance_meters);
  const title = train.title?.trim() || 'Support Train';
  const area =
    train.city && train.state ? `${train.city}, ${train.state}` : train.city || train.state || null;
  const slotsLine =
    train.open_slots_count > 0
      ? `${train.open_slots_count} open slot${train.open_slots_count !== 1 ? 's' : ''}`
      : 'View schedule';

  return (
    <button
      onClick={() => router.push(`/app/support-trains/${train.support_train_id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-app-border-subtle last:border-b-0 text-left hover:bg-app-hover transition"
    >
      <div className="w-11 h-11 rounded-lg bg-app-surface-sunken flex items-center justify-center flex-shrink-0">
        <Train className="w-5 h-5 text-primary-600 dark:text-primary-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-app-text truncate">{title}</div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            Support Train
          </span>
          {distance && (
            <span className="flex items-center gap-0.5 text-[12px] text-app-text-muted">
              <MapPin className="w-3 h-3" />
              {distance}
            </span>
          )}
          {train.published_at && (
            <span className="text-[12px] text-app-text-muted">{formatTimeAgo(train.published_at)}</span>
          )}
        </div>
        <div className="text-[13px] text-app-text-muted mt-0.5 truncate">
          {area ? `${area} · ${slotsLine}` : slotsLine}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-app-text-muted flex-shrink-0" />
    </button>
  );
}
