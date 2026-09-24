'use client';

// ============================================================
// /dev/ballot — design QA for Ballot P0 against the canvas
// (https://claude.ai/artifact/KCuXBiAYYaX13gpoqUCdmq, row "Proposed,
// September 24"). Fixtures use the canvas's FICTIONAL sample place
// (Fernbrook, Alder County) with Washington's real 2026 dates; they
// live only here and in tests. 404 in production (dev layout).
//
// Each column is one board, 390 wide, so a screenshot of a column can
// be laid beside the board it reproduces.
// ============================================================

import type { BallotDeadline, BallotTeaser as BallotTeaserData, PlaceBallotElectionData } from '@pantopus/types';
import BallotCard from '@/components/ballot/BallotCard';
import BallotTeaser from '@/components/ballot/BallotTeaser';
import BallotTodayCard from '@/components/ballot/BallotTodayCard';
import { GovernmentsView } from '@/components/ballot/GovernmentsSheet';

const SOS = 'https://www.sos.wa.gov/elections/elections-calendar/dates-and-deadlines';

function deadline(key: string, label: string, date: string, monthDay: string, days: number, extra: Partial<BallotDeadline> = {}): BallotDeadline {
  return {
    key, label, date, month_day: monthDay, time_local: null, timezone: 'America/Los_Angeles', days_until: days,
    needs_action: false, timeline: true, cutoff: 'mailed_by', detail: null, source: 'Washington Secretary of State', source_url: SOS, ...extra,
  };
}

const GOVERNMENTS = {
  count: 5,
  count_is_minimum: true,
  items: [
    { level: 'federal' as const, geoid: 'us', name: 'United States', on_ballot: true },
    { level: 'state' as const, geoid: '53', name: 'The state', on_ballot: null },
    { level: 'county' as const, geoid: '00000', name: 'Alder County', on_ballot: null },
    { level: 'school' as const, geoid: '0000000', name: 'Fernbrook Schools', on_ballot: null },
    { level: 'city' as const, geoid: '0000001', name: 'City of Fernbrook', on_ballot: null },
  ],
  summary: 'The United States, the state, Alder County, Fernbrook Schools and the City of Fernbrook.',
  caveat: 'Special districts, like fire, port and library districts, are not counted yet.',
  source_line: 'Boundaries: Census Bureau · Special districts are not counted yet',
};

const LINKS = {
  registration: { key: 'registration', label: 'Check or update registration', owner: 'Secretary of State', url: 'https://example.invalid/registration' },
  tracking: { key: 'ballot_tracking', label: 'Track your ballot', owner: 'Alder County Elections', url: 'https://example.invalid/track' },
  pamphlet: { key: 'drop_boxes', label: 'Voters’ pamphlet', owner: 'Alder County Elections', url: 'https://example.invalid/pamphlet' },
  dropBox: { key: 'drop_boxes', label: 'Find a drop box', owner: 'Alder County Elections', url: 'https://example.invalid/drop-box' },
  results: { key: 'results', label: 'Election results', owner: 'Alder County Elections', url: 'https://example.invalid/results' },
  voteGov: { key: 'registration', label: 'Registration and deadlines', owner: 'Vote.gov', url: 'https://vote.gov/' },
};

const BASE = {
  name: 'November 3 general election',
  date: '2026-11-03',
  polling_place: null,
  ballot: [],
  election_id: '2026-11-03-general',
  state: 'WA',
  state_name: 'Washington',
  subtitle: 'November 3 general election',
  voting_method: 'all_mail',
  source_line: 'Washington Secretary of State',
  checked_at: '2026-09-24',
};

const IN_SEASON: PlaceBallotElectionData = {
  ...BASE,
  days_until: 40,
  coverage: 'supported',
  phase: 'in_season',
  today: '2026-09-24',
  title: 'Your ballot',
  chip: '40 days',
  line: 'This address sits inside at least 5 governments.',
  note: null,
  how_it_works: 'Everyone here votes by mail. Your ballot is mailed by Oct 16. Return it in a drop box by 8 p.m. Nov 3, or mail it a week early so the postmark is on time.',
  deadlines: [
    deadline('ballots_mailed', 'Ballots mailed', '2026-10-16', 'Oct 16', 22),
    deadline('register_online_mail', 'Register by', '2026-10-26', 'Oct 26', 32, { needs_action: true, cutoff: 'received_by' }),
    deadline('return_by', 'By 8 p.m.', '2026-11-03', 'Nov 3', 40, { needs_action: true, time_local: '20:00' }),
    deadline('register_in_person', 'Register in person', '2026-11-03', 'Nov 3', 40, { needs_action: true, timeline: false, time_local: '20:00' }),
  ],
  election_day_notice: null,
  primary_action: { kind: 'governments', label: 'See your governments' },
  official_links: [LINKS.registration, LINKS.tracking, LINKS.pamphlet],
  governments: GOVERNMENTS,
  ballot_week: { show: false },
  mover_prompt: null,
};

const FAR: PlaceBallotElectionData = {
  ...BASE, days_until: 75, coverage: 'supported', phase: 'far', title: 'Your ballot', chip: '75 days',
  line: null, note: 'Registration deadline: Oct 26, online or by mail.', how_it_works: null, deadlines: [], official_links: [], governments: null, primary_action: null,
};

const ELECTION_DAY: PlaceBallotElectionData = {
  ...BASE, days_until: 0, coverage: 'supported', phase: 'election_day', title: 'Election Day', chip: 'Today', line: null, note: null, how_it_works: null,
  election_day_notice: { lead: 'Return by 8 p.m. today.', detail: 'Use a drop box. If you mail it, get it postmarked at a post office counter today.' },
  official_links: [LINKS.dropBox, LINKS.tracking], governments: null, primary_action: null, deadlines: [],
};

const AFTER: PlaceBallotElectionData = {
  ...BASE, days_until: 0, coverage: 'supported', phase: 'after', title: 'Your ballot', chip: null, line: null,
  note: 'Results are published by Alder County Elections. Pantopus doesn’t show results.', how_it_works: null,
  official_links: [LINKS.results], governments: null, primary_action: null, deadlines: [],
};

const LINKS_ONLY: PlaceBallotElectionData = {
  ...BASE, state: 'OR', state_name: 'Oregon', days_until: 40, coverage: 'links_only', phase: 'in_season', title: 'Your ballot', chip: '40 days',
  line: null, note: 'Pantopus doesn’t have this state’s deadlines yet. Its election office does.', how_it_works: null, voting_method: null,
  official_links: [LINKS.voteGov], governments: null, primary_action: null, deadlines: [], source_line: 'Election date: federal law', checked_at: null,
};

const TODAY: PlaceBallotElectionData = {
  ...IN_SEASON,
  ballot_week: { show: true, overline: 'Ballot week', title: 'Ballots were mailed by Oct 16', body: 'Return yours in a drop box by 8 p.m. Nov 3, or mail it a week early so the postmark is on time.' },
  mover_prompt: { text: 'Moved this year? Update your registration online by Oct 26.', days_left: 9, url: 'https://example.invalid/registration' },
};

const TEASER_WA: BallotTeaserData = {
  coverage: 'supported',
  state: 'WA',
  election: { id: '2026-11-03-general', name: 'November 3 general election', date: '2026-11-03', days_until: 40 },
  headline: 'Your address sits inside at least 5 governments.',
  note: null,
  next_deadline: { key: 'register_online_mail', lead: 'Register or update by Oct 26.', days_left: 32, detail: 'In person through Election Day.' },
  governments: { ...GOVERNMENTS, items: GOVERNMENTS.items.map(({ level, name }) => ({ level, name })) },
  primary_action: { kind: 'governments', label: 'See your governments' },
  source_line: 'Dates: Washington Secretary of State · Boundaries: Census Bureau',
};

const TEASER_LINKS: BallotTeaserData = {
  coverage: 'links_only',
  state: 'OR',
  election: { id: '2026-11-03-general', name: 'November 3 general election', date: '2026-11-03', days_until: 40 },
  headline: 'The general election is November 3.',
  note: 'Pantopus doesn’t have this state’s deadlines yet. Its election office does.',
  next_deadline: null,
  governments: null,
  primary_action: { kind: 'link', label: 'Check your registration', url: 'https://vote.gov/' },
  source_line: 'Election date: federal law · Registration and deadlines: Vote.gov',
};

const CLOCK = new Date('2026-09-24T09:40:00');

function Column({ id, title, children, bg = 'bg-app-bg' }: { id: string; title: string; children: React.ReactNode; bg?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[12px] font-semibold text-app-text-secondary">{title}</div>
      <div id={id} data-board={id} className={`w-[390px] ${bg}`}>{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase leading-4 tracking-[0.08em] text-app-text-secondary">{children}</div>;
}

export default function DevBallotPage() {
  return (
    <div className="min-h-screen bg-app-bg p-6">
      <h1 className="mb-1 text-lg font-bold text-app-text">Ballot P0 · design QA</h1>
      <p className="mb-6 text-sm text-app-text-secondary">Fictional sample data (Fernbrook, Alder County) with Washington’s 2026 dates. Dev only.</p>
      <div className="flex flex-wrap items-start gap-10">
        <Column id="p0-place" title="P0Place · card states">
          <div className="flex flex-col gap-4 px-4 pb-6 pt-5">
            <Label>In season · Washington · 40 days out</Label>
            <BallotCard data={IN_SEASON} asOf="2026-09-24T00:00:00.000Z" onOpenGovernments={() => undefined} />
            <Label>Far · 61 to 120 days out</Label>
            <BallotCard data={FAR} asOf="2026-09-24T00:00:00.000Z" />
            <Label>Election Day</Label>
            <BallotCard data={ELECTION_DAY} asOf="2026-09-24T00:00:00.000Z" />
            <Label>After · 1 to 7 days</Label>
            <BallotCard data={AFTER} asOf="2026-09-24T00:00:00.000Z" />
            <Label>Outside the pilot · official links only</Label>
            <BallotCard data={LINKS_ONLY} asOf={null} />
          </div>
        </Column>
        <Column id="p0-governments" title="P0Governments · finished frame" bg="bg-app-surface">
          <div className="h-[844px]">
            <GovernmentsView governments={GOVERNMENTS} address="1418 Alder Crest Dr" onClose={() => undefined} animate={false} />
          </div>
        </Column>
        <Column id="p0-story" title="The peel · story (plays once)" bg="bg-app-surface">
          <div className="h-[844px]">
            <GovernmentsView governments={GOVERNMENTS} address="1418 Alder Crest Dr" onClose={() => undefined} />
          </div>
        </Column>
        <Column id="p0-start" title="P0Start · teasers">
          <div className="flex flex-col gap-4 px-4 pb-6 pt-5">
            <BallotTeaser teaser={TEASER_WA} address="1418 Alder Crest Dr" now={CLOCK} />
            <BallotTeaser teaser={TEASER_LINKS} address="1418 Alder Crest Dr" now={CLOCK} />
          </div>
        </Column>
        <Column id="p0-today" title="P0Today · ballot week">
          <div className="px-4 pb-6 pt-5">
            <BallotTodayCard data={TODAY} ballotHref="#" />
          </div>
        </Column>
      </div>
    </div>
  );
}
