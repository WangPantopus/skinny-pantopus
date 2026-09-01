// ============================================================
// Place dashboard — contract → presentation.
//
// Maps PlaceIntelligence section envelopes onto the W1.2 archetype
// cards, and derives the Today's Pulse hero from the Today sections.
// Pure + data-driven: a section renders per its own `access`/`status`,
// so the dashboard degrades section-by-section.
// ============================================================

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CloudSun,
  Wind,
  Bell,
  Sunrise,
  Waves,
  Activity,
  Flame,
  House,
  TestTube,
  Droplets,
  Factory,
  Users,
  Zap,
  BadgePercent,
  Building2,
  Landmark,
  Vote,
  ShieldCheck,
  Check,
  Clock,
  TriangleAlert,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  BadgeCheck,
  Mailbox,
} from 'lucide-react';
import type {
  PlaceIntelligence,
  PlaceSection,
  PlaceSectionId,
  PlaceSectionStatus,
  PlaceBand,
  PlaceBlockDensityData,
  PlaceAirQualityData,
  AirQualityCategory,
  PlaceWeatherData,
  PlaceAlertsData,
  PlaceSunriseSunsetData,
  PlaceFloodData,
  FloodRiskLevel,
  PlaceSeismicData,
  PlaceWildfireData,
  PlaceLeadRadonData,
  PlaceDrinkingWaterData,
  PlaceEnvironmentalHazardsData,
  PlaceCensusContextData,
  PlaceBillBenchmarkData,
  PlaceIncentivesData,
  PlaceRentBandData,
  PlaceCivicDistrictsData,
  PlaceCivicElectionData,
  PlaceYourHomeData,
} from '@pantopus/types';
import {
  SectionCard,
  DensityCard,
  LockedCard,
  type PlaceSectionState,
  type PlaceSectionCardChip,
  type StatusDotTone,
} from '@/components/archetypes/place';
import type { HeroVariant } from '@/components/archetypes/place';

// ── formatting helpers ──────────────────────────────────────
function money(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmtTime(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtMonthYear(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// "6:42a" — the compact sun clock used in the Today row.
function fmtSunClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const suffix = h >= 12 ? 'p' : 'a';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m}${suffix}`;
}

const AQI_DOT: Record<AirQualityCategory, StatusDotTone> = {
  good: 'success',
  moderate: 'warning',
  unhealthy_sensitive: 'warning',
  unhealthy: 'error',
  very_unhealthy: 'error',
  hazardous: 'error',
};

const FLOOD_CHIP: Record<FloodRiskLevel, PlaceSectionCardChip> = {
  minimal: { label: 'Minimal risk', variant: 'success' },
  moderate: { label: 'Moderate risk', variant: 'warning' },
  high: { label: 'High risk', variant: 'error' },
};

// ── per-section presentation config ─────────────────────────
interface SectionFormatted {
  value?: ReactNode;
  chip?: PlaceSectionCardChip;
  caption?: ReactNode;
  statusDot?: StatusDotTone;
}

interface SectionConfig {
  icon: LucideIcon;
  title: string;
  inline?: boolean;
  sparkline?: boolean;
  /** Build the reading from a ready/stale envelope's data. */
  format?: (data: unknown, env: PlaceSection) => SectionFormatted;
  /** Optional freshness caption from the envelope. */
  asOf?: (env: PlaceSection) => string | undefined;
}

const SECTION_CONFIG: Record<PlaceSectionId, SectionConfig> = {
  weather: {
    icon: CloudSun,
    title: 'Weather',
    inline: true,
    asOf: (env) => fmtTime(env.as_of),
    format: (data) => {
      const d = data as PlaceWeatherData;
      const label = d.condition_label ? d.condition_label.toLowerCase() : '';
      return { value: `${Math.round(d.current_temp_f)}°${label ? `, ${label}` : ''}` };
    },
  },
  air_quality: {
    icon: Wind,
    title: 'Air quality',
    inline: true,
    format: (data) => {
      const d = data as PlaceAirQualityData;
      return { value: `${d.category_label} (${d.index})`, statusDot: AQI_DOT[d.category] ?? 'neutral' };
    },
  },
  alerts: {
    icon: Bell,
    title: 'Alerts',
    inline: true,
    format: (data) => {
      const d = data as PlaceAlertsData;
      const n = d.active?.length ?? 0;
      return n === 0
        ? { value: 'None', statusDot: 'success' }
        : { value: `${n} active`, statusDot: 'error' };
    },
  },
  sunrise_sunset: {
    icon: Sunrise,
    title: 'Sunrise & sunset',
    inline: true,
    format: (data) => {
      const d = data as PlaceSunriseSunsetData;
      return { value: `${fmtSunClock(d.sunrise)} · ${fmtSunClock(d.sunset)}` };
    },
  },
  your_home: {
    icon: House,
    title: 'Your home',
    sparkline: true,
    asOf: (env) => fmtMonthYear(env.as_of),
    format: (data) => {
      const d = data as PlaceYourHomeData;
      const parts: string[] = [];
      if (d.year_built) parts.push(`Built ${d.year_built}`);
      if (d.sqft) parts.push(`${d.sqft.toLocaleString('en-US')} sqft`);
      const val = money(d.estimated_value);
      if (val) parts.push(`est. value ${val}`);
      return { value: parts.join(' · ') || 'Property details on file' };
    },
  },
  flood: {
    icon: Waves,
    title: 'Flood',
    inline: true,
    format: (data) => {
      const d = data as PlaceFloodData;
      return { chip: FLOOD_CHIP[d.risk_level] ?? { label: d.zone_label, variant: 'neutral' } };
    },
  },
  seismic: {
    icon: Activity,
    title: 'Earthquake',
    inline: true,
    format: (data) => {
      const d = data as PlaceSeismicData;
      const high = d.design_category === 'D' || d.design_category === 'E';
      return { chip: { label: `Design category ${d.design_category}`, variant: high ? 'warning' : 'success' } };
    },
  },
  wildfire: {
    icon: Flame,
    title: 'Wildfire',
    inline: true,
    format: (data) => {
      const d = data as PlaceWildfireData;
      const high = d.hazard_class != null && d.hazard_class >= 4;
      return {
        chip: {
          label: d.hazard_label,
          variant: high ? 'warning' : d.burnable ? 'success' : 'neutral',
        },
      };
    },
  },
  lead_radon: {
    icon: TestTube,
    title: 'Lead & radon',
    format: (data) => {
      const d = data as PlaceLeadRadonData;
      return { value: d.summary, caption: d.disclaimer };
    },
  },
  drinking_water: {
    icon: Droplets,
    title: 'Water',
    format: (data) => ({ value: (data as PlaceDrinkingWaterData).summary }),
  },
  environmental_hazards: {
    icon: Factory,
    title: 'Environment',
    format: (data) => {
      const d = data as PlaceEnvironmentalHazardsData;
      return { value: d.summary, caption: d.disclaimer };
    },
  },
  // block_density is handled specially (DensityCard) in renderSection.
  block_density: { icon: Users, title: 'Verified homes nearby' },
  census_context: {
    icon: House,
    title: 'Homes here',
    asOf: (env) => fmtMonthYear(env.as_of),
    format: (data) => {
      const d = data as PlaceCensusContextData;
      const value = d.summary || (d.median_year_built ? `Median built ${d.median_year_built}` : 'Area facts');
      return { value, caption: 'Census, area-level — not your home' };
    },
  },
  bill_benchmark: {
    icon: Zap,
    title: 'Bill benchmark',
    format: (data) => {
      const d = data as PlaceBillBenchmarkData;
      const pct = Math.abs(d.comparison_pct);
      let chip: PlaceSectionCardChip | undefined;
      if (d.comparison === 'higher') chip = { label: `${pct}% above`, variant: 'warning', icon: TrendingUp };
      else if (d.comparison === 'lower') chip = { label: `${pct}% below`, variant: 'success', icon: TrendingDown };
      return { value: d.summary, chip };
    },
  },
  incentives: {
    icon: BadgePercent,
    title: 'Incentives',
    format: (data) => ({ value: (data as PlaceIncentivesData).summary }),
  },
  rent_band: {
    icon: Building2,
    title: 'Rent band',
    format: (data) => {
      const d = data as PlaceRentBandData;
      const lo = money(d.band_low);
      const hi = money(d.band_high);
      return { value: `${d.bedrooms}BR market band ${lo}–${hi}` };
    },
  },
  civic_districts: {
    icon: Landmark,
    title: 'Your districts',
    format: (data) => {
      const d = data as PlaceCivicDistrictsData;
      const n = d.districts?.length ?? 0;
      return { value: n ? `${n} voting districts on record` : 'Your federal, state, and city districts' };
    },
  },
  civic_election: {
    icon: Vote,
    title: 'Next election',
    inline: true,
    format: (data) => {
      const d = data as PlaceCivicElectionData;
      return { chip: { label: `In ${d.days_until} days`, variant: 'info' } };
    },
  },
};

// ── envelope status → SectionCard state ─────────────────────
function statusToState(status: PlaceSectionStatus): PlaceSectionState {
  if (status === 'ready' || status === 'partial') return 'loaded';
  if (status === 'stale') return 'stale';
  if (status === 'error') return 'error';
  return 'unavailable';
}

// ── lock reason / CTA, by band (rare on the authed dashboard) ─
function lockCta(band: PlaceBand): string {
  if (band === 'D') return 'Verify address';
  if (band === 'B' || band === 'C') return 'Claim home';
  return 'Create account';
}
function lockReason(env: PlaceSection): string {
  if (env.unavailable_reason) return env.unavailable_reason;
  if (env.band === 'D') return 'Verify your address to see this.';
  return 'Claim your place to see this.';
}

// ── navigation handlers, threaded into the locked cards ──────
// Band D → verify (T3 → T4); Band B/C → claim (T1 → T3). Driven off
// the contract's per-section band so a locked card never dead-ends.
export interface PlaceSectionHandlers {
  onVerify?: () => void;
  onClaim?: () => void;
}
function lockHandler(env: PlaceSection, handlers?: PlaceSectionHandlers): (() => void) | undefined {
  return env.band === 'D' ? handlers?.onVerify : handlers?.onClaim;
}

// ── render one section envelope as the right card ───────────
// `onOpen` taps through to the section's group-detail page (W2.3) — it's
// omitted for groups without a detail screen, so those cards render no
// chevron (no dead control). `onVerify` / `onClaim` route the locked
// cards (Band D / Band B-C), so a locked card never dead-ends.
export interface PlaceSectionRenderOptions extends PlaceSectionHandlers {
  /** Tap-through to the section's group-detail page (W2.3). */
  onOpen?: () => void;
}

export function renderSection(env: PlaceSection, opts?: PlaceSectionRenderOptions): ReactNode {
  const cfg = SECTION_CONFIG[env.id];
  const onOpen = opts?.onOpen;
  const handlers = opts;

  if (env.id === 'block_density') {
    if (env.access === 'locked') {
      return (
        <LockedCard
          icon={cfg.icon}
          title="Verified homes nearby"
          reason={lockReason(env)}
          cta={lockCta(env.band)}
          onCta={lockHandler(env, handlers)}
        />
      );
    }
    const hasData = env.data && (env.status === 'ready' || env.status === 'partial' || env.status === 'stale');
    if (hasData) {
      return <DensityCard bucket={(env.data as PlaceBlockDensityData).bucket} showCta={false} onClick={onOpen} />;
    }
    return (
      <SectionCard
        icon={Users}
        title="Verified homes nearby"
        state={statusToState(env.status)}
        caption={env.unavailable_reason ?? undefined}
        onClick={onOpen}
      />
    );
  }

  if (env.access === 'locked') {
    return (
      <LockedCard
        icon={cfg.icon}
        title={cfg.title}
        reason={lockReason(env)}
        cta={lockCta(env.band)}
        onCta={lockHandler(env, handlers)}
      />
    );
  }

  const state = statusToState(env.status);
  const reading = (state === 'loaded' || state === 'stale') && env.data ? cfg.format?.(env.data, env) ?? {} : {};

  return (
    <SectionCard
      icon={cfg.icon}
      title={cfg.title}
      state={state}
      inline={cfg.inline}
      sparkline={cfg.sparkline && (state === 'loaded' || state === 'stale')}
      asOf={state === 'loaded' || state === 'stale' ? cfg.asOf?.(env) : undefined}
      value={reading.value}
      chip={reading.chip}
      statusDot={reading.statusDot}
      caption={state === 'unavailable' ? env.unavailable_reason ?? undefined : reading.caption}
      onClick={onOpen}
    />
  );
}

// ── Today's Pulse derivation (hero) ─────────────────────────
export interface DerivedPulse {
  variant: HeroVariant;
  title: string;
  chip: { label: string; icon?: LucideIcon };
  mainIcon: LucideIcon;
  nudge?: { icon?: LucideIcon; text: string };
}

function findSection(intel: PlaceIntelligence, id: PlaceSectionId): PlaceSection | undefined {
  for (const g of intel.groups) {
    for (const s of g.sections) if (s.id === id) return s;
  }
  return undefined;
}

const BAD_AQI = new Set<AirQualityCategory>([
  'unhealthy_sensitive',
  'unhealthy',
  'very_unhealthy',
  'hazardous',
]);

export function derivePulse(intel: PlaceIntelligence): DerivedPulse {
  const aqi = findSection(intel, 'air_quality');
  const alerts = findSection(intel, 'alerts');
  const bill = findSection(intel, 'bill_benchmark');

  // 1) An active weather alert outranks everything.
  const active =
    alerts && alerts.status === 'ready' && alerts.data ? (alerts.data as PlaceAlertsData).active : [];
  if (active && active.length > 0) {
    const a = active[0];
    return {
      variant: 'alert',
      mainIcon: TriangleAlert,
      chip: { label: a.event || 'Active alert', icon: TriangleAlert },
      title: a.headline || a.event,
      nudge: a.description ? { icon: Clock, text: a.description } : undefined,
    };
  }

  // 2) Then unhealthy air.
  const aqiData = aqi && aqi.status === 'ready' ? (aqi.data as PlaceAirQualityData | null) : null;
  if (aqiData && BAD_AQI.has(aqiData.category)) {
    return {
      variant: 'alert',
      mainIcon: Wind,
      chip: { label: 'Air quality', icon: Wind },
      title: `Air quality is ${aqiData.category_label.toLowerCase()} right now (${aqiData.index}).`,
      nudge: aqiData.health_message ? { icon: Clock, text: aqiData.health_message } : undefined,
    };
  }

  // 3) All clear — assert only what we actually know.
  const airGood = aqiData != null && (aqiData.category === 'good' || aqiData.category === 'moderate');
  const alertsKnownClear =
    alerts != null && alerts.status === 'ready' &&
    (!alerts.data || (alerts.data as PlaceAlertsData).active.length === 0);

  const clauses: string[] = [];
  if (airGood) clauses.push('air is good');
  if (alertsKnownClear) clauses.push('there are no active alerts');
  const tail = clauses.length
    ? ` ${clauses.join(' and ').replace(/^./, (c) => c.toUpperCase())}.`
    : '';
  const title = `All clear on your block today.${tail}`;

  const billData = bill && bill.status === 'ready' ? (bill.data as PlaceBillBenchmarkData | null) : null;
  const nudge =
    billData && billData.comparison === 'higher'
      ? { icon: TrendingUp, text: `${billData.summary}. Worth a look.` }
      : undefined;

  return {
    variant: 'allclear',
    mainIcon: ShieldCheck,
    chip: { label: 'All clear', icon: Check },
    title,
    nudge,
  };
}

// ════════════════════════════════════════════════════════════
// Band-D "Locked until you verify" group (§9 — the T3 → T4 step)
//
// These trust / identity tools are NOT part of the launch-set contract;
// at T3 (claimed, unverified) they render as locked cards that route to
// address verification, per the claimed-dashboard design. At T4 they
// unlock as their own pillars (Inbox / Identity), so this group shows
// only while the resident is claimed-but-unverified.
// ════════════════════════════════════════════════════════════
export interface VerifyLockedItem {
  icon: LucideIcon;
  title: string;
  reason: string;
}

export const VERIFY_LOCKED_SECTIONS: VerifyLockedItem[] = [
  { icon: MessageCircle, title: 'Neighbor messaging', reason: 'Verify your address to message neighbors.' },
  { icon: BadgeCheck, title: 'Verified badge', reason: 'Verify your address to get your verified badge.' },
  {
    icon: Mailbox,
    title: 'Your mailbox',
    reason: 'Verify your address for your mailbox — packages, civic notices, and permits.',
  },
];

export function renderVerifyLocked(onVerify: () => void): ReactNode {
  return VERIFY_LOCKED_SECTIONS.map((item) => (
    <LockedCard
      key={item.title}
      icon={item.icon}
      title={item.title}
      reason={item.reason}
      cta="Verify address"
      onCta={onVerify}
    />
  ));
}
