// ============================================================
// BEFORE-YOU-SIGN SCOUT (Wave 4 backend, Wave 5 web)
//
//   GET /api/scout?address=…&asking_rent=…&year_built=…&bedrooms=…
//   Route: backend/routes/scout.js · Service: backend/services/scoutService.js
//
// The one surface in the product where the person asking is NOT the
// person the data is about: they are considering an address somebody
// else currently lives at. Everything here describes LAND AND BUILDINGS
// from public records. Nothing derived from the current occupants is on
// this wire, and no field may ever be added that is — no owner or
// resident names, no occupancy, no Band B valuation, no Band D real-rent
// band, no density bucket.
//
// The QUESTION LIST is the product. `ask_before_you_sign` is generated
// from facts we actually have, and each entry carries the fact that
// produced it in `because`, so the reader can check it rather than
// trust it. Render `because` in full — a question without its reason is
// a checklist someone found on the internet.
//
// NEVER ADVICE. Every generated line is a question or a fact. The server
// enforces this; a client must not add imperatives around it, and must
// not reintroduce the possessive voice ("your county") that the server
// deliberately strips — this reader does not live there.
// ============================================================

import { get } from '../client';

/**
 * The envelope's three answers, all delivered as HTTP 200.
 *
 * `could_not_place` and `unsupported_region` are DIFFERENT and must not
 * be rendered alike: one means we could not read an address out of what
 * was typed, the other means it resolved somewhere outside US coverage.
 * Collapsing them once told every US user during a geocoder outage that
 * the product was not for them.
 *
 * Only `ready` carries `scout`. Real errors (400/401/429/500) return an
 * `{ error }` body with NO `status` key at all, so branch on which key is
 * present rather than on the HTTP status alone.
 */
export type ScoutStatus = 'ready' | 'could_not_place' | 'unsupported_region';

/** Area-level identity, echoed back. Never more precise than this. */
export interface ScoutPlace {
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
}

export interface ScoutFlood {
  /** FEMA zone code, e.g. "AE", "X", "D", "AREA NOT INCLUDED". */
  zone: string;
  /** Special Flood Hazard Area — where a federally backed mortgage requires cover. */
  in_sfha: boolean;
  /**
   * FEMA'S ANSWER HAS THREE VALUES. Branch on this, never on `in_sfha`
   * alone: `in_sfha: false` covers both "FEMA looked and it is low risk"
   * AND "FEMA has made no determination here" (zone D, unmapped areas,
   * open water). Rendering the boolean as two branches says "outside the
   * high-risk area" about land nobody has assessed — a confident safety
   * claim for exactly the places where no one can make one.
   */
  determination: 'high_risk' | 'low_risk' | 'undetermined';
}

/**
 * What flood insurance actually costs around here, from real NFIP
 * policies in the census tract. A benchmark, never a quote.
 *
 * NULL IS NOT "NO DATA". The benchmark is cache-only and a background job
 * warms it, so the first sighting of a tract returns null and the same
 * address can answer minutes later. It is also null when the tract holds
 * fewer than the k-anonymity floor of policies. Never cache a null as
 * "this address has no flood cost".
 */
export interface ScoutFloodCost {
  premium_p25: number;
  premium_median: number;
  premium_p75: number;
  policy_count: number;
  scope: string;
  /** Server-composed. Render verbatim. */
  note: string;
}

export interface ScoutRadon {
  /** EPA radon zone 1–3, or null where the county is uncovered. */
  radon_zone: number | null;
  lead_paint_risk: string | null;
  /**
   * The CALLER's number, off a listing — not something we looked up. Any
   * copy derived from it must attribute it back to the reader.
   */
  year_built: number | null;
}

export interface ScoutWater {
  utility_name: string | null;
  pws_id: string | null;
  violation_count: number;
  recent_health_violations: boolean;
}

/**
 * The county's HUD fair market rent band, and where the asking rent sits
 * against it.
 *
 * `bedrooms` TRAVELS WITH `position` AND MUST BE RENDERED WITH IT. The
 * verdict is only meaningful against a stated unit size: a studio at
 * $1,400 against a 2-bedroom band of $1,600–$1,920 is `below_band`, which
 * reads as "a good deal" and is not one. `bedrooms_stated` is false when
 * the server defaulted the count rather than the reader choosing it —
 * label that difference rather than presenting our assumption as theirs.
 */
export interface ScoutRent {
  band_low: number;
  band_high: number;
  period: string;
  asking_rent: number | null;
  bedrooms: number;
  bedrooms_stated: boolean;
  position: 'above_band' | 'in_band' | 'below_band' | null;
  scope: string;
}

/**
 * One generated question. `because` is the fact that produced it and is
 * never optional; `source` names where that fact came from and IS
 * optional — omit the element entirely when null rather than rendering
 * an empty label.
 *
 * `id` is stable but the list is open: render whatever arrives rather
 * than switching on the ids this build happens to know, or a question
 * added server-side will silently vanish.
 */
export interface ScoutAsk {
  id: string;
  question: string;
  because: string;
  source: string | null;
}

export interface ScoutReport {
  place: ScoutPlace;
  flood: ScoutFlood | null;
  /** Independent of `flood` — FEMA can be down while the benchmark is warm. */
  flood_cost: ScoutFloodCost | null;
  environment: {
    radon: ScoutRadon | null;
    water: ScoutWater | null;
  };
  rent: ScoutRent | null;
  ask_before_you_sign: ScoutAsk[];
  /** Rendered verbatim, unclamped. It says where the address went. */
  scope_note: string;
}

export interface ScoutResponse {
  status: ScoutStatus;
  /** Present on the two non-ready answers. */
  message?: string;
  /** Present only on `ready`. */
  scout?: ScoutReport;
}

export interface ScoutOptions {
  /** Monthly asking rent, from the listing. */
  askingRent?: number;
  /**
   * Build year, from the listing. Not optional in practice: the radon
   * section resolves only when this is supplied, so without it neither
   * the radon nor the lead-paint question can fire even in an EPA Zone 1
   * county.
   */
  yearBuilt?: number;
  /** 0 (studio) through 4. Omitting it defaults the band to 2-bedroom. */
  bedrooms?: number;
}

/**
 * Fetch a Scout report. Returns the WHOLE envelope, not an unwrapped
 * report, because `status` is a three-value discriminator the caller has
 * to branch on.
 *
 * Requires an account (T1) but no claim on the address — the reader
 * cannot be a verified resident of a place they do not live at.
 */
export async function getScoutReport(
  address: string,
  opts?: ScoutOptions,
): Promise<ScoutResponse> {
  return get<ScoutResponse>('/api/scout', {
    address,
    asking_rent: opts?.askingRent,
    year_built: opts?.yearBuilt,
    bedrooms: opts?.bedrooms,
  });
}
