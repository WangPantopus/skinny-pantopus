// ============================================================
// PLACE INTELLIGENCE SERIALIZER
//
// Shapes raw, already-fetched section inputs into the
// `PlaceIntelligence` section-envelope contract, then assembles the
// grouped response. Pure transform — it does NOT fetch data (later
// waves wire propertyIntelligenceService / neighborhoodProfile /
// airNow / FEMA / EPA / Civic into the inputs).
//
// The canonical contract lives in TypeScript at
//   frontend/packages/types/src/placeIntelligence.ts
// The meta constants below MUST stay in sync with it (a unit test
// asserts the envelope shape). Backend is plain CommonJS and cannot
// import the TS package, so the meta is mirrored here.
//
// See docs/design/place + the product design doc §8.2 (groups),
// §8.3 (the 12 launch layers), §9 (bands + the tier × band gates).
// ============================================================

// ─── The eight curated groups, in presentation order (§8.2) ──
const PLACE_GROUPS = [
  'today',
  'your_home',
  'risk_readiness',
  'health_environment',
  'your_block',
  'money_signals',
  'civic',
  'identity',
];

const PLACE_GROUP_LABELS = {
  today: 'Today',
  your_home: 'Your home',
  risk_readiness: 'Risk & readiness',
  health_environment: 'Health & environment',
  your_block: 'Your block',
  money_signals: 'Money signals',
  civic: 'Civic',
  identity: 'Identity',
};

// ─── Launch-set section metadata (Band A, §8.3) ──────────────
// group · band · default provider label · launch-set layer number.
const PLACE_SECTION_META = {
  weather: { group: 'today', band: 'A', source: 'National Weather Service', layer: 1 },
  air_quality: { group: 'today', band: 'A', source: 'AirNow · EPA', layer: 2 },
  alerts: { group: 'today', band: 'A', source: 'National Weather Service', layer: null },
  sunrise_sunset: { group: 'today', band: 'A', source: 'Open-Meteo', layer: null },
  // Band B (W0.2) — exact property facts + valuation (ATTOM).
  your_home: { group: 'your_home', band: 'B', source: 'County records · ATTOM', layer: null },
  flood: { group: 'risk_readiness', band: 'A', source: 'FEMA National Flood Hazard Layer', layer: 3 },
  // Phase 4 — the deferred half of risk & readiness.
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

const PLACE_SECTION_IDS = Object.keys(PLACE_SECTION_META);

// ─── Enumerations (kept in sync with the TS unions) ──────────
const ACCESS_VALUES = ['available', 'preview', 'locked'];
const STATUS_VALUES = ['ready', 'partial', 'unavailable', 'stale', 'error'];
const COVERAGE_VALUES = ['full', 'partial', 'none'];

// A section carries data only in these statuses; error/unavailable null it.
const DATA_BEARING_STATUSES = new Set(['ready', 'partial', 'stale']);

function assertOneOf(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(
      `placeIntelligenceSerializer: invalid ${label} "${value}" (expected one of ${allowed.join(', ')})`,
    );
  }
}

// ─── Address ref ─────────────────────────────────────────────
// Accepts a few common raw shapes (`line1`/`address`, `zipcode`/`zip`).
function serializePlaceAddressRef(place) {
  const src = place || {};
  const line1 = src.line1 || src.address || src.address_line1 || '';
  const city = src.city || '';
  const state = src.state || '';
  const postalCode = src.postal_code || src.zipcode || src.zip || null;
  const label = src.label || [line1, city].filter(Boolean).join(', ') || '';
  return { label, line1, city, state, postal_code: postalCode };
}

// ─── One section envelope ────────────────────────────────────
/**
 * @param {string} id  A launch-set section id (key of PLACE_SECTION_META).
 * @param {object} [options]
 * @param {*}       [options.data]               Section payload, or null.
 * @param {string}  [options.status]             ready|partial|unavailable|stale|error.
 *                                               Defaults: ready when data is present
 *                                               and accessible, else unavailable.
 * @param {string}  [options.access='available'] available|preview|locked.
 * @param {string}  [options.asOf=null]          ISO 8601 timestamp of the data.
 * @param {string}  [options.source]             Provider label; defaults to meta.
 * @param {string}  [options.coverage='full']    full|partial|none.
 * @param {string}  [options.unavailableReason=null]  Coverage gap or lock reason.
 * @param {string}  [options.band]               Override meta band (rare).
 * @param {string}  [options.group]              Override meta group (rare).
 * @returns {object} The PlaceSectionEnvelope.
 */
function serializePlaceSection(id, options = {}) {
  const meta = PLACE_SECTION_META[id];
  if (!meta) {
    throw new Error(
      `placeIntelligenceSerializer: unknown section id "${id}" (expected one of ${PLACE_SECTION_IDS.join(', ')})`,
    );
  }

  const {
    data = null,
    status,
    access = 'available',
    asOf = null,
    source,
    coverage = 'full',
    unavailableReason = null,
    band,
    group,
  } = options;

  assertOneOf(access, ACCESS_VALUES, 'access');
  assertOneOf(coverage, COVERAGE_VALUES, 'coverage');
  if (status !== undefined) assertOneOf(status, STATUS_VALUES, 'status');
  if (band !== undefined) assertOneOf(band, ['A', 'B', 'C', 'D'], 'band');

  // Locked / preview-without-data sections never expose payloads.
  const accessible = access === 'available' || access === 'preview';
  const hasData = accessible && data != null;

  const resolvedStatus = status || (hasData ? 'ready' : 'unavailable');
  const includeData = hasData && DATA_BEARING_STATUSES.has(resolvedStatus);

  return {
    id,
    group: group || meta.group,
    band: band || meta.band,
    access,
    status: resolvedStatus,
    as_of: asOf,
    source: source !== undefined ? source : meta.source,
    coverage,
    unavailable_reason: unavailableReason,
    data: includeData ? data : null,
  };
}

// ─── The full grouped response ───────────────────────────────
/**
 * @param {object} options
 * @param {object} options.place                 Raw address (see serializePlaceAddressRef).
 * @param {string} [options.tier='T1']           T0–T4.
 * @param {boolean} [options.regionSupported=true]  false ⇒ "coming to your region".
 * @param {string} [options.generatedAt]         ISO 8601; defaults to now.
 * @param {object[]} [options.sections=[]]        Envelopes from serializePlaceSection,
 *                                                OR raw `{ id, ...sectionOptions }` to
 *                                                serialize inline.
 * @returns {object} The PlaceIntelligence response.
 */
function serializePlaceIntelligence(options = {}) {
  const {
    place,
    tier = 'T1',
    regionSupported = true,
    generatedAt,
    sections = [],
  } = options;

  assertOneOf(tier, ['T0', 'T1', 'T2', 'T3', 'T4'], 'tier');

  // Accept already-serialized envelopes or raw `{ id, ... }` specs.
  // An envelope is recognized by its snake_case `as_of` key, which raw
  // specs never carry (they use the camelCase `asOf` option).
  const envelopes = sections.map((section) => {
    if (section && typeof section === 'object' && 'as_of' in section) {
      return section; // already an envelope
    }
    const { id, ...rest } = section || {};
    return serializePlaceSection(id, rest);
  });

  // Bucket by group, preserving input order within each group.
  const byGroup = new Map();
  for (const envelope of envelopes) {
    if (!envelope || !envelope.group) continue;
    if (!byGroup.has(envelope.group)) byGroup.set(envelope.group, []);
    byGroup.get(envelope.group).push(envelope);
  }

  const groups = PLACE_GROUPS
    .filter((group) => byGroup.has(group))
    .map((group) => ({
      group,
      label: PLACE_GROUP_LABELS[group],
      sections: byGroup.get(group),
    }));

  return {
    place: serializePlaceAddressRef(place),
    tier,
    region_supported: regionSupported,
    generated_at: generatedAt || new Date().toISOString(),
    groups,
  };
}

module.exports = {
  PLACE_GROUPS,
  PLACE_GROUP_LABELS,
  PLACE_SECTION_META,
  PLACE_SECTION_IDS,
  serializePlaceAddressRef,
  serializePlaceSection,
  serializePlaceIntelligence,
};
