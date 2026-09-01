'use client';

// AudienceZoneHeader — persistent visual cue that the current page is the
// audience-side surface. Audience Profile design v2 §11.8 ("Mode separation
// visual cues") + unified-IA §3.2: the audience destination uses a teal
// accent and a small persistent header so creators always know which side
// they're acting on. Personal-zone pages (Feed, Marketplace, etc.) do NOT
// render this bar.

import Link from 'next/link';

interface AudienceZoneHeaderProps {
  handle?: string | null;
  displayName?: string | null;
  rightSlot?: React.ReactNode;
}

export function AudienceZoneHeader({
  handle,
  displayName,
  rightSlot,
}: AudienceZoneHeaderProps) {
  return (
    <div
      role="banner"
      aria-label="Audience profile zone"
      className="border-b border-teal-200 bg-teal-50 px-4 py-2 text-teal-900"
      data-zone="audience"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span aria-hidden className="inline-flex h-2 w-2 rounded-full bg-teal-500" />
          <span className="font-medium">Beacon</span>
          {handle ? (
            <Link
              href={`/@${handle}`}
              className="text-teal-700 underline-offset-2 hover:underline"
            >
              @{handle}
            </Link>
          ) : null}
          {displayName && handle && displayName !== handle ? (
            <span className="text-teal-700">· {displayName}</span>
          ) : null}
        </div>
        {rightSlot ? <div className="text-sm">{rightSlot}</div> : null}
      </div>
    </div>
  );
}

export default AudienceZoneHeader;
