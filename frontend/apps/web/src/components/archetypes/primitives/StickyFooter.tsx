// ============================================================
// StickyFooter — bottom-pinned CTA shelf rendered inside a page
// or modal. Primary + optional secondary (ghost) buttons.
//
// Unlike mobile, this is `position: sticky; bottom: 0` (not
// absolute) so it plays with scrollable page content.
// ============================================================

'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface StickyFooterProps {
  primaryLabel: string;
  onPrimaryClick: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryTone?: 'primary' | 'success' | 'warning' | 'danger';
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
  secondaryDisabled?: boolean;
  helperText?: ReactNode;
  className?: string;
}

const TONE_BG: Record<NonNullable<StickyFooterProps['primaryTone']>, string> = {
  primary: 'bg-primary-600 hover:bg-primary-700',
  success: 'bg-app-success hover:brightness-110',
  warning: 'bg-app-warning hover:brightness-110',
  danger: 'bg-app-error hover:brightness-110',
};

export default function StickyFooter({
  primaryLabel,
  onPrimaryClick,
  primaryDisabled,
  primaryLoading,
  primaryTone = 'primary',
  secondaryLabel,
  onSecondaryClick,
  secondaryDisabled,
  helperText,
  className = '',
}: StickyFooterProps) {
  return (
    <div
      className={`sticky bottom-0 left-0 right-0 z-10 bg-app-surface/95 backdrop-blur-md border-t border-app-border px-4 py-3 ${className}`}
    >
      {helperText ? (
        <p className="text-xs text-app-text-secondary text-center mb-2">{helperText}</p>
      ) : null}
      <div className="flex items-center gap-2 justify-end">
        {secondaryLabel ? (
          <button
            type="button"
            onClick={onSecondaryClick}
            disabled={secondaryDisabled}
            className="h-11 px-5 rounded-lg border border-app-border bg-app-surface text-app-text-strong text-sm font-semibold hover:bg-app-hover disabled:opacity-50 transition"
          >
            {secondaryLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPrimaryClick}
          disabled={primaryDisabled || primaryLoading}
          className={`h-11 px-6 rounded-lg text-white text-sm font-semibold shadow-sm transition flex items-center gap-2 disabled:opacity-50 ${TONE_BG[primaryTone]}`}
        >
          {primaryLoading ? <Loader2 size={16} className="animate-spin" /> : null}
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
