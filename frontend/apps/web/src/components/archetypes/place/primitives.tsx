// ============================================================
// Place archetype — shared atoms (web mirror of place-components.jsx)
//
// Home-green accent = colors.identity.home (app-home); CTAs/links =
// colors.primary (primary-600). Tokens only — white bordered cards,
// rounded-2xl, shadow-sm, NO left-border accents; color lives in the
// icon tiles, chips, dots and pills. Presentational: data in via props.
// ============================================================

'use client';

import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ArrowRight, Check, ChevronRight, Home, User } from 'lucide-react';

// ── Icon tone tile ──────────────────────────────────────────
// Rounded square that carries the section's lucide glyph. `home` is
// the Place accent; `muted` is the degraded/neutral tone; `sky` is the
// CTA tone (used by selectable / informational tiles).
export type PlaceTone = 'home' | 'muted' | 'sky';

const TILE_TONE: Record<PlaceTone, string> = {
  home: 'bg-app-home-bg text-app-home',
  muted: 'bg-app-surface-sunken text-app-text-muted',
  sky: 'bg-primary-100 text-primary-600',
};

export interface IconTileProps {
  icon: LucideIcon;
  tone?: PlaceTone;
  size?: number;
  className?: string;
}

export function IconTile({ icon: Icon, tone = 'home', size = 34, className = '' }: IconTileProps) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-[9px] ${TILE_TONE[tone]} ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.56)} strokeWidth={2} />
    </span>
  );
}

// ── Chevron — the tap-through affordance ────────────────────
export function Chevron({ className = '' }: { className?: string }) {
  return <ChevronRight size={18} strokeWidth={2.25} className={`shrink-0 text-app-text-muted ${className}`} />;
}

// ── Verbs-first sky text button (the CTA voice) ─────────────
export interface TextButtonProps {
  children: ReactNode;
  onClick?: () => void;
  arrow?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}

export function TextButton({ children, onClick, arrow = true, type = 'button', className = '' }: TextButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center gap-1 bg-transparent p-0 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors ${className}`}
    >
      {children}
      {arrow ? <ArrowRight size={15} strokeWidth={2.25} className="shrink-0" /> : null}
    </button>
  );
}

// ── Status dot (a small semantic reading marker) ────────────
export type StatusDotTone = 'success' | 'warning' | 'error' | 'neutral';

const DOT_TONE: Record<StatusDotTone, string> = {
  success: 'bg-app-success',
  warning: 'bg-app-warning',
  error: 'bg-app-error',
  neutral: 'bg-app-text-muted',
};

export function StatusDot({ tone = 'success' }: { tone?: StatusDotTone }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${DOT_TONE[tone]}`} />;
}

// ── Qualitative value sparkline (home-green trend) ──────────
// Shape is illustrative, not data-bound — a calm upward trend in the
// Place accent. currentColor keeps it token-driven (text-app-home).
export function Sparkline({ className = '' }: { className?: string }) {
  const gid = `place-spark-${useId().replace(/:/g, '')}`;
  const pts = '0,26 14,24 28,25 42,20 56,21 70,15 84,13 98,8 112,9 126,4';
  return (
    <svg
      width="118"
      height="34"
      viewBox="0 0 126 30"
      className={`shrink-0 overflow-visible text-app-home ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,30 ${pts} 126,30`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="126" cy="4" r="2.6" fill="currentColor" />
    </svg>
  );
}

// ── Verified / claimed avatar ───────────────────────────────
// verified → green disc + green check badge; claimed → slate disc +
// amber home badge; none → neutral disc, no badge.
export type PlaceAvatarStatus = 'verified' | 'claimed' | 'none';

export interface PlaceAvatarProps {
  initials?: string;
  status?: PlaceAvatarStatus;
  size?: number;
  /**
   * Optional status pill rendered under the disc (e.g. "Claimed"). Used
   * to make the claimed-but-unverified state legible and motivate the
   * verify step. Verified avatars carry the green check, not a pill.
   */
  label?: string;
  className?: string;
}

export function PlaceAvatar({ initials = 'RC', status = 'verified', size = 40, label, className = '' }: PlaceAvatarProps) {
  const disc =
    status === 'verified'
      ? 'text-white bg-gradient-to-br from-green-500 to-green-700'
      : status === 'claimed'
        ? 'text-white bg-gradient-to-br from-slate-400 to-slate-500'
        : 'text-app-text-secondary bg-app-surface-sunken';
  const badge = Math.round(size * 0.42);

  const inner = (
    <>
      <span
        className={`inline-flex items-center justify-center w-full h-full rounded-full font-bold ${disc}`}
        style={{ fontSize: Math.round(size * 0.34) }}
      >
        {initials ? initials : <User size={Math.round(size * 0.5)} strokeWidth={2} />}
      </span>
      {status === 'verified' ? (
        <span
          className="absolute -right-0.5 -bottom-0.5 inline-flex items-center justify-center rounded-full bg-app-home border-2 border-app-surface"
          style={{ width: badge, height: badge }}
        >
          <Check size={Math.round(size * 0.24)} strokeWidth={3.25} className="text-white" />
        </span>
      ) : null}
      {status === 'claimed' ? (
        <span
          className="absolute -right-0.5 -bottom-0.5 inline-flex items-center justify-center rounded-full bg-app-warning border-2 border-app-surface"
          style={{ width: badge, height: badge }}
        >
          <Home size={Math.round(size * 0.22)} strokeWidth={2.75} className="text-white" />
        </span>
      ) : null}
    </>
  );

  if (!label) {
    return (
      <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
        {inner}
      </span>
    );
  }

  // With a label: the disc + a small amber pill, stacked and centered.
  return (
    <span className={`inline-flex flex-col items-center gap-1.5 shrink-0 ${className}`}>
      <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
        {inner}
      </span>
      <span className="text-[10px] leading-[13px] font-bold uppercase tracking-[0.04em] text-app-warning bg-app-warning-bg border border-app-warning-light rounded-full px-1.5 py-0.5">
        {label}
      </span>
    </span>
  );
}

// ── Card shell — white, bordered, rounded-2xl, shadow-sm ─────
// The one card frame for the whole archetype. No left-border accents.
export interface PlaceCardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function PlaceCard({ children, onClick, className = '' }: PlaceCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-app-surface border border-app-border rounded-2xl shadow-sm ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
