// ============================================================
// ArchetypeEmptyState — 72x72 identity-tinted circle + headline
// + subcopy + optional primary CTA. Design-system empty state.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

export type EmptyStateTone = 'personal' | 'home' | 'business' | 'neutral';

const TONE_BG: Record<EmptyStateTone, string> = {
  personal: 'bg-app-personal-bg text-app-personal',
  home: 'bg-app-home-bg text-app-home',
  business: 'bg-app-business-bg text-app-business',
  neutral: 'bg-app-surface-sunken text-app-text-secondary',
};

export interface ArchetypeEmptyStateProps {
  icon: LucideIcon;
  headline: ReactNode;
  subcopy?: ReactNode;
  tone?: EmptyStateTone;
  ctaLabel?: string;
  onCtaClick?: () => void;
  secondaryCtaLabel?: string;
  onSecondaryCtaClick?: () => void;
  className?: string;
}

export default function ArchetypeEmptyState({
  icon: Icon,
  headline,
  subcopy,
  tone = 'home',
  ctaLabel,
  onCtaClick,
  secondaryCtaLabel,
  onSecondaryCtaClick,
  className = '',
}: ArchetypeEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-20 px-8 text-center ${className}`}>
      <div className={`w-[72px] h-[72px] rounded-full flex items-center justify-center mb-[18px] ${TONE_BG[tone]}`}>
        <Icon size={32} strokeWidth={1.8} />
      </div>
      <h3 className="text-xl font-semibold text-app-text -tracking-[0.01em] mb-2 leading-snug max-w-[420px]">
        {headline}
      </h3>
      {subcopy ? (
        <p className="text-sm text-app-text-secondary max-w-[260px] leading-relaxed mb-6">{subcopy}</p>
      ) : null}
      {ctaLabel && onCtaClick ? (
        <div className="flex items-center gap-2">
          {secondaryCtaLabel && onSecondaryCtaClick ? (
            <button
              type="button"
              onClick={onSecondaryCtaClick}
              className="h-10 px-5 rounded-lg border border-app-border bg-app-surface text-sm font-semibold text-app-text-strong hover:bg-app-hover transition"
            >
              {secondaryCtaLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCtaClick}
            className="h-10 px-5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm flex items-center gap-1.5 transition"
          >
            <Plus size={16} />
            {ctaLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
