// ============================================================
// Ballot P0 (docs/ballot-implementation-plan-2026-09-24.md §6) — the web
// surfaces render exactly what the server composed and nothing else:
// the Place card in each phase, the deadline timeline's geometry, the
// /start teaser and its governments view, the Today card, and their
// placement on the dashboard and the funnel. Visual parity with the
// canvas is checked separately by screenshot (plan §10).
//
// Also here, from the pre-launch review: the timeline's label repair (the
// shared spec's vectors), the governments sheet as a modal dialog, the
// Today reads (none without ballot_p0), tolerant payload reading, and the
// primary-fill and link-ink tokens.
// ============================================================

import { useState, type ReactElement } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { BallotDeadline, BallotTeaser as BallotTeaserData, PlaceBallotElectionData, PlaceIntelligence, PlaceSection } from '@pantopus/types';
import { get } from '../../../packages/api/src/client';
import { getPlaceIntelligence } from '../../../packages/api/src/endpoints/place';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/app/place',
  useParams: () => ({}),
}));
// getPlaceIntelligence itself (not the app-wide mock) is exercised below.
jest.mock('../../../packages/api/src/client', () => ({ get: jest.fn(), put: jest.fn() }));

import BallotCard, { ballotCardData } from '@/components/ballot/BallotCard';
import BallotTeaser from '@/components/ballot/BallotTeaser';
import BallotTodayCard, { hasBallotToday } from '@/components/ballot/BallotTodayCard';
import BallotTodaySection, { useBallotToday } from '@/components/ballot/BallotTodaySection';
import DeadlineTimeline, { timelineLayout } from '@/components/ballot/DeadlineTimeline';
import GovernmentsSheet, { GovernmentsView, storyOverline } from '@/components/ballot/GovernmentsSheet';
import { asOfLabel, daysLeft, monthDay } from '@/components/ballot/format';
import CivicDetail from '@/components/place/detail/CivicDetail';
import PlaceDashboardView from '@/components/place/PlaceDashboardView';
import HubTodayPage from '@/app/(app)/app/hub/today/page';
import { PreviewBody } from '@/components/place/StartFunnel';

function deadline(key: string, label: string, date: string, days: number, extra: Partial<BallotDeadline> = {}): BallotDeadline {
  return {
    key, label, date, month_day: monthDay(date), time_local: null, timezone: 'America/Los_Angeles', days_until: days,
    needs_action: false, timeline: true, cutoff: 'mailed_by', detail: null, source: 'Washington Secretary of State',
    source_url: 'https://www.sos.wa.gov/elections/elections-calendar/dates-and-deadlines', ...extra,
  };
}

const DEADLINES = [
  deadline('ballots_mailed', 'Ballots mailed', '2026-10-16', 22),
  deadline('register_online_mail', 'Register by', '2026-10-26', 32, { needs_action: true }),
  deadline('return_by', 'By 8 p.m.', '2026-11-03', 40, { needs_action: true, time_local: '20:00' }),
  deadline('register_in_person', 'Register in person', '2026-11-03', 40, { needs_action: true, timeline: false }),
];

const GOVERNMENTS = {
  count: 5,
  count_is_minimum: true,
  items: [
    { level: 'federal' as const, name: 'United States', on_ballot: true },
    { level: 'state' as const, name: 'The state', on_ballot: null },
    { level: 'county' as const, name: 'Clark County', on_ballot: null },
    { level: 'school' as const, name: 'Camas School District', on_ballot: null },
    { level: 'city' as const, name: 'City of Camas', on_ballot: null },
  ],
  summary: 'The United States, the state, Clark County, the Camas School District and the City of Camas.',
  caveat: 'Special districts, like fire, port and library districts, are not counted yet.',
  source_line: 'Boundaries: Census Bureau · Special districts are not counted yet',
};

const LINKS = [
  { key: 'registration', label: 'Check or update registration', owner: 'Secretary of State', url: 'https://www.sos.wa.gov/register' },
  { key: 'ballot_tracking', label: 'Track your ballot', owner: 'VoteWA', url: 'https://voter.votewa.gov/WhereToVote.aspx' },
  { key: 'drop_boxes', label: 'Find a drop box', owner: 'Clark County Elections', url: 'https://clark.wa.gov/elections/drop-box-locator' },
];

const IN_SEASON: PlaceBallotElectionData = {
  name: 'November 3 general election', date: '2026-11-03', days_until: 40, polling_place: null, ballot: [],
  election_id: '2026-11-03-general', coverage: 'supported', phase: 'in_season', state: 'WA', state_name: 'Washington',
  today: '2026-09-24', title: 'Your ballot', subtitle: 'November 3 general election', chip: '40 days',
  line: 'This address sits inside at least 5 governments.', note: null,
  how_it_works: 'Everyone here votes by mail. Your ballot is mailed by Oct 16. Return it in a drop box by 8 p.m. Nov 3, or mail it a week early so the postmark is on time.',
  voting_method: 'all_mail', deadlines: DEADLINES, election_day_notice: null,
  primary_action: { kind: 'governments', label: 'See your governments' },
  official_links: LINKS, governments: GOVERNMENTS, ballot_week: { show: false }, mover_prompt: null,
  source_line: 'Washington Secretary of State', checked_at: '2026-09-24',
};

describe('format helpers', () => {
  it('formats calendar dates and days left without a timezone shift', () => {
    expect(monthDay('2026-10-16')).toBe('Oct 16');
    expect(daysLeft(32)).toBe('32 days left.');
    expect(daysLeft(1)).toBe('1 day left.');
    expect(daysLeft(0)).toBe('Last day.');
  });

  it('dates reference data instead of pretending it is a live fetch', () => {
    expect(asOfLabel('2026-09-24T00:00:00.000Z', new Date('2026-09-24T18:00:00Z'))).toBe('Sep 24');
    expect(asOfLabel(null)).toBeNull();
  });

  it('reads a real timestamp in the viewer\'s own day, the one its same-day test uses', () => {
    // Expectations are built from local dates, so they hold in any timezone;
    // west of UTC an evening lookup has the next day's UTC date, east of it a
    // morning one has the day before's.
    const monthDayOf = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const clock = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const evening = new Date(2026, 8, 24, 20, 30);
    const earlyMorning = new Date(2026, 8, 24, 0, 30);
    const tomorrow = new Date(2026, 8, 25, 9, 0);
    expect(asOfLabel(evening.toISOString(), tomorrow)).toBe(monthDayOf(evening));
    expect(asOfLabel(earlyMorning.toISOString(), tomorrow)).toBe(monthDayOf(earlyMorning));
    expect(monthDayOf(evening)).toBe('Sep 24');
    // The same day still reads as a clock time.
    expect(asOfLabel(evening.toISOString(), new Date(2026, 8, 24, 21, 0))).toBe(clock(evening));
    // A calendar date keeps its date everywhere, whatever the viewer's day.
    expect(asOfLabel('2026-09-24T00:00:00.000Z', tomorrow)).toBe('Sep 24');
    expect(asOfLabel('2026-09-24', tomorrow)).toBe('Sep 24');
  });
});

describe('deadline timeline geometry', () => {
  it('spaces markers by real days across the canvas width', () => {
    const layout = timelineLayout(DEADLINES, '2026-09-24', 326)!;
    expect(layout.markers.map((m) => [m.key, Math.round(m.x * 10) / 10, m.side])).toEqual([
      ['today', 8, 'below'],
      ['ballots_mailed', 178.5, 'above'],
      ['register_online_mail', 256, 'below'],
      ['return_by', 318, 'above'],
    ]);
    // The wait for ballots is drawn from today to the mailing date.
    expect(layout.waitUntilX).toBeCloseTo(178.5);
    // Only the registration deadline takes the warning ink; the final
    // marker is ink even though it needs action (as on the canvas).
    expect(layout.markers.filter((m) => m.needsAction).map((m) => m.key)).toEqual(['register_online_mail']);
  });

  it('moves a label that would crowd a same-side neighbour', () => {
    const crowded = [
      deadline('register_online_mail', 'Register by', '2026-11-01', 38, { needs_action: true }),
      deadline('return_by', 'By 8 p.m.', '2026-11-03', 40, { needs_action: true }),
    ];
    const layout = timelineLayout(crowded, '2026-09-24', 326)!;
    expect(layout.markers.find((m) => m.key === 'register_online_mail')!.side).toBe('below');
  });

  it('draws nothing on Election Day or with nothing ahead', () => {
    expect(timelineLayout([deadline('return_by', 'By 8 p.m.', '2026-11-03', 0)], '2026-11-03', 326)).toBeNull();
    expect(timelineLayout([], '2026-09-24', 326)).toBeNull();
  });
});

// The shared timeline spec's vectors (real deadlines on the days that collided
// on the canvas arrangement), at the canvas card's 326 width. The same four run
// on iOS and Android. `legacy` is the canvas arrangement of side and anchor, as
// it was before the repair pass.
type VectorRow = [key: string, label: string, date: string, days: number, needsAction: boolean, timeline: boolean];
type Side = 'above' | 'below';
type Anchor = 'start' | 'middle' | 'end';
type VectorMarker = [key: string, x: number, side: Side, anchor: Anchor, dx: number];
const WA_ROWS: VectorRow[] = [
  ['ballots_mailed', 'Ballots mailed', '2026-10-16', 22, false, true],
  ['register_online_mail', 'Register by', '2026-10-26', 32, true, true],
  ['return_by', 'By 8 p.m.', '2026-11-03', 40, true, true],
  ['register_in_person', 'Register in person', '2026-11-03', 40, true, false],
];
const OR_ROWS = (registerDays: number): VectorRow[] => [
  ['register_online_mail', 'Register by', '2026-10-13', registerDays, true, true],
  ['ballots_mailed', 'Ballots mailed', '2026-10-14', registerDays + 1, false, true],
  ['return_by', 'By 8 p.m.', '2026-11-03', registerDays + 21, true, true],
];
const TIMELINE_VECTORS: { name: string; today: string; rows: VectorRow[]; legacy: [Side, Anchor][]; expected: VectorMarker[] }[] = [
  {
    // Nothing collides: the canvas arrangement, exactly as it was.
    name: 'WA 2026-09-24 width 326',
    today: '2026-09-24',
    rows: WA_ROWS,
    legacy: [['below', 'start'], ['above', 'middle'], ['below', 'middle'], ['above', 'end']],
    expected: [['today', 8, 'below', 'start', 0], ['ballots_mailed', 178.5, 'above', 'middle', 0], ['register_online_mail', 256, 'below', 'middle', 0], ['return_by', 318, 'above', 'end', 0]],
  },
  {
    // Register (Oct 13) and ballots mailed (Oct 14) one day apart: both used to sit above and overprint.
    name: 'OR 2026-10-10 width 326',
    today: '2026-10-10',
    rows: OR_ROWS(3),
    legacy: [['below', 'start'], ['above', 'middle'], ['above', 'middle'], ['above', 'end']],
    expected: [['today', 8, 'below', 'start', 0], ['register_online_mail', 46.75, 'above', 'middle', 0], ['ballots_mailed', 59.67, 'below', 'start', 0], ['return_by', 318, 'above', 'end', 0]],
  },
  {
    // Today is the registration deadline: the second label has to slide along its row.
    name: 'OR 2026-10-13 width 326',
    today: '2026-10-13',
    rows: OR_ROWS(0),
    legacy: [['below', 'start'], ['above', 'start'], ['above', 'start'], ['above', 'end']],
    expected: [['today', 8, 'below', 'start', 0], ['register_online_mail', 8, 'above', 'start', 0], ['ballots_mailed', 22.76, 'below', 'start', 30.24], ['return_by', 318, 'above', 'end', 0]],
  },
  {
    // A 24-character label near the left edge used to run off the card.
    name: 'HI 2026-10-25 width 326',
    today: '2026-10-25',
    rows: [
      ['register_online_mail', 'Paper forms by 4:30 p.m.', '2026-10-26', 1, true, true],
      ['return_by', 'By 7 p.m.', '2026-11-03', 9, true, true],
    ],
    legacy: [['below', 'start'], ['above', 'middle'], ['above', 'end']],
    expected: [['today', 8, 'below', 'start', 0], ['register_online_mail', 42.44, 'above', 'start', 0], ['return_by', 318, 'above', 'end', 0]],
  },
];
const vectorDeadlines = (rows: VectorRow[]) =>
  rows.map(([key, label, date, days, needsAction, timeline]) => deadline(key, label, date, days, { needs_action: needsAction, timeline }));

describe('deadline timeline label repair (shared spec vectors)', () => {
  it.each(TIMELINE_VECTORS)('$name', ({ today, rows, legacy, expected }) => {
    const layout = timelineLayout(vectorDeadlines(rows), today, 326)!;
    expect(layout.markers.map((m) => [m.key, m.side, m.anchor])).toEqual(expected.map(([key, , side, anchor]) => [key, side, anchor]));
    layout.markers.forEach((m, i) => {
      expect(Math.abs(m.x - expected[i][1])).toBeLessThanOrEqual(0.01);
      expect(Math.abs(m.dx - expected[i][4])).toBeLessThanOrEqual(0.01);
    });
    // A layout with nothing colliding comes out exactly as the canvas arrangement; the others are repaired.
    const arrangement = layout.markers.map((m) => [m.side, m.anchor]);
    if (today === '2026-09-24') expect(arrangement).toEqual(legacy);
    else expect(arrangement).not.toEqual(legacy);
  });

  it('draws a slid label at its anchor plus the slide', () => {
    // The card's 324-wide content box gives the 326-wide chart of the vectors.
    const { container } = render(<DeadlineTimeline deadlines={vectorDeadlines(OR_ROWS(0))} today="2026-10-13" />);
    const texts = Array.from(container.querySelectorAll('text'));
    const mailed = texts.filter((t) => t.textContent === 'Oct 14' || t.textContent === 'Ballots mailed');
    expect(mailed).toHaveLength(2);
    // Anchored start at x 22.76: text at x − 4 + dx.
    for (const t of mailed) {
      expect(t.getAttribute('text-anchor')).toBe('start');
      expect(Math.abs(Number(t.getAttribute('x')) - (22.76 - 4 + 30.24))).toBeLessThanOrEqual(0.01);
    }
    // A label that was not moved keeps the canvas x.
    const register = texts.find((t) => t.textContent === 'Register by')!;
    expect(Number(register.getAttribute('x'))).toBeCloseTo(8 - 4);
  });
});

describe('the Place "Your ballot" card', () => {
  it('in season: header, count, timeline, how it works, the governments action and official links', () => {
    const open = jest.fn();
    render(<BallotCard data={IN_SEASON} asOf="2026-09-24T00:00:00.000Z" onOpenGovernments={open} />);
    const card = screen.getByRole('region', { name: 'Your ballot' });
    expect(within(card).getByText('November 3 general election')).toBeInTheDocument();
    expect(within(card).getByText('40 days')).toBeInTheDocument();
    expect(within(card).getByText('This address sits inside at least 5 governments.')).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: /Timeline: today, Sep 24; ballots mailed Oct 16; register by Oct 26; return by 8 p.m. Nov 3/ })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'See your governments' }));
    expect(open).toHaveBeenCalled();
    const links = within(card).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(LINKS.map((l) => l.url));
    for (const a of links) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
    expect(within(card).getByText('Washington Secretary of State · as of Sep 24')).toBeInTheDocument();
    // Nothing P0 cannot back: no decisions count, no "nothing this year".
    expect(card.textContent).not.toMatch(/decisions|nothing this year|should arrive/i);
  });

  it('Election Day: the return notice replaces the timeline', () => {
    render(
      <BallotCard
        data={{ ...IN_SEASON, phase: 'election_day', title: 'Election Day', chip: 'Today', line: null, how_it_works: null, primary_action: null,
          election_day_notice: { lead: 'Return by 8 p.m. today.', detail: 'Use a drop box. If you mail it, get it postmarked at a post office counter today.' } }}
      />,
    );
    expect(screen.getByText('Return by 8 p.m. today.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Timeline/ })).not.toBeInTheDocument();
  });

  it('outside the pilot: one sentence and the official link, never a count', () => {
    render(
      <BallotCard
        data={{ ...IN_SEASON, coverage: 'links_only', line: null, how_it_works: null, deadlines: [], governments: null, primary_action: null,
          note: 'Pantopus doesn’t have this state’s deadlines yet. Its election office does.',
          official_links: [{ key: 'registration', label: 'Registration and deadlines', owner: 'Vote.gov', url: 'https://vote.gov/' }],
          source_line: 'Election date: federal law' }}
      />,
    );
    expect(screen.getByText('Registration and deadlines')).toBeInTheDocument();
    expect(screen.queryByText(/governments/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

const TEASER: BallotTeaserData = {
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

describe('the /start teaser', () => {
  it('lists the governments by name, the next deadline, and opens the still view', () => {
    render(<BallotTeaser teaser={TEASER} address="415 NE Everett St" now={new Date('2026-09-24T09:40:00')} />);
    for (const g of GOVERNMENTS.items) expect(screen.getByText(g.name)).toBeInTheDocument();
    expect(screen.getByText('This address')).toBeInTheDocument();
    expect(screen.getByText('Register or update by Oct 26.')).toBeInTheDocument();
    expect(screen.getByText(/32 days left\. In person through Election Day\./)).toBeInTheDocument();
    expect(screen.getByText(/as of 9:40 AM\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'See your governments' }));
    const dialog = screen.getByRole('dialog', { name: 'You are standing in at least 5 governments.' });
    expect(within(dialog).getByText('415 NE Everett St', { selector: 'span' })).toBeInTheDocument();
    expect(within(dialog).getByText(/The United States, the state, Clark County/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('outside the pilot: the official link and no time stamp', () => {
    render(
      <BallotTeaser
        teaser={{ ...TEASER, coverage: 'links_only', state: 'OR', headline: 'The general election is November 3.', governments: null, next_deadline: null,
          note: 'Pantopus doesn’t have this state’s deadlines yet. Its election office does.',
          primary_action: { kind: 'link', label: 'Check your registration', url: 'https://vote.gov/' },
          source_line: 'Election date: federal law · Registration and deadlines: Vote.gov' }}
        address="1421 SE Oak St"
      />,
    );
    const link = screen.getByRole('link', { name: /Check your registration/ });
    expect(link).toHaveAttribute('href', 'https://vote.gov/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Election date: federal law · Registration and deadlines: Vote.gov.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('the governments view (the peel)', () => {
  const view = (props: Partial<Parameters<typeof GovernmentsView>[0]> = {}) =>
    render(<GovernmentsView governments={GOVERNMENTS} address="415 NE Everett St" onClose={() => undefined} {...props} />);

  it('plays the story: one caption per government, overline and name only, then Skip', () => {
    const { container } = view();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    const captions = container.querySelectorAll('div[aria-hidden="true"]');
    expect(Array.from(captions).map((c) => c.textContent)).toEqual(
      GOVERNMENTS.items.map((g, i) => `${storyOverline(i + 1, 5, true)}${g.name}`),
    );
    // Each government takes its turn 1.2 s after the last, as on the board.
    expect(Array.from(captions).map((c) => (c as HTMLElement).style.animationDelay)).toEqual(['0ms', '1200ms', '2400ms', '3600ms', '4800ms']);
    expect(container.querySelectorAll('polygon')).toHaveLength(10);
    // The finished frame is already in the document for screen readers.
    expect(screen.getByText('You are standing in at least 5 governments.')).toBeInTheDocument();
  });

  it('Skip jumps to the finished frame, which then closes', () => {
    const onClose = jest.fn();
    const { container } = view({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelectorAll('div[aria-hidden="true"]')).toHaveLength(0);
    expect(container.querySelectorAll('polygon')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the still frame and reduced motion start on the finished frame', () => {
    const { unmount } = view({ animate: false });
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    unmount();

    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'), media: query, onchange: null,
      addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      const { container } = view();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(container.querySelectorAll('div[aria-hidden="true"]')).toHaveLength(0);
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it('a P0 count is a minimum, so the overline says so', () => {
    expect(storyOverline(2, 5, true)).toBe('Government 2 of at least 5');
    expect(storyOverline(2, 5, false)).toBe('Government 2 of 5');
  });

  it('the drawing is decorative, and scales down on phones narrower than its 390', () => {
    const { container } = view({ animate: false });
    const svg = container.querySelector('svg')!;
    // The visible title already says "at least 5 governments".
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    expect(svg).not.toHaveAttribute('aria-label');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // 390 × 420 where the screen has room; its viewBox keeps the proportions where it has not.
    expect(svg).toHaveAttribute('width', '390');
    expect(svg).toHaveAttribute('height', '420');
    expect(svg).toHaveAttribute('viewBox', '0 0 390 420');
    expect(svg).toHaveClass('max-w-full', 'h-auto');
  });
});

describe('the governments sheet (a modal dialog)', () => {
  const sheet = (onClose: () => void) => <GovernmentsSheet open onClose={onClose} governments={GOVERNMENTS} address="415 NE Everett St" />;

  it('opens on Skip, and a parent re-render with a fresh onClose does not move focus', () => {
    const { rerender } = render(sheet(() => undefined));
    expect(screen.getByRole('button', { name: 'Skip' })).toHaveFocus();
    const done = screen.getByRole('button', { name: 'Done' });
    done.focus();
    // Every caller passes an inline arrow, so any re-render hands the sheet a new onClose.
    rerender(sheet(() => undefined));
    rerender(sheet(() => undefined));
    expect(done).toHaveFocus();
  });

  it('keeps Tab and Shift+Tab inside after a click on dead space, and Escape closes', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<><button type="button">Behind the sheet</button>{sheet(onClose)}</>);
    // A tabbable element after the sheet in document order, for Shift+Tab to run into.
    const after = document.body.appendChild(document.createElement('button'));
    try {
      const dialog = screen.getByRole('dialog');
      for (const shift of [false, true]) {
        // The source line under Done is not focusable: the click leaves focus on the page.
        await user.click(screen.getByText(GOVERNMENTS.source_line));
        expect(document.body).toHaveFocus();
        await user.tab({ shift });
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
      }
      expect(onClose).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      after.remove();
    }
  });

  it('locks page scroll while open and gives focus back to what opened it', () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open it</button>
          <GovernmentsSheet open={open} onClose={() => setOpen(false)} governments={GOVERNMENTS} address="415 NE Everett St" />
        </>
      );
    }
    render(<Opener />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(opener).toHaveFocus();
  });
});

describe('primary buttons and links', () => {
  // Each render gets its own queries, bound to its own container.
  const inside = (ui: ReactElement) => within(render(ui).container);
  const still = (props: Partial<Parameters<typeof GovernmentsView>[0]> = {}) => (
    <GovernmentsView governments={GOVERNMENTS} address="415 NE Everett St" onClose={() => undefined} animate={false} {...props} />
  );

  it('use the app\'s standard primary fill and its hover, not the pressed shade at rest', () => {
    const week = { ...IN_SEASON, ballot_week: { show: true, overline: 'Ballot week', title: 'Ballots were mailed' } };
    const fills = [
      inside(<BallotCard data={IN_SEASON} onOpenGovernments={() => undefined} />).getByRole('button', { name: 'See your governments' }),
      inside(<BallotTeaser teaser={TEASER} address="415 NE Everett St" />).getByRole('button', { name: 'See your governments' }),
      inside(<BallotTodayCard data={week} ballotHref="/app/place" />).getByRole('link', { name: 'Open your ballot' }),
      inside(still()).getByRole('button', { name: 'Done' }),
    ];
    for (const el of fills) {
      expect(el).toHaveClass('bg-primary-600', 'hover:bg-primary-700');
      expect(el).not.toHaveClass('bg-primary-700');
    }
  });

  it('keep Skip and Close in link ink, with a hover that follows the theme', () => {
    const close = inside(still()).getByRole('button', { name: 'Close' });
    expect(close).toHaveClass('text-app-link', 'hover:text-primary-800');
    // primary-900 has no dark-mode variant: it was 1.9:1 on the dark sheet.
    expect(close).not.toHaveClass('hover:text-primary-900');
  });
});

describe('Today', () => {
  const WEEK: PlaceBallotElectionData = {
    ...IN_SEASON,
    ballot_week: { show: true, overline: 'Ballot week', title: 'Ballots were mailed by Oct 16', body: 'Return yours in a drop box by 8 p.m. Nov 3, or mail it a week early so the postmark is on time.' },
    mover_prompt: { text: 'Moved this year? Update your registration online by Oct 26.', days_left: 9, url: 'https://www.sos.wa.gov/register' },
  };

  it('shows ballot week and the mover line, and nothing when neither applies', () => {
    render(<BallotTodayCard data={WEEK} ballotHref="/app/place" />);
    expect(screen.getByText('Ballots were mailed by Oct 16')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open your ballot' })).toHaveAttribute('href', '/app/place');
    expect(screen.getByText(/Moved this year\? Update your registration online by Oct 26\. 9 days left\./)).toBeInTheDocument();
    expect(screen.queryByText(/Mail Day/)).not.toBeInTheDocument();
    expect(hasBallotToday(IN_SEASON)).toBe(false);
  });

  it('"Moved this year?" with no URL is a plain well; with one it opens the official page', () => {
    const mover = { text: 'Moved this year? Update your registration online by Oct 26.', days_left: 9 };
    const { rerender } = render(<BallotTodayCard data={{ ...WEEK, mover_prompt: { ...mover, url: null } }} ballotHref="/app/place" />);
    expect(screen.getByText(/Moved this year\?/).closest('a')).toBeNull();
    // Ballot week keeps its own link; the well adds none.
    expect(screen.getAllByRole('link')).toHaveLength(1);
    rerender(<BallotTodayCard data={{ ...WEEK, mover_prompt: { ...mover, url: 'https://www.sos.wa.gov/register' } }} ballotHref="/app/place" />);
    const link = screen.getByText(/Moved this year\?/).closest('a');
    expect(link).toHaveAttribute('href', 'https://www.sos.wa.gov/register');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link!.getAttribute('rel')).toContain('noopener');
  });

  describe('the reads behind it', () => {
    const flag = api.featureFlags.getFeatureFlag as jest.Mock;
    const primaryHome = api.homes.getPrimaryHome as jest.Mock;
    const intel = api.place.getPlaceIntelligence as jest.Mock;
    // Lets the reads that would have been sent settle, inside act like the rest.
    const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    const renderWithClient = (ui: ReactElement) =>
      render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
    function TodayProbe({ enabled = true }: { enabled?: boolean }) {
      return <BallotTodaySection data={useBallotToday(enabled)} />;
    }

    beforeEach(() => {
      flag.mockReset();
      primaryHome.mockReset();
      intel.mockReset();
    });

    it('send no home or election request for a viewer without ballot_p0', async () => {
      flag.mockResolvedValue({ flagName: 'ballot_p0', enabled: false });
      renderWithClient(<TodayProbe />);
      await waitFor(() => expect(flag).toHaveBeenCalledWith('ballot_p0'));
      await settle();
      expect(primaryHome).not.toHaveBeenCalled();
      expect(intel).not.toHaveBeenCalled();
      expect(screen.queryByText('Ballots were mailed by Oct 16')).not.toBeInTheDocument();
    });

    it('with ballot_p0 read the primary home, then only the civic_election section, and show the card', async () => {
      flag.mockResolvedValue({ flagName: 'ballot_p0', enabled: true });
      primaryHome.mockResolvedValue({ home: { id: 'home-1' } });
      intel.mockResolvedValue(intelligence(WEEK));
      renderWithClient(<TodayProbe />);
      expect(await screen.findByText('Ballots were mailed by Oct 16')).toBeInTheDocument();
      expect(intel).toHaveBeenCalledTimes(1);
      expect(intel).toHaveBeenCalledWith('home-1', ['civic_election']);
    });

    it('send nothing, not even the flag read, until the page has a session', async () => {
      renderWithClient(<TodayProbe enabled={false} />);
      await settle();
      expect(flag).not.toHaveBeenCalled();
      expect(primaryHome).not.toHaveBeenCalled();
      expect(intel).not.toHaveBeenCalled();
    });

    describe('on the Today page', () => {
      // The briefing never arrives here, so anything the Ballot reads send is
      // sent without waiting behind it.
      const briefing = jest.fn(() => new Promise<never>(() => undefined));
      beforeEach(() => {
        briefing.mockClear();
        Object.assign(api.hub, { getHubToday: briefing });
        (api.getAuthToken as jest.Mock).mockReturnValue('token');
      });

      it('a viewer without ballot_p0 costs one cached flag read, started with the briefing, and nothing else', async () => {
        flag.mockResolvedValue({ flagName: 'ballot_p0', enabled: false });
        renderWithClient(<HubTodayPage />);
        await waitFor(() => expect(flag).toHaveBeenCalledWith('ballot_p0'));
        expect(briefing).toHaveBeenCalledTimes(1);
        await settle();
        expect(flag).toHaveBeenCalledTimes(1);
        expect(primaryHome).not.toHaveBeenCalled();
        expect(intel).not.toHaveBeenCalled();
      });

      it('a viewer with ballot_p0 has the home and election reads under way before the briefing arrives', async () => {
        flag.mockResolvedValue({ flagName: 'ballot_p0', enabled: true });
        primaryHome.mockResolvedValue({ home: { id: 'home-1' } });
        intel.mockResolvedValue(intelligence(WEEK));
        renderWithClient(<HubTodayPage />);
        await waitFor(() => expect(intel).toHaveBeenCalledWith('home-1', ['civic_election']));
        expect(briefing).toHaveBeenCalledTimes(1);
      });
    });
  });
});

describe('reading the card payload', () => {
  it('does not need the day a deadline falls on: it is never drawn, month_day carries it', () => {
    const { date: _date, ...withoutDate } = DEADLINES[0];
    const data = ballotCardData({ ...IN_SEASON, deadlines: [withoutDate, DEADLINES[1], DEADLINES[2]] });
    expect(data?.deadlines?.map((d) => d.key)).toEqual(['ballots_mailed', 'register_online_mail', 'return_by']);
  });

  it('reads a list whole or not at all, as a native decode does, and keeps the card around it', () => {
    const data = ballotCardData({
      ...IN_SEASON,
      deadlines: [DEADLINES[0], { key: 'broken' }, DEADLINES[1]],
      official_links: [LINKS[0], { key: 'x', label: 'No URL', owner: 'Y' }, LINKS[2]],
    });
    expect(data?.deadlines).toEqual([]);
    expect(data?.official_links).toEqual([]);
    expect(data?.title).toBe('Your ballot');
  });
});

function section(id: PlaceSection['id'], group: PlaceSection['group'], data: unknown, extra: Partial<PlaceSection> = {}): PlaceSection {
  return { id, group, band: 'A', access: 'available', status: 'ready', as_of: '2026-09-24T00:00:00.000Z', source: 'Test', coverage: 'full', unavailable_reason: null, data, ...extra } as PlaceSection;
}

function intelligence(electionData: unknown): PlaceIntelligence {
  return {
    place: { label: '415 NE Everett St, Camas', line1: '415 NE Everett St', city: 'Camas', state: 'WA', postal_code: '98607' },
    tier: 'T1', region_supported: true, generated_at: '2026-09-24T16:00:00Z',
    groups: [
      { group: 'civic', label: 'Civic', sections: [
        section('civic_districts', 'civic', { districts: [{ level: 'federal', office_label: 'U.S. House', name: "Washington's 3rd District" }], representatives: [] }),
        section('civic_election', 'civic', electionData),
      ] },
    ],
  } as PlaceIntelligence;
}

describe('placement', () => {
  beforeEach(() => window.localStorage.clear());

  it('leads the dashboard with "This season" and drops the duplicate election row', () => {
    render(<PlaceDashboardView intelligence={intelligence(IN_SEASON)} homeId="home-1" />);
    expect(screen.getByText('This season')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your ballot' })).toBeInTheDocument();
    expect(screen.queryByText('Next election')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'See your governments' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps the existing election row while the flag is off', () => {
    render(<PlaceDashboardView intelligence={intelligence({ name: '2026 General Election', date: '2026-11-03', days_until: 40, polling_place: null, ballot: [] })} homeId="home-1" />);
    expect(screen.queryByText('This season')).not.toBeInTheDocument();
    expect(screen.getByText('Next election')).toBeInTheDocument();
  });

  it('the Civic page row for the governments view reads as a whole sentence', () => {
    const civic = (minimum: boolean) => ({
      ...intelligence(IN_SEASON),
      groups: [{
        group: 'civic' as const,
        label: 'Civic',
        sections: [section('civic_districts', 'civic', {
          districts: [{ level: 'federal', office_label: 'U.S. House', name: "Washington's 3rd District" }],
          representatives: [],
          governments: { ...GOVERNMENTS, count_is_minimum: minimum },
        })],
      }],
    }) as PlaceIntelligence;
    const { unmount } = render(<CivicDetail intelligence={civic(true)} />);
    expect(screen.getByTestId('place.civic.governments')).toHaveTextContent('Your governmentsThis address sits inside at least 5 governments.');
    unmount();
    render(<CivicDetail intelligence={civic(false)} />);
    expect(screen.getByTestId('place.civic.governments')).toHaveTextContent('This address sits inside 5 governments.');
  });

  it('puts the teaser under the aha card on /start, and nothing without it', () => {
    const base = { status: 'ready' as const, tier: 'preview' as const, region: 'US' as const, place: { address: '415 NE Everett St', city: 'Camas', state: 'WA', zipcode: '98607' }, sections: [], locked: [] };
    const { rerender } = render(<PreviewBody preview={{ ...base, ballot_teaser: TEASER }} onWall={() => undefined} />);
    expect(screen.getByRole('region', { name: 'Election information for this address' })).toBeInTheDocument();
    rerender(<PreviewBody preview={base} onWall={() => undefined} />);
    expect(screen.queryByRole('region', { name: 'Election information for this address' })).not.toBeInTheDocument();
  });
});

describe('the intelligence request', () => {
  it('opts in to the Ballot payload on every call, whatever sections it asks for', async () => {
    const getMock = get as jest.Mock;
    getMock.mockReset();
    getMock.mockResolvedValue({ groups: [] });
    await getPlaceIntelligence('home-1');
    await getPlaceIntelligence('home-1', ['civic_election']);
    expect(getMock.mock.calls).toEqual([
      ['/api/homes/home-1/intelligence', { ballot: 1 }],
      ['/api/homes/home-1/intelligence', { ballot: 1, sections: 'civic_election' }],
    ]);
  });
});
