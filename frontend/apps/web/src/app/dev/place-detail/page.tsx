'use client';

// ============================================================
// /dev/place-detail — visual preview of the seven Place group-detail
// pages (W2.3) from a rich mock PlaceIntelligence. Public route, no
// fetching — a verification surface, not a shipped screen.
// ============================================================

import type { PlaceIntelligence, PlaceSection, PlaceSectionId } from '@pantopus/types';
import TodayDetail from '@/components/place/detail/TodayDetail';
import YourHomeDetail from '@/components/place/detail/YourHomeDetail';
import RiskDetail from '@/components/place/detail/RiskDetail';
import BlockDetail from '@/components/place/detail/BlockDetail';
import MoneyDetail from '@/components/place/detail/MoneyDetail';
import CivicDetail from '@/components/place/detail/CivicDetail';
import IdentityDetail from '@/components/place/detail/IdentityDetail';

const META: Record<PlaceSectionId, { group: PlaceSection['group']; band: PlaceSection['band']; source: string }> = {
  weather: { group: 'today', band: 'A', source: 'National Weather Service' },
  air_quality: { group: 'today', band: 'A', source: 'AirNow · EPA' },
  alerts: { group: 'today', band: 'A', source: 'National Weather Service' },
  sunrise_sunset: { group: 'today', band: 'A', source: 'Open-Meteo' },
  good_day_to: { group: 'today', band: 'A', source: "Pantopus \u00b7 derived from today's conditions" },
  your_home: { group: 'your_home', band: 'B', source: 'County records · ATTOM' },
  home_systems: { group: 'your_home', band: 'C', source: 'Your household record' },
  flood: { group: 'risk_readiness', band: 'A', source: 'FEMA National Flood Hazard Layer' },
  heat_cold: { group: 'risk_readiness', band: 'A', source: 'NWS HeatRisk \u00b7 National Weather Service' },
  seismic: { group: 'risk_readiness', band: 'A', source: 'USGS seismic design values (ASCE 7-22)' },
  wildfire: { group: 'risk_readiness', band: 'A', source: 'USFS Wildfire Hazard Potential' },
  lead_radon: { group: 'health_environment', band: 'A', source: 'EPA radon zones · HUD lead-paint rules' },
  drinking_water: { group: 'health_environment', band: 'A', source: 'EPA SDWIS' },
  environmental_hazards: { group: 'health_environment', band: 'A', source: 'EPA ECHO' },
  block_density: { group: 'your_block', band: 'A', source: 'Pantopus' },
  census_context: { group: 'your_block', band: 'A', source: 'U.S. Census · American Community Survey' },
  bill_benchmark: { group: 'money_signals', band: 'A', source: 'Your utility · peer comparison' },
  incentives: { group: 'money_signals', band: 'A', source: 'DSIRE' },
  rent_band: { group: 'money_signals', band: 'A', source: 'HUD Fair Market Rents · county-wide estimate' },
  real_rent: { group: 'money_signals', band: 'D', source: 'Pantopus · verified neighbors on your block' },
  exemption_check: { group: 'money_signals', band: 'B', source: 'County records · ATTOM' },
  civic_districts: { group: 'civic', band: 'A', source: 'Open civic data · Google Civic Information' },
  civic_election: { group: 'civic', band: 'A', source: 'Official county elections' },
};

const GROUP_ORDER: PlaceSection['group'][] = [
  'today', 'your_home', 'risk_readiness', 'health_environment', 'your_block', 'money_signals', 'civic', 'identity',
];
const GROUP_LABELS: Record<PlaceSection['group'], string> = {
  today: 'Today', your_home: 'Your home', risk_readiness: 'Risk & readiness', health_environment: 'Health & environment',
  your_block: 'Your block', money_signals: 'Money signals', civic: 'Civic', identity: 'Identity',
};

function sec(id: PlaceSectionId, opts: Partial<PlaceSection> = {}): PlaceSection {
  const meta = META[id];
  return {
    id, group: meta.group, band: meta.band, access: 'available', status: 'ready',
    as_of: null, source: meta.source, coverage: 'full', unavailable_reason: null, data: null, ...opts,
  } as PlaceSection;
}

function hours() {
  const codes = ['clear', 'clear', 'clear', 'partly_cloudy', 'partly_cloudy', 'cloudy', 'cloudy', 'partly_cloudy', 'partly_cloudy'] as const;
  const temps = [62, 63, 64, 66, 67, 68, 67, 65, 62];
  const base = new Date('2026-06-07T16:00:00Z').getTime();
  return temps.map((t, i) => ({ time: new Date(base + i * 3600000).toISOString(), temp_f: t, condition_code: codes[i], precip_chance: i >= 5 ? 10 : 0 }));
}
function days() {
  const codes = ['clear', 'partly_cloudy', 'rain', 'rain', 'partly_cloudy'] as const;
  const hi = [68, 70, 64, 61, 66]; const lo = [49, 51, 50, 48, 49]; const p = [0, 10, 60, 40, 10];
  const base = new Date('2026-06-07T12:00:00Z').getTime();
  return codes.map((c, i) => ({ date: new Date(base + i * 86400000).toISOString(), condition_code: c, high_f: hi[i], low_f: lo[i], precip_chance: p[i] }));
}

function buildMock(): PlaceIntelligence {
  const sections: PlaceSection[] = [
    sec('weather', { as_of: '2026-06-07T16:40:00Z', data: { current_temp_f: 62, condition_code: 'clear', condition_label: 'Clear', feels_like_f: 60, high_f: 68, low_f: 49, hourly: hours(), daily: days() } }),
    sec('air_quality', { data: { index: 38, category: 'good', category_label: 'Good', dominant_pollutant: 'pm25', health_message: 'Air quality is good. It’s a fine day to be active outdoors, with no precautions needed.' } }),
    sec('alerts', { data: { active: [] } }),
    sec('sunrise_sunset', { data: { sunrise: '2026-06-07T13:42:00Z', sunset: '2026-06-08T03:11:00Z', daylight_minutes: 809 } }),
    // Verbatim output of backend/services/goodDayEngine.js for the hours()
    // and days() above — the preview must not flatter the real engine.
    sec('good_day_to', { as_of: '2026-06-07T16:40:00Z', data: { tiles: [
      { id: 'open_windows', label: 'Open windows', glyph: '\ud83e\ude9f', verdict: 'yes', answer: 'Yes \u2014 until 5pm', because: 'AQI 38 (good) and 62\u201368\u00b0F through 5pm.' },
      { id: 'run', label: 'Run', glyph: '\ud83c\udfc3', verdict: 'yes', answer: '9am\u20135pm', because: '62\u00b0F and under 50% rain in that window.' },
      { id: 'wash_car', label: 'Wash the car', glyph: '\ud83d\ude97', verdict: 'no', answer: 'Wait \u2014 rain Tuesday', because: '60% chance of rain Tuesday. It would be wasted.' },
      { id: 'water_lawn', label: 'Water the lawn', glyph: '\ud83c\udf31', verdict: 'yes', answer: 'Worth doing', because: 'No meaningful rain in the next 2 days (highest chance 10%).' },
      { id: 'grill', label: 'Grill', glyph: '\ud83d\udd25', verdict: 'yes', answer: 'Yes', because: '64\u00b0F this evening, under 50% rain and light wind.' },
    ] } }),
    sec('your_home', { as_of: '2026-05-01T00:00:00Z', data: { year_built: 1979, sqft: 1840, bedrooms: 3, bathrooms: 2, lot_sqft: 5200, home_type: 'house', estimated_value: 612000, value_low: 590000, value_high: 640000, assessed_value: 438200 } }),
    // Verbatim output of backend/services/heatColdEngine.js for a Major-heat
    // week — the preview must not flatter the real engine.
    sec('heat_cold', { as_of: '2026-06-07T16:40:00Z', data: {
      mode: 'heat',
      heat_covered: true,
      peak_level: 3,
      peak_date: '2026-06-09',
      freeze: null,
      heat_days: [
        { date: '2026-06-07', day: 1, level: 1, label: 'Minor', meaning: 'Affects primarily those extremely sensitive to heat.' },
        { date: '2026-06-08', day: 2, level: 2, label: 'Moderate', meaning: 'Affects most people sensitive to heat, especially without effective cooling or hydration.' },
        { date: '2026-06-09', day: 3, level: 3, label: 'Major', meaning: 'Affects anyone without effective cooling or adequate hydration. Impacts likely in health systems and heat-sensitive industries.' },
        { date: '2026-06-10', day: 4, level: 3, label: 'Major', meaning: 'Affects anyone without effective cooling or adequate hydration. Impacts likely in health systems and heat-sensitive industries.' },
        { date: '2026-06-11', day: 5, level: 2, label: 'Moderate', meaning: 'Affects most people sensitive to heat, especially without effective cooling or hydration.' },
        { date: '2026-06-12', day: 6, level: 1, label: 'Minor', meaning: 'Affects primarily those extremely sensitive to heat.' },
        { date: '2026-06-13', day: 7, level: 1, label: 'Minor', meaning: 'Affects primarily those extremely sensitive to heat.' },
      ],
      headline: 'Major heat risk, tomorrow through Thursday.',
      guidance: "Overnight lows near 79\u00b0F give the house no chance to shed the day's heat. Your home dates to 1979, so it likely leaks more than a newer build \u2014 cool one room rather than the whole house. Check on anyone nearby who is older, alone, or without working cooling.",
      source_note: 'NWS HeatRisk (experimental)',
    } }),
    // Verbatim output of backend/services/homeSystemsService.js for a 1979
    // home with two confirmed systems — the preview must not flatter it.
    sec('home_systems', { data: {
          "systems": [
                {
                      "key": "roof",
                      "label": "Roof",
                      "installed_year": 2019,
                      "age_years": 7,
                      "typical_life_low": 20,
                      "typical_life_high": 25,
                      "status": "ok",
                      "life_remaining": 0.72,
                      "source": "permit",
                      "source_label": "From a permit record",
                      "confidence": "medium",
                      "source_ref": "RES-19-3382",
                      "note": "Asphalt shingle roofs typically last 20\u201325 years."
                },
                {
                      "key": "hvac",
                      "label": "Heating & cooling",
                      "installed_year": 1979,
                      "age_years": 47,
                      "typical_life_low": 15,
                      "typical_life_high": 20,
                      "status": "past_expected",
                      "life_remaining": 0,
                      "source": "estimated",
                      "source_label": "Estimated from year built",
                      "confidence": "low",
                      "source_ref": null,
                      "note": "Furnaces typically last 15\u201320 years; central air units less."
                },
                {
                      "key": "water_heater",
                      "label": "Water heater",
                      "installed_year": 2022,
                      "age_years": 4,
                      "typical_life_low": 8,
                      "typical_life_high": 12,
                      "status": "ok",
                      "life_remaining": 0.67,
                      "source": "resident",
                      "source_label": "You told us",
                      "confidence": "high",
                      "source_ref": null,
                      "note": "Tank water heaters typically last 8\u201312 years."
                },
                {
                      "key": "electrical_panel",
                      "label": "Electrical panel",
                      "installed_year": 1979,
                      "age_years": 47,
                      "typical_life_low": 40,
                      "typical_life_high": 60,
                      "status": "aging",
                      "life_remaining": 0.22,
                      "source": "estimated",
                      "source_label": "Estimated from year built",
                      "confidence": "low",
                      "source_ref": null,
                      "note": "Panels last decades, but capacity and recalled brands matter more than age."
                },
                {
                      "key": "sewer_septic",
                      "label": "Sewer / septic",
                      "installed_year": 1979,
                      "age_years": 47,
                      "typical_life_low": 30,
                      "typical_life_high": 40,
                      "status": "past_expected",
                      "life_remaining": 0,
                      "source": "estimated",
                      "source_label": "Estimated from year built",
                      "confidence": "low",
                      "source_ref": null,
                      "note": "Septic tanks typically last 30\u201340 years; sewer laterals longer."
                },
                {
                      "key": "windows",
                      "label": "Windows",
                      "installed_year": 1979,
                      "age_years": 47,
                      "typical_life_low": 20,
                      "typical_life_high": 30,
                      "status": "past_expected",
                      "life_remaining": 0,
                      "source": "estimated",
                      "source_label": "Estimated from year built",
                      "confidence": "low",
                      "source_ref": null,
                      "note": "Windows typically last 20\u201330 years before seals fail."
                }
          ],
          "summary": {
                "past_expected_count": 3,
                "aging_count": 1,
                "confirmed_count": 2,
                "total_count": 6,
                "headline": "Past typical service life: heating & cooling, sewer / septic and windows."
          }
    } }),
    sec('flood', { data: { zone: 'X', zone_label: 'Zone X', risk_level: 'minimal', in_sfha: false, insurance_required: false, plain_meaning: "Your home sits outside the high-risk flood zones. Flood insurance isn't federally required here — though low-risk areas still see a meaningful share of claims, so it's worth considering.", nfip: { policy_count: 128, premium_p25: 480, premium_median: 760, premium_p75: 1240, full_risk_median: 910, window_months: 24, coverage: 'full', as_of: '2026-08-01T00:00:00.000Z' } } }),
    sec('exemption_check', { data: { filing_status: 'none_on_file', exemptions: [], homestead_on_file: false, assessment_signal: { assessed_value: 438200, market_value: 612000, ratio_pct: -28, stance: 'below' }, state_program: { state: 'OR', label: 'Homeowner exemption programs', filing: 'varies', note: 'Many states and counties reduce property tax on a primary residence, and most programs require a one-time application. Check your county assessor.', curated: false } } }),
    sec('lead_radon', { status: 'unavailable' }),
    sec('drinking_water', { status: 'unavailable' }),
    sec('environmental_hazards', { status: 'unavailable' }),
    sec('block_density', { data: { bucket: 'few', label: 'A few verified homes nearby' } }),
    sec('census_context', { data: { median_year_built: 1985, median_home_value: 498000, tract_name: 'Census tract 41051001100', summary: 'Most homes here went up in the mid-1980s, and the typical one is valued around half a million. Yours sits a little above that.' } }),
    sec('bill_benchmark', { data: { utility: 'electric', your_amount: 142, band_low: 165, band_high: 210, comparison: 'lower', comparison_pct: -16, period: '12-month average', summary: 'Your bill runs lower than most homes like yours nearby — similar size, similar age. The shaded band is what comparable homes typically pay.' } }),
    sec('incentives', { data: { summary: '4 programs you may qualify for', programs: [
      { id: 'fed', name: 'Residential Clean Energy Credit', level: 'federal', incentive_type: 'tax_credit', summary: '30% of the cost of solar or battery storage, claimed on your federal return.' },
      { id: 'eto', name: 'Energy Trust of Oregon rebates', level: 'utility', incentive_type: 'rebate', summary: 'Cash back on heat pumps, insulation, and efficient windows.' },
      { id: 'storage', name: 'Solar + Storage Rebate', level: 'state', incentive_type: 'rebate', summary: 'An upfront rebate for solar paired with home battery storage.' },
      { id: 'hpwh', name: 'Heat-pump water heater discount', level: 'utility', incentive_type: 'discount', summary: 'Taken off at checkout through participating installers.' },
    ] } }),
    sec('rent_band', { data: { bedrooms: 2, band_low: 2120, band_high: 2600, market_low: 1800, market_high: 2900, period: 'FY 2026', summary: 'Typical asking rent for a 2-bedroom in your area.' } }),
    sec('real_rent', { band: 'D', data: { state: 'ready', reports: 11, needed: 10, scope: 'bedrooms', bedrooms: 2, sample_size: 11, rent_p25: 1950, rent_median: 2180, rent_p75: 2400, your_rent: 2300, standing: 'in_band', summary: '11 verified 2-bedroom homes on your block pay a median of $2,180/mo.' } }),
    sec('civic_districts', { data: {
      districts: [
        { level: 'federal', office_label: 'U.S. House', name: 'Oregon’s 3rd District' },
        { level: 'state', office_label: 'State Senate', name: 'District 23' },
        { level: 'state', office_label: 'State House', name: 'District 46' },
        { level: 'county', office_label: 'County', name: 'Multnomah County' },
        { level: 'city', office_label: 'City Council', name: 'Portland · District 3' },
        { level: 'school', office_label: 'School', name: 'Portland Public Schools' },
      ],
      representatives: [
        { name: 'Ron Wyden', office: 'U.S. Senator', level: 'federal', party: 'D', phone: '+1-202-224-5244', email: null, website: 'https://www.wyden.senate.gov' },
        { name: 'Jeff Merkley', office: 'U.S. Senator', level: 'federal', party: 'D', phone: '+1-202-224-3753', email: null, website: 'https://www.merkley.senate.gov' },
        { name: 'Kayse Jama', office: 'State Senator · D-23', level: 'state', party: 'D', phone: null, email: 'sen.kaysejama@oregonlegislature.gov', website: 'https://www.oregonlegislature.gov' },
        { name: 'Keith Wilson', office: 'Mayor of Portland', level: 'city', party: null, phone: '+1-503-823-4120', email: null, website: 'https://www.portland.gov' },
      ],
    } }),
    sec('civic_election', { data: {
      name: 'May 2026 Primary Election', date: '2026-05-19T00:00:00Z', days_until: 12,
      polling_place: { name: 'Vote by mail · Oregon', detail: 'Return by mail or to any county drop box by 8:00 PM on election day.', vote_by_mail: true },
      ballot: [
        { type: 'office', title: 'U.S. Representative · District 3', candidates: ['Maxine Dexter', 'Joe Polise', 'David Walker'], summary: null },
        { type: 'office', title: 'Governor', candidates: ['Tina Kotek', 'Christine Drazan', 'Nick Kristof'], summary: null },
        { type: 'measure', title: 'Measure 26-250', candidates: [], summary: 'Renews the local levy that funds parks, trails, and natural-area maintenance for five years.' },
      ],
    } }),
  ];

  const byGroup = new Map<PlaceSection['group'], PlaceSection[]>();
  for (const s of sections) {
    if (!byGroup.has(s.group)) byGroup.set(s.group, []);
    byGroup.get(s.group)!.push(s);
  }
  const groups = GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({ group: g, label: GROUP_LABELS[g], sections: byGroup.get(g)! }));

  return {
    place: { label: '1421 SE Oak St, Portland', line1: '1421 SE Oak St', city: 'Portland', state: 'OR', postal_code: '97214' },
    tier: 'T4', region_supported: true, generated_at: '2026-06-07T16:41:00Z', groups,
  };
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[420px]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-muted mb-2 px-1">{label}</div>
      <div className="bg-app-bg border border-app-border rounded-3xl shadow-sm overflow-hidden">{children}</div>
    </div>
  );
}

export default function DevPlaceDetailPage() {
  const intel = buildMock();
  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-[1600px] mx-auto px-5 py-10">
        <header className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-app-home mb-1">Pantopus · Place · group-detail preview</p>
          <h1 className="text-2xl font-bold -tracking-[0.02em]">Group-detail pages (W2.3)</h1>
          <p className="text-sm text-app-text-secondary mt-1 max-w-2xl">
            The seven ContentDetail pages, rendered from one mock PlaceIntelligence. Permits and property tax show the
            post-v1 states; private inputs (mortgage, rent, readiness checklist) are device-local.
          </p>
        </header>

        <div className="flex flex-wrap gap-8 items-start">
          <Column label="Today / Environment"><TodayDetail intelligence={intel} /></Column>
          <Column label="Your home"><YourHomeDetail intelligence={intel} homeId={null} /></Column>
          <Column label="Risk & readiness"><RiskDetail intelligence={intel} homeId={null} /></Column>
          <Column label="Your block"><BlockDetail intelligence={intel} homeId={null} /></Column>
          <Column label="Money signals"><MoneyDetail intelligence={intel} homeId={null} /></Column>
          <Column label="Civic"><CivicDetail intelligence={intel} /></Column>
          <Column label="Identity"><IdentityDetail intelligence={intel} homeId={null} residentName="Riley Chen" /></Column>
        </div>
      </div>
    </main>
  );
}
