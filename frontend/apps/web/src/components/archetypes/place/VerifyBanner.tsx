// ============================================================
// Place — VERIFY BANNER. The gentle T3 → T4 nudge that sits above the
// pulse on a claimed (unverified) dashboard: "Verify your address to
// message neighbors and get your badge." Sky-toned (the CTA voice, not
// the Place green), routes to address verification. Same flat card
// frame — color lives in the icon tile + text, never a left-border.
// ============================================================

'use client';

import { ShieldCheck, ArrowRight, ChevronRight } from 'lucide-react';

export interface VerifyBannerProps {
  /** The reassuring "get / keep" line; never "unlock". */
  title?: string;
  /** Verbs-first CTA. */
  cta?: string;
  /** Routes to verification (required — the whole banner is the control). */
  onClick: () => void;
  className?: string;
}

export default function VerifyBanner({
  title = 'Verify your address to message neighbors and get your badge.',
  cta = 'Verify address',
  onClick,
  className = '',
}: VerifyBannerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 text-left rounded-2xl bg-primary-50 border border-primary-200 shadow-sm px-3.5 py-3 hover:bg-primary-100 transition-colors ${className}`}
    >
      <span className="inline-flex items-center justify-center shrink-0 w-[38px] h-[38px] rounded-xl bg-primary-100 border border-primary-200 text-primary-600">
        <ShieldCheck size={20} strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-semibold text-primary-900 leading-5 -tracking-[0.01em]">
          {title}
        </span>
        <span className="inline-flex items-center gap-1 mt-1 text-[13.5px] font-semibold text-primary-600">
          {cta}
          <ArrowRight size={14} strokeWidth={2.5} className="shrink-0" />
        </span>
      </span>
      <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-primary-300" />
    </button>
  );
}
