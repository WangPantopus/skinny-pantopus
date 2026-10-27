// ============================================================
// The three facts the hero shows after someone picks an address.
//
// The first is the preview's own "what stands out" card (ranked by
// surprise on the server); the other two come from the free sections in
// a fixed order. Every fact carries its source and its scale (county,
// area or this address), so a county-wide radon zone never reads as a
// fact about one house. Nothing is invented: a section without data is
// skipped.
// ============================================================

import type { PlacePreview } from '@pantopus/api';
import type { PlaceSection, PlaceSectionId } from '@pantopus/types';
import { PLACE_SECTION_META } from '@pantopus/types';

export type FactScale = 'county' | 'area' | 'address';

export interface HeroFact {
  key: string;
  label: string;
  value: string;
  source: string;
  scale: FactScale;
}

const SCALE_WORD: Record<FactScale, string> = {
  county: 'county-wide',
  area: 'area',
  address: 'this address',
};

export function scaleWord(scale: FactScale): string {
  return SCALE_WORD[scale];
}

const SECTION_SCALE: Partial<Record<PlaceSectionId, FactScale>> = {
  weather: 'area',
  air_quality: 'area',
  alerts: 'area',
  flood: 'address',
  seismic: 'area',
  wildfire: 'area',
  lead_radon: 'county',
  drinking_water: 'area',
  civic_districts: 'address',
  census_context: 'area',
  rent_band: 'county',
};

const SECTION_LABEL: Partial<Record<PlaceSectionId, string>> = {
  weather: 'Weather now',
  air_quality: 'Air right now',
  flood: 'Flood',
  seismic: 'Earthquake',
  wildfire: 'Wildfire',
  lead_radon: 'Radon',
  drinking_water: 'Drinking water',
};

/** The order the second and third facts are drawn from. */
const FACT_ORDER: PlaceSectionId[] = ['air_quality', 'flood', 'lead_radon', 'drinking_water', 'seismic', 'wildfire', 'weather'];

const SHOWN_STATUSES = new Set(['ready', 'partial', 'stale']);

const FLOOD_RISK: Record<string, string> = { minimal: 'Minimal risk', moderate: 'Moderate risk', high: 'High risk' };

function sourceOf(env: PlaceSection): string {
  return env.source || PLACE_SECTION_META[env.id]?.source || 'Public records';
}

function valueOf(env: PlaceSection): string | null {
  if (!env.data || !SHOWN_STATUSES.has(env.status)) return null;
  switch (env.id) {
    case 'air_quality':
      return `${env.data.category_label}, AQI ${env.data.index}`;
    case 'weather':
      return `${Math.round(env.data.current_temp_f)}°, ${env.data.condition_label}`;
    case 'flood': {
      const risk = FLOOD_RISK[env.data.risk_level];
      if (risk && env.data.zone_label) return `${risk} · ${env.data.zone_label}`;
      return risk ?? (env.data.zone_label || null);
    }
    case 'lead_radon': {
      const zone = env.data.radon_zone;
      if (zone == null) return null;
      const band = zone === 1 ? ', the highest band' : zone === 3 ? ', the lowest band' : '';
      return `EPA zone ${zone}${band}`;
    }
    case 'drinking_water':
      return env.data.utility_name
        ? `${env.data.utility_name}${env.data.recent_health_violations ? ', recent health-based violations' : ', no recent health-based violations'}`
        : null;
    case 'seismic':
      return env.data.design_category ? `Design category ${env.data.design_category}` : null;
    case 'wildfire':
      return env.data.hazard_label || null;
    default:
      return null;
  }
}

function scaleOf(env: PlaceSection): FactScale {
  if (env.id === 'drinking_water' && env.data?.match === 'county') return 'county';
  return SECTION_SCALE[env.id] ?? 'area';
}

export function heroFacts(preview: PlacePreview): HeroFact[] {
  const sections = preview.sections ?? [];
  const byId = new Map(sections.map((s) => [s.id, s] as const));
  const facts: HeroFact[] = [];

  const aha = preview.aha;
  const ahaSection = aha?.section_id ? byId.get(aha.section_id) : undefined;
  if (aha?.headline) {
    facts.push({
      key: `aha-${aha.section_id ?? 'quiet'}`,
      label: 'What stands out',
      value: aha.headline,
      source: ahaSection ? sourceOf(ahaSection) : 'Public records',
      scale: ahaSection ? scaleOf(ahaSection) : 'area',
    });
  }

  for (const id of FACT_ORDER) {
    if (facts.length >= 3) break;
    if (id === aha?.section_id) continue;
    const env = byId.get(id);
    if (!env) continue;
    const value = valueOf(env);
    if (!value) continue;
    facts.push({ key: id, label: SECTION_LABEL[id] ?? id, value, source: sourceOf(env), scale: scaleOf(env) });
  }
  return facts;
}
