// ============================================================
// Place — LOCKED card. Content the current tier can't see yet.
// Same card frame; a small lock in the header (not a color-flooded
// card), a one-line reason, and a verbs-first CTA. The reason copy is
// always "get / keep", never "unlock".
//   "Save this place to…"  ·  "Claim your place to…"  ·  "Verify your address to…"
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { IconTile, TextButton } from './primitives';

export interface LockedCardProps {
  icon: LucideIcon;
  title: string;
  reason: ReactNode;
  /** Verbs-first CTA, e.g. "Create account" / "Claim home" / "Verify address". */
  cta: string;
  onCta?: () => void;
  className?: string;
}

export default function LockedCard({ icon, title, reason, cta, onCta, className = '' }: LockedCardProps) {
  return (
    <div className={`bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-2.5">
        <IconTile icon={icon} tone="muted" />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-app-text-strong -tracking-[0.01em]">{title}</div>
        </div>
        <Lock size={16} strokeWidth={2} className="shrink-0 text-app-text-muted" />
      </div>
      <p className="text-sm text-app-text-secondary leading-5 mb-2.5">{reason}</p>
      <TextButton onClick={onCta}>{cta}</TextButton>
    </div>
  );
}
