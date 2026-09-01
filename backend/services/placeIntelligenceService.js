// ============================================================
// PLACE INTELLIGENCE SERVICE
//
// Composes the PlaceIntelligence section-envelope contract (W0.1) for
// a claimed home by REUSING existing data services — it does not
// re-implement any provider fetching:
//   Today              providerOrchestrator.getHubToday (weather/AQI/alerts)
//   Risk & Readiness   neighborhoodProfileService.getProfile (FEMA flood)
//   Your Block         neighborhoodProfileService (Census tract context)
//                      + NeighborhoodPreview table (k-anon density bucket)
//   Your Home (Band B) propertyIntelligenceService.getProfile (ATTOM) —
//                      only when ATTOM_API_KEY is configured, else
//                      `unavailable` (never a 500)
//   Money Signals      BillBenchmark table (peer comparison)
//
// Every section degrades INDEPENDENTLY: a thrown/failed source yields
// that section's `error`/`unavailable` status — it never fails the
// whole response. Bands are respected: Band B/C/D are gated by tier
// (derived from the caller's home access), Band A is always visible.
//
// See docs/design/place + the product design doc §8.2 / §8.3 / §9.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { encodeGeohash } = require('../utils/geohash');
const {
  PLACE_SECTION_IDS,
  PLACE_SECTION_META,
  serializePlaceSection,
  serializePlaceIntelligence,
} = require('../serializers/placeIntelligenceSerializer');

const providerOrchestrator = require('./context/providerOrchestrator');
const neighborhoodProfileService = require('./ai/neighborhoodProfileService');
const propertyIntelligenceService = require('./ai/propertyIntelligenceService');
const placeSectionAdapters = require('./placeSectionAdapters');
const { getHomePrivacy } = require('./homePrivacyService');

const HOME_SELECT =
  'id, owner_id, address, address2, city, state, zipcode, map_center_lat, map_center_lng, year_built, sq_ft, bedrooms, bathrooms, lot_sq_ft, home_type';

// k-anon density bucket labels (mirror @pantopus/types PLACE_DENSITY_LABELS).
const DENSITY_LABELS = {
  none: 'No activity shown yet',
  forming: 'Your block is starting to form',
  few: 'A few verified homes nearby',
  growing: 'Growing activity near this area',
};

// ── Trust tier from the caller's home access (§3) ────────────
// The endpoint requires home access, so the caller is claimed (T3+);
// a verified occupancy lifts them to T4.
function resolveTier(access) {
  if (!access || !access.hasAccess) return 'T1';
  const vs = access.occupancy && access.occupancy.verification_status;
  if (vs === 'verified') return 'T4';
  return 'T3';
}

// ── Band × tier → section access (§9.2) ──────────────────────
function bandAccess(band, tier) {
  if (band === 'A') return 'available';
  if (band === 'B' || band === 'C') return tier === 'T3' || tier === 'T4' ? 'available' : 'locked';
  if (band === 'D') return tier === 'T4' ? 'available' : 'locked';
  return 'locked';
}

// ── Location → geohash-6 (matches NeighborhoodPreview / BillBenchmark) ──
function homeLatLng(home) {
  const lat = Number(home.map_center_lat);
  const lng = Number(home.map_center_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

// ── Provider value → contract union mappers (best-effort) ────
const CONDITION_CODES = new Set([
  'clear', 'partly_cloudy', 'cloudy', 'fog', 'rain', 'snow', 'sleet', 'thunderstorm', 'wind',
]);
function mapConditionCode(code) {
  const c = String(code || '').toLowerCase();
  if (CONDITION_CODES.has(c)) return c;
  if (c.includes('thunder') || c.includes('storm')) return 'thunderstorm';
  if (c.includes('snow')) return 'snow';
  if (c.includes('sleet') || c.includes('hail')) return 'sleet';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return 'rain';
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return 'fog';
  if (c.includes('partly') || c.includes('mostly_sunny') || c.includes('mostly_clear')) return 'partly_cloudy';
  if (c.includes('cloud') || c.includes('overcast')) return 'cloudy';
  if (c.includes('wind')) return 'wind';
  if (c.includes('clear') || c.includes('sun') || c.includes('fair')) return 'clear';
  return 'clear';
}

function mapAqiCategory(category) {
  const c = String(category || '').toLowerCase();
  if (c.includes('hazard')) return 'hazardous';
  if (c.includes('very')) return 'very_unhealthy';
  if (c.includes('sensitive')) return 'unhealthy_sensitive';
  if (c.includes('unhealthy')) return 'unhealthy';
  if (c.includes('moderate')) return 'moderate';
  if (c.includes('good')) return 'good';
  return 'good';
}

const AQI_CATEGORY_LABELS = {
  good: 'Good',
  moderate: 'Moderate',
  unhealthy_sensitive: 'Unhealthy for sensitive groups',
  unhealthy: 'Unhealthy',
  very_unhealthy: 'Very unhealthy',
  hazardous: 'Hazardous',
};
const AQI_HEALTH_MESSAGES = {
  good: 'Air quality is good. A fine day to be active outdoors.',
  moderate: 'Air quality is acceptable. Unusually sensitive people should consider limiting prolonged exertion.',
  unhealthy_sensitive: 'Sensitive groups should limit time outdoors. It is fine for most people.',
  unhealthy: 'Limit time outdoors, especially if you are sensitive.',
  very_unhealthy: 'Avoid prolonged time outdoors.',
  hazardous: 'Stay indoors and keep windows closed where possible.',
};

function mapAlertSeverity(sev) {
  const s = String(sev || '').toLowerCase();
  if (s.includes('warn') || s.includes('severe') || s.includes('extreme')) return 'warning';
  if (s.includes('watch')) return 'watch';
  return 'advisory';
}

// FEMA zone → qualitative risk.
function floodInSfha(zone) {
  const z = String(zone || '').toUpperCase();
  return z.startsWith('A') || z.startsWith('V');
}
function floodRiskLevel(zone) {
  const z = String(zone || '').toUpperCase();
  if (floodInSfha(z)) return 'high';
  if (z.includes('0.2') || z.includes('X500') || z.includes('SHADED')) return 'moderate';
  return 'minimal';
}

function densityBucket(count) {
  const n = Number(count) || 0;
  if (n <= 0) return 'none';
  if (n < 10) return 'forming';
  if (n < 25) return 'few';
  return 'growing';
}

function censusSummary(profile) {
  const parts = [];
  if (profile.median_year_built) parts.push(`most homes here were built around ${profile.median_year_built}`);
  if (profile.median_home_value) {
    parts.push(`the typical one is valued near $${Math.round(profile.median_home_value).toLocaleString('en-US')}`);
  }
  if (!parts.length) return 'Census tract context for your area.';
  return `${parts.join(', and ')}.`.replace(/^./, (m) => m.toUpperCase());
}

// ════════════════════════════════════════════════════════════
// Section composers — each returns an array of serialized
// envelopes and NEVER throws (failures degrade to a per-section
// error/unavailable status).
// ════════════════════════════════════════════════════════════

// Shared Today envelope builder. `weather` / `aqi` are the Hub-shaped
// blocks (or null → unavailable); `alerts` is an array (or null →
// unavailable; an EMPTY array is still "ready": "No active alerts").
function buildTodayEnvelopes({ weather, aqi, alerts, asOf = null }) {
  const out = [];

  if (weather) {
    out.push(serializePlaceSection('weather', {
      access: 'available',
      asOf,
      data: {
        current_temp_f: weather.current_temp_f,
        condition_code: mapConditionCode(weather.condition_code),
        condition_label: weather.condition_label,
        feels_like_f: weather.feels_like_f ?? null,
        high_f: weather.high_f,
        low_f: weather.low_f,
        hourly: [],
        daily: [],
      },
    }));
  } else {
    out.push(serializePlaceSection('weather', { access: 'available', status: 'unavailable' }));
  }

  if (aqi) {
    const category = mapAqiCategory(aqi.category);
    out.push(serializePlaceSection('air_quality', {
      access: 'available',
      asOf,
      data: {
        index: aqi.index,
        category,
        category_label: aqi.category || AQI_CATEGORY_LABELS[category],
        dominant_pollutant: aqi.pollutant ?? null,
        health_message: AQI_HEALTH_MESSAGES[category],
      },
    }));
  } else {
    out.push(serializePlaceSection('air_quality', { access: 'available', status: 'unavailable' }));
  }

  if (Array.isArray(alerts)) {
    const active = alerts.map((a) => ({
      id: String(a.id),
      event: a.title,
      severity: mapAlertSeverity(a.severity),
      headline: a.headline || a.title,
      description: a.description || a.title,
      onset: a.starts_at || null,
      ends: a.ends_at || null,
    }));
    out.push(serializePlaceSection('alerts', { access: 'available', asOf, status: 'ready', data: { active } }));
  } else {
    out.push(serializePlaceSection('alerts', { access: 'available', status: 'unavailable' }));
  }

  return out;
}

async function composeToday(userId) {
  let hub = null;
  try {
    hub = await providerOrchestrator.getHubToday(userId);
  } catch (err) {
    logger.warn('placeIntelligence: getHubToday failed', { userId, error: err.message });
  }
  return buildTodayEnvelopes({
    weather: hub && hub.weather ? hub.weather : null,
    aqi: hub && hub.aqi ? hub.aqi : null,
    alerts: hub ? (hub.alerts || []) : null,
    asOf: (hub && hub.fetched_at) || null,
  });
}

// Today for a POINT (no user, no home) — the anonymous preview's daily
// snapshot. Calls the same providers the Hub uses, straight from a
// lat/lng; each degrades on its own. Never throws.
async function composeTodayForPoint(lat, lng) {
  // Required lazily: the providers pull in WeatherKit's JWT/logger chain,
  // which the dashboard route's test harness doesn't load — and the
  // preview is the only caller that needs them from here.
  const { fetchWeather } = require('./context/weatherProvider');
  const { fetchAQI } = require('./context/aqiProvider');
  const { fetchAlerts } = require('./context/alertsProvider');
  const [weatherResult, aqiResult, alertsResult] = await Promise.allSettled([
    fetchWeather(lat, lng),
    fetchAQI(lat, lng),
    fetchAlerts(lat, lng),
  ]);
  const w = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
  const a = aqiResult.status === 'fulfilled' ? aqiResult.value : null;
  const al = alertsResult.status === 'fulfilled' ? alertsResult.value : null;

  const weather = w && w.current && w.source !== 'error'
    ? {
        current_temp_f: w.current.temp_f ?? null,
        condition_code: w.current.condition_code,
        condition_label: w.current.condition_label,
        feels_like_f: w.current.feels_like_f ?? null,
        high_f: (w.daily && w.daily[0] && w.daily[0].high_f) ?? null,
        low_f: (w.daily && w.daily[0] && w.daily[0].low_f) ?? null,
      }
    : null;
  const aqi = a && a.aqi != null ? { index: a.aqi, category: a.category, pollutant: a.pollutant } : null;
  const alerts = al && al.source !== 'error' && Array.isArray(al.alerts)
    ? al.alerts.map((x) => ({
        id: x.id,
        title: x.event || x.headline,
        severity: x.severity,
        headline: x.headline,
        description: x.description,
        starts_at: x.onset,
        ends_at: x.expires,
      }))
    : null;

  return buildTodayEnvelopes({
    weather,
    aqi,
    alerts,
    asOf: (w && w.fetchedAt) || (a && a.fetchedAt) || new Date().toISOString(),
  });
}

async function composeNeighborhood(home) {
  const ll = homeLatLng(home);
  let profile = null;
  if (ll) {
    try {
      const result = await neighborhoodProfileService.getProfile({
        latitude: ll.lat,
        longitude: ll.lng,
        address: home.address || '',
      });
      profile = result && result.profile;
    } catch (err) {
      logger.warn('placeIntelligence: neighborhoodProfile failed', { homeId: home.id, error: err.message });
    }
  }
  const out = [];

  if (profile && profile.flood_zone) {
    out.push(serializePlaceSection('flood', {
      access: 'available',
      asOf: profile.cached_at || null,
      data: {
        zone: profile.flood_zone,
        zone_label: `Zone ${profile.flood_zone}`,
        risk_level: floodRiskLevel(profile.flood_zone),
        in_sfha: floodInSfha(profile.flood_zone),
        insurance_required: floodInSfha(profile.flood_zone),
        plain_meaning: profile.flood_zone_description || '',
      },
    }));
  } else {
    out.push(serializePlaceSection('flood', { access: 'available', status: 'unavailable' }));
  }

  if (profile && (profile.median_year_built != null || profile.median_home_value != null)) {
    out.push(serializePlaceSection('census_context', {
      access: 'available',
      asOf: profile.cached_at || null,
      data: {
        median_year_built: profile.median_year_built ?? null,
        median_home_value: profile.median_home_value ?? null,
        tract_name: profile.tract_id ? `Census tract ${profile.tract_id}` : null,
        summary: censusSummary(profile),
      },
    }));
  } else {
    out.push(serializePlaceSection('census_context', { access: 'available', status: 'unavailable' }));
  }

  return out;
}

async function composeDensity(home) {
  const ll = homeLatLng(home);
  if (!ll) return [serializePlaceSection('block_density', { access: 'available', status: 'unavailable' })];

  try {
    const geohash = encodeGeohash(ll.lat, ll.lng, 6);
    const { data } = await supabaseAdmin
      .from('NeighborhoodPreview')
      .select('verified_users_count')
      .eq('geohash', geohash)
      .maybeSingle();
    // k-anon: the raw count is floored to a bucket and never returned.
    const bucket = densityBucket(data && data.verified_users_count);
    return [serializePlaceSection('block_density', {
      access: 'available',
      data: { bucket, label: DENSITY_LABELS[bucket] },
    })];
  } catch (err) {
    logger.warn('placeIntelligence: density failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('block_density', { access: 'available', status: 'error' })];
  }
}

async function composeYourHome(home, tier) {
  const access = bandAccess('B', tier);
  if (access === 'locked') {
    return [serializePlaceSection('your_home', {
      access: 'locked',
      unavailableReason: "Claim your place to see your home's exact details and value.",
    })];
  }
  // Band B is ATTOM-paid — without a key there is no exact data (area teaser only).
  if (!process.env.ATTOM_API_KEY) {
    return [serializePlaceSection('your_home', {
      access,
      status: 'unavailable',
      unavailableReason: "Exact property details aren't available for your area yet.",
    })];
  }

  let result = null;
  try {
    result = await propertyIntelligenceService.getProfile(home.id);
  } catch (err) {
    logger.warn('placeIntelligence: propertyIntelligence failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('your_home', { access, status: 'error' })];
  }
  const profile = result && result.profile;
  if (!profile || result.source === 'error') {
    return [serializePlaceSection('your_home', { access, status: 'unavailable' })];
  }

  return [serializePlaceSection('your_home', {
    access,
    asOf: profile.cached_at || null,
    // 'cache_stale' = ATTOM was unreachable and an expired row served
    // instead (database-first resilience) — surfaced as a stale envelope.
    status: result.source === 'cache_stale' ? 'stale' : 'ready',
    data: {
      year_built: profile.year_built ?? null,
      sqft: profile.sqft ?? null,
      bedrooms: profile.bedrooms ?? null,
      bathrooms: profile.bathrooms ?? null,
      lot_sqft: profile.lot_sqft ?? null,
      home_type: profile.property_type ?? null,
      estimated_value: profile.estimated_value ?? null,
      value_low: profile.value_range_low ?? null,
      value_high: profile.value_range_high ?? null,
      assessed_value: profile.assessed_value ?? null,
    },
  })];
}

async function composeBillBenchmark(home) {
  const ll = homeLatLng(home);
  if (!ll) return [serializePlaceSection('bill_benchmark', { access: 'available', status: 'unavailable' })];

  let rows = null;
  try {
    const geohash = encodeGeohash(ll.lat, ll.lng, 6);
    // Privacy floor: only household_count >= 10 may be shown (matches the
    // existing bill-trends read). Smaller cohorts stay unavailable.
    const { data } = await supabaseAdmin
      .from('BillBenchmark')
      .select('bill_type, avg_amount_cents, household_count')
      .eq('geohash', geohash)
      .eq('bill_type', 'electric')
      .gte('household_count', 10);
    rows = data;
  } catch (err) {
    logger.warn('placeIntelligence: billBenchmark failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('bill_benchmark', { access: 'available', status: 'error' })];
  }

  const amounts = (rows || [])
    .map((r) => Number(r.avg_amount_cents) / 100)
    .filter((n) => Number.isFinite(n));
  if (!amounts.length) {
    return [serializePlaceSection('bill_benchmark', { access: 'available', status: 'unavailable' })];
  }

  const bandLow = Math.round(Math.min(...amounts));
  const bandHigh = Math.round(Math.max(...amounts));
  const bandMid = (bandLow + bandHigh) / 2;

  // Optional: compare the resident's own electric bills (Band C input).
  let yourAmount = null;
  try {
    const { data: bills } = await supabaseAdmin
      .from('HomeBill')
      .select('amount, bill_type')
      .eq('home_id', home.id)
      .eq('bill_type', 'electric');
    // HomeBill.amount is stored in cents (the benchmark job averages it
    // straight into avg_amount_cents); convert to dollars to match the band.
    const vals = (bills || []).map((b) => Number(b.amount)).filter((n) => Number.isFinite(n));
    if (vals.length) yourAmount = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length / 100);
  } catch (err) {
    logger.warn('placeIntelligence: own bills read failed', { homeId: home.id, error: err.message });
  }

  let comparison = 'typical';
  let comparisonPct = 0;
  let summary;
  if (yourAmount != null && bandMid > 0) {
    comparisonPct = Math.round(((yourAmount - bandMid) / bandMid) * 100);
    comparison = comparisonPct > 5 ? 'higher' : comparisonPct < -5 ? 'lower' : 'typical';
    const dir = comparison === 'higher' ? 'above' : comparison === 'lower' ? 'below' : 'in line with';
    summary = `Your electric bill is ${Math.abs(comparisonPct)}% ${dir} neighbors`;
  } else {
    summary = `Neighborhood electric bills average about $${Math.round(bandMid).toLocaleString('en-US')}/mo`;
  }

  return [serializePlaceSection('bill_benchmark', {
    access: 'available',
    data: {
      utility: 'electric',
      your_amount: yourAmount,
      band_low: bandLow,
      band_high: bandHigh,
      comparison,
      comparison_pct: comparisonPct,
      period: '12-month average',
      summary,
    },
  })];
}

// ════════════════════════════════════════════════════════════
// composeHomeIntelligence — the full grouped response
// ════════════════════════════════════════════════════════════

// Which launch-set sections each wired composer produces, so a
// `?sections=` subset request only runs (and only pays for) the
// composers it actually needs.
//
// Still BUILD_PENDING: `incentives` only (DSIRE's API is license-gated;
// curated federal copy would rot).
const COMPOSER_SECTIONS = [
  { ids: ['weather', 'air_quality', 'alerts'], run: ({ userId }) => composeToday(userId) },
  { ids: ['sunrise_sunset'], run: ({ home }) => placeSectionAdapters.composeSunriseSunset(home) },
  { ids: ['flood', 'census_context'], run: ({ home }) => composeNeighborhood(home) },
  { ids: ['seismic'], run: ({ home }) => placeSectionAdapters.composeSeismic(home) },
  { ids: ['wildfire'], run: ({ home }) => placeSectionAdapters.composeWildfire(home) },
  { ids: ['lead_radon'], run: ({ home }) => placeSectionAdapters.composeLeadRadon(home) },
  { ids: ['drinking_water'], run: ({ home }) => placeSectionAdapters.composeDrinkingWater(home) },
  { ids: ['environmental_hazards'], run: ({ home }) => placeSectionAdapters.composeEnvironmentalHazards(home) },
  { ids: ['block_density'], run: ({ home }) => composeDensity(home) },
  { ids: ['your_home'], run: ({ home, tier }) => composeYourHome(home, tier) },
  { ids: ['bill_benchmark'], run: ({ home }) => composeBillBenchmark(home) },
  { ids: ['rent_band'], run: ({ home }) => placeSectionAdapters.composeRentBand(home) },
  { ids: ['civic_districts'], run: ({ home }) => placeSectionAdapters.composeCivicDistricts(home) },
  { ids: ['civic_election'], run: ({ home }) => placeSectionAdapters.composeCivicElection(home) },
];

// ── Per-home privacy → the place address ref (§ homePrivacy) ──
// The endpoint is member-only, so most of the 9 Security toggles do not
// apply here by design: guest_approval / notification_previews /
// doc_lock / photo_blur / vault_auto_lock govern other surfaces, and
// member_name_visibility / activity_visibility / map_opt_out govern what
// OUTSIDERS see (this payload reaches members only). The one toggle that
// shapes THIS payload is `address_precision` ("Street only · hide unit
// number"): when ON, the unit (address2) is stripped from the ref.
//
// The Home.address column is often a fully-formatted geocoder string
// ("4080 NE Tacoma Ct, Camas, Washington 98607, United States"); the ref
// wants the street line, so everything after the first comma is dropped
// (serializePlaceAddressRef re-appends the city for the display label).
function buildPlaceRef(home, privacy) {
  const full = String(home.address || '');
  const street = (full.split(',')[0] || '').trim() || full;
  const unit = String(home.address2 || '').trim();
  const includeUnit = unit && !(privacy && privacy.address_precision);
  return {
    line1: includeUnit ? `${street} ${unit}` : street,
    city: home.city,
    state: home.state,
    zipcode: home.zipcode,
  };
}

/**
 * @param {object} params
 * @param {string} params.homeId
 * @param {string} params.userId
 * @param {object} params.access  Result of checkHomePermission (hasAccess, isOwner, occupancy).
 * @param {string[]} [params.sectionIds]  Optional subset of PLACE_SECTION_IDS to compose
 *                                        (already validated by the route); omitted ⇒ all.
 * @returns {Promise<object|null>} The PlaceIntelligence response, or null if the home is missing.
 */
async function composeHomeIntelligence({ homeId, userId, access, sectionIds }) {
  const { data: home, error } = await supabaseAdmin
    .from('Home')
    .select(HOME_SELECT)
    .eq('id', homeId)
    .maybeSingle();

  if (error || !home) {
    if (error) logger.warn('placeIntelligence: home fetch failed', { homeId, error: error.message });
    return null;
  }

  const tier = resolveTier(access);
  const requested = new Set(
    Array.isArray(sectionIds) && sectionIds.length ? sectionIds : PLACE_SECTION_IDS,
  );

  // Compose only the composers that produce a requested section — plus the
  // home's privacy toggles — in parallel; each composer is self-contained
  // and resolves (never rejects), so one failure can't sink the response.
  const runs = COMPOSER_SECTIONS.filter(({ ids }) => ids.some((id) => requested.has(id)));
  const [privacy, ...groups] = await Promise.all([
    getHomePrivacy(homeId),
    ...runs.map(({ run }) => run({ home, userId, tier })),
  ]);

  const composed = {};
  for (const env of groups.flat()) composed[env.id] = env;

  // Emit the requested sections in canonical order; anything not yet wired
  // fills as `unavailable` so the full IA renders with section-by-section
  // degradation (turned on in later waves).
  const sections = PLACE_SECTION_IDS.filter((id) => requested.has(id)).map((id) => {
    if (composed[id]) return composed[id];
    const meta = PLACE_SECTION_META[id];
    return serializePlaceSection(id, { access: bandAccess(meta.band, tier), status: 'unavailable' });
  });

  return serializePlaceIntelligence({
    place: buildPlaceRef(home, privacy),
    tier,
    regionSupported: true,
    sections,
  });
}

module.exports = {
  composeHomeIntelligence,
  composeTodayForPoint,
  // Exported for unit testing.
  resolveTier,
  bandAccess,
  densityBucket,
  floodRiskLevel,
  mapAqiCategory,
  buildPlaceRef,
};
