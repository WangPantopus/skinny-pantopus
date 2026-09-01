// ============================================================
// Today's Pulse — stream ranking (C10).
//
// Flattens the NeighborhoodPulse signals into one priority-ranked
// stream, bucketed into the four legibility tiers the design uses
// (Needs attention · Worth a look · Around you · When you have a
// minute) — the ranking made readable, never a fake number. Pure +
// data-driven so the view degrades to "all clear" when nothing is
// urgent, and so it's trivial to test.
// ============================================================

import type { LucideIcon } from 'lucide-react';
import {
  Wind,
  CloudSun,
  TriangleAlert,
  Leaf,
  Briefcase,
  Users,
  Sparkles,
  BellOff,
} from 'lucide-react';
import type { NeighborhoodPulse, PulseSignal } from '@pantopus/types';

export type SignalTone = 'home' | 'sky' | 'warning' | 'muted';
export type TierKey = 'attention' | 'worth' | 'around' | 'whenever';

/** A single ranked signal, ready to render as a SignalCard. */
export interface StreamSignal {
  key: string;
  icon: LucideIcon;
  tone: SignalTone;
  /** The top tier reads with an emphasis wash; everything else is calm. */
  emphasis: boolean;
  title: string;
  detail: string;
  /** First actionable action the signal carries (route into the app). */
  action?: { label: string; route: string };
}

export interface StreamTier {
  key: TierKey;
  label: string;
  signals: StreamSignal[];
}

export interface ClearedFact {
  icon: LucideIcon;
  label: string;
}

export interface RankedStream {
  /** True when something needs attention now (the calm top card is hidden). */
  urgent: boolean;
  tiers: StreamTier[];
  /** The reassuring facts shown in the "all clear" summary. */
  cleared: ClearedFact[];
  /** The pulse's own one-line summary (the all-clear subtitle). */
  summary: string;
}

const TIER_ORDER: TierKey[] = ['attention', 'worth', 'around', 'whenever'];

const TIER_LABEL: Record<TierKey, string> = {
  attention: 'Needs attention',
  worth: 'Worth a look',
  around: 'Around you',
  whenever: 'When you have a minute',
};

const isUrgentColor = (color: string): boolean => color === 'red' || color === 'amber';

// Time-sensitive environmental signals rise to the top; community is the
// "around you" life on the block; suggestions/services are opportunities.
function signalTier(signal: PulseSignal): TierKey {
  switch (signal.signal_type) {
    case 'air_quality':
    case 'weather':
      return isUrgentColor(signal.color) ? 'attention' : 'whenever';
    case 'community':
      return 'around';
    case 'seasonal_suggestion':
    case 'local_services':
      return 'worth';
    default:
      return isUrgentColor(signal.color) ? 'attention' : 'worth';
  }
}

function signalTone(signal: PulseSignal): SignalTone {
  switch (signal.color) {
    case 'red':
    case 'amber':
      return 'warning';
    case 'green':
      return 'home';
    case 'blue':
      return 'sky';
    case 'gray':
      return 'muted';
    default:
      if (signal.signal_type === 'community') return 'home';
      if (signal.signal_type === 'seasonal_suggestion' || signal.signal_type === 'local_services') return 'sky';
      return 'muted';
  }
}

const TYPE_ICON: Record<PulseSignal['signal_type'], LucideIcon> = {
  air_quality: Wind,
  weather: CloudSun,
  seasonal_suggestion: Leaf,
  community: Users,
  local_services: Briefcase,
};

function signalIcon(signal: PulseSignal): LucideIcon {
  // An urgent weather signal reads as the NWS advisory triangle.
  if (signal.signal_type === 'weather' && isUrgentColor(signal.color)) return TriangleAlert;
  return TYPE_ICON[signal.signal_type] ?? Sparkles;
}

function primaryAction(signal: PulseSignal): { label: string; route: string } | undefined {
  const action = signal.actions?.find((a) => a.label && a.route);
  return action ? { label: action.label, route: action.route } : undefined;
}

/**
 * Rank the pulse into the legible tiers. Signals are ordered by the
 * server's `priority` (lower = more important) within each tier.
 */
export function rankPulse(pulse: NeighborhoodPulse['pulse']): RankedStream {
  const buckets: Record<TierKey, StreamSignal[]> = {
    attention: [],
    worth: [],
    around: [],
    whenever: [],
  };

  const ordered = [...(pulse.signals ?? [])].sort((a, b) => a.priority - b.priority);
  ordered.forEach((signal, i) => {
    const tier = signalTier(signal);
    buckets[tier].push({
      key: `${signal.signal_type}-${i}`,
      icon: signalIcon(signal),
      tone: signalTone(signal),
      emphasis: tier === 'attention',
      title: signal.title,
      detail: signal.detail,
      action: primaryAction(signal),
    });
  });

  const tiers = TIER_ORDER
    .map((key) => ({ key, label: TIER_LABEL[key], signals: buckets[key] }))
    .filter((tier) => tier.signals.length > 0);

  const urgent = buckets.attention.length > 0;

  // The all-clear facts assert only what the pulse actually reports. With
  // nothing urgent, "No active alerts" is true by construction; air / weather
  // are claimed only when a calm (green) signal is present.
  const cleared: ClearedFact[] = [{ icon: BellOff, label: 'No active alerts' }];
  if (ordered.some((s) => s.signal_type === 'air_quality' && s.color === 'green')) {
    cleared.push({ icon: Wind, label: 'Air quality good' });
  }
  if (ordered.some((s) => s.signal_type === 'weather' && s.color === 'green')) {
    cleared.push({ icon: CloudSun, label: 'Mild, clear weather' });
  }

  return { urgent, tiers, cleared, summary: pulse.summary ?? '' };
}
