// ============================================================
// /start — the ballot teaser (Board: Web lookup, and the proposed P0
// "web lookup teaser" board). A card under the aha card: the green
// "On record for this address" overline, a 24/30 headline, the still
// stack beside a legend of the governments by name, the one deadline
// that needs action in the warning well, one primary action and the
// source line. Outside the pilot: the election date, one sentence and
// the official link — never a count.
//
// "Compare with a friend" and the decisions line wait for P0.5 / P1.
// ============================================================

'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { BallotTeaser as BallotTeaserData } from '@pantopus/types';
import GovernmentStack from './GovernmentStack';
import GovernmentsSheet from './GovernmentsSheet';
import { NoticeWell } from './BallotCard';
import { daysLeft } from './format';

const FRAME =
  'rounded-2xl border border-app-border bg-app-surface px-4 py-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col gap-[14px]';
const PRIMARY =
  'flex h-[46px] items-center justify-center gap-2 rounded-lg bg-primary-700 text-[15px] font-semibold leading-[normal] text-white no-underline hover:bg-primary-800 hover:text-white';

export interface BallotTeaserProps {
  teaser: BallotTeaserData;
  /** The looked-up street line, for the governments view header. */
  address: string;
  className?: string;
  /** Clock for the "as of" time (tests pass a fixed one). */
  now?: Date;
}

export default function BallotTeaser({ teaser, address, className = '', now }: BallotTeaserProps) {
  const [open, setOpen] = useState(false);
  const gov = teaser.governments;
  const time = (now ?? new Date()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const action = teaser.primary_action;

  return (
    <section aria-label="Election information for this address" className={`${FRAME} ${className}`}>
      <div className="text-[11px] font-semibold uppercase leading-4 tracking-[0.07em] text-app-home">On record for this address</div>
      <h2 className="m-0 text-[24px] font-bold leading-[30px] -tracking-[0.015em] text-app-text">{teaser.headline}</h2>

      {gov ? (
        <div className="flex items-center gap-3">
          <GovernmentStack count={gov.count} size="teaser" shrink label={`${gov.count} stacked boundary shapes over the address`} />
          <div className="flex flex-col gap-3 text-[13px] leading-[18px] text-app-text-strong">
            {gov.items.map((item) => (
              <div key={`${item.level}-${item.name}`} className="flex items-start gap-2">
                <span className="mt-2 h-0 w-[18px] shrink-0 border-t-2 border-app-text" aria-hidden="true" />
                <span>{item.name}</span>
              </div>
            ))}
            <div className="flex items-start gap-2">
              <span className="mt-[3px] flex w-[18px] shrink-0 justify-center" aria-hidden="true">
                <span className="h-[10px] w-[10px] rounded-full bg-app-home" />
              </span>
              <span>This address</span>
            </div>
          </div>
        </div>
      ) : null}

      {teaser.note ? <div className="text-[15px] font-medium leading-[21px] text-app-text">{teaser.note}</div> : null}

      {teaser.next_deadline ? (
        <NoticeWell
          lead={teaser.next_deadline.lead}
          detail={[daysLeft(teaser.next_deadline.days_left), teaser.next_deadline.detail].filter(Boolean).join(' ')}
        />
      ) : null}

      {action ? (
        <div className="flex flex-col gap-2">
          {action.kind === 'governments' && gov ? (
            <button type="button" className={PRIMARY} onClick={() => setOpen(true)}>
              {action.label}
            </button>
          ) : action.kind === 'link' && action.url ? (
            <a className={PRIMARY} href={action.url} target="_blank" rel="noopener noreferrer">
              {action.label}
              <ExternalLink size={16} strokeWidth={2} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="text-[12.5px] leading-[18px] text-app-text-muted">
        {/* Only a live lookup has a time; the links-only card has none. */}
        {teaser.source_line}
        {teaser.coverage === 'supported' ? ` · as of ${time}` : ''}.
      </div>

      {gov ? <GovernmentsSheet open={open} onClose={() => setOpen(false)} governments={gov} address={address} /> : null}
    </section>
  );
}
