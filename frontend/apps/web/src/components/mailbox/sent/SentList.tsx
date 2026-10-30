'use client';

// ============================================================
// Sent (Mail drawings M2, M5; contract "Sent"): what you've sent, newest
// first. Cards still waiting for the carrier's 7 a.m. pickup sit in their own
// well at the top; the rest go under the day you sent them, by your clock.
// 25 at a time, more as you scroll. Never whether a card was opened.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SentPiece } from '@pantopus/api';
import { useSentCards, useTakeBackHolidayCard } from '@/lib/mailbox-queries';
import ErrorState from '@/components/ui/ErrorState';
import { toast } from '@/components/ui/toast-store';
import MailboxIllustration from '../MailboxIllustration';
import { calendarDay } from '../MailRow';
import { mailLoadMessage } from '../mailLoadMessage';
import useMailAddressee from '../useMailAddressee';
import { askTakeBack, takeBackMessage } from '../cards/takeBack';
import SentRow from './SentRow';
import { sentDayLabel } from './sentWords';

const heading = 'px-1 pb-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.06em] text-app-text-secondary';

export default function SentList({ selectedId }: { selectedId?: string }) {
  const { timeZone } = useMailAddressee();
  const sent = useSentCards();
  const takeBack = useTakeBackHolidayCard();
  const [takingId, setTakingId] = useState<string | null>(null);

  const items = useMemo(() => sent.data?.pages.flatMap((page) => page.items) ?? [], [sent.data]);
  const waiting = items.filter((piece) => piece.status === 'waiting');
  const groups = useMemo(() => {
    const out: { label: string; items: SentPiece[] }[] = [];
    for (const piece of items) {
      if (piece.status === 'waiting') continue;
      const label = sentDayLabel(piece.sent_at, timeZone);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(piece);
      else out.push({ label, items: [piece] });
    }
    return out;
  }, [items, timeZone]);

  // More as you scroll, like Incoming.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = sent;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  const onTakeBack = async (piece: SentPiece) => {
    const today = calendarDay(new Date(), timeZone);
    const yes = await askTakeBack({ byEmail: piece.by_email, sentToday: calendarDay(new Date(piece.sent_at), timeZone) === today });
    if (!yes) return;
    setTakingId(piece.id);
    takeBack.mutate(piece.id, {
      onSuccess: () => toast.success('You took your card back.'),
      onError: (error) => toast.error(takeBackMessage(error)),
      onSettled: () => setTakingId(null),
    });
  };

  const row = (piece: SentPiece) => (
    <div role="listitem" key={piece.id}>
      <SentRow piece={piece} selected={piece.id === selectedId} takingBack={takingId === piece.id} onTakeBack={(p) => { void onTakeBack(p); }} />
    </div>
  );

  return (
    <div data-testid="mailSent" className="pb-6">
      <p className="px-4 pt-3 text-[13px] leading-[18px] text-app-text-secondary">What you’ve sent, newest first.</p>

      {sent.isPending ? (
        <div className="space-y-5 px-4 py-4" role="status" aria-label="Loading what you’ve sent">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-[150px] rounded-md bg-app-surface-sunken animate-pulse" />
              <div className="mt-2 h-3 w-40 rounded bg-app-surface-sunken animate-pulse" />
            </div>
          ))}
        </div>
      ) : sent.isError && items.length === 0 ? (
        <ErrorState title="Couldn't load your mail" message={mailLoadMessage(sent.error)} onRetry={() => { void sent.refetch(); }} />
      ) : items.length === 0 ? (
        <section aria-label="Nothing sent yet" className="flex flex-col items-center px-6 py-12 text-center">
          <MailboxIllustration state="closed" size={132} />
          <h3 className="mt-3 text-lg font-semibold text-app-text">Nothing sent yet.</h3>
          <p className="mt-1 max-w-xs text-sm text-app-text-secondary">Cards you send show up here, with when they arrive.</p>
        </section>
      ) : (
        <>
          {waiting.length ? (
            <section aria-label="Waiting for pickup" data-testid="mailSentWaiting" className="px-3 pt-4">
              <h3 className={heading}>Waiting for pickup</h3>
              <div role="list" className="space-y-4 rounded-[20px] bg-[#eeeae3] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] [@media(prefers-color-scheme:dark)]:bg-app-surface-sunken [@media(prefers-color-scheme:dark)]:shadow-none">
                {waiting.map(row)}
              </div>
            </section>
          ) : null}
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label} className="px-3 pt-4">
              <h3 className={heading}>{group.label}</h3>
              <div role="list" className="space-y-4">{group.items.map(row)}</div>
            </section>
          ))}

          <div ref={sentinelRef} className="h-4" />

          {/* A later page failed: keep the rows, retry that page */}
          {sent.isFetchNextPageError ? (
            <div role="alert" className="mx-3 my-4 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-strong">
              <p>Couldn&apos;t load more of what you&apos;ve sent. {mailLoadMessage(sent.error)}</p>
              <button
                type="button"
                disabled={isFetchingNextPage}
                onClick={() => { if (!isFetchingNextPage) void fetchNextPage(); }}
                className="flex-shrink-0 font-semibold text-primary-600 hover:underline disabled:opacity-50"
              >
                Try again
              </button>
            </div>
          ) : null}

          {isFetchingNextPage ? (
            <div className="py-4 text-center" role="status" aria-label="Loading more of what you’ve sent">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-app-border border-t-gray-600" />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
