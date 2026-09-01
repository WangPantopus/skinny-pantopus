'use client';

// ============================================================
// /dev/place-pulse — visual preview of Today's Pulse, the full ranked
// stream (W2.5). Mock NeighborhoodPulse data exercises both moods: an
// urgent stream (Needs attention rises to the top) and a calm one (the
// "all clear" summary tops the list). Public route, no fetching — a
// verification surface, not a shipped screen.
// ============================================================

import type { NeighborhoodPulse } from '@pantopus/types';
import PulseStreamView from '@/components/place/pulse/PulseStreamView';

function pulse(signals: NeighborhoodPulse['pulse']['signals'], summary: string, status: NeighborhoodPulse['pulse']['overall_status']): NeighborhoodPulse['pulse'] {
  return {
    greeting: 'Good morning',
    summary,
    overall_status: status,
    property: null,
    neighborhood: null,
    signals,
    seasonal_context: { season: 'spring', tip: null, first_action_nudge: null },
    community_density: { neighbor_count: 3, density_message: 'A few verified homes nearby', invite_cta: false },
    sources: [],
    meta: { community_signals_count: 0, external_signals_count: 0, partial_failures: [], computed_at: '2026-06-07T16:41:00Z' },
  };
}

const URGENT = pulse(
  [
    {
      signal_type: 'air_quality',
      priority: 1,
      title: 'Air quality is unhealthy for sensitive groups',
      detail: 'AQI 112 right now. Limit time outdoors this afternoon — it should clear by evening.',
      icon: 'wind',
      color: 'amber',
      actions: [{ type: 'view', label: 'See air quality', route: '/app/place/today' }],
    },
    {
      signal_type: 'weather',
      priority: 2,
      title: 'Wind Advisory until 6:00 PM',
      detail: 'Southwest gusts up to 45 mph. Secure loose outdoor objects on your property.',
      icon: 'triangle-alert',
      color: 'amber',
      actions: [{ type: 'view', label: 'See alert details', route: '/app/place/today' }],
    },
    {
      signal_type: 'seasonal_suggestion',
      priority: 5,
      title: 'A heat-pump rebate may apply to your home',
      detail: 'You could be eligible for up to $1,600 back. Verify a few details to confirm.',
      icon: 'badge-percent',
      color: 'blue',
      actions: [{ type: 'view', label: 'Check your eligibility', route: '/app/place/money' }],
    },
    {
      signal_type: 'community',
      priority: 8,
      title: 'A new home verified on your block',
      detail: 'Two doors down on SE Oak St. Your block is starting to form — 3 verified homes now.',
      icon: 'house',
      color: 'green',
      actions: [{ type: 'view', label: 'See your block', route: '/app/place/block' }],
    },
  ],
  "Heads up — air quality and wind need your attention today.",
  'alert',
);

const CALM = pulse(
  [
    {
      signal_type: 'local_services',
      priority: 4,
      title: 'Your electric bill runs high',
      detail: 'About 12% above similar verified homes near you this season.',
      icon: 'zap',
      color: 'amber',
      actions: [{ type: 'view', label: "See where it's going", route: '/app/place/money' }],
    },
    {
      signal_type: 'community',
      priority: 8,
      title: 'A new home verified on your block',
      detail: 'Two doors down on SE Oak St. Your block is starting to form — 3 verified homes now.',
      icon: 'house',
      color: 'green',
      actions: [{ type: 'view', label: 'See your block', route: '/app/place/block' }],
    },
  ],
  'Nothing needs your attention on your block right now.',
  'quiet',
);

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[420px]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-muted mb-2 px-1">
        {label}
      </div>
      <div className="bg-app-bg border border-app-border rounded-3xl shadow-sm overflow-hidden">{children}</div>
    </div>
  );
}

export default function DevPlacePulsePage() {
  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-6xl mx-auto px-5 py-10">
        <header className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-app-home mb-1">
            Pantopus · Place · pulse stream preview
          </p>
          <h1 className="text-2xl font-bold -tracking-[0.02em]">Today&apos;s Pulse — full ranked stream</h1>
          <p className="text-sm text-app-text-secondary mt-1 max-w-2xl">
            The feed sibling to the structured dashboard. Mock NeighborhoodPulse data, ranked into the
            four legibility tiers. When something is urgent, &quot;Needs attention&quot; rises above
            everything with an emphasis wash; on a calm day the &quot;all clear&quot; summary tops the
            list. The claimed (T3) column adds the quiet verify nudge.
          </p>
        </header>

        <div className="flex flex-wrap gap-8 items-start">
          <Column label="Urgent — needs attention first">
            <PulseStreamView pulse={URGENT} address="1421 SE Oak St · Portland" homeId="dev-home" />
          </Column>
          <Column label="Calm — all clear summary">
            <PulseStreamView pulse={CALM} address="1421 SE Oak St · Portland" homeId="dev-home" />
          </Column>
          <Column label="Claimed (T3) — verify nudge">
            <PulseStreamView
              pulse={CALM}
              address="1421 SE Oak St · Portland"
              homeId="dev-home"
              verifyAddress="1421 SE Oak St, Portland"
              showVerify
            />
          </Column>
        </div>
      </div>
    </main>
  );
}
