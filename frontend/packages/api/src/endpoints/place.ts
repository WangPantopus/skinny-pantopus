// ============================================================
// PLACE — address-led home intelligence (the "Place" / ProfileDashboard)
//
// Thin wrappers over the PlaceIntelligence section-envelope contract
// (@pantopus/types · placeIntelligence.ts), served by:
//   GET /api/homes/:id/intelligence — the living dashboard for a saved
//                                     / claimed / verified place (T1–T4)
//   GET /api/public/place           — the anonymous T0 one-shot preview
//
// Reuses the shared axios client. The richer AI surfaces
// (ai.getPlaceBrief / getNeighborhoodPulse) stay where the dashboard
// wants narrative copy; these wrappers carry the structured contract.
// ============================================================

import { get } from '../client';
import type {
  PlaceIntelligence,
  PlaceDensityBucket,
  PlaceGroup,
  PlaceBand,
  PlaceSection,
  PlaceSectionId,
} from '@pantopus/types';

// ─── Public preview (T0) — the anonymous one-shot demonstration ───
// NOTE: the preview returns the sanitized `free` mini-shape (flood,
// density bucket, area teaser — what native clients decode) PLUS, since
// Wedge v2 (D1), the full free Band-A snapshot as `sections` (the same
// PlaceSection envelopes the dashboard renders) and one `aha` card —
// the most non-obvious fact for this spot. Only Band B (ATTOM, paid)
// remains a *locked descriptor*. Mirrors backend/routes/public.js.

export type PlacePreviewStatus = 'ready' | 'partial' | 'unsupported_region';

export interface PlacePreviewFlood {
  status: 'ready' | 'unavailable';
  zone?: string;
  description?: string | null;
  source: string;
}

export interface PlacePreviewDensity {
  status: 'ready';
  /** k-anon bucket only — never a count (§4.1). */
  bucket: PlaceDensityBucket;
  label: string;
  source: string;
}

export interface PlacePreviewArea {
  status: 'ready' | 'unavailable';
  median_year_built?: number | null;
  median_home_value?: number | null;
  note: string;
  source: string;
}

export type PlacePreviewAhaTone = 'alert' | 'watch' | 'info' | 'calm';

/**
 * The aha card — one headline the visitor did not know about their own
 * address, ranked by surprise server-side (placePreviewService.pickAha).
 * `section_id` is null for the "quiet on every layer" card.
 */
export interface PlacePreviewAha {
  section_id: PlaceSectionId | null;
  tone: PlacePreviewAhaTone;
  /** Short badge, e.g. "High", "AQI 31", "Zone X", "Quiet". */
  grade: string | null;
  headline: string;
  detail: string;
  /** The question the claim answers, e.g. "Claim it to get smoke-day alerts every morning." */
  follow_up: string;
}

/** A gated section descriptor — drives a LockedCard + the soft wall. */
export interface PlacePreviewLockedSection {
  id: string;
  group: PlaceGroup;
  title: string;
  band: PlaceBand;
  /** The tier that opens it: account = T1, claim = T3. */
  unlock: 'account' | 'claim';
  reason: string;
}

export interface PlacePreview {
  status: PlacePreviewStatus;
  tier: 'preview';
  region: 'US' | null;
  /** Present on `unsupported_region`. */
  message?: string;
  /** Sanitized area-level place identity (no exact coords). */
  place?: {
    address: string | null;
    city: string | null;
    state: string | null;
    zipcode: string | null;
  };
  /** The free demonstration subset (present on ready/partial). */
  free?: {
    flood: PlacePreviewFlood;
    density: PlacePreviewDensity;
    area: PlacePreviewArea;
  };
  /** The one most surprising fact for this spot (present on ready/partial). */
  aha?: PlacePreviewAha;
  /** Every free Band-A layer as section envelopes, in dashboard order. */
  sections?: PlaceSection[];
  locked?: PlacePreviewLockedSection[];
  disclaimer?: string;
}

/**
 * The living, updating dashboard for a saved place. The viewer's tier
 * (T1–T4) and per-section access / gating are resolved server-side and
 * carried in each section envelope.
 *
 * Pass `sections` to lazy-load a subset (e.g. a detail page refreshing
 * only its own group): the response then carries just those envelopes,
 * in canonical order. Omitted ⇒ the full launch set.
 *
 * GET /api/homes/:id/intelligence[?sections=a,b,c]
 */
export async function getPlaceIntelligence(
  homeId: string,
  sections?: PlaceSectionId[],
): Promise<PlaceIntelligence> {
  const params = sections && sections.length ? { sections: sections.join(',') } : undefined;
  return get<PlaceIntelligence>(`/api/homes/${homeId}/intelligence`, params);
}

/**
 * The anonymous, address-only preview — no account required. Returns the
 * free Band-A subset live (flood, density bucket, area teaser) with
 * everything recurring or exact as a `locked` descriptor. Non-persistent
 * (no DB writes): close and reopen still hits the wall.
 *
 * GET /api/public/place?address=...
 */
export async function getPublicPlacePreview(address: string): Promise<PlacePreview> {
  return get<PlacePreview>('/api/public/place', { address });
}
