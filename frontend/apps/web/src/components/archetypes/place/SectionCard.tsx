// ============================================================
// Place — the SECTION-CARD atom (web mirror of place-components.jsx).
//
// One card pattern, six states:
//   loaded | stale | empty | unavailable | error | loading
// plus an `inline` single-line rhythm for dense reading rows.
//
// Header: home-green section icon, sentence-case title, optional
// "as of <date>" caption (right), and a chevron affording tap-through.
// Color lives in chips / dots / icon tiles — never a left-border.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { ShimmerBlock } from '@/components/ui/Shimmer';
import Chip, { type ChipVariant } from '../primitives/Chip';
import { Chevron, IconTile, StatusDot, Sparkline, TextButton, type StatusDotTone } from './primitives';

export type PlaceSectionState = 'loaded' | 'stale' | 'empty' | 'unavailable' | 'error' | 'loading';

export interface PlaceSectionCardChip {
  label: ReactNode;
  variant?: ChipVariant;
  icon?: LucideIcon;
}

export interface PlaceSectionCardAction {
  label: string;
  onClick?: () => void;
}

export interface SectionCardProps {
  /** Section glyph (home-green tile). */
  icon: LucideIcon;
  title: string;
  /** Right-aligned freshness caption, e.g. "9:40 AM" or "May 2026". */
  asOf?: string;
  state?: PlaceSectionState;
  /** Primary reading. */
  value?: ReactNode;
  /** Quiet supporting line under the value (e.g. "Screening, not a diagnosis"). */
  caption?: ReactNode;
  chip?: PlaceSectionCardChip;
  /** Small semantic dot before the inline value. */
  statusDot?: StatusDotTone;
  /** Render a qualitative value trend (home-value). */
  sparkline?: boolean;
  /** A verbs-first sky action used in place of the value. */
  action?: PlaceSectionCardAction;
  /** Error-state retry. */
  onRetry?: () => void;
  /** Tap-through for the whole card. */
  onClick?: () => void;
  /** Dense single-line rhythm (loaded / stale only). */
  inline?: boolean;
  /** Tighter padding. */
  compact?: boolean;
  className?: string;
}

export default function SectionCard({
  icon,
  title,
  asOf,
  state = 'loaded',
  value,
  caption,
  chip,
  statusDot,
  sparkline,
  action,
  onRetry,
  onClick,
  inline = false,
  compact = false,
  className = '',
}: SectionCardProps) {
  const loading = state === 'loading';
  const isReading = state === 'loaded' || state === 'stale';
  const tone = state === 'empty' || state === 'unavailable' ? 'muted' : 'home';

  // ── INLINE: compact single-line reading ──────────────────
  if (inline && isReading) {
    return (
      <div
        onClick={onClick}
        className={`bg-app-surface border border-app-border rounded-2xl shadow-sm px-3.5 py-3 flex items-center gap-3 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        <IconTile icon={icon} tone={tone} size={32} />
        <div className="text-[15px] font-semibold text-app-text shrink-0 -tracking-[0.01em]">{title}</div>
        <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
          {chip ? (
            <Chip label={chip.label} variant={chip.variant ?? 'neutral'} icon={chip.icon} />
          ) : action ? (
            <span className="text-sm font-semibold text-primary-600 whitespace-nowrap">{action.label}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[15px] font-medium text-app-text text-right leading-tight">
              {statusDot ? <StatusDot tone={statusDot} /> : null}
              {value}
            </span>
          )}
        </div>
        {onClick ? <Chevron /> : null}
      </div>
    );
  }

  // ── Block body per state ─────────────────────────────────
  let body: ReactNode;
  if (loading) {
    body = (
      <div className="flex flex-col gap-2.5 pt-0.5">
        <ShimmerBlock className="h-[15px] w-3/5" />
        <ShimmerBlock className="h-3 w-5/6" />
      </div>
    );
  } else if (state === 'empty') {
    body = (
      <div>
        <div className="text-[15px] font-medium text-app-text-secondary">Nothing here yet</div>
        <div className="text-[13px] text-app-text-muted mt-0.5">
          {caption ?? "We'll show this once it's available."}
        </div>
      </div>
    );
  } else if (state === 'unavailable') {
    body = (
      <div>
        <div className="text-[15px] font-medium text-app-text-secondary">Not available for your area yet.</div>
        <div className="text-[13px] text-app-text-muted mt-0.5">
          {caption ?? 'Coverage is expanding. Check back later.'}
        </div>
      </div>
    );
  } else if (state === 'error') {
    body = (
      <div>
        <div className="flex items-center gap-1.5">
          <CloudOff size={16} strokeWidth={2} className="text-app-text-secondary" />
          <span className="text-[15px] font-medium text-app-text-strong">{"Couldn't load this"}</span>
        </div>
        <div className="mt-2">
          <TextButton arrow={false} onClick={onRetry}>Try again</TextButton>
        </div>
      </div>
    );
  } else {
    // loaded / stale (block)
    body = (
      <div className={`flex gap-3 ${sparkline ? 'items-end' : 'items-start'}`}>
        <div className="flex-1 min-w-0">
          {action ? (
            <TextButton onClick={action.onClick}>{action.label}</TextButton>
          ) : (
            <div className="text-[15px] font-medium text-app-text leading-[21px]">{value}</div>
          )}
          {chip ? (
            <div className="mt-2">
              <Chip label={chip.label} variant={chip.variant ?? 'neutral'} icon={chip.icon} />
            </div>
          ) : null}
          {caption ? <div className="text-[12.5px] text-app-text-muted mt-1.5">{caption}</div> : null}
        </div>
        {sparkline ? <Sparkline /> : null}
      </div>
    );
  }

  const headerGap = loading || state === 'error' ? 'mb-3' : 'mb-2.5';

  return (
    <div
      onClick={onClick}
      className={`bg-app-surface border border-app-border rounded-2xl shadow-sm ${compact ? 'p-3.5' : 'p-4'} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className={`flex items-center gap-3 ${headerGap}`}>
        <IconTile icon={icon} tone={tone} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-app-text -tracking-[0.01em]">{title}</div>
        </div>
        {asOf && !loading ? (
          <div
            className={`flex items-center gap-1.5 text-xs whitespace-nowrap ${
              state === 'stale' ? 'text-app-warning' : 'text-app-text-muted'
            }`}
          >
            {state === 'stale' ? <RefreshCw size={13} strokeWidth={2} /> : null}
            <span>{asOf}</span>
          </div>
        ) : null}
        {onClick && !loading ? <Chevron /> : null}
      </div>
      {body}
    </div>
  );
}
