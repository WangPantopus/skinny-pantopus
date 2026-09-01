// ============================================================
// Place — ContentDetail chrome (web mirror of the place-*-detail.jsx
// design references). The shared furniture every group-detail page sits
// inside: a sticky back-header, the overline section label, the
// source / "as of" caption, the post-v1 "coming soon" row, and the
// quiet info note that closes each screen.
//
// Tokens only — white bordered cards, home-green accent, sky CTAs.
// Responsive: mobile-web-first single column; the header sticks below
// the AppShell top bar (top-14) instead of the mobile status bar.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Info } from 'lucide-react';
import Chip from '../primitives/Chip';

// ── Sticky back-header — back chevron + title + address ──────
export interface DetailHeaderProps {
  title: string;
  /** Compact address line, e.g. "1421 SE Oak St · Portland". */
  address?: string;
  /** In-page leaf back (overrides navigation). */
  onBack?: () => void;
  /** Route to return to when there's no onBack. Defaults to the dashboard. */
  backHref?: string;
}

export function DetailHeader({ title, address, onBack, backHref = '/app/place' }: DetailHeaderProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.push(backHref));
  // At lg+ the PlaceShell nav rail handles section navigation, so the back
  // chevron only renders below lg — EXCEPT for in-page leaves (onBack),
  // which still need a way back to their parent screen on any viewport.
  const backVisibility = onBack ? '' : 'lg:hidden';
  return (
    <div className="sticky top-14 z-30 px-4 sm:px-5 bg-app-bg/80 supports-[backdrop-filter]:bg-app-bg/70 backdrop-blur-md border-b border-app-border lg:rounded-b-xl">
      <div className="flex items-center gap-2.5 py-2.5">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className={`w-9 h-9 rounded-full bg-app-surface border border-app-border shadow-sm flex items-center justify-center shrink-0 text-app-text-strong hover:bg-app-hover transition ${backVisibility}`}
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[20px] leading-6 font-bold -tracking-[0.02em] text-app-text truncate">{title}</h1>
          {address ? (
            <p className="text-[12.5px] font-medium text-app-text-muted truncate mt-0.5" title={address}>{address}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Overline section label (denser detail rhythm) ───────────
export function DetailSectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] font-bold tracking-[0.08em] uppercase text-app-text-muted px-1 mt-6 mb-2 ${className}`}>
      {children}
    </div>
  );
}

// ── Source / "as of" caption ────────────────────────────────
export function SourceNote({ name, asOf }: { name: string; asOf?: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-2.5 text-[12px] text-app-text-muted">
      <span className="font-medium">{name}</span>
      {asOf ? (
        <>
          <span className="opacity-50">·</span>
          <span>{asOf}</span>
        </>
      ) : null}
    </div>
  );
}

// ── Post-v1 "coming soon" row ───────────────────────────────
export function ComingSoonRow({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub: string }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm px-3.5 py-3 flex items-center gap-3">
      <span className="w-9 h-9 rounded-[9px] bg-app-surface-sunken flex items-center justify-center shrink-0 text-app-text-muted">
        <Icon size={19} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-app-text-secondary truncate">{title}</div>
        <div className="text-[12.5px] text-app-text-muted mt-0.5 truncate">{sub}</div>
      </div>
      <Chip label="Coming soon" variant="neutral" />
    </div>
  );
}

// ── Quiet info note (closes each screen / status leaves) ────
export type InfoNoteTone = 'neutral' | 'warning' | 'sky';

const INFO_NOTE_TONE: Record<InfoNoteTone, { wrap: string; icon: string; text: string }> = {
  neutral: { wrap: 'bg-app-surface border-app-border', icon: 'text-app-text-muted', text: 'text-app-text-secondary' },
  warning: { wrap: 'bg-app-warning-bg border-app-warning-light', icon: 'text-app-warning', text: 'text-app-text-strong' },
  sky: { wrap: 'bg-app-info-bg border-app-info-light', icon: 'text-app-info', text: 'text-app-text-strong' },
};

export function InfoNote({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: InfoNoteTone; className?: string }) {
  const c = INFO_NOTE_TONE[tone];
  return (
    <div className={`flex items-start gap-2 mt-4 px-3.5 py-3 rounded-xl border ${c.wrap} ${className}`}>
      <Info size={15} strokeWidth={2} className={`mt-0.5 shrink-0 ${c.icon}`} />
      <span className={`text-[12.5px] leading-[18px] ${c.text}`}>{children}</span>
    </div>
  );
}
