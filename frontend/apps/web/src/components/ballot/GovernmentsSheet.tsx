// ============================================================
// The governments view (Board: The peel, with the proposed board "P0:
// governments view"). A full-screen sheet on phones and a 390 × 844
// panel on wider screens: the progress bar, the address with Skip, the
// stack at the peel's geometry, then the story — each government lifts,
// takes the green highlight and shows its caption for 1.2 s — ending on
// the finished frame: "Your address" over the serif count, the names,
// and Done with the boundary source.
//
// P0 captions carry the overline and the name only. The board's third
// line says what each government decides this year, which needs
// contest data (P1), so it is left out. The story plays once and holds
// the finished frame (the board loops only as a prototype); Skip jumps
// there, and reduced motion starts there.
// ============================================================

'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from '@/components/scheduling/polish/a11y';
import GovernmentStack, { STACK_POLYGONS, STORY_STEP_MS } from './GovernmentStack';

export interface GovernmentsSheetData {
  count: number;
  count_is_minimum: boolean;
  /** In stack order: United States first, then the state, county, schools, city. */
  items?: { name: string }[];
  summary: string;
  caveat: string;
  source_line: string;
}

/** "Government 2 of at least 5" — a P0 count is a minimum. */
export function storyOverline(k: number, total: number, minimum: boolean): string {
  return `Government ${k} of ${minimum ? 'at least ' : ''}${total}`;
}

export function GovernmentsView({
  governments,
  address,
  onClose,
  titleId,
  closeRef,
  animate = true,
}: {
  governments: GovernmentsSheetData;
  address: string;
  onClose: () => void;
  titleId?: string;
  closeRef?: React.Ref<HTMLButtonElement>;
  /** False renders the finished frame (the still board). */
  animate?: boolean;
}) {
  const n = governments.count_is_minimum ? `at least ${governments.count}` : String(governments.count);
  const steps = (governments.items ?? []).slice(0, Math.min(governments.count, STACK_POLYGONS.length));
  const reduced = useReducedMotion();
  const [finished, setFinished] = useState(false);
  const playing = animate && !reduced && !finished && steps.length > 0;
  const delay = (k: number) => ({ animationDelay: `${k * STORY_STEP_MS}ms` });

  return (
    <div className="relative flex h-full min-h-[844px] w-full flex-col bg-app-surface text-app-text">
      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="relative h-1 overflow-hidden rounded-full bg-app-border">
          <div
            className={`absolute inset-0 origin-left rounded-full bg-app-text ${playing ? 'motion-safe:animate-[ballotBar_1s_linear_both]' : ''}`}
            style={playing ? { animationDuration: `${(steps.length + 1) * STORY_STEP_MS}ms` } : undefined}
            onAnimationEnd={() => setFinished(true)}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold leading-[normal] text-app-text-secondary">{address}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={playing ? () => setFinished(true) : onClose}
            className="py-[10px] pl-3 text-[14px] font-semibold leading-[normal] text-app-link hover:text-primary-900"
          >
            {playing ? 'Skip' : 'Close'}
          </button>
        </div>
      </div>
      <div className="flex justify-center">
        <GovernmentStack
          count={governments.count}
          size="peel"
          story={playing}
          label={`${governments.count} government boundary layers stacked above the address`}
          homeTitle={address}
        />
      </div>
      <div className="relative mx-4">
        {playing
          ? steps.map((g, k) => (
            <div
              key={`${k}-${g.name}`}
              aria-hidden="true"
              className="absolute inset-x-0 top-0 flex flex-col gap-[6px] opacity-0 motion-safe:animate-[ballotCap_1.2s_ease-out_both]"
              style={delay(k)}
            >
              <span className="text-[11px] font-semibold uppercase leading-[normal] tracking-[0.07em] text-app-home">
                {storyOverline(k + 1, governments.count, governments.count_is_minimum)}
              </span>
              <span className="text-[24px] font-bold leading-[30px] -tracking-[0.015em] text-app-text">{g.name}</span>
            </div>
          ))
          : null}
        <div
          className={`flex flex-col gap-[6px] ${playing ? 'motion-safe:animate-[ballotCapIn_0.18s_ease-out_both]' : ''}`}
          style={playing ? delay(steps.length) : undefined}
        >
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
