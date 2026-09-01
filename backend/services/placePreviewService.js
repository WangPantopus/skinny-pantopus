// ============================================================
// PLACE PREVIEW SERVICE — the anonymous T0 "taste", unlocked
//
// Composes the free Band-A section snapshot for a POINT (no home, no
// user) so the signed-out preview shows the same truths the claimed
// dashboard shows — as a one-shot snapshot. Everything here is public,
// location-keyed data (weather, air, alerts, FEMA, USGS, USFS, EPA,
// Census, HUD, civic districts); the only layer that stays behind a
// wall is Band B (ATTOM property facts), which is paid and exact.
//
// Why the snapshot leaks nothing: the recurring value of an account is
// *saving* the place and getting it *every morning* — not reading one
// number a weather app already gives away. (Wedge v2, D1.)
//
// Two rules the route relies on:
//   • Each section carries its own time budget (PLACE_PREVIEW_SECTION_
//     BUDGET_MS, default 3500). A slow provider degrades ONLY its own
//     section to `unavailable`; the underlying fetch keeps running so
//     the shared PlaceSectionCache is warm for the next visitor.
//   • No cache key ever contains the typed address — adapters key by
//     geohash / county / state, and the synthetic "home" passed to them
//     is identified by its geohash-6 cell, never by the search.
//
// The aha card: pickAha() ranks the ready sections by how *non-obvious*
// the fact is for this exact spot and returns one headline the visitor
// did not know about their own address, with the follow-up question the
// claim answers. When every layer is quiet, that is itself the card.
// ============================================================

const { serializePlaceSection } = require('../serializers/placeIntelligenceSerializer');
const { encodeGeohash } = require('../utils/geohash');
const adapters = require('./placeSectionAdapters');
const placeIntelligenceService = require('./placeIntelligenceService');

const DEFAULT_BUDGET_MS = 3500;

// Curated dashboard order — the same reading order the claimed
// dashboard uses (Today → Risk → Health → Block → Money → Civic).
const PREVIEW_SECTION_ORDER = [
  'weather', 'air_quality', 'alerts', 'sunrise_sunset',
  'flood', 'seismic', 'wildfire',
  'lead_radon', 'drinking_water', 'environmental_hazards',
  'block_density', 'census_context',
  'rent_band',
  'civic_districts', 'civic_election',
];

// Preview-facing density labels. The signed-out card must never read as
// a zero: below the floor it is an invitation, not an absence.
const PREVIEW_DENSITY_LABELS = {
  none: 'Founding Neighbor slots are open here',
  forming: 'Your block is starting to form',
  few: 'A few verified homes nearby',
  growing: 'Growing activity near this area',
};

const SLOW_REASON = 'Still loading from the source. Check back in a moment.';

function sectionBudgetMs() {
  const n = Number(process.env.PLACE_PREVIEW_SECTION_BUDGET_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BUDGET_MS;
}

// Race a composer against the budget. On timeout OR rejection the
// fallback envelopes are returned; the composer itself keeps running so
// its read-through cache still fills.
function withBudget(run, ms, fallback) {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback()), ms);
    if (timer && typeof timer.unref === 'function') timer.unref();
  });
  const attempt = Promise.resolve()
    .then(run)
    .then(
      (value) => { clearTimeout(timer); return Array.isArray(value) ? value : fallback(); },
      () => { clearTimeout(timer); return fallback(); },
    );
  return Promise.race([attempt, timeout]);
}

const unavailable = (ids, reason = SLOW_REASON) =>
  () => ids.map((id) => serializePlaceSection(id, { status: 'unavailable', unavailableReason: reason }));

// ── Remote Band-A layers for a point ─────────────────────────
// Returns envelopes for the layers that need a provider round-trip.
// Flood / census / density are assembled by the route (it already has
// them) via assemblePreviewSections.
async function composePreviewSections({ lat, lng, city = null, state = null }) {
  const gh6 = encodeGeohash(lat, lng, 6);
  // The adapters take a "home"; this one is a point with a geohash for
  // an id (their warn-logs print it) and no exact-record fields.
  const home = {
    id: `preview:${gh6}`,
    map_center_lat: lat,
    map_center_lng: lng,
    city,
    state,
    year_built: null,
    bedrooms: null,
  };
  const ms = sectionBudgetMs();
  const tasks = [
    withBudget(() => placeIntelligenceService.composeTodayForPoint(lat, lng), ms, unavailable(['weather', 'air_quality', 'alerts'])),
    withBudget(() => adapters.composeSunriseSunset(home), ms, unavailable(['sunrise_sunset'])),
    withBudget(() => adapters.composeSeismic(home), ms, unavailable(['seismic'])),
    withBudget(() => adapters.composeWildfire(home), ms, unavailable(['wildfire'])),
    withBudget(() => adapters.composeLeadRadon(home), ms, unavailable(['lead_radon'])),
    withBudget(() => adapters.composeDrinkingWater(home), ms, unavailable(['drinking_water'])),
    withBudget(() => adapters.composeEnvironmentalHazards(home), ms, unavailable(['environmental_hazards'])),
    withBudget(() => adapters.composeRentBand(home), ms, unavailable(['rent_band'])),
    withBudget(() => adapters.composeCivicDistricts(home), ms, unavailable(['civic_districts'])),
    withBudget(() => adapters.composeCivicElection(home), ms, unavailable(['civic_election'])),
  ];
  const settled = await Promise.all(tasks);
  return settled.flat();
}

// ── Local layers the route already holds ─────────────────────
function floodEnvelope(flood) {
  if (!flood || !flood.flood_zone) {
    return serializePlaceSection('flood', { status: 'unavailable' });
  }
  const zone = String(flood.flood_zone).toUpperCase();
  const inSfha = zone.startsWith('A') || zone.startsWith('V');
  return serializePlaceSection('flood', {
    data: {
      zone: flood.flood_zone,
      zone_label: `Zone ${flood.flood_zone}`,
      risk_level: placeIntelligenceService.floodRiskLevel(flood.flood_zone),
      in_sfha: inSfha,
      insurance_required: inSfha,
      plain_meaning: flood.flood_zone_description || '',
    },
  });
}

function censusEnvelope(area) {
  const has = area && (area.median_year_built != null || area.median_home_value != null);
  if (!has) return serializePlaceSection('census_context', { status: 'unavailable' });
  const parts = [];
  if (area.median_year_built) parts.push(`most homes here were built around ${area.median_year_built}`);
  if (area.median_home_value) {
    parts.push(`the typical one is valued near $${Math.round(area.median_home_value).toLocaleString('en-US')}`);
  }
  const summary = parts.length
    ? `${parts.join(', and ')}.`.replace(/^./, (m) => m.toUpperCase())
    : 'Census tract context for this area.';
  return serializePlaceSection('census_context', {
    data: {
      median_year_built: area.median_year_built ?? null,
      median_home_value: area.median_home_value ?? null,
      tract_name: null,
      summary,
    },
  });
}

function densityEnvelope(bucket) {
  const b = PREVIEW_DENSITY_LABELS[bucket] ? bucket : 'none';
  return serializePlaceSection('block_density', {
    data: { bucket: b, label: PREVIEW_DENSITY_LABELS[b] },
  });
}

// Merge the remote envelopes with the route's local layers into the
// curated order. Unknown ids are dropped; missing ids are omitted (a
// section that no composer produced is simply not shown).
function assemblePreviewSections({ remote = [], flood = null, area = null, bucket = 'none' }) {
  const byId = new Map();
  for (const env of remote) if (env && env.id) byId.set(env.id, env);
  byId.set('flood', floodEnvelope(flood));
  byId.set('census_context', censusEnvelope(area));
  byId.set('block_density', densityEnvelope(bucket));
  return PREVIEW_SECTION_ORDER.filter((id) => byId.has(id)).map((id) => byId.get(id));
}

// ── The aha card ─────────────────────────────────────────────
const DATA_BEARING = new Set(['ready', 'partial', 'stale']);
const ready = (env) => env && DATA_BEARING.has(env.status) && env.data;

function toneFor(score) {
  if (score >= 75) return 'alert';
  if (score >= 45) return 'watch';
  return 'info';
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Each builder returns { score, grade, headline, detail, follow_up } or null.
const AHA_BUILDERS = {
  alerts(d) {
    const active = Array.isArray(d.active) ? d.active : [];
    if (!active.length) return null;
    const rank = { warning: 100, watch: 70, advisory: 50 };
    const top = active.slice().sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0))[0];
    const label = { warning: 'Warning', watch: 'Watch', advisory: 'Advisory' }[top.severity] || 'Alert';
    return {
      score: rank[top.severity] || 50,
      grade: label,
      headline: `${top.event || 'A weather alert'}: in effect right now`,
      detail: (top.headline && top.headline !== top.event ? top.headline : top.description || '').slice(0, 160),
      follow_up: 'Claim this address and we\'ll wake you for the next one.',
    };
  },
  air_quality(d) {
    const scores = { hazardous: 95, very_unhealthy: 95, unhealthy: 95, unhealthy_sensitive: 80, moderate: 40, good: 8 };
    const score = scores[d.category] ?? 8;
    return {
      score,
      grade: Number.isFinite(Number(d.index)) ? `AQI ${d.index}` : null,
      headline: `Air right now: ${d.category_label || d.category}`,
      detail: d.health_message || '',
      follow_up: 'Claim this address to get a smoke-day alert every morning.',
    };
  },
  flood(d) {
    const level = d.risk_level;
    const score = level === 'high' ? 95 : level === 'moderate' ? 65 : 6;
    const headline = level === 'high'
      ? 'This address sits in a FEMA high-risk flood zone'
      : level === 'moderate'
        ? 'This address sits in a moderate flood-risk zone'
        : 'Minimal flood risk on FEMA\'s map';
    return {
      score,
      grade: d.zone_label || (d.zone ? `Zone ${d.zone}` : null),
      headline,
      detail: d.plain_meaning || (level === 'high' ? 'Flood insurance is usually required for a mortgage here.' : ''),
      follow_up: level === 'minimal'
        ? 'Claim it to hear the day the map changes.'
        : 'Claim it to track insurance requirements and map changes.',
    };
  },
  wildfire(d) {
    const cls = d.burnable ? Number(d.hazard_class) : null;
    const score = cls === 5 ? 92 : cls === 4 ? 85 : cls === 3 ? 55 : cls === 2 ? 12 : 10;
    return {
      score,
      grade: d.hazard_label || null,
      headline: d.burnable
        ? `${d.hazard_label} wildfire hazard around this address`
        : 'This point is classed as non-burnable land',
      detail: d.summary || '',
      follow_up: cls != null && cls >= 3
        ? 'Claim it to get smoke-day and burn-ban alerts every morning.'
        : 'Claim it to hear the morning that changes.',
    };
  },
  seismic(d) {
    const sdc = String(d.design_category || '').toUpperCase();
    const score = { E: 85, D: 78, C: 45, B: 8, A: 6 }[sdc] ?? 20;
    return {
      score,
      grade: sdc ? `Category ${sdc}` : null,
      headline: sdc ? `Seismic design category ${sdc} at this point` : 'Seismic design demand for this point',
      detail: d.summary || '',
      follow_up: sdc === 'D' || sdc === 'E'
        ? 'Claim it to keep an earthquake-readiness list for this home.'
        : 'Claim it for the full risk picture.',
    };
  },
  lead_radon(d) {
    const zone = Number(d.radon_zone);
    if (!Number.isFinite(zone)) return null;
    const score = zone === 1 ? 75 : zone === 2 ? 42 : 10;
    const level = zone === 1 ? 'High' : zone === 2 ? 'Moderate' : 'Low';
    return {
      score,
      grade: `Radon zone ${zone}`,
      headline: `${level} radon potential for this county`,
      detail: d.summary || '',
      follow_up: 'Claim it and we\'ll remind you when a test kit is due.',
    };
  },
  environmental_hazards(d) {
    const count = Number(d.facilities_within_mile) || 0;
    const score = count >= 3 ? 68 : count >= 1 ? 50 : 10;
    const nearest = Array.isArray(d.facilities) && d.facilities[0];
    return {
      score,
      grade: `${count} nearby`,
      headline: count === 0
        ? 'No EPA-regulated facilities within a mile'
        : `${plural(count, 'EPA-regulated facility', 'EPA-regulated facilities')} within a mile`,
      detail: nearest
        ? `Nearest: ${nearest.name}, ${nearest.distance_mi} mi (${nearest.program}). Regulated activity, not contamination.`
        : d.summary || '',
      follow_up: 'Claim it to see each one and what it\'s regulated for.',
    };
  },
  drinking_water(d) {
    const n = Number(d.violation_count) || 0;
    const bad = Boolean(d.recent_health_violations) && n > 0;
    const name = d.utility_name || 'Your water system';
    return {
      score: bad ? 74 : 12,
      grade: bad ? plural(n, 'violation', 'violations') : 'No violations',
      headline: bad
        ? `${name}: ${plural(n, 'health-based violation', 'health-based violations')} in 5 years`
        : `${name}: no health-based violations in 5 years`,
      detail: d.summary || '',
      follow_up: 'Claim it to be told when the next notice is filed.',
    };
  },
  rent_band(d) {
    const lo = Number(d.band_low);
    const hi = Number(d.band_high);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    const bedrooms = Number(d.bedrooms);
    const label = bedrooms === 0 ? 'studio' : `${Number.isFinite(bedrooms) ? bedrooms : 2}-bedroom`;
    return {
      score: 30,
      grade: `$${lo.toLocaleString('en-US')}+`,
      headline: `Typical ${label} rent nearby: $${lo.toLocaleString('en-US')}–$${hi.toLocaleString('en-US')} a month`,
      detail: d.summary || '',
      follow_up: 'Claim it to compare with what this home is worth.',
    };
  },
  civic_election(d) {
    const days = Number(d.days_until);
    if (!d.name || !Number.isFinite(days)) return null;
    return {
      score: days <= 45 ? 66 : 28,
      grade: `${days} days`,
      headline: `${d.name} is ${plural(days, 'day', 'days')} away`,
      detail: 'Districts and deadlines for this exact address live on its page.',
      follow_up: 'Claim it to get your ballot deadline the week it matters.',
    };
  },
  civic_districts(d) {
    const districts = Array.isArray(d.districts) ? d.districts : [];
    if (!districts.length) return null;
    const house = districts.find((x) => x.office_label === 'U.S. House');
    const others = districts.filter((x) => x !== house).map((x) => x.office_label.toLowerCase());
    return {
      score: 22,
      grade: null,
      headline: house ? house.name : `${plural(districts.length, 'district represents', 'districts represent')} this address`,
      detail: others.length ? `Plus ${others.join(', ')}.` : '',
      follow_up: 'Claim it to see who holds each seat.',
    };
  },
  census_context(d) {
    if (!d.median_year_built) return null;
    return {
      score: 18,
      grade: `${d.median_year_built}`,
      headline: `Most homes here were built around ${d.median_year_built}`,
      detail: d.summary || '',
      follow_up: 'Claim it to see this home\'s own record.',
    };
  },
};

// Facts worth naming on the calm card, when they are calm.
function calmFacts(byId) {
  const facts = [];
  const flood = ready(byId.get('flood'));
  if (flood && flood.risk_level === 'minimal') facts.push('minimal flood risk');
  const wf = ready(byId.get('wildfire'));
  if (wf && (!wf.burnable || Number(wf.hazard_class) <= 2)) facts.push('low wildfire hazard');
  const air = ready(byId.get('air_quality'));
  if (air && air.category === 'good') facts.push('good air today');
  const alerts = ready(byId.get('alerts'));
  if (alerts && Array.isArray(alerts.active) && alerts.active.length === 0) facts.push('no active alerts');
  const seismic = ready(byId.get('seismic'));
  if (seismic && /^[AB]$/i.test(String(seismic.design_category))) facts.push('low earthquake demand');
  return facts;
}

const AHA_FLOOR = 35;

function pickAha(sections) {
  const byId = new Map();
  for (const env of sections || []) if (env && env.id) byId.set(env.id, env);

  let best = null;
  for (const id of Object.keys(AHA_BUILDERS)) {
    const data = ready(byId.get(id));
    if (!data) continue;
    let built = null;
    try {
      built = AHA_BUILDERS[id](data);
    } catch {
      built = null;
    }
    if (!built) continue;
    if (!best || built.score > best.score) best = { section_id: id, ...built };
  }

  if (!best || best.score < AHA_FLOOR) {
    const facts = calmFacts(byId);
    const listed = facts.length
      ? `${facts.join(', ')}.`.replace(/^./, (m) => m.toUpperCase())
      : 'Nothing on the public layers stands out for this spot.';
    return {
      section_id: null,
      tone: 'calm',
      grade: 'Quiet',
      headline: 'Quiet on every layer',
      detail: `${listed} That's rarer than you'd think.`,
      follow_up: 'Claim this address to know the morning that changes.',
    };
  }

  const { score, ...card } = best;
  return { ...card, tone: toneFor(score) };
}

module.exports = {
  composePreviewSections,
  assemblePreviewSections,
  pickAha,
  PREVIEW_SECTION_ORDER,
  PREVIEW_DENSITY_LABELS,
  // Exported for unit testing.
  withBudget,
  sectionBudgetMs,
};
