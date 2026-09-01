// ============================================================
// Place — DENSITY BUCKET card. Verified homes nearby, as a k-anon
// bucket only — qualitative dots + a label, NEVER a number (the
// signed-out density rule, design doc §4.1). Labels come from the
// canonical PlaceIntelligence contract so they stay in lockstep.
// ============================================================

'use client';

import { Users } from 'lucide-react';
import { PLACE_DENSITY_LABELS, type PlaceDensityBucket } from '@pantopus/types';
import { Chevron, IconTile, TextButton } from './primitives';

// Filled dots per bucket — qualitative scale, not a count.
const BUCKET_DOTS: Record<PlaceDensityBucket, number> = {
  none: 0,
  forming: 1,
  few: 2,
  growing: 3,
};

function DensityDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1 shrink-0">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${i < level ? 'bg-app-home' : 'bg-app-border'}`} />
      ))}
    </div>
  );
}

export interface DensityCardProps {
  bucket?: PlaceDensityBucket;
  /** Override the canonical bucket label (the signed-out preview sends
   *  its own: below the floor it reads as an invitation, never a zero). */
  label?: string;
  ctaLabel?: string;
  onCta?: () => void;
  onClick?: () => void;
  /** Hide the conversion CTA (e.g. on an already-verified resident's dashboard). */
  showCta?: boolean;
  className?: string;
}

export default function DensityCard({
  bucket = 'few',
  label: labelOverride,
  ctaLabel = 'Be one of the first to verify on your block',
  onCta,
  onClick,
  showCta = true,
  className = '',
}: DensityCardProps) {
  const level = BUCKET_DOTS[bucket];
  const label = labelOverride ?? PLACE_DENSITY_LABELS[bucket];
  const empty = level === 0;
  return (
    <div
      className={`bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div className={`flex items-center gap-3 ${showCta ? 'mb-2.5' : ''}`}>
        <IconTile icon={Users} tone={empty ? 'muted' : 'home'} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-app-text -tracking-[0.01em]">Verified homes nearby</div>
        </div>
        {onClick ? <Chevron /> : null}
      </div>
      <div className={`flex items-center gap-2.5 ${showCta ? 'mb-2.5' : 'mt-2.5'}`}>
        <DensityDots level={level} />
        <span className={`text-[15px] font-medium ${empty ? 'text-app-text-secondary' : 'text-app-text'}`}>{label}</span>
      </div>
      {showCta ? <TextButton onClick={onCta}>{ctaLabel}</TextButton> : null}
    </div>
  );
}
