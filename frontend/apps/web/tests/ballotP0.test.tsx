// ============================================================
// Ballot P0 (docs/ballot-implementation-plan-2026-09-24.md §6) — the web
// surfaces render exactly what the server composed and nothing else:
// the Place card in each phase, the deadline timeline's geometry, the
// /start teaser and its governments view, the Today card, and their
// placement on the dashboard and the funnel. Visual parity with the
// canvas is checked separately by screenshot (plan §10).
// ============================================================

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { BallotDeadline, BallotTeaser as BallotTeaserData, PlaceBallotElectionData, PlaceIntelligence, PlaceSection } from '@pantopus/types';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/app/place',
  useParams: () => ({}),
}));

import BallotCard from '@/components/ballot/BallotCard';
import BallotTeaser from '@/components/ballot/BallotTeaser';
import BallotTodayCard, { hasBallotToday } from '@/components/ballot/BallotTodayCard';
import { GovernmentsView, storyOverline } from '@/components/ballot/GovernmentsSheet';
import { timelineLayout } from '@/components/ballot/DeadlineTimeline';
import { asOfLabel, daysLeft, monthDay } from '@/components/ballot/format';
import PlaceDashboardView from '@/components/place/PlaceDashboardView';
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
    fireEvent.keyDown(window, { key: 'Escape' });
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
    const captions = container.querySelectorAll('[aria-hidden="true"]');
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
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
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
      expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it('a P0 count is a minimum, so the overline says so', () => {
    expect(storyOverline(2, 5, true)).toBe('Government 2 of at least 5');
    expect(storyOverline(2, 5, false)).toBe('Government 2 of 5');
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

  it('puts the teaser under the aha card on /start, and nothing without it', () => {
    const base = { status: 'ready' as const, tier: 'preview' as const, region: 'US' as const, place: { address: '415 NE Everett St', city: 'Camas', state: 'WA', zipcode: '98607' }, sections: [], locked: [] };
    const { rerender } = render(<PreviewBody preview={{ ...base, ballot_teaser: TEASER }} onWall={() => undefined} />);
    expect(screen.getByRole('region', { name: 'Election information for this address' })).toBeInTheDocument();
    rerender(<PreviewBody preview={base} onWall={() => undefined} />);
    expect(screen.queryByRole('region', { name: 'Election information for this address' })).not.toBeInTheDocument();
  });
});
