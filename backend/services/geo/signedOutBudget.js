/**
 * The hourly Mapbox budget for signed-out address lookups, everyone together.
 *
 * Signed-out callers are limited per network (middleware/rateLimiter.js), but
 * that can't stop someone rotating addresses or an app bug looping on many
 * phones at once. This caps what the signed-out funnel (typeahead and the
 * address preview) can spend on Mapbox in an hour, whatever the cause: 300
 * calls an hour stays near Mapbox's free tier, and a month pinned at the cap
 * costs about $90 beyond it.
 *
 *   GEO_ANON_HOURLY_CALLS=300   Mapbox calls signed-out lookups may make in an hour
 *   GEO_ANON_LOOKUPS=off        refuses every signed-out lookup that would call Mapbox
 *
 * Signed-in people are not counted: their own limits apply, and an attack on
 * the signed-out funnel must not lock members out. Raise the hourly number
 * before a planned push (a postcard drop, a post in a local group).
 *
 * The count lives in this process (production runs one API process), so a
 * restart starts a fresh hour: a deploy adds at most one hour's budget.
 */
const logger = require('../../utils/logger');

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_HOURLY_CALLS = 300;

let windowStart = 0;
let used = 0;
let warnedHalf = false;
let warnedFull = false;

function positiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function lookupsOff() {
  return String(process.env.GEO_ANON_LOOKUPS || '').trim().toLowerCase() === 'off';
}

function hourlyLimit() {
  return positiveInt(process.env.GEO_ANON_HOURLY_CALLS, DEFAULT_HOURLY_CALLS);
}

/**
 * Spend one Mapbox call for a signed-out lookup. False when signed-out lookups
 * are off or this hour's budget is gone; the caller answers GEO_BUSY.
 */
function take(now = Date.now()) {
  if (lookupsOff()) return false;
  if (now - windowStart >= HOUR_MS) {
    windowStart = now;
    used = 0;
    warnedHalf = false;
    warnedFull = false;
  }
  const limit = hourlyLimit();
  if (used >= limit) {
    if (!warnedFull) {
      warnedFull = true;
      logger.warn('geo_signed_out_budget_exhausted', { limit });
    }
    return false;
  }
  used += 1;
  if (!warnedHalf && used >= Math.ceil(limit / 2)) {
    warnedHalf = true;
    logger.warn('geo_signed_out_budget_half_used', { used, limit });
  }
  return true;
}

/** Seconds until signed-out lookups can call Mapbox again, for Retry-After. */
function retryAfterSeconds(now = Date.now()) {
  if (lookupsOff()) return HOUR_MS / 1000;
  return Math.max(1, Math.ceil((windowStart + HOUR_MS - now) / 1000));
}

/**
 * Answer a lookup the budget refused: 429 with GEO_BUSY, so no client
 * retries it on its own (they retry 5xx), and the sentence the screen shows.
 */
function refuse(res, message) {
  res.set('Retry-After', String(retryAfterSeconds()));
  return res.status(429).json({ error: 'GEO_BUSY', message });
}

module.exports = { take, retryAfterSeconds, refuse };
