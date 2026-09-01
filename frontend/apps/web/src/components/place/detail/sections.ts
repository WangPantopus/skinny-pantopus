// ============================================================
// Place group-detail — slug ⇄ group mapping + section finders.
//
// Each detail page is one curated GROUP (§8.2). The dashboard taps
// through to `/app/place/<slug>`; the slugs are URL-friendly aliases
// for the contract group ids.
//
// `health_environment` has no detail page of its own (no designed
// screen): its dashboard cards tap through to the Risk & readiness
// page, which renders the group's three sections.
// ============================================================

import type {
  PlaceAddressRef,
  PlaceGroup,
  PlaceIntelligence,
  PlaceSection,
  PlaceSectionId,
} from '@pantopus/types';

export interface PlaceDetailMeta {
  group: PlaceGroup;
  title: string;
}

/** The seven detail-backed groups, keyed by URL slug. */
export const PLACE_DETAIL_BY_SLUG: Record<string, PlaceDetailMeta> = {
  today: { group: 'today', title: 'Today' },
  'your-home': { group: 'your_home', title: 'Your home' },
  risk: { group: 'risk_readiness', title: 'Risk & readiness' },
  block: { group: 'your_block', title: 'Your block' },
  money: { group: 'money_signals', title: 'Money signals' },
  civic: { group: 'civic', title: 'Civic' },
  identity: { group: 'identity', title: 'Identity' },
};

/**
 * Group → slug, for the dashboard's tap-through. `health_environment`
 * folds into the Risk & readiness page (it has no designed screen of
 * its own; the risk detail renders its three sections).
 */
export const GROUP_TO_SLUG: Partial<Record<PlaceGroup, string>> = {
  today: 'today',
  your_home: 'your-home',
  risk_readiness: 'risk',
  health_environment: 'risk',
  your_block: 'block',
  money_signals: 'money',
  civic: 'civic',
  identity: 'identity',
};

/** Find a single section envelope across the grouped contract. */
export function findPlaceSection<Id extends PlaceSectionId>(
  intel: PlaceIntelligence,
  id: Id,
): Extract<PlaceSection, { id: Id }> | undefined {
  for (const g of intel.groups) {
    for (const s of g.sections) {
      if (s.id === id) return s as Extract<PlaceSection, { id: Id }>;
    }
  }
  return undefined;
}

/** Compact header address, e.g. "1421 SE Oak St · Portland". */
export function detailAddress(place: PlaceAddressRef): string {
  const city = place.city?.trim();
  const line1 = place.line1?.trim();
  if (line1 && city) return `${line1} · ${city}`;
  return line1 || place.label;
}
