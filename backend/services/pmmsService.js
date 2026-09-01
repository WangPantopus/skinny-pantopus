/**
 * Freddie Mac PMMS (Wave 2b — Home Record Watch's free half)
 *
 * The weekly Primary Mortgage Market Survey 30-year average, from
 * Freddie Mac's own keyless history CSV (weekly rows since April
 * 1971, ~97 KB — probed live 2026-08-25, current through the latest
 * Thursday). Parsed once into:
 *   * monthly averages ("what did 30-year loans average the month
 *     yours was recorded") — historical facts that never change;
 *   * the latest weekly reading ("what they average now").
 *
 * Cached 3 days in PlaceSectionCache (the survey updates weekly), with
 * the standard stale-serve on fetch failure.
 */

const logger = require('../utils/logger');
const { readThrough } = require('./placeSectionCache');

const PMMS_URL = 'https://www.freddiemac.com/pmms/docs/PMMS_history.csv';
const SECTION_ID = '_pmms30';
const TTL_MS = 3 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20000;

/**
 * CSV → { monthly: { 'YYYY-MM': avg }, latest: { date, rate } }.
 * Pure, exported for tests. Rows are `M/D/YYYY,rate30,...`; blank or
 * unparsable rate cells are skipped.
 */
function parsePmmsCsv(csv) {
  const monthly = {};
  const counts = {};
  let latest = null;
  for (const line of String(csv).split('\n').slice(1)) {
    const [dateRaw, rateRaw] = line.split(',');
    if (!dateRaw || !rateRaw) continue;
    const rate = Number(rateRaw);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    const m = dateRaw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) continue;
    const [, month, day, year] = m;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    monthly[key] = (monthly[key] || 0) + rate;
    counts[key] = (counts[key] || 0) + 1;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!latest || iso > latest.date) latest = { date: iso, rate };
  }
  for (const key of Object.keys(monthly)) {
    monthly[key] = Math.round((monthly[key] / counts[key]) * 100) / 100;
  }
  return { monthly, latest };
}

async function fetchPmms() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(PMMS_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`PMMS HTTP ${res.status}`);
    const parsed = parsePmmsCsv(await res.text());
    if (!parsed.latest || Object.keys(parsed.monthly).length < 100) {
      // A truncated/reshaped file must not overwrite a good cache.
      throw new Error('PMMS: parsed history implausibly small');
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The parsed PMMS history (cached).
 * @returns {Promise<{ monthly: Record<string, number>, latest: { date: string, rate: number }, stale: boolean } | null>}
 */
async function getPmmsHistory() {
  try {
    const { payload, stale } = await readThrough({
      cacheKey: 'us',
      sectionId: SECTION_ID,
      ttlMs: TTL_MS,
      fetch: fetchPmms,
    });
    if (!payload || !payload.latest) return null;
    return { monthly: payload.monthly || {}, latest: payload.latest, stale: Boolean(stale) };
  } catch (err) {
    logger.warn('pmms: history unavailable', { error: err.message });
    return null;
  }
}

module.exports = {
  getPmmsHistory,
  // Exported for testing.
  parsePmmsCsv,
};
