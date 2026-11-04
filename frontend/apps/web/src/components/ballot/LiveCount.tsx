// ============================================================
// Place — "Your ballot", the live count drawn while ballots are counted
// (the November 3, 2026 results design): a status line, then each race
// with a bar per choice, or one Yes/No bar for a measure. Every bar is
// the same neutral slate: no party colors and nothing marks a leader.
// Statewide races can start folded behind one row.
//
// Every word and number comes from the server (civic_election.live_count,
// backend ballot/liveResults.js); this component only lays them out.
// ============================================================

'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { BallotCountGroup, BallotCountOption, BallotCountRace, BallotLiveCount } from '@pantopus/types';

function CandidateRow({ option }: { option: BallotCountOption }) {
  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex items-baseline gap-2 text-[14px] leading-[18px]">
        <span className="min-w-0 flex-1 text-app-text">{option.name}</span>
        <span className="text-[12.5px] tabular-nums text-app-text-muted">
          {option.votes_label}
          <span className="sr-only"> votes</span>
        </span>
        <span className="min-w-[46px] text-right font-semibold tabular-nums text-app-text">{option.percent_label}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-[3px] bg-app-border" aria-hidden="true">
        <div className="h-full rounded-[3px] bg-slate-500 dark:bg-slate-400" style={{ width: `${Math.min(1, Math.max(0, option.share)) * 100}%` }} />
      </div>
    </div>
  );
}

function MeasureBar({ yes, no }: { yes: BallotCountOption; no: BallotCountOption }) {
  // The two sides split the whole bar between them.
  const both = yes.share + no.share;
  const yesWidth = both > 0 ? (yes.share / both) * 100 : 50;
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex justify-between gap-3 text-[14px] leading-[18px] tabular-nums">
        <span>
          <span className="text-app-text-secondary">{yes.name}</span> <span className="font-semibold text-app-text">{yes.percent_label}</span>
        </span>
        <span>
          <span className="font-semibold text-app-text">{no.percent_label}</span> <span className="text-app-text-secondary">{no.name}</span>
        </span>
      </div>
      <div className="flex h-2 gap-0.5" aria-hidden="true">
        <div className="rounded-l bg-slate-600 dark:bg-slate-300" style={{ width: `calc(${yesWidth}% - 1px)` }} />
        <div className="rounded-r bg-slate-400 dark:bg-slate-500" style={{ width: `calc(${100 - yesWidth}% - 1px)` }} />
      </div>
    </div>
  );
}

function CountRace({ race, first }: { race: BallotCountRace; first: boolean }) {
  const measure = race.kind === 'measure' && race.options.length === 2;
  return (
    <div className={`flex flex-col gap-[9px] ${first ? 'pb-3 pt-1.5' : 'border-t border-app-border py-3'}`}>
      <div className="text-[14px] font-semibold leading-[18px] text-app-text">
        {race.title}
        {race.qualifier ? <span className="font-normal text-app-text-secondary"> · {race.qualifier}</span> : null}
      </div>
      {measure ? (
        <MeasureBar yes={race.options[0]} no={race.options[1]} />
      ) : (
        race.options.map((option, i) => <CandidateRow key={`${option.name}-${i}`} option={option} />)
      )}
    </div>
  );
}

function CountGroup({ group }: { group: BallotCountGroup }) {
  const [open, setOpen] = useState(!group.fold);
  if (group.fold && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="flex items-center justify-between gap-3 rounded-[14px] bg-app-surface-sunken p-3 text-left"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-[14px] font-medium leading-[normal] text-app-text">{group.fold.label}</span>
          <span className="text-[12px] leading-[normal] text-app-text-secondary">{group.fold.detail}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[13.5px] text-app-text-secondary">
          Show
          <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
        </span>
      </button>
    );
  }
  return (
    <div className="flex flex-col">
      <div className="mb-0.5 text-[11px] font-semibold uppercase leading-[normal] tracking-[0.06em] text-app-text-muted">{group.title}</div>
      {group.races.map((race, i) => (
        <CountRace key={race.key} race={race} first={i === 0} />
      ))}
      {group.fold ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-expanded
          className="self-center pt-1 text-[13.5px] text-app-text-secondary hover:text-app-text"
        >
          Show fewer
        </button>
      ) : null}
    </div>
  );
}

export default function LiveCount({ count }: { count: BallotLiveCount }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] leading-[18px] text-app-text-secondary">
        <span className="font-semibold text-app-text">{count.status}</span> · {count.posted}
      </div>
      {count.groups.map((group) => (
        <CountGroup key={group.key} group={group} />
      ))}
    </div>
  );
}
