// ============================================================
// W2.5 — Today's Pulse full stream. The ranking flattens the
// NeighborhoodPulse signals into priority tiers, and the view tops the
// list with the "all clear" summary when nothing is urgent (and floats
// "Needs attention" above it when something is). Pure ranking + the
// presentational view, exercised directly with mock pulse data.
// ============================================================

import { render, screen } from '@testing-library/react';
import type { NeighborhoodPulse, PulseSignal } from '@pantopus/types';
import { rankPulse } from '@/components/place/pulse/ranking';
import PulseStreamView from '@/components/place/pulse/PulseStreamView';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useParams: () => ({}),
  usePathname: () => '/app/place/pulse',
}));

function pulse(signals: PulseSignal[], summary = 'All quiet.', status: NeighborhoodPulse['pulse']['overall_status'] = 'quiet'): NeighborhoodPulse['pulse'] {
  return {
    greeting: 'Good morning',
    summary,
    overall_status: status,
    property: null,
    neighborhood: null,
    signals,
    seasonal_context: { season: 'spring', tip: null, first_action_nudge: null },
    community_density: { neighbor_count: 0, density_message: '', invite_cta: false },
    sources: [],
    meta: { community_signals_count: 0, external_signals_count: 0, partial_failures: [], computed_at: '2026-06-07T16:41:00Z' },
  };
}

const AQI_URGENT: PulseSignal = {
  signal_type: 'air_quality', priority: 1, title: 'Air quality is unhealthy for sensitive groups',
  detail: 'AQI 112 right now.', icon: 'wind', color: 'amber',
  actions: [{ type: 'view', label: 'See air quality', route: '/app/place/today' }],
};
const REBATE: PulseSignal = {
  signal_type: 'seasonal_suggestion', priority: 5, title: 'A heat-pump rebate may apply',
  detail: 'Up to $1,600 back.', icon: 'badge-percent', color: 'blue', actions: [],
};
const BLOCK: PulseSignal = {
  signal_type: 'community', priority: 8, title: 'A new home verified on your block',
  detail: 'Two doors down.', icon: 'house', color: 'green', actions: [],
};

describe('rankPulse — ranking into tiers', () => {
  it('floats urgent environmental signals into "Needs attention"', () => {
    const ranked = rankPulse(pulse([REBATE, AQI_URGENT, BLOCK], 'busy', 'alert'));
    expect(ranked.urgent).toBe(true);
    expect(ranked.tiers[0].key).toBe('attention');
    expect(ranked.tiers[0].signals[0].title).toBe(AQI_URGENT.title);
    expect(ranked.tiers[0].signals[0].emphasis).toBe(true);
    // The other signals fall into their own tiers.
    expect(ranked.tiers.map((t) => t.key)).toEqual(['attention', 'worth', 'around']);
  });

  it('is all-clear when nothing is urgent', () => {
    const ranked = rankPulse(pulse([REBATE, BLOCK]));
    expect(ranked.urgent).toBe(false);
    expect(ranked.tiers.some((t) => t.key === 'attention')).toBe(false);
    expect(ranked.cleared.map((c) => c.label)).toContain('No active alerts');
  });

  it('orders signals within a tier by priority', () => {
    const a: PulseSignal = { ...REBATE, priority: 9, title: 'Later' };
    const b: PulseSignal = { ...REBATE, priority: 2, title: 'Sooner' };
    const ranked = rankPulse(pulse([a, b]));
    const worth = ranked.tiers.find((t) => t.key === 'worth')!;
    expect(worth.signals.map((s) => s.title)).toEqual(['Sooner', 'Later']);
  });
});

describe('PulseStreamView — renders the ranked stream', () => {
  it('shows "Needs attention" first and hides the all-clear card when urgent', () => {
    render(<PulseStreamView pulse={pulse([AQI_URGENT, REBATE, BLOCK], 'busy', 'alert')} homeId="h1" address="1421 SE Oak St · Portland" />);
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(screen.getByText(AQI_URGENT.title)).toBeInTheDocument();
    expect(screen.queryByText('All clear today')).not.toBeInTheDocument();
  });

  it('tops the list with the all-clear summary when nothing is urgent', () => {
    render(<PulseStreamView pulse={pulse([REBATE, BLOCK], 'Calm day.')} homeId="h1" />);
    expect(screen.getByText('All clear today')).toBeInTheDocument();
    expect(screen.getByText('Calm day.')).toBeInTheDocument();
    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
    expect(screen.getByText('Worth a look')).toBeInTheDocument();
    expect(screen.getByText('Around you')).toBeInTheDocument();
  });

  it('adds the verify nudge for a claimed (T3) place', () => {
    render(<PulseStreamView pulse={pulse([BLOCK])} homeId="h1" showVerify />);
    expect(screen.getByText('Verify your address')).toBeInTheDocument();
    expect(screen.getByText('When you have a minute')).toBeInTheDocument();
  });
});
