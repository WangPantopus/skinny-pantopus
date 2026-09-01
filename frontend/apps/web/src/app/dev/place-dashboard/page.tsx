'use client';

// ============================================================
// /dev/place-dashboard — visual preview of the assembled Place
// dashboard (W1.3) with mock PlaceIntelligence that mirrors a seeded
// verified home. Shows both hero moods (all-clear / active alert), the
// loading skeleton, and section-by-section degradation (ready / stale /
// unavailable / error + density bucket). Public route, no fetching.
// ============================================================

import type { PlaceIntelligence, PlaceSection, PlaceSectionId } from '@pantopus/types';
import PlaceDashboardView from '@/components/place/PlaceDashboardView';
import PlaceDashboardSkeleton from '@/components/place/PlaceDashboardSkeleton';

// ── section meta (mirrors the backend serializer) ───────────
const META: Record<PlaceSectionId, { group: PlaceSection['group']; band: PlaceSection['band']; source: string }> = {
  weather: { group: 'today', band: 'A', source: 'National Weather Service' },
  air_quality: { group: 'today', band: 'A', source: 'AirNow · EPA' },
  alerts: { group: 'today', band: 'A', source: 'National Weather Service' },
  sunrise_sunset: { group: 'today', band: 'A', source: 'Open-Meteo' },
  your_home: { group: 'your_home', band: 'B', source: 'County records · ATTOM' },
  flood: { group: 'risk_readiness', band: 'A', source: 'FEMA National Flood Hazard Layer' },
  seismic: { group: 'risk_readiness', band: 'A', source: 'USGS seismic design values (ASCE 7-22)' },
  wildfire: { group: 'risk_readiness', band: 'A', source: 'USFS Wildfire Hazard Potential' },
  lead_radon: { group: 'health_environment', band: 'A', source: 'EPA radon zones · HUD lead-paint rules' },
  drinking_water: { group: 'health_environment', band: 'A', source: 'EPA SDWIS' },
  environmental_hazards: { group: 'health_environment', band: 'A', source: 'EPA ECHO' },
  block_density: { group: 'your_block', band: 'A', source: 'Pantopus' },
  census_context: { group: 'your_block', band: 'A', source: 'U.S. Census · American Community Survey' },
  bill_benchmark: { group: 'money_signals', band: 'A', source: 'Pantopus · peer comparison' },
  incentives: { group: 'money_signals', band: 'A', source: 'DSIRE' },
  rent_band: { group: 'money_signals', band: 'A', source: 'HUD Fair Market Rents' },
  civic_districts: { group: 'civic', band: 'A', source: 'Google Civic Information' },
  civic_election: { group: 'civic', band: 'A', source: 'Official county elections' },
};

const GROUP_ORDER: PlaceSection['group'][] = [
  'today',
  'your_home',
  'risk_readiness',
  'health_environment',
  'your_block',
  'money_signals',
  'civic',
  'identity',
];
const GROUP_LABELS: Record<PlaceSection['group'], string> = {
  today: 'Today',
  your_home: 'Your home',
  risk_readiness: 'Risk & readiness',
  health_environment: 'Health & environment',
  your_block: 'Your block',
  money_signals: 'Money signals',
  civic: 'Civic',
  identity: 'Identity',
};

function sec(id: PlaceSectionId, opts: Partial<PlaceSection> = {}): PlaceSection {
  const meta = META[id];
  return {
    id,
    group: meta.group,
    band: meta.band,
    access: 'available',
    status: 'ready',
    as_of: null,
    source: meta.source,
    coverage: 'full',
    unavailable_reason: null,
    data: null,
    ...opts,
  } as PlaceSection;
}

function build(alert: boolean, tier: PlaceIntelligence['tier'] = 'T4'): PlaceIntelligence {
  const sections: PlaceSection[] = [
    // Today
    sec('weather', {
      as_of: '2026-06-07T16:40:00Z',
      data: {
        current_temp_f: 62,
        condition_code: 'clear',
        condition_label: 'Clear',
        feels_like_f: 60,
        high_f: 68,
        low_f: 49,
        hourly: [],
        daily: [],
      },
    }),
    alert
      ? sec('air_quality', {
          data: {
            index: 112,
            category: 'unhealthy_sensitive',
            category_label: 'Unhealthy for sensitive groups',
            dominant_pollutant: 'pm25',
            health_message: 'Limit time outdoors this afternoon. It should clear by evening.',
          },
        })
      : sec('air_quality', {
          data: {
            index: 38,
            category: 'good',
            category_label: 'Good',
            dominant_pollutant: 'pm25',
            health_message: 'Air quality is good. A fine day to be active outdoors.',
          },
        }),
    // No active weather alert in either scenario, so the alert hero is
    // carried by air quality (the design's canonical alert example).
    sec('alerts', { data: { active: [] } }),
    sec('sunrise_sunset', { status: 'unavailable', unavailable_reason: 'Coverage is expanding. Check back later.' }),

    // Your home — Band B, no ATTOM key in the seed
    sec('your_home', {
      status: 'unavailable',
      unavailable_reason: "Exact property details aren't available for your area yet.",
    }),

    // Risk & readiness
    sec('flood', {
      data: {
        zone: 'X',
        zone_label: 'Zone X',
        risk_level: 'minimal',
        in_sfha: false,
        insurance_required: false,
        plain_meaning: 'Minimal flood risk. Outside the high-risk flood zone.',
      },
    }),

    // Health & environment — degrade independently
    sec('lead_radon', { status: 'unavailable' }),
    sec('drinking_water', { status: 'error' }),
    sec('environmental_hazards', { status: 'unavailable' }),

    // Your block
    sec('block_density', { data: { bucket: 'few', label: 'A few verified homes nearby' } }),
    sec('census_context', {
      status: 'stale',
      as_of: '2026-01-12T00:00:00Z',
      data: {
        median_year_built: 1985,
        median_home_value: 540000,
        tract_name: 'Census tract 41051001100',
        summary: 'Most homes here were built around 1985, and the typical one is valued near $540,000.',
      },
    }),

    // Money signals
    sec('bill_benchmark', {
      data: {
        utility: 'electric',
        your_amount: 142,
        band_low: 96,
        band_high: 130,
        comparison: 'higher',
        comparison_pct: 12,
        period: '12-month average',
        summary: 'Your electric bill is 12% above neighbors',
      },
    }),
    sec('incentives', { status: 'unavailable' }),
    sec('rent_band', { status: 'unavailable' }),

    // Civic
    sec('civic_districts', { status: 'unavailable' }),
    sec('civic_election', { status: 'unavailable' }),
  ];

  const byGroup = new Map<PlaceSection['group'], PlaceSection[]>();
  for (const s of sections) {
    if (!byGroup.has(s.group)) byGroup.set(s.group, []);
    byGroup.get(s.group)!.push(s);
  }
  const groups = GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    sections: byGroup.get(g)!,
  }));

  return {
    place: {
      label: '1421 SE Oak St, Portland',
      line1: '1421 SE Oak St',
      city: 'Portland',
      state: 'OR',
      postal_code: '97214',
    },
    tier,
    region_supported: true,
    generated_at: '2026-06-07T16:41:00Z',
    groups,
  };
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[420px]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-muted mb-2 px-1">
        {label}
      </div>
      <div className="bg-app-bg border border-app-border rounded-3xl shadow-sm p-4">{children}</div>
    </div>
  );
}

export default function DevPlaceDashboardPage() {
  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-6xl mx-auto px-5 py-10">
        <header className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-app-home mb-1">
            Pantopus · Place · dashboard preview
          </p>
          <h1 className="text-2xl font-bold -tracking-[0.02em]">Place dashboard (T3 claimed · T4 verified)</h1>
          <p className="text-sm text-app-text-secondary mt-1 max-w-2xl">
            Mock PlaceIntelligence mirroring a seeded home. Sections degrade independently — ready,
            stale, unavailable, error — and the hero floats what matters now. The claimed (T3) tier
            adds the verify nudge and shows the Band-D items (messaging, badge, mailbox) as locked.
          </p>
        </header>

        <div className="flex flex-wrap gap-8 items-start">
          <Column label="Verified (T4) · all clear">
            <PlaceDashboardView intelligence={build(false)} homeId="dev-home" userInitials="RC" />
          </Column>
          <Column label="Verified (T4) · active alert">
            <PlaceDashboardView intelligence={build(true)} homeId="dev-home" userInitials="RC" />
          </Column>
          <Column label="Claimed (T3) · verify nudge + Band-D locked">
            <PlaceDashboardView
              intelligence={build(false, 'T3')}
              homeId="dev-home"
              userInitials="RC"
              onClaim={() => {}}
            />
          </Column>
          <Column label="Loading">
            <PlaceDashboardSkeleton />
          </Column>
        </div>
      </div>
    </main>
  );
}
