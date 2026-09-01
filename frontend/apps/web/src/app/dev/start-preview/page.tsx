'use client';

// ============================================================
// /dev/start-preview — visual preview of the signed-out taste (Wedge
// v2, D1) with a fixture PlacePreview: the aha card, every free Band-A
// layer, the one locked layer, and the privacy promise. Public route,
// no fetching. Two fixtures: a "High wildfire" spot and a "quiet on
// every layer" spot, toggled at the top.
// ============================================================

import { useState } from 'react';
import type { PlacePreview } from '@pantopus/api';
import type { PlaceSection, PlaceSectionId } from '@pantopus/types';
import { PreviewBody } from '@/components/place/StartFunnel';

const META: Partial<Record<PlaceSectionId, { group: PlaceSection['group']; source: string }>> = {
  weather: { group: 'today', source: 'National Weather Service' },
  air_quality: { group: 'today', source: 'AirNow · EPA' },
  alerts: { group: 'today', source: 'National Weather Service' },
  sunrise_sunset: { group: 'today', source: 'Open-Meteo' },
  flood: { group: 'risk_readiness', source: 'FEMA National Flood Hazard Layer' },
  seismic: { group: 'risk_readiness', source: 'USGS seismic design values (ASCE 7-22)' },
  wildfire: { group: 'risk_readiness', source: 'USFS Wildfire Hazard Potential' },
  lead_radon: { group: 'health_environment', source: 'EPA radon zones · HUD lead-paint rules' },
  drinking_water: { group: 'health_environment', source: 'EPA SDWIS' },
  environmental_hazards: { group: 'health_environment', source: 'EPA ECHO' },
  block_density: { group: 'your_block', source: 'Pantopus' },
  census_context: { group: 'your_block', source: 'U.S. Census · American Community Survey' },
  rent_band: { group: 'money_signals', source: 'HUD Fair Market Rents' },
  civic_districts: { group: 'civic', source: 'U.S. Census Bureau' },
  civic_election: { group: 'civic', source: 'Official county elections' },
};

function env(id: PlaceSectionId, data: unknown, status: PlaceSection['status'] = 'ready', reason: string | null = null): PlaceSection {
  const m = META[id]!;
  return {
    id,
    group: m.group,
    band: 'A',
    access: 'available',
    status,
    as_of: '2026-09-01T14:00:00.000Z',
    source: m.source,
    coverage: 'full',
    unavailable_reason: reason,
    data: status === 'unavailable' || status === 'error' ? null : data,
  } as PlaceSection;
}

const BASE = {
  status: 'ready' as const,
  tier: 'preview' as const,
  region: 'US' as const,
  place: { address: '1214 NE Birch St', city: 'Camas', state: 'WA', zipcode: '98607' },
  free: {
    flood: { status: 'ready' as const, zone: 'X', description: 'Minimal flood risk', source: 'FEMA National Flood Hazard Layer' },
    density: { status: 'ready' as const, bucket: 'none' as const, label: 'Founding Neighbor slots are open here', source: 'Pantopus verified neighbors' },
    area: { status: 'ready' as const, median_year_built: 1998, median_home_value: 612000, note: 'Area-level, not your home', source: 'U.S. Census · American Community Survey' },
  },
  locked: [
    { id: 'home_details', group: 'your_home' as const, title: 'Home details & value', band: 'B' as const, unlock: 'claim' as const, reason: "Claim this address to see the home's exact record and value." },
  ],
  disclaimer: 'A free, one-time look at what\'s public. Claim this address to save it and get it every morning.',
};

function sections(quiet: boolean): PlaceSection[] {
  return [
    env('weather', { current_temp_f: 71, condition_code: 'clear', condition_label: 'Clear', feels_like_f: 70, high_f: 84, low_f: 55, hourly: [], daily: [] }),
    env('air_quality', quiet
      ? { index: 28, category: 'good', category_label: 'Good', dominant_pollutant: 'PM2.5', health_message: 'Air quality is good. A fine day to be active outdoors.' }
      : { index: 112, category: 'unhealthy_sensitive', category_label: 'Unhealthy for sensitive groups', dominant_pollutant: 'PM2.5', health_message: 'Sensitive groups should limit time outdoors. It is fine for most people.' }),
    env('alerts', { active: [] }),
    env('sunrise_sunset', { sunrise: '2026-09-01T13:30:00Z', sunset: '2026-09-02T02:45:00Z', daylight_minutes: 795, summary: '13h 15m of daylight.' }),
    env('flood', { zone: 'X', zone_label: 'Zone X', risk_level: 'minimal', in_sfha: false, insurance_required: false, plain_meaning: 'Minimal flood risk' }),
    env('seismic', { design_category: 'D', sds: 1.1, summary: 'Seismic design category D — high expected shaking demand.', disclaimer: 'Engineering demand for new construction at this point (ASCE 7-22) — not an earthquake forecast.' }),
    env('wildfire', quiet
      ? { hazard_class: 1, hazard_label: 'Very low', burnable: true, summary: 'Very low wildfire hazard potential for the vegetation around this point.', disclaimer: 'USFS Wildfire Hazard Potential (2023).' }
      : { hazard_class: 4, hazard_label: 'High', burnable: true, summary: 'High wildfire hazard potential for the vegetation around this point.', disclaimer: 'USFS Wildfire Hazard Potential (2023) — landscape fuel conditions, not a prediction for this home.' }),
    env('lead_radon', { year_built: null, lead_paint_risk: 'unknown', radon_zone: 2, summary: 'Clark County is EPA radon zone 2 (moderate potential). A $15 test kit settles it.', disclaimer: 'Screening, not a test of this home.' }, 'partial'),
    env('drinking_water', { utility_name: 'City of Camas Water', pws_id: 'WA5311100', recent_health_violations: false, violation_count: 0, summary: 'No health-based violations reported in the last 5 years.' }),
    env('environmental_hazards', quiet
      ? { facilities_within_mile: 0, radius_mi: 1, facilities: [], summary: 'No EPA-regulated facilities within a mile.', disclaimer: '' }
      : { facilities_within_mile: 2, radius_mi: 1, facilities: [{ name: 'Georgia-Pacific Camas Mill', program: 'Clean Air Act', distance_mi: 0.8 }], summary: '2 EPA-regulated facilities within a mile — regulated activity nearby, not unsafe exposure.', disclaimer: '' }),
    env('block_density', { bucket: 'none', label: 'Founding Neighbor slots are open here' }),
    env('census_context', { median_year_built: 1998, median_home_value: 612000, tract_name: null, summary: 'Most homes here were built around 1998, and the typical one is valued near $612,000.' }),
    env('rent_band', { bedrooms: 2, band_low: 1890, band_high: 2268, market_low: 1450, market_high: 3900, period: 'FY 2026', summary: "HUD's FY 2026 fair market rent for a 2-bedroom in Clark County is $1,890/mo; the band runs to about 20% above it." }),
    env('civic_districts', { districts: [
      { level: 'federal', office_label: 'U.S. House', name: "Washington's 3rd District" },
      { level: 'state', office_label: 'State Senate', name: 'State Senate District 18' },
      { level: 'county', office_label: 'County', name: 'Clark County' },
      { level: 'city', office_label: 'City', name: 'Camas' },
      { level: 'school', office_label: 'School district', name: 'Camas School District' },
    ], representatives: [] }),
    env('civic_election', null, 'unavailable', 'No upcoming election on the calendar for your area.'),
  ];
}

const FIXTURES: Record<'smoke' | 'quiet', PlacePreview> = {
  smoke: {
    ...BASE,
    sections: sections(false),
    aha: {
      section_id: 'wildfire',
      tone: 'alert',
      grade: 'High',
      headline: 'High wildfire hazard around this address',
      detail: 'High wildfire hazard potential for the vegetation around this point.',
      follow_up: 'Claim it to get smoke-day and burn-ban alerts every morning.',
    },
  },
  quiet: {
    ...BASE,
    sections: sections(true),
    aha: {
      section_id: null,
      tone: 'calm',
      grade: 'Quiet',
      headline: 'Quiet on every layer',
      detail: "Minimal flood risk, low wildfire hazard, good air today, no active alerts. That's rarer than you'd think.",
      follow_up: 'Claim this address to know the morning that changes.',
    },
  },
};

export default function StartPreviewDevPage() {
  const [which, setWhich] = useState<'smoke' | 'quiet'>('smoke');
  return (
    <div className="min-h-screen bg-app-bg">
      <div className="mx-auto w-full max-w-[480px] sm:max-w-[540px] px-5 pt-4 pb-10">
        <div className="flex items-center gap-2 mb-2">
          {(['smoke', 'quiet'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setWhich(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${which === k ? 'bg-primary-600 text-white border-primary-600' : 'bg-app-surface text-app-text border-app-border'}`}
            >
              {k === 'smoke' ? 'High wildfire spot' : 'Quiet spot'}
            </button>
          ))}
          <span className="text-xs text-app-text-muted">/dev fixture · 1214 NE Birch St, Camas</span>
        </div>
        <PreviewBody preview={FIXTURES[which]} onWall={() => {}} />
      </div>
    </div>
  );
}
