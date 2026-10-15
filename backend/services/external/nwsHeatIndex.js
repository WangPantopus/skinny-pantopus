// ============================================================
// NWS heat index forecast — heat where HeatRisk has no reading
//
// NWS HeatRisk (services/external/heatRisk.js) covers the contiguous US
// only. Alaska, Hawaii and the territories still have NWS gridpoint
// forecasts with a heat index, so there the heat half of the Heat & cold
// card reads NWS's own heat index classes (weather.gov/ama/heatindex):
//
//   Caution          80–90°F   fatigue possible
//   Extreme caution  90–103°F  heat stroke, cramps or exhaustion possible
//   Danger           103–124°F cramps or exhaustion likely, stroke possible
//   Extreme danger   125°F+    heat stroke highly likely
//
// The same forecast covers for HeatRisk when that service is down.
// ============================================================

const logger = require('../../utils/logger');

const FETCH_TIMEOUT_MS = 8000;
// NWS refuses requests without a contact User-Agent.
const USER_AGENT = '(Pantopus, admin@pantopus.app)';

const HEAT_INDEX_CLASSES = [
  { min: 125, label: 'Extreme danger', meaning: 'Heat stroke is highly likely.' },
  { min: 103, label: 'Danger', meaning: 'Heat cramps or heat exhaustion are likely, and heat stroke is possible with prolonged exposure or activity.' },
  { min: 90, label: 'Extreme caution', meaning: 'Heat stroke, heat cramps or heat exhaustion are possible with prolonged exposure or activity.' },
  { min: 80, label: 'Caution', meaning: 'Fatigue is possible with prolonged exposure or activity.' },
];

/** NWS's class for a heat index in °F, or null below 80°F. */
function heatIndexClass(f) {
  return HEAT_INDEX_CLASSES.find((c) => f >= c.min) || null;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function localDate(ms, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
}

/**
 * The highest forecast heat index on each of the next 7 local days.
 *
 * @returns {Promise<{days: Array<{date: string, max_f: number}>}|null>}
 *   `days` is empty when NWS forecasts no heat index at all (it leaves the
 *   value null in cold weather). Null means NWS could not be reached.
 */
async function fetchHeatIndexDays(latitude, longitude, { now = Date.now() } = {}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    const point = await fetchJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`);
    const gridUrl = point && point.properties && point.properties.forecastGridData;
    const timeZone = point && point.properties && point.properties.timeZone;
    if (!gridUrl || !timeZone) return null;

    const grid = await fetchJson(gridUrl);
    const values = grid && grid.properties && grid.properties.heatIndex && grid.properties.heatIndex.values;
    if (!Array.isArray(values)) return null;

    // Each value covers "start/duration"; its start's local date is the day.
    const today = localDate(now, timeZone);
    const byDate = new Map();
    for (const v of values) {
      if (!v || typeof v.value !== 'number' || !Number.isFinite(v.value)) continue;
      const startMs = Date.parse(String(v.validTime || '').split('/')[0]);
      if (!Number.isFinite(startMs)) continue;
      const date = localDate(startMs, timeZone);
      if (date < today) continue;
      const f = (v.value * 9) / 5 + 32;
      byDate.set(date, Math.max(byDate.has(date) ? byDate.get(date) : -Infinity, f));
    }
    const days = [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(0, 7)
      .map(([date, f]) => ({ date, max_f: Math.round(f) }));
    return { days };
  } catch (err) {
    logger.warn('nwsHeatIndex: fetch failed', { error: err.message });
    return null;
  }
}

module.exports = { fetchHeatIndexDays, heatIndexClass, HEAT_INDEX_CLASSES };
