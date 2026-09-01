// ============================================================
// NWS HeatRisk — the national 7-day heat-impact forecast
//
// HeatRisk is a 0–4 index (Little to None → Extreme) covering CONUS on a
// ~2.5 km grid, published daily by NWS. It is the national, data-driven
// replacement for `services/ai/seasonalEngine.js`, which is hard-gated to
// two 30 km circles around Vancouver WA and Portland OR and returns
// all-nulls everywhere else.
//
// Served from an ArcGIS ImageServer, so no raster pipeline is needed:
//
//   /query       → the raster catalog (7 daily rasters, one per day out)
//   /getSamples  → all 7 values at one point, in a SINGLE request
//
// Two quirks the implementation has to respect:
//
//   1. `idp_validtime` is NOT reliable for ordering — as observed,
//      HeatRisk_2 and HeatRisk_3 both reported the same valid date. The
//      `name` field (`HeatRisk_<N>_Mercator`) is the authoritative day
//      index, so dates are derived as day-1's date + (N-1).
//
//   2. Coverage is CONUS only. Alaska, Hawaii and the territories return
//      NoData, which must surface as an honest coverage gap rather than
//      a fabricated "Little to None".
//
// The service is branded experimental by NWS; the section labels it as
// such rather than presenting it as an operational product.
// ============================================================

const logger = require('../../utils/logger');

const BASE =
  'https://mapservices.weather.noaa.gov/experimental/rest/services/NWS_HeatRisk/ImageServer';
const FETCH_TIMEOUT_MS = 8000;

// NWS HeatRisk levels. Labels and meanings are the published scale.
const HEAT_RISK_LEVELS = {
  0: { label: 'Little to none', meaning: 'Little to no risk from expected heat.' },
  1: { label: 'Minor', meaning: 'Affects primarily those extremely sensitive to heat.' },
  2: { label: 'Moderate', meaning: 'Affects most people sensitive to heat, especially without effective cooling or hydration.' },
  3: { label: 'Major', meaning: 'Affects anyone without effective cooling or adequate hydration. Impacts likely in health systems and heat-sensitive industries.' },
  4: { label: 'Extreme', meaning: 'Rare and long-duration heat with little to no overnight relief. Affects anyone without effective cooling or adequate hydration.' },
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** `HeatRisk_3_Mercator` → 3. Null when the name is not the expected shape. */
function dayIndexFromName(name) {
  const m = /^HeatRisk_(\d+)_/i.exec(String(name || ''));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}

function toIsoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The raster catalog: rasterId → day index.
 *
 * Identical for every location, so callers cache it once globally rather
 * than per address. Returns null when the catalog cannot be read.
 */
async function fetchCatalog() {
  const url =
    `${BASE}/query?where=1%3D1&outFields=objectid%2Cname%2Cidp_validtime` +
    '&returnGeometry=false&f=json';
  const data = await fetchJson(url);
  const features = (data && data.features) || [];
  if (features.length === 0) return null;

  const byRasterId = {};
  let day1ValidMs = null;

  for (const f of features) {
    const a = (f && f.attributes) || {};
    const day = dayIndexFromName(a.name);
    if (day === null || a.objectid == null) continue;
    byRasterId[String(a.objectid)] = day;
    if (day === 1 && Number.isFinite(a.idp_validtime)) day1ValidMs = a.idp_validtime;
  }

  if (Object.keys(byRasterId).length === 0) return null;
  return { byRasterId, day1ValidMs };
}

/**
 * HeatRisk levels for the next 7 days at a point.
 *
 * @returns {Promise<{days: Array<{date: string, day: number, level: number,
 *   label: string, meaning: string}>, covered: boolean}|null>}
 *   `covered: false` means the point is outside CONUS (NoData) — a real
 *   coverage gap, not a zero reading. Null means the service failed.
 */
async function fetchHeatRisk(latitude, longitude, { catalog } = {}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  try {
    const cat = catalog || (await fetchCatalog());
    if (!cat) return null;

    const geometry = encodeURIComponent(
      JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    );
    const url =
      `${BASE}/getSamples?geometry=${geometry}&geometryType=esriGeometryPoint` +
      '&returnFirstValueOnly=false&f=json';
    const data = await fetchJson(url);
    const samples = (data && data.samples) || [];

    // Outside CONUS the service returns no samples (or non-numeric values)
    // rather than an error — that is a coverage gap, not a zero reading.
    if (samples.length === 0) return { days: [], covered: false };

    // Anchor on day 1's valid time. Falling back to Date.now() shifted every
    // derived date by a day for US evenings (UTC is already tomorrow), so a
    // catalog without a usable day-1 timestamp reports no coverage instead
    // of confidently wrong dates.
    if (!Number.isFinite(cat.day1ValidMs)) return { days: [], covered: false };
    const day1Ms = cat.day1ValidMs;
    const days = [];

    for (const s of samples) {
      const day = cat.byRasterId[String(s.rasterId)];
      if (!day) continue;
      const raw = Number(s.value);
      // Reject rather than clamp. ArcGIS can report NoData as a numeric
      // sentinel (-9999, float max); clamping turned those into a
      // confident level 0 or 4 with covered:true, which is exactly the
      // "reading of zero" this module promises never to emit.
      if (!Number.isFinite(raw) || raw < -0.5 || raw > 4.5) continue;
      const level = Math.max(0, Math.min(4, Math.round(raw)));
      const meta = HEAT_RISK_LEVELS[level];
      days.push({
        // `idp_validtime` disagrees with itself across rasters, so dates
        // are derived from day 1 plus the authoritative name index.
        date: toIsoDate(day1Ms + (day - 1) * 24 * 60 * 60 * 1000),
        day,
        level,
        label: meta.label,
        meaning: meta.meaning,
      });
    }

    if (days.length === 0) return { days: [], covered: false };
    days.sort((a, b) => a.day - b.day);
    return { days, covered: true };
  } catch (err) {
    logger.warn('heatRisk: fetch failed', { lat, lng, error: err.message });
    return null;
  }
}

module.exports = { fetchHeatRisk, fetchCatalog, dayIndexFromName, HEAT_RISK_LEVELS, BASE };
