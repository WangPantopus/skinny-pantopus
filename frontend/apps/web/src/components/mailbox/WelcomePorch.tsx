'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { MailItemV2 } from '@/types/mailbox';

const SERIF = "'Iowan Old Style', 'Hoefler Text', Charter, Georgia, serif";
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const OPEN_MS = 700;

/** The welcome letter from Pantopus (SRV-6), still sealed. */
export function isSealedWelcome(item: MailItemV2): boolean {
  const extracted = (item as MailItemV2 & { mail_extracted?: { pantopus_letter?: unknown } }).mail_extracted;
  const key = typeof extracted?.pantopus_letter === 'string' ? extracted.pantopus_letter : '';
  return Boolean(item.from_pantopus) && key.startsWith('welcome:') && !item.opened_at && !item.viewed;
}

/**
 * The first day (Mail tab drawings, R12-Welcome): your front porch, and on the
 * mat the sealed letter from Pantopus. Open envelope lifts the flap and opens
 * the letter; Skip the animation (or Reduce Motion) opens it at once; Close
 * leaves it sealed in Incoming.
 */
export default function WelcomePorch({
  address,
  onOpen,
  onClose,
}: {
  address: string | null;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const number = address?.match(/^\s*(\d+[A-Za-z]?)\b/)?.[1] ?? null;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    openRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; before?.focus?.(); };
  }, [onClose]);

  const open = () => {
    if (opening) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onOpen(); return; }
    setOpening(true);
    window.setTimeout(onOpen, OPEN_MS);
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="welcome-title" className="fixed inset-0 z-[1000] overflow-hidden bg-[#efe6d8] text-[#111827]">
      {/* The porch: siding, the door with its number and light, the boards and the mat */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 bottom-[230px]" style={{ background: 'repeating-linear-gradient(180deg, #efe6d8 0 26px, #e4d8c5 26px 28px)' }} />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[230px]" style={{ background: 'repeating-linear-gradient(90deg, #d9c7a8 0 62px, #ccb994 62px 64px)' }} />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-[228px] h-1.5 bg-[#b8a27c]" />
      <div aria-hidden="true" className="absolute bottom-0 left-1/2 h-full w-[390px] -translate-x-1/2">
        <div className="absolute bottom-[224px] left-[105px] w-[180px] rounded-t bg-[#f8fafc]" style={{ height: 'clamp(180px, calc(100% - 470px), 370px)' }}>
          <div className="absolute inset-x-3 bottom-0 top-3 rounded-t-sm bg-[#0369a1]">
            <div className="absolute inset-x-[18px] top-[22px] h-[30%] rounded-[3px] border-[3px] border-[#075985]" />
            <div className="absolute inset-x-[18px] top-[calc(30%+44px)] bottom-[30px] rounded-[3px] border-[3px] border-[#075985]" />
            <div className="absolute right-4 top-[46%] h-3 w-3 rounded-full bg-[#fbbf24]" />
          </div>
        </div>
        {number ? (
          <div className="absolute bottom-[calc(224px+min(320px,calc(100%-520px)))] left-[300px] h-6 min-w-[40px] rounded-[3px] bg-[#1f2937] px-1.5 text-center text-xs font-bold leading-6 text-[#f8fafc]" style={{ fontFamily: MONO }}>
            {number}
          </div>
        ) : null}
        <div className="absolute bottom-[calc(224px+min(300px,calc(100%-540px)))] left-[60px] h-[34px] w-[22px] rounded-[10px_10px_4px_4px] bg-[#fde68a] shadow-[0_0_30px_14px_rgba(253,230,138,0.55)]" />
        <div className="absolute bottom-[150px] left-[85px] h-[62px] w-[220px] rounded-md bg-[#8a6a4a] shadow-[0_6px_12px_rgba(0,0,0,0.15)]">
          <div className="absolute inset-[7px] rounded border-2 border-dashed border-[#a7835e]" />
        </div>
      </div>

      {/* The sealed letter on the mat */}
      <button
        type="button"
        onClick={open}
        aria-label="Open the letter from Pantopus"
        className="absolute bottom-[166px] left-1/2 h-[110px] w-[170px] -translate-x-1/2 rounded focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500"
        style={{ transform: 'translateX(-50%) rotate(-4deg)' }}
      >
        <svg width="170" height="110" viewBox="0 0 170 110" aria-hidden="true" className="block" style={{ filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.22))', overflow: 'visible' }}>
          <rect x="1" y="1" width="168" height="108" rx="4" fill="#fbf6ea" stroke="#e5d9bd" />
          <path d="M1 106 L85 52 L169 106" fill="none" stroke="#e5d9bd" strokeWidth="1.5" />
          <g style={{ transformOrigin: '85px 2px', transform: opening ? 'scaleY(-1)' : 'none', transition: `transform ${OPEN_MS - 150}ms ease-in-out` }}>
            <path d="M1 3 L85 62 L169 3 Z" fill="#f4ecd9" stroke="#e5d9bd" strokeWidth="1.5" strokeLinejoin="round" />
            {!opening ? (
              <>
                <circle cx="85" cy="62" r="17" fill="#0369a1" />
                <circle cx="85" cy="62" r="12.5" fill="#075985" />
                <text x="85" y="67" textAnchor="middle" fontSize="13" fontWeight="700" fill="#e0f2fe" fontFamily={SERIF}>P</text>
              </>
            ) : null}
          </g>
        </svg>
      </button>

      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-[#1f2937] hover:bg-white">
        <X className="h-5 w-5" aria-hidden />
      </button>

      <div className="absolute inset-x-6 top-[72px] text-center">
        <p className="text-[11px] font-semibold uppercase leading-4 tracking-[0.08em] text-[#4e5563]">From Pantopus</p>
        <h1 id="welcome-title" className="mt-1.5 text-[32px] leading-[38px] text-[#0f172a]" style={{ fontFamily: SERIF }}>A letter has arrived for you</h1>
        <p className="mt-2 text-[15px] leading-[22px] text-[#374151]">
          {address ? `Your first piece of mail at ${address}.` : 'Your first piece of mail.'}
        </p>
      </div>

      <div className="absolute inset-x-4 bottom-[34px] mx-auto flex max-w-sm flex-col items-center gap-1.5">
        <button ref={openRef} type="button" onClick={open} disabled={opening} className="min-h-[48px] w-full rounded-xl bg-primary-600 px-4 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-80">
          {opening ? 'Opening…' : 'Open envelope'}
        </button>
        <button type="button" onClick={onOpen} className="min-h-[44px] px-3 text-sm font-semibold text-[#1f2937] underline">
          Skip the animation
        </button>
      </div>
    </div>,
    document.body,
  );
}
