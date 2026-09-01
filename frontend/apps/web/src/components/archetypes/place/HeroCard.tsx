// ============================================================
// Place — HERO ("Today's Pulse"). The card that floats what matters
// now. Two moods, same frame:
//   allclear → home-green, a calm summary + one non-urgent nudge.
//   alert    → amber, urgency carried by a semantic chip + Lucide icon
//              (never a left-border or a red flood-fill).
// The nudge is interactive only when given an onClick (else it reads
// as a quiet informational line — no dead affordance).
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import Chip from '../primitives/Chip';

export type HeroVariant = 'allclear' | 'alert';

export interface HeroNudge {
  icon?: LucideIcon;
  text: string;
  onClick?: () => void;
}

export interface HeroCardProps {
  variant?: HeroVariant;
  /** The main reassuring / urgent line. */
  title: string;
  /** Top-right status chip. */
  chip: { label: string; icon?: LucideIcon };
  /** Large glyph beside the title. */
  mainIcon: LucideIcon;
  nudge?: HeroNudge;
  /** Tap-through to the full Today's Pulse stream (W2.5). When set, the
   *  title row becomes the expand affordance (chevron). */
  onOpen?: () => void;
  className?: string;
}

export default function HeroCard({ variant = 'allclear', title, chip, mainIcon: MainIcon, nudge, onOpen, className = '' }: HeroCardProps) {
  const alert = variant === 'alert';
  const tile = alert ? 'bg-app-warning-bg text-app-warning' : 'bg-app-home-bg text-app-home';
  const NudgeIcon = nudge?.icon;
  const nudgeInteractive = Boolean(nudge?.onClick);

  const titleRow = (
    <>
      <span className={`inline-flex items-center justify-center shrink-0 w-[42px] h-[42px] rounded-xl ${tile}`}>
        <MainIcon size={22} strokeWidth={2} />
      </span>
      <p className="flex-1 text-[17px] font-semibold text-app-text leading-[23px] -tracking-[0.012em]">{title}</p>
      {onOpen ? <ChevronRight size={20} strokeWidth={2.25} className="shrink-0 mt-0.5 text-app-text-muted" /> : null}
    </>
  );

  return (
    <div className={`bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-text-secondary">
          Today&apos;s pulse
        </span>
        <Chip label={chip.label} variant={alert ? 'warning' : 'success'} icon={chip.icon} />
      </div>

      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label="See your full Today's Pulse"
          className="w-full flex items-start gap-3 mb-3.5 text-left cursor-pointer"
        >
          {titleRow}
        </button>
      ) : (
        <div className="flex items-start gap-3 mb-3.5">{titleRow}</div>
      )}

      {nudge ? (
        nudgeInteractive ? (
          <button
            type="button"
            onClick={nudge.onClick}
            className="w-full flex items-center gap-2.5 rounded-xl bg-app-surface-sunken px-3 py-2.5 text-left cursor-pointer hover:bg-app-hover transition-colors"
          >
            {NudgeIcon ? (
              <NudgeIcon size={17} strokeWidth={2} className={alert ? 'text-app-warning shrink-0' : 'text-app-home shrink-0'} />
            ) : null}
            <span className="flex-1 text-[13.5px] text-app-text-strong leading-[19px]">{nudge.text}</span>
            <ChevronRight size={17} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
          </button>
        ) : (
          // Informational nudge (no action) — a div, not a disabled button.
          <div className="w-full flex items-center gap-2.5 rounded-xl bg-app-surface-sunken px-3 py-2.5">
            {NudgeIcon ? (
              <NudgeIcon size={17} strokeWidth={2} className={alert ? 'text-app-warning shrink-0' : 'text-app-home shrink-0'} />
            ) : null}
            <span className="flex-1 text-[13.5px] text-app-text-strong leading-[19px]">{nudge.text}</span>
          </div>
        )
      ) : null}
    </div>
  );
}
