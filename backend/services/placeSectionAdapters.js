/**
 * Place Section Adapters (Phase 2)
 *
 * Per-section providers for the launch-set sections that were
 * BUILD_PENDING after wave 0/1. Each compose* returns serialized
 * envelopes and NEVER throws — failures degrade to that section's
 * error/unavailable status. All remote fetches go through
 * placeSectionCache.readThrough (Phase 0), so each section gets its
 * Step-1 freshness budget + stale-serve for free.
 *
 *   sunrise_sunset         Open-Meteo daily (keyless)        ~6 h cache
 *   lead_radon             CountyRadonZone table (mig. 158)  local read
 *                          + Home.year_built lead screening
 *   rent_band              HudFmr table (mig. 158)           local read
 *   drinking_water         EPA SDWIS via data.epa.gov        90 d cache
 *   environmental_hazards  EPA ECHO get_facilities           90 d cache
 *
 * `incentives` stays BUILD_PENDING: DSIRE's API is license-gated
 * (programs.dsireusa.org returns "Access denied" without one) and
 * hand-curated federal copy would rot — no trustworthy free source.
 *
 * County resolution: the Census geocoder (already used by
 * neighborhoodProfileService) gives state+county FIPS for the home's
 * lat/lng; that lookup is itself cached per home for 90 days.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { encodeGeohash } = require('../utils/geohash');
const { serializePlaceSection } = require('../serializers/placeIntelligenceSerializer');
const { readThrough } = require('./placeSectionCache');
const { geocodeToTract } = require('./ai/neighborhoodProfileService');

const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

function homeLatLng(home) {
  const lat = Number(home.map_center_lat);
  const lng = Number(home.map_center_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

async function fetchJson(url, { headers } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── County FIPS for a point (geocoder, cached ~1 yr per geohash-7) ──
// Single-flight: several composers (radon, rent band, water) ask for the
// county of the same point at the same moment; one geocoder call serves
// them all instead of three cache misses racing.
const countyInFlight = new Map();

async function homeCountyFips(home) {
  const ll = homeLatLng(home);
  if (!ll) return null;
  const pointKey = `geo:${encodeGeohash(ll.lat, ll.lng, 7)}`;
  if (countyInFlight.has(pointKey)) return countyInFlight.get(pointKey);
  const run = lookupCountyFips(home, ll, pointKey).finally(() => countyInFlight.delete(pointKey));
  countyInFlight.set(pointKey, run);
  return run;
}

async function lookupCountyFips(home, ll, pointKey) {
  try {
    // Keyed by the point (geohash-7, ~150 m), not the home: county is a
    // fact about land, so claimed homes and the anonymous preview share
    // one row and no per-home / per-search key is ever written.
    const { payload } = await readThrough({
      cacheKey: pointKey,
      sectionId: '_county_fips',
      // County assignment changes only at the decennial census —
      // effectively permanent, refreshed yearly as a safety valve.
      ttlMs: 365 * DAY_MS,
      fetch: async () => {
        const tract = await geocodeToTract(ll.lat, ll.lng);
        if (!tract || !tract.stateCode || !tract.countyCode) return null;
        return { county_fips: `${tract.stateCode}${tract.countyCode}` };
      },
    });
    return (payload && payload.county_fips) || null;
  } catch (err) {
    logger.warn('placeSections: county fips failed', { homeId: home.id, error: err.message });
    return null;
  }
}

async function hudFmrRow(countyFips) {
  const { data } = await supabaseAdmin
    .from('HudFmr')
    .select('county_fips, fiscal_year, county_name, state_abbr, area_name, fmr_lo, fmr_hi')
    .eq('county_fips', countyFips)
    .order('fiscal_year', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

// ════════════════════════════════════════════════════════════
// sunrise_sunset — Open-Meteo daily, keyless
// ════════════════════════════════════════════════════════════
async function composeSunriseSunset(home) {
  const ll = homeLatLng(home);
  if (!ll) return [serializePlaceSection('sunrise_sunset', { status: 'unavailable' })];

  try {
    // geohash-5 (~5 km): sun times don't move within a cell; 6 h budget
    // keeps the day fresh without a per-minute fetch.
    const gh5 = encodeGeohash(ll.lat, ll.lng, 5);
    const { payload, fetchedAt, stale } = await readThrough({
      cacheKey: `geo:${gh5}`,
      sectionId: 'sunrise_sunset',
      ttlMs: 6 * 60 * 60 * 1000,
      fetch: async () => {
        const data = await fetchJson(
          `https://api.open-meteo.com/v1/forecast?latitude=${ll.lat}&longitude=${ll.lng}` +
          '&daily=sunrise,sunset,daylight_duration&timezone=auto&forecast_days=1',
        );
        const d = data && data.daily;
        if (!d || !d.sunrise || !d.sunrise[0]) return null;
        return {
          sunrise: d.sunrise[0],
          sunset: d.sunset[0],
          daylight_minutes: Math.round((Number(d.daylight_duration && d.daylight_duration[0]) || 0) / 60),
        };
      },
    });
    if (!payload) return [serializePlaceSection('sunrise_sunset', { status: 'unavailable' })];
    return [serializePlaceSection('sunrise_sunset', {
      asOf: fetchedAt,
      status: stale ? 'stale' : 'ready',
      data: payload,
    })];
  } catch (err) {
    logger.warn('placeSections: sunrise failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('sunrise_sunset', { status: 'error' })];
  }
}

// ════════════════════════════════════════════════════════════
// lead_radon — EPA radon zone (county) + lead-paint screening (year built)
// ════════════════════════════════════════════════════════════
// EPA prevalence of lead-based paint by era: pre-1960 ~69–87%,
// 1960–1977 ~24%, banned for residential use in 1978.
function leadRiskForYear(yearBuilt) {
  if (!Number.isFinite(yearBuilt)) return 'possible';
  if (yearBuilt < 1960) return 'likely';
  if (yearBuilt < 1978) return 'possible';
  return 'unlikely';
}

const RADON_ZONE_PHRASES = {
  1: 'highest radon potential (zone 1)',
  2: 'moderate radon potential (zone 2)',
  3: 'low radon potential (zone 3)',
};

function leadRadonSummary(yearBuilt, risk, zone) {
  const lead = Number.isFinite(yearBuilt)
    ? (risk === 'unlikely'
      ? `Built ${yearBuilt} — after the 1978 lead-paint ban`
      : `Built ${yearBuilt} — lead paint ${risk}; test before renovating`)
    : 'Build year unknown — assume lead paint is possible in older homes';
  const radon = zone
    ? `Your county has the ${RADON_ZONE_PHRASES[zone]}`
    : 'County radon zone unavailable for your area';
  return `${lead}. ${radon}.`;
}

async function composeLeadRadon(home) {
  try {
    const countyFips = await homeCountyFips(home);
    let zone = null;
    if (countyFips) {
      const { data } = await supabaseAdmin
        .from('CountyRadonZone')
        .select('zone')
        .eq('county_fips', countyFips)
        .maybeSingle();
      zone = (data && data.zone) || null;
    }

    const yearBuilt = Number.isFinite(Number(home.year_built)) && Number(home.year_built) > 0
      ? Number(home.year_built)
      : null;
    const risk = leadRiskForYear(yearBuilt);

    if (yearBuilt == null && zone == null) {
      return [serializePlaceSection('lead_radon', {
        status: 'unavailable',
        unavailableReason: 'No build year on file and no county radon coverage for this area yet.',
      })];
    }

    return [serializePlaceSection('lead_radon', {
      status: yearBuilt != null && zone != null ? 'ready' : 'partial',
      coverage: zone == null ? 'partial' : 'full',
      data: {
        year_built: yearBuilt,
        lead_paint_risk: risk,
        radon_zone: zone,
        summary: leadRadonSummary(yearBuilt, risk, zone),
        disclaimer: 'Screening based on build year and county radon zone — not a test of this home. Test kits settle both.',
      },
    })];
  } catch (err) {
    logger.warn('placeSections: lead_radon failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('lead_radon', { status: 'error' })];
  }
}

// ════════════════════════════════════════════════════════════
// rent_band — HUD Fair Market Rents (county table, migration 158)
// ════════════════════════════════════════════════════════════
async function composeRentBand(home) {
  try {
    const countyFips = await homeCountyFips(home);
    const row = countyFips ? await hudFmrRow(countyFips) : null;
    if (!row) {
      return [serializePlaceSection('rent_band', {
        status: 'unavailable',
        unavailableReason: 'No HUD rent data for your county yet.',
      })];
    }

    // Default to the 2-bedroom band only when bedrooms is unknown — a
    // studio (0) is a real value and gets the efficiency band.
    const rawBedrooms = Number(home.bedrooms);
    const bedrooms = Number.isFinite(rawBedrooms) && home.bedrooms != null
      ? Math.min(4, Math.max(0, Math.round(rawBedrooms)))
      : 2;
    const fmrLo = row.fmr_lo[bedrooms];
    const fmrHi = row.fmr_hi[bedrooms];
    // HUD FMRs are 40th-percentile point estimates; where HUD prices a
    // county at one number (lo = hi) the band extends 20% above it to
    // show a typical asking-rent spread — the summary says exactly that.
    const bandLow = fmrLo;
    const bandHigh = Math.max(fmrHi, Math.round(fmrLo * 1.2));
    const bedroomsLabel = bedrooms === 0 ? 'studio' : `${bedrooms}-bedroom`;

    return [serializePlaceSection('rent_band', {
      status: 'ready',
      data: {
        bedrooms,
        band_low: bandLow,
        band_high: bandHigh,
        // Full comparison track: efficiency floor to 20% over the 4BR top.
        market_low: Math.min(row.fmr_lo[0], bandLow),
        market_high: Math.max(Math.round(row.fmr_hi[4] * 1.2), bandHigh),
        period: `FY ${row.fiscal_year}`,
        summary: `HUD's FY ${row.fiscal_year} fair market rent for a ${bedroomsLabel} in ${row.county_name} is $${fmrLo.toLocaleString('en-US')}/mo; the band runs to about 20% above it.`,
      },
    })];
  } catch (err) {
    logger.warn('placeSections: rent_band failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('rent_band', { status: 'error' })];
  }
}

// ════════════════════════════════════════════════════════════
// drinking_water — EPA SDWIS (data.epa.gov dmapservice)
// ════════════════════════════════════════════════════════════
const SDWIS_BASE = 'https://data.epa.gov/dmapservice';

function stripCountySuffix(name) {
  return String(name || '').replace(/\s+(county|parish|borough|census area|municipality|planning region)$/i, '').trim();
}

// One county fetch: active community systems → pick the one serving the
// home's city when the name matches, else the largest; then its
// health-based violations (last 5 years).
async function fetchCountyWater(countyFips, homeCity) {
  const fmr = await hudFmrRow(countyFips);
  if (!fmr) return null;
  const county = stripCountySuffix(fmr.county_name);
  const state = fmr.state_abbr;

  const areas = await fetchJson(
    `${SDWIS_BASE}/sdwis.geographic_area/area_type_code/equals/CN` +
    `/and/county_served/equals/${encodeURIComponent(county)}` +
    `/and/primacy_agency_code/equals/${state}` +
    '/and/pws_type_code/equals/CWS/and/pws_activity_code/equals/A/1:40/json',
  );
  const pwsids = [...new Set((areas || []).map((a) => a.pwsid).filter(Boolean))];
  if (!pwsids.length) return null;

  const orChain = pwsids.map((id) => `pwsid/equals/${id}`).join('/or/');
  const systems = (await fetchJson(`${SDWIS_BASE}/sdwis.water_system/${orChain}/json`)) || [];
  const active = systems.filter((s) => s.pws_activity_code === 'A' && s.pws_type_code === 'CWS');
  if (!active.length) return null;

  const cityUpper = String(homeCity || '').toUpperCase();
  const cityMatches = cityUpper
    ? active.filter((s) => String(s.pws_name || '').toUpperCase().includes(cityUpper))
    : [];
  const pool = cityMatches.length ? cityMatches : active;
  const system = pool.reduce((a, b) =>
    (Number(b.population_served_count) || 0) > (Number(a.population_served_count) || 0) ? b : a);

  const violations = (await fetchJson(
    `${SDWIS_BASE}/sdwis.violation/pwsid/equals/${system.pwsid}` +
    '/and/is_health_based_ind/equals/Y/1:200/json',
  )) || [];
  const cutoff = Date.now() - 5 * 365 * DAY_MS;
  const recent = violations.filter((v) => {
    const t = Date.parse(v.compl_per_begin_date || '');
    return Number.isFinite(t) && t >= cutoff;
  });

  return {
    utility_name: String(system.pws_name || '').replace(/\s+/g, ' ').trim(),
    pws_id: system.pwsid || null,
    recent_health_violations: recent.length > 0,
    violation_count: recent.length,
    summary: recent.length > 0
      ? `${recent.length} health-based violation${recent.length === 1 ? '' : 's'} reported in the last 5 years.`
      : 'No health-based violations reported in the last 5 years.',
  };
}

async function composeDrinkingWater(home) {
  try {
    const countyFips = await homeCountyFips(home);
    if (!countyFips) return [serializePlaceSection('drinking_water', { status: 'unavailable' })];

    // City folded into the key: neighbors in the same city share the row.
    const citySlug = String(home.city || '').toLowerCase().replace(/[^a-z]/g, '') || 'any';
    const { payload, fetchedAt, stale } = await readThrough({
      cacheKey: `county:${countyFips}:${citySlug}`,
      sectionId: 'drinking_water',
      ttlMs: 90 * DAY_MS,
      fetch: () => fetchCountyWater(countyFips, home.city),
    });
    if (!payload) {
      return [serializePlaceSection('drinking_water', {
        status: 'unavailable',
        unavailableReason: 'No community water system found for your area in EPA records.',
      })];
    }
    return [serializePlaceSection('drinking_water', {
      asOf: fetchedAt,
      status: stale ? 'stale' : 'ready',
      coverage: 'partial', // county-level match, not a service-area polygon
      data: payload,
    })];
  } catch (err) {
    logger.warn('placeSections: drinking_water failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('drinking_water', { status: 'error' })];
  }
}

// ════════════════════════════════════════════════════════════
// environmental_hazards — EPA ECHO facilities within 1 mile
// ════════════════════════════════════════════════════════════
const ECHO_URL = 'https://echodata.epa.gov/echo/echo_rest_services.get_facilities';
const ECHO_PROGRAM_FLAGS = [
  ['CWAFlag', 'Clean Water Act'],
  ['CAAFlag', 'Clean Air Act'],
  ['RCRAFlag', 'Hazardous waste (RCRA)'],
  ['SDWISFlag', 'Safe Drinking Water Act'],
];

function haversineMiles(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function echoResults(data) {
  const results = data && data.Results;
  if (!results || results.Error) {
    throw new Error((results && results.Error && results.Error.ErrorMessage) || 'ECHO error');
  }
  return results;
}

function mapEchoFacilities(rows, lat, lng) {
  return (rows || []).slice(0, 5).map((f) => {
    const programs = ECHO_PROGRAM_FLAGS.filter(([flag]) => String(f[flag] || '') === 'Y').map(([, label]) => label);
    const fLat = Number(f.FacLat);
    const fLng = Number(f.FacLong);
    return {
      name: String(f.FacName || 'Regulated facility'),
      program: programs[0] || 'EPA-regulated',
      distance_mi: Number.isFinite(fLat) && Number.isFinite(fLng)
        ? Math.round(haversineMiles(lat, lng, fLat, fLng) * 10) / 10
        : 1,
    };
  });
}

// Two-step ECHO flow: get_facilities answers the COUNT + a QueryID;
// the facility ROWS come from get_qid against that query. ECHO's edge
// is flaky (some requests land on throttling nodes), so a count>0 with
// no resolvable rows THROWS rather than caching a half-payload — the
// envelope serves stale/error and a later request completes the pair.
async function fetchEchoFacilities(lat, lng) {
  const search = echoResults(await fetchJson(
    `${ECHO_URL}?output=JSON&p_lat=${lat}&p_long=${lng}&p_radius=1&responseset=20`,
  ));
  const count = Number(search.QueryRows) || 0;

  let rows = Array.isArray(search.Facilities) ? search.Facilities : [];
  if (count > 0 && rows.length === 0 && search.QueryID) {
    const page = echoResults(await fetchJson(
      `https://echodata.epa.gov/echo/echo_rest_services.get_qid?output=JSON&qid=${encodeURIComponent(search.QueryID)}&pageno=1`,
    ));
    rows = Array.isArray(page.Facilities) ? page.Facilities : [];
  }
  if (count > 0 && rows.length === 0) {
    throw new Error('ECHO returned a count but no facility rows');
  }

  const facilities = mapEchoFacilities(rows, lat, lng);
  return {
    facilities_within_mile: count,
    radius_mi: 1,
    facilities,
    summary: count === 0
      ? 'No EPA-regulated facilities within a mile.'
      : `${count} EPA-regulated facilit${count === 1 ? 'y' : 'ies'} within a mile — regulated activity nearby, not unsafe exposure.`,
    disclaimer: 'Presence on EPA registries means regulated activity, not contamination or danger.',
  };
}

async function composeEnvironmentalHazards(home) {
  const ll = homeLatLng(home);
  if (!ll) return [serializePlaceSection('environmental_hazards', { status: 'unavailable' })];
  try {
    const gh6 = encodeGeohash(ll.lat, ll.lng, 6);
    const { payload, fetchedAt, stale } = await readThrough({
      cacheKey: `geo:${gh6}`,
      sectionId: 'environmental_hazards',
      ttlMs: 90 * DAY_MS,
      fetch: () => fetchEchoFacilities(ll.lat, ll.lng),
    });
    if (!payload) return [serializePlaceSection('environmental_hazards', { status: 'unavailable' })];
    return [serializePlaceSection('environmental_hazards', {
      asOf: fetchedAt,
      status: stale ? 'stale' : 'ready',
      data: payload,
    })];
  } catch (err) {
    logger.warn('placeSections: environmental_hazards failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('environmental_hazards', { status: 'error' })];
  }
}

// ════════════════════════════════════════════════════════════
// civic_districts — Census geocoder, layers=all (keyless)
// ════════════════════════════════════════════════════════════
// The geocoder returns every elected geography for a point. The
// contract's `representatives` arrives via a companion source later
// (§11.4) and ships empty here — the client renders districts alone.

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// Geography-key prefixes vary by vintage ("119th Congressional
// Districts", "2024 State Legislative Districts - Upper") — match by
// suffix pattern, not exact key. Returns the display list PLUS the raw
// district codes the representative lookups key on.
function districtsFromGeographies(geo) {
  const find = (re) => {
    const key = Object.keys(geo).find((k) => re.test(k));
    const rows = key && geo[key];
    return rows && rows.length ? rows[0] : null;
  };

  const out = [];
  const codes = { cd: null, sldu: null, sldl: null };
  const state = find(/^States$/);
  const stateName = (state && state.NAME) || null;

  const cd = find(/Congressional Districts$/);
  if (cd && cd.NAME) {
    const num = Number(String(cd.BASENAME || '').replace(/\D/g, ''));
    const atLarge = !Number.isFinite(num) || num === 0 || num >= 98;
    codes.cd = atLarge ? 0 : num;
    out.push({
      level: 'federal',
      office_label: 'U.S. House',
      name: stateName
        ? (atLarge ? `${stateName} At-Large District` : `${stateName}'s ${ordinal(num)} District`)
        : cd.NAME,
    });
  }
  const sldu = find(/State Legislative Districts - Upper/);
  if (sldu && sldu.NAME) {
    codes.sldu = String(sldu.BASENAME || '').trim() || null;
    out.push({ level: 'state', office_label: 'State Senate', name: sldu.NAME });
  }
  const sldl = find(/State Legislative Districts - Lower/);
  if (sldl && sldl.NAME) {
    codes.sldl = String(sldl.BASENAME || '').trim() || null;
    out.push({ level: 'state', office_label: 'State House', name: sldl.NAME });
  }
  const county = find(/^Counties$/);
  if (county && county.NAME) out.push({ level: 'county', office_label: 'County', name: county.NAME });
  const place = find(/^Incorporated Places$/);
  if (place && place.NAME) {
    out.push({ level: 'city', office_label: 'City', name: place.NAME.replace(/\s+(city|town|village|borough)$/i, '') });
  }
  const school = find(/Unified School Districts$/);
  if (school && school.NAME) out.push({ level: 'school', office_label: 'School district', name: school.NAME });

  return { districts: out, codes };
}

// ── Representative lookups (both keyless) ────────────────────
// Federal: the canonical unitedstates/congress-legislators dataset —
// reduced to a per-state index before caching (the raw file is 1.4 MB;
// the index is a few hundred KB across all states). 7-day budget.
async function fetchCongressIndex() {
  const { payload } = await readThrough({
    cacheKey: 'us:congress',
    sectionId: '_congress_legislators',
    ttlMs: 7 * DAY_MS,
    fetch: async () => {
      const members = await fetchJson(
        'https://unitedstates.github.io/congress-legislators/legislators-current.json',
      );
      if (!Array.isArray(members) || !members.length) return null;
      const byState = {};
      for (const m of members) {
        const t = m.terms && m.terms[m.terms.length - 1];
        if (!t || !t.state) continue;
        const entry = {
          name: (m.name && (m.name.official_full || `${m.name.first} ${m.name.last}`)) || 'Member of Congress',
          party: t.party || null,
          phone: t.phone || null,
          website: t.url || null,
        };
        const s = (byState[t.state] = byState[t.state] || { sens: [], reps: {} });
        if (t.type === 'sen') s.sens.push(entry);
        else if (t.type === 'rep') s.reps[String(t.district ?? 0)] = entry;
      }
      return byState;
    },
  });
  return payload || null;
}

// State: OpenStates' published "current people" CSVs (keyless; the API
// itself is key-gated). Minimal RFC-4180 parse — fields are quoted and
// may contain commas/newlines.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchStateLegislators(stateAbbr) {
  const st = String(stateAbbr || '').toLowerCase();
  if (!/^[a-z]{2}$/.test(st)) return null;
  const { payload } = await readThrough({
    cacheKey: `state:${st}`,
    sectionId: '_state_legislators',
    ttlMs: 7 * DAY_MS,
    fetch: async () => {
      const res = await fetch(`https://data.openstates.org/people/current/${st}.csv`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = parseCsv(await res.text());
      if (rows.length < 2) return null;
      const header = rows[0];
      const col = (name) => header.indexOf(name);
      const [iName, iParty, iDistrict, iChamber, iEmail, iVoice, iLinks] = [
        col('name'), col('current_party'), col('current_district'), col('current_chamber'),
        col('email'), col('capitol_voice'), col('links'),
      ];
      const people = rows.slice(1).map((r) => ({
        name: r[iName] || '',
        party: r[iParty] || null,
        district: String(r[iDistrict] || '').trim(),
        chamber: r[iChamber] || '',
        email: r[iEmail] || null,
        phone: r[iVoice] || null,
        website: (r[iLinks] || '').split(';')[0] || null,
      })).filter((p) => p.name && p.district);
      return { people };
    },
  });
  return (payload && payload.people) || null;
}

// Trim leading zeros so the geocoder's "017" matches OpenStates' "17".
function districtEq(a, b) {
  const norm = (v) => String(v || '').trim().replace(/^0+(?=\d)/, '').toLowerCase();
  return norm(a) !== '' && norm(a) === norm(b);
}

async function lookupRepresentatives(stateAbbr, codes) {
  const reps = [];
  // Federal — never let one source's failure hide the other's results.
  try {
    const congress = await fetchCongressIndex();
    const st = congress && congress[String(stateAbbr || '').toUpperCase()];
    if (st) {
      const house = codes.cd != null ? st.reps[String(codes.cd)] : null;
      if (house) reps.push({ ...house, office: 'U.S. Representative', level: 'federal', email: null });
      for (const sen of st.sens) reps.push({ ...sen, office: 'U.S. Senator', level: 'federal', email: null });
    }
  } catch (err) {
    logger.warn('placeSections: congress lookup failed', { error: err.message });
  }
  try {
    if (codes.sldu || codes.sldl) {
      const people = await fetchStateLegislators(stateAbbr);
      for (const p of people || []) {
        if (p.chamber === 'upper' && districtEq(p.district, codes.sldu)) {
          reps.push({ name: p.name, party: p.party, phone: p.phone, email: p.email, website: p.website, office: 'State Senator', level: 'state' });
        } else if (p.chamber === 'lower' && districtEq(p.district, codes.sldl)) {
          reps.push({ name: p.name, party: p.party, phone: p.phone, email: p.email, website: p.website, office: 'State Representative', level: 'state' });
        }
      }
    }
  } catch (err) {
    logger.warn('placeSections: state legislators lookup failed', { stateAbbr, error: err.message });
  }
  return reps;
}

async function composeCivicDistricts(home) {
  const ll = homeLatLng(home);
  if (!ll) return [serializePlaceSection('civic_districts', { status: 'unavailable' })];
  try {
    const gh6 = encodeGeohash(ll.lat, ll.lng, 6);
    const { payload, fetchedAt, stale } = await readThrough({
      cacheKey: `geo:${gh6}`,
      sectionId: 'civic_districts',
      ttlMs: 90 * DAY_MS,
      fetch: async () => {
        const data = await fetchJson(
          'https://geocoding.geo.census.gov/geocoder/geographies/coordinates' +
          `?x=${ll.lng}&y=${ll.lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json`,
        );
        const geo = data && data.result && data.result.geographies;
        if (!geo) return null;
        const { districts, codes } = districtsFromGeographies(geo);
        if (!districts.length) return null;
        return { districts, codes };
      },
    });
    if (!payload) return [serializePlaceSection('civic_districts', { status: 'unavailable' })];

    // Names/contacts resolve OUTSIDE the 90-day district cache so a seat
    // change surfaces on the rep sources' own 7-day cadence. (Both lookups
    // are keyless and individually cached; city/county officials have no
    // national source — the list is honestly partial.) Rows cached before
    // codes existed carry their old reps until the geo cache expires.
    const representatives = payload.codes
      ? await lookupRepresentatives(home.state, payload.codes)
      : (payload.representatives || []);

    return [serializePlaceSection('civic_districts', {
      asOf: fetchedAt,
      status: stale ? 'stale' : 'ready',
      source: 'U.S. Census Bureau · unitedstates/congress-legislators · OpenStates',
      coverage: representatives.length ? 'full' : 'partial',
      data: { districts: payload.districts, representatives },
    })];
  } catch (err) {
    logger.warn('placeSections: civic_districts failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('civic_districts', { status: 'error' })];
  }
}

// ════════════════════════════════════════════════════════════
// civic_election — Google Civic Information API (key-gated)
// ════════════════════════════════════════════════════════════
// Seasonal by design: off-season (or with no key / no upcoming election
// for the home's state) the section is `unavailable` while districts
// stay ready. Enable the "Google Civic Information API" on the existing
// Google Cloud project and set GOOGLE_CIVIC_API_KEY to light this up.
const STATE_NAMES = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado',
  CT: 'connecticut', DE: 'delaware', DC: 'district of columbia', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas', KY: 'kentucky',
  LA: 'louisiana', ME: 'maine', MD: 'maryland', MA: 'massachusetts', MI: 'michigan', MN: 'minnesota',
  MS: 'mississippi', MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire',
  NJ: 'new jersey', NM: 'new mexico', NY: 'new york', NC: 'north carolina', ND: 'north dakota',
  OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode island', SC: 'south carolina',
  SD: 'south dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont', VA: 'virginia',
  WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming',
};

function electionMatchesState(election, stateAbbr) {
  const ocd = String(election.ocdDivisionId || '');
  if (ocd === 'ocd-division/country:us') return true; // national
  const name = STATE_NAMES[String(stateAbbr || '').toUpperCase()];
  return Boolean(name && ocd.includes(`state:${stateAbbr.toLowerCase()}`));
}

async function composeCivicElection(home) {
  const apiKey = process.env.GOOGLE_CIVIC_API_KEY;
  if (!apiKey) {
    return [serializePlaceSection('civic_election', {
      status: 'unavailable',
      unavailableReason: 'Election data is not configured yet.',
    })];
  }
  try {
    const { payload, fetchedAt, stale } = await readThrough({
      cacheKey: `state:${String(home.state || 'us').toLowerCase()}`,
      sectionId: 'civic_election',
      ttlMs: DAY_MS,
      fetch: async () => {
        const data = await fetchJson(
          `https://civicinfo.googleapis.com/civicinfo/v2/elections?key=${apiKey}`,
        );
        const now = Date.now();
        const upcoming = (data.elections || [])
          .filter((e) => e.id !== '2000') // Google's VIP Test Election
          .filter((e) => Date.parse(e.electionDay) >= now - DAY_MS)
          .filter((e) => electionMatchesState(e, home.state))
          .sort((a, b) => Date.parse(a.electionDay) - Date.parse(b.electionDay));
        if (!upcoming.length) return null;
        const next = upcoming[0];
        return { name: next.name, date: next.electionDay };
      },
    });
    if (!payload) {
      return [serializePlaceSection('civic_election', {
        status: 'unavailable',
        unavailableReason: 'No upcoming election on the calendar for your area.',
      })];
    }
    const daysUntil = Math.max(0, Math.ceil((Date.parse(payload.date) - Date.now()) / DAY_MS));
    return [serializePlaceSection('civic_election', {
      asOf: fetchedAt,
      status: stale ? 'stale' : 'ready',
      data: {
        name: payload.name,
        date: payload.date,
        days_until: daysUntil,
        polling_place: null, // voterInfoQuery lands with the ballot wave
        ballot: [],
      },
    })];
  } catch (err) {
    logger.warn('placeSections: civic_election failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('civic_election', { status: 'error' })];
  }
}

// ════════════════════════════════════════════════════════════
// seismic — USGS seismic design values (ASCE 7-22, keyless)
// ════════════════════════════════════════════════════════════
// Returns the point's Seismic Design Category (A lowest demand → E
// highest) straight from the USGS design-maps service — engineering
// demand for this location, not an earthquake prediction.
const SDC_PHRASES = {
  A: 'very low expected shaking demand',
  B: 'low expected shaking demand',
  C: 'moderate expected shaking demand',
  D: 'high expected shaking demand',
  E: 'very high expected shaking demand (near a major fault)',
};

async function composeSeismic(home) {
  const ll = homeLatLng(home);
  if (!ll) return [serializePlaceSection('seismic', { status: 'unavailable' })];
  try {
    const gh5 = encodeGeohash(ll.lat, ll.lng, 5);
    const { payload, fetchedAt, stale } = await readThrough({
      cacheKey: `geo:${gh5}`,
      sectionId: 'seismic',
      ttlMs: 180 * DAY_MS, // hazard model updates on a multi-year cycle
      fetch: async () => {
        const data = await fetchJson(
          'https://earthquake.usgs.gov/ws/designmaps/asce7-22.json' +
          `?latitude=${ll.lat}&longitude=${ll.lng}&riskCategory=II&siteClass=Default&title=pantopus`,
        );
        const d = data && data.response && data.response.data;
        const sdc = d && String(d.sdc || '').toUpperCase();
        if (!sdc || !SDC_PHRASES[sdc]) return null;
        return { design_category: sdc, sds: Number.isFinite(Number(d.sds)) ? Number(d.sds) : null };
      },
    });
    if (!payload) {
      return [serializePlaceSection('seismic', {
        status: 'unavailable',
        unavailableReason: 'No seismic design data for this point.',
      })];
    }
    return [serializePlaceSection('seismic', {
      asOf: fetchedAt,
      status: stale ? 'stale' : 'ready',
      data: {
        design_category: payload.design_category,
        sds: payload.sds,
        summary: `Seismic design category ${payload.design_category} — ${SDC_PHRASES[payload.design_category]}.`,
        disclaimer: 'Engineering demand for new construction at this point (ASCE 7-22) — not an earthquake forecast.',
      },
    })];
  } catch (err) {
    logger.warn('placeSections: seismic failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('seismic', { status: 'error' })];
  }
}

// ════════════════════════════════════════════════════════════
// wildfire — USFS Wildfire Hazard Potential (2023, keyless)
// ════════════════════════════════════════════════════════════
// One pixel identify against the classified WHP raster. Classes 1–5
// run very low → very high; 6 is non-burnable (developed/agriculture)
// and 7 is water — both render as "not classified as burnable".
const WHP_URL =
  'https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/USFS_EDW_RMRS_WildfireHazardPotentialClassified/ImageServer/identify';
const WHP_LABELS = { 1: 'Very low', 2: 'Low', 3: 'Moderate', 4: 'High', 5: 'Very high' };

async function composeWildfire(home) {
  const ll = homeLatLng(home);
  if (!ll) return [serializePlaceSection('wildfire', { status: 'unavailable' })];
  try {
    const gh6 = encodeGeohash(ll.lat, ll.lng, 6);
    const { payload, fetchedAt, stale } = await readThrough({
      cacheKey: `geo:${gh6}`,
      sectionId: 'wildfire',
      ttlMs: 180 * DAY_MS, // WHP is a vintage raster (2023)
      fetch: async () => {
        const geometry = JSON.stringify({ x: ll.lng, y: ll.lat, spatialReference: { wkid: 4326 } });
        const params = new URLSearchParams({
          geometry,
          geometryType: 'esriGeometryPoint',
          returnGeometry: 'false',
          f: 'json',
        });
        const data = await fetchJson(`${WHP_URL}?${params}`);
        const raw = data && data.value;
        if (raw == null || raw === 'NoData') return null;
        const cls = Number(raw);
        if (!Number.isFinite(cls)) return null;
        return { class: cls };
      },
    });
    if (!payload) {
      return [serializePlaceSection('wildfire', {
        status: 'unavailable',
        unavailableReason: 'No wildfire hazard data for this point.',
      })];
    }
    const cls = payload.class;
    const burnable = cls >= 1 && cls <= 5;
    return [serializePlaceSection('wildfire', {
      asOf: fetchedAt,
      status: stale ? 'stale' : 'ready',
      data: {
        hazard_class: burnable ? cls : null,
        hazard_label: burnable ? WHP_LABELS[cls] : 'Not classified as burnable',
        burnable,
        summary: burnable
          ? `${WHP_LABELS[cls]} wildfire hazard potential for the vegetation around this point.`
          : 'This point sits on land the USFS classes as non-burnable (developed or water) — nearby wildlands may still carry risk.',
        disclaimer: 'USFS Wildfire Hazard Potential (2023) — landscape fuel conditions, not a prediction for this home.',
      },
    })];
  } catch (err) {
    logger.warn('placeSections: wildfire failed', { homeId: home.id, error: err.message });
    return [serializePlaceSection('wildfire', { status: 'error' })];
  }
}

module.exports = {
  composeSunriseSunset,
  composeLeadRadon,
  composeRentBand,
  composeDrinkingWater,
  composeEnvironmentalHazards,
  composeCivicDistricts,
  composeCivicElection,
  composeSeismic,
  composeWildfire,
  // Exported for testing.
  parseCsv,
  districtEq,
  leadRiskForYear,
  haversineMiles,
  stripCountySuffix,
  districtsFromGeographies,
  ordinal,
};
