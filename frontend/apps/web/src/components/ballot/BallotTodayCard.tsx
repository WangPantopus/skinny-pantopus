// ============================================================
// Today — the "Ballot week" card and the "Moved this year?" well
// (Board: Today in ballot week, as corrected on the proposed P0 board:
// no Mail Day line, no personal delivery date, no plan line before P2).
// ============================================================

'use client';

import Link from 'next/link';
import { Calendar } from 'lucide-react';
import type { PlaceBallotElectionData } from '@pantopus/types';
import { BallotTile } from './BallotGlyph';
import { CARD_FRAME } from './BallotCard';
import { daysLeft } from './format';

export interface BallotTodayCardProps {
  data: PlaceBallotElectionData;
  /** Where "Open your ballot" goes (the Place card). */
  ballotHref: string;
}

export function hasBallotToday(data: PlaceBallotElectionData | null | undefined): boolean {
  return Boolean(data && ((data.ballot_week && data.ballot_week.show) || data.mover_prompt));
}

export default function BallotTodayCard({ data, ballotHref }: BallotTodayCardProps) {
  const week = data.ballot_week && data.ballot_week.show ? data.ballot_week : null;
  const mover = data.mover_prompt ?? null;
  if (!week && !mover) return null;

  return (
    <div className="flex flex-col gap-4">
      {week ? (
        <section aria-label={week.overline || 'Ballot week'} className={`${CARD_FRAME} gap-3`}>
          <div className="flex items-center gap-[10px]">
            <BallotTile />
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase leading-[normal] tracking-[0.07em] text-app-home">{week.overline}</span>
              <span className="text-[15px] font-semibold leading-[normal] text-app-text">{week.title}</span>
            </div>
          </div>
          {week.body ? <div className="text-[13.5px] leading-[19px] text-app-text-strong">{week.body}</div> : null}
          <Link
            href={ballotHref}
            className="flex h-11 items-center justify-center rounded-lg bg-primary-700 text-[14.5px] font-semibold leading-[normal] text-white no-underline hover:bg-primary-800 hover:text-white"
          >
            Open your ballot
          </Link>
        </section>
      ) : null}
      {mover ? (
        <a
          href={mover.url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-[10px] rounded-xl bg-app-warning-bg px-[14px] py-3 text-app-warning no-underline hover:text-app-warning"
        >
          <Calendar size={18} strokeWidth={2} className="min-w-0" aria-hidden="true" />
          <span className="text-[13.5px] leading-[19px]">
            {mover.text} {daysLeft(mover.days_left)}
          </span>
        </a>
      ) : null}
    </div>
  );
}
