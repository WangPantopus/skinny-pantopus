// ============================================================
// W2.3 — Place group-detail pages render from the PlaceIntelligence
// contract, and degrade section-by-section. These exercise the seven
// presentational views directly with a mock contract (no fetching).
// ============================================================

import { render, screen } from '@testing-library/react';
import type { PlaceIntelligence, PlaceSection, PlaceSectionId } from '@pantopus/types';
import TodayDetail from '@/components/place/detail/TodayDetail';
import YourHomeDetail from '@/components/place/detail/YourHomeDetail';
import RiskDetail from '@/components/place/detail/RiskDetail';
import BlockDetail from '@/components/place/detail/BlockDetail';
import MoneyDetail from '@/components/place/detail/MoneyDetail';
import CivicDetail from '@/components/place/detail/CivicDetail';
import IdentityDetail from '@/components/place/detail/IdentityDetail';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useParams: () => ({}),
  usePathname: () => '/app/place',
}));

const GROUP: Record<PlaceSectionId, PlaceSection['group']> = {
  weather: 'today', air_quality: 'today', alerts: 'today', sunrise_sunset: 'today',
  your_home: 'your_home', flood: 'risk_readiness', seismic: 'risk_readiness', wildfire: 'risk_readiness', lead_radon: 'health_environment',
  drinking_water: 'health_environment', environmental_hazards: 'health_environment',
  block_density: 'your_block', census_context: 'your_block', bill_benchmark: 'money_signals',
  incentives: 'money_signals', rent_band: 'money_signals', civic_districts: 'civic', civic_election: 'civic',
};

function sec(id: PlaceSectionId, opts: Partial<PlaceSection> = {}): PlaceSection {
  return {
    id, group: GROUP[id], band: 'A', access: 'available', status: 'ready',
    as_of: null, source: 'Test source', coverage: 'full', unavailable_reason: null, data: null, ...opts,
  } as PlaceSection;
}

function intel(sections: PlaceSection[], tier: PlaceIntelligence['tier'] = 'T4'): PlaceIntelligence {
  const byGroup = new Map<PlaceSection['group'], PlaceSection[]>();
  for (const s of sections) {
    if (!byGroup.has(s.group)) byGroup.set(s.group, []);
    byGroup.get(s.group)!.push(s);
  }
  return {
    place: { label: '1421 SE Oak St, Portland', line1: '1421 SE Oak St', city: 'Portland', state: 'OR', postal_code: '97214' },
    tier, region_supported: true, generated_at: '2026-06-07T16:41:00Z',
    groups: Array.from(byGroup.entries()).map(([group, secs]) => ({ group, label: group, sections: secs })),
  };
}

const FULL = intel([
  sec('weather', { data: { current_temp_f: 62, condition_code: 'clear', condition_label: 'Clear', feels_like_f: 60, high_f: 68, low_f: 49, hourly: [], daily: [] } }),
  sec('air_quality', { data: { index: 38, category: 'good', category_label: 'Good', dominant_pollutant: 'pm25', health_message: 'Air quality is good.' } }),
  sec('alerts', { data: { active: [] } }),
  sec('sunrise_sunset', { data: { sunrise: '2026-06-07T13:42:00Z', sunset: '2026-06-08T03:11:00Z', daylight_minutes: 809 } }),
  sec('your_home', { data: { year_built: 1979, sqft: 1840, bedrooms: 3, bathrooms: 2, lot_sqft: 5200, home_type: 'house', estimated_value: 612000, value_low: 590000, value_high: 640000, assessed_value: 438200 } }),
  sec('flood', { data: { zone: 'X', zone_label: 'Zone X', risk_level: 'minimal', in_sfha: false, insurance_required: false, plain_meaning: 'Minimal flood risk.' } }),
  sec('block_density', { data: { bucket: 'few', label: 'A few verified homes nearby' } }),
  sec('census_context', { data: { median_year_built: 1985, median_home_value: 498000, tract_name: 't', summary: 'Most homes here are mid-1980s.' } }),
  sec('bill_benchmark', { data: { utility: 'electric', your_amount: 142, band_low: 165, band_high: 210, comparison: 'lower', comparison_pct: -16, period: '12-month average', summary: 'Your bill runs lower than most homes nearby.' } }),
  sec('incentives', { data: { summary: '1 program', programs: [{ id: 'fed', name: 'Residential Clean Energy Credit', level: 'federal', incentive_type: 'tax_credit', summary: '30% of solar cost.' }] } }),
  sec('rent_band', { data: { bedrooms: 2, band_low: 2120, band_high: 2600, market_low: 1800, market_high: 2900, period: 'FY 2026', summary: 'Typical 2BR rent.' } }),
  sec('civic_districts', { data: { districts: [{ level: 'federal', office_label: 'U.S. House', name: "Oregon's 3rd District" }], representatives: [] } }),
  sec('civic_election', { data: { name: 'May 2026 Primary Election', date: '2026-05-19T00:00:00Z', days_until: 12, polling_place: { name: 'Vote by mail · Oregon', detail: 'Return by mail.', vote_by_mail: true }, ballot: [{ type: 'office', title: 'Governor', candidates: ['A', 'B'], summary: null }] } }),
]);

describe('Place group-detail — renders from the contract', () => {
  it('Today shows weather, air quality, and the all-clear alerts state', () => {
    render(<TodayDetail intelligence={FULL} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(screen.getByText(/US Air Quality Index/)).toBeInTheDocument();
    expect(screen.getByText('No active alerts')).toBeInTheDocument();
  });

  it('Your home shows facts, value, and the property-records reuse entry', () => {
    render(<YourHomeDetail intelligence={FULL} homeId="home-1" />);
    expect(screen.getByText('$612,000')).toBeInTheDocument();
    expect(screen.getByText('1,840 sqft')).toBeInTheDocument();
    expect(screen.getByText('See full property records')).toBeInTheDocument();
  });

  it('Risk shows the flood zone and the readiness checklist', () => {
    render(<RiskDetail intelligence={FULL} homeId="home-1" />);
    expect(screen.getByText('Zone X')).toBeInTheDocument();
    expect(screen.getByText('Your household plan')).toBeInTheDocument();
  });

  it('Block shows the density bucket, census, and permits unavailable', () => {
    render(<BlockDetail intelligence={FULL} homeId="home-1" />);
    expect(screen.getByText('A few verified homes nearby')).toBeInTheDocument();
    expect(screen.getByText('This neighborhood')).toBeInTheDocument();
    expect(screen.getByText('Not available for your area yet.')).toBeInTheDocument();
  });

  it('Money shows the bill benchmark, an incentive, and the rent band', () => {
    render(<MoneyDetail intelligence={FULL} homeId="home-1" />);
    expect(screen.getByText(/Your bill runs lower/)).toBeInTheDocument();
    expect(screen.getByText('Residential Clean Energy Credit')).toBeInTheDocument();
    expect(screen.getByText('2-bedroom market band')).toBeInTheDocument();
  });

  it('Civic shows districts and the in-season election', () => {
    render(<CivicDetail intelligence={FULL} />);
    expect(screen.getByText('The elected levels that cover your address')).toBeInTheDocument();
    expect(screen.getByText("Oregon's 3rd District")).toBeInTheDocument();
    expect(screen.getByText('12 days away')).toBeInTheDocument();
    expect(screen.getByText('Vote by mail · Oregon')).toBeInTheDocument();
  });

  it('Identity shows verified status and the residency-letter generator', () => {
    render(<IdentityDetail intelligence={FULL} homeId="home-1" residentName="Riley Chen" />);
    expect(screen.getByText('Verified resident')).toBeInTheDocument();
    expect(screen.getByText('Generate a verified residency letter')).toBeInTheDocument();
  });
});

describe('Place group-detail — degrades section-by-section', () => {
  it('renders the unavailable state when a section has no coverage', () => {
    const degraded = intel([
      sec('weather', { status: 'unavailable', data: null }),
      sec('air_quality', { data: { index: 38, category: 'good', category_label: 'Good', dominant_pollutant: 'pm25', health_message: 'Good.' } }),
      sec('alerts', { data: { active: [] } }),
      sec('sunrise_sunset', { status: 'unavailable', data: null }),
    ]);
    render(<TodayDetail intelligence={degraded} />);
    // Weather degrades to the unavailable card while air quality still reads.
    expect(screen.getAllByText('Not available for your area yet.').length).toBeGreaterThan(0);
    expect(screen.getByText(/US Air Quality Index/)).toBeInTheDocument();
  });

  it('Civic shows the calm off-season state when no election is set', () => {
    const offSeason = intel([
      sec('civic_districts', { data: { districts: [{ level: 'federal', office_label: 'U.S. House', name: "Oregon's 3rd District" }], representatives: [] } }),
      sec('civic_election', { status: 'unavailable', data: null }),
    ]);
    render(<CivicDetail intelligence={offSeason} />);
    expect(screen.getByText('No upcoming election')).toBeInTheDocument();
  });

  it('Identity locks the residency letter until the address is verified (T3)', () => {
    render(<IdentityDetail intelligence={{ ...FULL, tier: 'T3' }} homeId="home-1" residentName="Riley Chen" />);
    expect(screen.getByText('Verify your address')).toBeInTheDocument();
    expect(screen.queryByText('Generate a verified residency letter')).not.toBeInTheDocument();
  });
});
