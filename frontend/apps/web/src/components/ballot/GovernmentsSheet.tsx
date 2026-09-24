// ============================================================
// The still governments view (proposed board "P0: still governments
// view" — the Peel board's finished frame, which is also what reduced
// motion shows). A full-screen sheet on phones and a 390 × 844 panel
// on wider screens: the full progress bar, the address with Close, the
// stack at the peel's geometry, "Your address" over the serif count,
// the names, and Done with the boundary source.
//
// The animated story (1.2 s a step) waits for P1, when every government
// has a true caption.
// ============================================================

'use client';

import { useEffect, useId, useRef } from 'react';
import GovernmentStack from './GovernmentStack';

export interface GovernmentsSheetData {
  count: number;
  count_is_minimum: boolean;
  summary: string;
  caveat: string;
  source_line: string;
}

export function GovernmentsView({
  governments,
  address,
  onClose,
  titleId,
  closeRef,
}: {
  governments: GovernmentsSheetData;
  address: string;
  onClose: () => void;
  titleId?: string;
  closeRef?: React.Ref<HTMLButtonElement>;
}) {
  const n = governments.count_is_minimum ? `at least ${governments.count}` : String(governments.count);
  return (
    <div className="relative flex h-full min-h-[844px] w-full flex-col bg-app-surface text-app-text">
      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="h-1 rounded-full bg-app-text" />
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold leading-[normal] text-app-text-secondary">{address}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="py-[10px] pl-3 text-[14px] font-semibold leading-[normal] text-app-link hover:text-primary-900"
          >
            Close
          </button>
        </div>
      </div>
      <div className="flex justify-center">
        <GovernmentStack count={governments.count} size="peel" label={`${governments.count} government boundary layers stacked above the address`} homeTitle={address} />
      </div>
      <div className="mx-4 flex flex-col gap-[6px]">
        <span className="text-[11px] font-semibold uppercase leading-[normal] tracking-[0.07em] text-app-home">Your address</span>
        <span
          id={titleId}
          className="text-[30px] font-bold leading-[34px] -tracking-[0.015em] text-app-text"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          You are standing in {n} governments.
        </span>
        <span className="text-[15px] leading-[22px] text-app-text-strong">
          {governments.summary} {governments.caveat}
        </span>
      </div>
      <div className="absolute bottom-6 left-4 right-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-[50px] items-center justify-center rounded-lg bg-primary-700 text-[16px] font-semibold leading-[normal] text-white hover:bg-primary-800"
        >
          Done
        </button>
        <span className="text-center text-[12px] leading-4 text-app-text-muted">{governments.source_line}</span>
      </div>
    </div>
  );
}

export default function GovernmentsSheet({
  open,
  onClose,
  governments,
  address,
}: {
  open: boolean;
  onClose: () => void;
  governments: GovernmentsSheetData | null;
  address: string;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open || !governments) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="h-full w-full overflow-y-auto sm:h-[844px] sm:max-h-[calc(100dvh-32px)] sm:w-[390px] sm:overflow-hidden sm:rounded-2xl">
        <GovernmentsView governments={governments} address={address} onClose={onClose} titleId={titleId} closeRef={closeRef} />
      </div>
    </div>
  );
}
