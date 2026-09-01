// ============================================================
// Place — AHA card. The one fact above the fold the visitor did not
// know about their own address (Wedge v2, D1). Same card frame as the
// Today's Pulse hero; the tone is carried by the grade badge and the
// icon tile — never a flooded card or a left-border.
//
//   alert → amber   (a high band, an active warning, bad air)
//   watch → info    (moderate: worth knowing, not worth worrying)
//   info  → neutral (a plain fact: rent band, districts, build year)
//   calm  → green   ("quiet on every layer" — itself the surprise)
//
// The follow-up line is the question the claim answers; when given an
// onFollowUp it becomes the card's action, otherwise it reads quietly.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import { ChevronRight, Sparkles } from 'lucide-react';
import Chip, { type ChipVariant } from '../primitives/Chip';

export type AhaTone = 'alert' | 'watch' | 'info' | 'calm';

export interface AhaCardProps {
  tone: AhaTone;
  /** Short badge: "High", "AQI 31", "Zone X", "Quiet". */
  grade?: string | null;
  headline: string;
  detail?: string;
  /** The question the claim answers. */
  followUp: string;
  onFollowUp?: () => void;
  icon?: LucideIcon;
  /** Source label under the detail, e.g. "USFS Wildfire Hazard Potential". */
  source?: string | null;
  className?: string;
}

const TILE: Record<AhaTone, string> = {
  alert: 'bg-app-warning-bg text-app-warning',
  watch: 'bg-app-info-light text-app-info',
  info: 'bg-app-surface-sunken text-app-text-strong',
  calm: 'bg-app-home-bg text-app-home',
};

const CHIP: Record<AhaTone, ChipVariant> = {
  alert: 'warning',
  watch: 'info',
  info: 'neutral',
  calm: 'success',
};

const FOLLOW_ICON: Record<AhaTone, string> = {
  alert: 'text-app-warning',
  watch: 'text-app-info',
  info: 'text-app-text-strong',
  calm: 'text-app-home',
};

export default function AhaCard({
  tone,
  grade,
  headline,
  detail,
  followUp,
  onFollowUp,
  icon: Icon = Sparkles,
  source,
  className = '',
}: AhaCardProps) {
  const interactive = Boolean(onFollowUp);
  return (
    <div className={`bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-text-secondary">What stands out</span>
        {grade ? <Chip label={grade} variant={CHIP[tone]} /> : null}
      </div>

      <div className="flex items-start gap-3">
        <span className={`inline-flex items-center justify-center shrink-0 w-[42px] h-[42px] rounded-xl ${TILE[tone]}`}>
          <Icon size={22} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-app-text leading-[23px] -tracking-[0.012em] [text-wrap:balance]">
            {headline}
          </p>
          {detail ? <p className="mt-1.5 text-[13.5px] text-app-text-secondary leading-[19px]">{detail}</p> : null}
          {source ? <p className="mt-1.5 text-[11.5px] text-app-text-muted leading-4">{source}</p> : null}
        </div>
      </div>

      {interactive ? (
        <button
          type="button"
          onClick={onFollowUp}
          className="mt-3.5 w-full flex items-center gap-2.5 rounded-xl bg-app-surface-sunken px-3 py-2.5 text-left cursor-pointer hover:bg-app-hover transition-colors"
        >
          <Sparkles size={17} strokeWidth={2} className={`shrink-0 ${FOLLOW_ICON[tone]}`} />
          <span className="flex-1 text-[13.5px] text-app-text-strong leading-[19px]">{followUp}</span>
          <ChevronRight size={17} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
        </button>
      ) : (
        <div className="mt-3.5 w-full flex items-center gap-2.5 rounded-xl bg-app-surface-sunken px-3 py-2.5">
          <Sparkles size={17} strokeWidth={2} className={`shrink-0 ${FOLLOW_ICON[tone]}`} />
          <span className="flex-1 text-[13.5px] text-app-text-strong leading-[19px]">{followUp}</span>
        </div>
      )}
    </div>
  );
}
