// ============================================================
// PLACE INTELLIGENCE — the section-envelope contract
//
// Address-led home intelligence (the "Place" / ProfileDashboard).
// This file is the source of truth for the web + mobile clients and
// is mirrored, in CommonJS, by the backend serializer at
// backend/serializers/placeIntelligenceSerializer.js.
//
// See docs/design/place and the product design doc:
//   §3   the Trust Ladder (T0–T4)
//   §8.2 curated groups COMPOSE contract sections (not 1:1)
//   §8.3 the v1 LAUNCH SET (the 12 data-backed layers)
//   §9   sensitivity bands (A|B|C|D) + the tier × band gating matrix
//
// W0.1 defines the envelope, the eight-group set, and the per-section
// data shapes for the LAUNCH SET only. Band B/C/D sections (Your Home
// valuation, equity, identity tools, permits, property tax) are
// represented through the same envelope as `unavailable` / `locked`
// until later waves add their data shapes.
// ============================================================

// ─── Trust ladder — the user model (§3) ──────────────────────
export type PlaceTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

// ─── Sensitivity bands — the gating axis (§9.1) ──────────────
//   A — public place      (free/cheap; T0 preview → up)
//   B — public property    (ATTOM-paid record; T3 claimed)
//   C — your private inputs (owner/household only; T3)
//   D — trust/identity tools (asserts identity; T4 verified)
export type PlaceBand = 'A' | 'B' | 'C' | 'D';

// ─── Per-section access for the viewer's tier (§9.2) ─────────
// Derived from band × tier. Drives the locked-card UI vs a live card.
//   available — viewer sees live data (subject to `status`)
//   preview   — T0 one-shot, non-persistent snapshot (anti-leak rule, §4)
//   locked    — gated for this tier; render a locked card + a CTA
export type PlaceSectionAccess = 'available' | 'preview' | 'locked';

// ─── Data freshness / availability for an accessible section ─
//   ready        — live data present
//   partial      — some data; ragged/partial coverage
//   unavailable  — not available for this area yet (coverage gap)
//   stale        — last-known data, past its freshness window
//   error        — fetch failed; the client may retry
export type PlaceSectionStatus =
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'stale'
  | 'error';

// ─── Source coverage for the address (§8.3: water ~80%) ──────
export type PlaceCoverage = 'full' | 'partial' | 'none';

// ─── The eight curated groups — presentation (§8.2) ──────────
export type PlaceGroup =
  | 'today'
  | 'your_home'
  | 'risk_readiness'
  | 'health_environment'
  | 'your_block'
  | 'money_signals'
  | 'civic'
  | 'identity';

export const PLACE_GROUPS = [
  'today',
  'your_home',
  'risk_readiness',
  'health_environment',
  'your_block',
  'money_signals',
  'civic',
  'identity',
] as const satisfies readonly PlaceGroup[];

export const PLACE_GROUP_LABELS: Record<PlaceGroup, string> = {
  today: 'Today',
  your_home: 'Your home',
  risk_readiness: 'Risk & readiness',
  health_environment: 'Health & environment',
  your_block: 'Your block',
  money_signals: 'Money signals',
  civic: 'Civic',
  identity: 'Identity',
};

// ════════════════════════════════════════════════════════════
// LAUNCH-SET SECTION DATA SHAPES — Band A (§8.3)
// All snake_case to match the backend serializer + existing
// Hub/Pulse contracts (HubTodayWeather, NeighborhoodPulse, …).
// ════════════════════════════════════════════════════════════

// ── Today ────────────────────────────────────────────────────

export type WeatherConditionCode =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'sleet'
  | 'thunderstorm'
  | 'wind';

export interface PlaceWeatherHour {
  /** ISO 8601 timestamp for the hour. */
  time: string;
  temp_f: number;
  condition_code: WeatherConditionCode;
  /** 0–100. */
  precip_chance: number;
}

export interface PlaceWeatherDay {
  /** ISO 8601 date. */
  date: string;
  condition_code: WeatherConditionCode;
  high_f: number;
  low_f: number;
  /** 0–100. */
  precip_chance: number;
}

/** Launch layer #1 — Weather (NOAA / NWS). */
export interface PlaceWeatherData {
  current_temp_f: number;
  condition_code: WeatherConditionCode;
  /** Human label, e.g. "Clear". */
  condition_label: string;
  feels_like_f: number | null;
  high_f: number | null;
  low_f: number | null;
  /** Hourly strip; may be empty on the dashboard summary. */
  hourly: PlaceWeatherHour[];
  /** 5-day forecast; may be empty on the dashboard summary. */
  daily: PlaceWeatherDay[];
}

export type AirQualityCategory =
  | 'good'
  | 'moderate'
  | 'unhealthy_sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

/** Launch layer #2 — Air quality (AirNow / EPA). */
export interface PlaceAirQualityData {
  /** US Air Quality Index, e.g. 38. */
  index: number;
  category: AirQualityCategory;
  /** Human label, e.g. "Good". */
  category_label: string;
  /** e.g. "pm25" | "ozone"; null when unknown. */
  dominant_pollutant: string | null;
  /** Plain "what it means" copy. */
  health_message: string;
}

export type WeatherAlertSeverity = 'advisory' | 'watch' | 'warning';

export interface PlaceWeatherAlert {
  id: string;
  /** e.g. "Wind Advisory". */
  event: string;
  severity: WeatherAlertSeverity;
  /** Short timing line, e.g. "In effect until 6:00 PM today". */
  headline: string;
  /** Body copy / instruction. */
  description: string;
  /** ISO 8601. */
  onset: string | null;
  /** ISO 8601. */
  ends: string | null;
}

/**
 * NWS active alerts — rides the NOAA feed alongside layer #1.
 * An empty `active` list renders as "No active alerts".
 */
export interface PlaceAlertsData {
  active: PlaceWeatherAlert[];
}

/** Sunrise / sunset — rides the NOAA / Open-Meteo feed alongside layer #1. */
export interface PlaceSunriseSunsetData {
  /** ISO 8601. */
  sunrise: string;
  /** ISO 8601. */
  sunset: string;
  daylight_minutes: number;
}

// ── Risk & readiness ─────────────────────────────────────────

export type FloodRiskLevel = 'minimal' | 'moderate' | 'high';

/** Launch layer #3 — Flood (FEMA National Flood Hazard Layer). */
export interface PlaceFloodData {
  /** FEMA zone code, e.g. "X". */
  zone: string;
  /** Human label, e.g. "Zone X". */
  zone_label: string;
  risk_level: FloodRiskLevel;
  /** Special Flood Hazard Area. */
  in_sfha: boolean;
  /** Federally-required flood insurance. */
  insurance_required: boolean;
  /** Plain "what this means" copy. */
  plain_meaning: string;
}

/** ASCE 7 seismic design categories (A lowest demand → E highest). */
export type SeismicDesignCategory = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * Phase-4 layer — Earthquake (USGS seismic design values, ASCE 7-22).
 * Engineering demand at this point, not a prediction. Informational.
 */
export interface PlaceSeismicData {
  design_category: SeismicDesignCategory;
  /** Design spectral acceleration, short period (g). */
  sds: number | null;
  summary: string;
  disclaimer: string;
}

/** USFS Wildfire Hazard Potential classes (1 very low → 5 very high). */
export type WildfireHazardClass = 1 | 2 | 3 | 4 | 5;

/**
 * Phase-4 layer — Wildfire (USFS Wildfire Hazard Potential, 2023).
 * `hazard_class` is null for non-burnable / water pixels (developed
 * cores, agriculture) — `burnable: false` carries that meaning.
 */
export interface PlaceWildfireData {
  hazard_class: WildfireHazardClass | null;
  hazard_label: string;
  burnable: boolean;
  summary: string;
  disclaimer: string;
}

// ── Health & environment ─────────────────────────────────────

export type LeadPaintRisk = 'unlikely' | 'possible' | 'likely';

/**
 * Launch layer #6 — Lead / radon screening.
 * `year_built` is a Band B (ATTOM) / T3 user-entered input; the
 * screening reads off it. "Screening, not a diagnosis."
 */
export interface PlaceLeadRadonData {
  year_built: number | null;
  lead_paint_risk: LeadPaintRisk;
  /** EPA radon zone (1 = highest potential). */
  radon_zone: 1 | 2 | 3 | null;
  summary: string;
  disclaimer: string;
}

/** Launch layer #7 — Drinking-water system (EPA SDWIS; coverage ~80%). */
export interface PlaceDrinkingWaterData {
  /** e.g. "Portland Water Bureau". */
  utility_name: string;
  /** Public Water System id. */
  pws_id: string | null;
  recent_health_violations: boolean;
  violation_count: number;
  summary: string;
}

export interface PlaceEpaFacility {
  name: string;
  /** Regulating program, e.g. "Clean Water Act". */
  program: string;
  distance_mi: number;
}

/**
 * Launch layer #5 — EPA environmental context (ECHO).
 * "Regulated activity nearby, not unsafe exposure." No toxic score.
 */
export interface PlaceEnvironmentalHazardsData {
  facilities_within_mile: number;
  radius_mi: number;
  /** Facility list; may be empty on the dashboard summary. */
  facilities: PlaceEpaFacility[];
  summary: string;
  disclaimer: string;
}

// ── Your block ───────────────────────────────────────────────

// k-anonymity bucket ONLY — never a count. Floored server-side (§4.1).
export type PlaceDensityBucket = 'none' | 'forming' | 'few' | 'growing';

export const PLACE_DENSITY_LABELS: Record<PlaceDensityBucket, string> = {
  none: 'No activity shown yet',
  forming: 'Your block is starting to form',
  few: 'A few verified homes nearby',
  growing: 'Growing activity near this area',
};

/**
 * Launch layer #11 — Block density.
 * Bucket + label only; intentionally carries NO neighbor count
 * (the public preview floors this server-side, §4.1).
 */
export interface PlaceBlockDensityData {
  bucket: PlaceDensityBucket;
  /** Server-rendered bucket label (see PLACE_DENSITY_LABELS). */
  label: string;
}

/** Launch layer #4 — Census tract context (ACS; area-level, not your home). */
export interface PlaceCensusContextData {
  median_year_built: number | null;
  median_home_value: number | null;
  tract_name: string | null;
  summary: string;
}

// ── Money signals ────────────────────────────────────────────

export type BillUtilityKind = 'electric' | 'gas' | 'water';
export type BenchmarkComparison = 'lower' | 'typical' | 'higher';

/** Launch layer #12 — Bill benchmark (peer-relative; informational). */
export interface PlaceBillBenchmarkData {
  utility: BillUtilityKind;
  /** Resident's own amount (Band C); null until they provide it. */
  your_amount: number | null;
  /** Typical-for-area band. */
  band_low: number;
  band_high: number;
  comparison: BenchmarkComparison;
  /** Signed percent vs neighbors: +12 = 12% above, -10 = 10% below. */
  comparison_pct: number;
  /** e.g. "12-month average". */
  period: string;
  summary: string;
}

export type IncentiveLevel = 'federal' | 'state' | 'utility' | 'local';
export type IncentiveType = 'tax_credit' | 'rebate' | 'discount' | 'loan';

export interface PlaceIncentive {
  id: string;
  name: string;
  level: IncentiveLevel;
  incentive_type: IncentiveType;
  summary: string;
}

/** Launch layer #10 — Incentives (DSIRE; "you may be eligible — verify"). */
export interface PlaceIncentivesData {
  programs: PlaceIncentive[];
  summary: string;
}

/** Launch layer #9 — Rent band (HUD Fair Market Rents; informational). */
export interface PlaceRentBandData {
  bedrooms: number;
  /** Market band low/high. */
  band_low: number;
  band_high: number;
  /** Full track min/max for the comparison bar. */
  market_low: number;
  market_high: number;
  /** e.g. "FY 2026". */
  period: string;
  summary: string;
}

// ── Civic ────────────────────────────────────────────────────

export type CivicLevel = 'federal' | 'state' | 'county' | 'city' | 'school';

export interface PlaceCivicDistrict {
  level: CivicLevel;
  /** e.g. "U.S. House". */
  office_label: string;
  /** e.g. "Oregon's 3rd District". */
  name: string;
}

export interface PlaceCivicRepresentative {
  name: string;
  office: string;
  level: CivicLevel;
  party: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

/**
 * Launch layer #8 (evergreen half) — Civic districts.
 * Districts are always present; representatives arrive via a companion
 * source and may be empty until that source ships (§11.4).
 */
export interface PlaceCivicDistrictsData {
  districts: PlaceCivicDistrict[];
  representatives: PlaceCivicRepresentative[];
}

export interface PlaceBallotRace {
  type: 'office' | 'measure';
  title: string;
  /** Offices: candidate names (order randomized, as on the ballot). */
  candidates: string[];
  /** Measures: plain-language summary. */
  summary: string | null;
}

export interface PlacePollingPlace {
  /** e.g. "Vote by mail · Oregon". */
  name: string;
  detail: string;
  vote_by_mail: boolean;
}

/**
 * Launch layer #8 (seasonal half) — Civic election.
 * Off-season this section is `unavailable` while districts stay ready.
 */
export interface PlaceCivicElectionData {
  name: string;
  /** ISO 8601. */
  date: string;
  days_until: number;
  polling_place: PlacePollingPlace | null;
  /** Ballot races; may be empty (summary only) on the dashboard. */
  ballot: PlaceBallotRace[];
}

// ════════════════════════════════════════════════════════════
// BAND-B SECTION DATA SHAPE (added in W0.2)
// Exact property facts + valuation (ATTOM-paid record). Gated to
// T3+ (claimed) and only populated when ATTOM_API_KEY is configured;
// otherwise the section renders `unavailable` (area teaser at T0).
// ════════════════════════════════════════════════════════════

/** Your Home — property facts + value estimate + assessment (Band B). */
export interface PlaceYourHomeData {
  year_built: number | null;
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  lot_sqft: number | null;
  home_type: string | null;
  estimated_value: number | null;
  value_low: number | null;
  value_high: number | null;
  assessed_value: number | null;
}

// ════════════════════════════════════════════════════════════
// SECTION ENVELOPE + RESPONSE
// ════════════════════════════════════════════════════════════

/** Maps each launch-set section id to its `data` payload shape. */
export interface PlaceSectionDataMap {
  weather: PlaceWeatherData;
  air_quality: PlaceAirQualityData;
  alerts: PlaceAlertsData;
  sunrise_sunset: PlaceSunriseSunsetData;
  flood: PlaceFloodData;
  seismic: PlaceSeismicData;
  wildfire: PlaceWildfireData;
  lead_radon: PlaceLeadRadonData;
  drinking_water: PlaceDrinkingWaterData;
  environmental_hazards: PlaceEnvironmentalHazardsData;
  block_density: PlaceBlockDensityData;
  census_context: PlaceCensusContextData;
  bill_benchmark: PlaceBillBenchmarkData;
  incentives: PlaceIncentivesData;
  rent_band: PlaceRentBandData;
  civic_districts: PlaceCivicDistrictsData;
  civic_election: PlaceCivicElectionData;
  // Band B (W0.2) — exact property facts + valuation.
  your_home: PlaceYourHomeData;
}

export type PlaceSectionId = keyof PlaceSectionDataMap;

export const PLACE_SECTION_IDS = [
  'weather',
  'air_quality',
  'alerts',
  'sunrise_sunset',
  'your_home',
  'flood',
  'seismic',
  'wildfire',
  'lead_radon',
  'drinking_water',
  'environmental_hazards',
  'block_density',
  'census_context',
  'bill_benchmark',
  'incentives',
  'rent_band',
  'civic_districts',
  'civic_election',
] as const satisfies readonly PlaceSectionId[];

/** Static metadata for each launch-set section. */
export interface PlaceSectionMeta {
  group: PlaceGroup;
  band: PlaceBand;
  /** Default human-readable provider label. */
  source: string;
  /** §8.3 launch-set layer number; null for NOAA-bundled rows. */
  layer: number | null;
}

export const PLACE_SECTION_META: Record<PlaceSectionId, PlaceSectionMeta> = {
  weather: { group: 'today', band: 'A', source: 'National Weather Service', layer: 1 },
  air_quality: { group: 'today', band: 'A', source: 'AirNow · EPA', layer: 2 },
  alerts: { group: 'today', band: 'A', source: 'National Weather Service', layer: null },
  sunrise_sunset: { group: 'today', band: 'A', source: 'Open-Meteo', layer: null },
  your_home: { group: 'your_home', band: 'B', source: 'County records · ATTOM', layer: null },
  flood: { group: 'risk_readiness', band: 'A', source: 'FEMA National Flood Hazard Layer', layer: 3 },
  seismic: { group: 'risk_readiness', band: 'A', source: 'USGS seismic design values (ASCE 7-22)', layer: null },
  wildfire: { group: 'risk_readiness', band: 'A', source: 'USFS Wildfire Hazard Potential', layer: null },
  lead_radon: { group: 'health_environment', band: 'A', source: 'EPA radon zones · HUD lead-paint rules', layer: 6 },
  drinking_water: { group: 'health_environment', band: 'A', source: 'EPA SDWIS', layer: 7 },
  environmental_hazards: { group: 'health_environment', band: 'A', source: 'EPA ECHO', layer: 5 },
  block_density: { group: 'your_block', band: 'A', source: 'Pantopus', layer: 11 },
  census_context: { group: 'your_block', band: 'A', source: 'U.S. Census · American Community Survey', layer: 4 },
  bill_benchmark: { group: 'money_signals', band: 'A', source: 'Pantopus · peer comparison', layer: 12 },
  incentives: { group: 'money_signals', band: 'A', source: 'DSIRE', layer: 10 },
  rent_band: { group: 'money_signals', band: 'A', source: 'HUD Fair Market Rents', layer: 9 },
  civic_districts: { group: 'civic', band: 'A', source: 'Google Civic Information', layer: 8 },
  civic_election: { group: 'civic', band: 'A', source: 'Official county elections', layer: 8 },
};

/**
 * The section envelope — the contract atom. One per section.
 *
 * `data` is non-null only when `access` allows it AND `status` is one
 * of ready/partial/stale; it is null for unavailable/error and for
 * locked sections (a tier gate).
 */
export interface PlaceSectionEnvelope<Id extends PlaceSectionId = PlaceSectionId> {
  id: Id;
  group: PlaceGroup;
  band: PlaceBand;
  access: PlaceSectionAccess;
  status: PlaceSectionStatus;
  /** ISO 8601 timestamp of the underlying data. */
  as_of: string | null;
  /** Provider label (see PLACE_SECTION_META). */
  source: string | null;
  coverage: PlaceCoverage;
  /** Why there is no data — a coverage gap or a lock reason. */
  unavailable_reason: string | null;
  data: PlaceSectionDataMap[Id] | null;
}

/** Discriminated union over all launch-set section envelopes. */
export type PlaceSection = {
  [Id in PlaceSectionId]: PlaceSectionEnvelope<Id>;
}[PlaceSectionId];

export interface PlaceAddressRef {
  /** Display label, e.g. "1421 SE Oak St, Portland". */
  label: string;
  line1: string;
  city: string;
  state: string;
  postal_code: string | null;
}

export interface PlaceGroupBlock {
  group: PlaceGroup;
  label: string;
  sections: PlaceSection[];
}

/**
 * GET /place/intelligence (and /place/preview at T0) — grouped
 * section envelopes for an address. `region_supported: false` drives
 * the "coming to your region" state for non-US addresses.
 */
export interface PlaceIntelligence {
  place: PlaceAddressRef;
  tier: PlaceTier;
  region_supported: boolean;
  /** ISO 8601. */
  generated_at: string;
  groups: PlaceGroupBlock[];
}
