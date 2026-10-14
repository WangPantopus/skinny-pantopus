'use strict';

const db = require('../../config/supabaseAdmin');
const parsePoint = require('../../utils/parsePostGISPoint');
const { haversineMeters } = require('../../utils/trustState');
const { applyLocationPrecision, leastPrecise } = require('../../utils/locationPrivacy');
const { homeAreaContext, HOME_SELECT, verifiedHomeOccupancy } = require('./areas');

const MILE = 1609.344;
// The existing approximate grid is 0.005 degrees, about 556 metres north/south.
const GRID_METRES = 556;
const MIN_HOMES = 5;

function distanceBand(metres) {
  const miles = metres / MILE;
  const step = miles < 1 ? 0.1 : miles < 10 ? 0.5 : 1;
  const rounded = Math.round(miles / step) * step;
  // At 1 and 10 miles the same text can come from either rounding interval.
  const low = rounded === 1 ? 0.95 : rounded === 10 ? 9.75 : rounded - step / 2;
  const high = rounded + (rounded === 1 ? 0.25 : rounded === 10 ? 0.5 : step / 2);
  return { text: `${Number(rounded.toFixed(1))} mi`, low: Math.max(0, low) * MILE, high: high * MILE };
}

function validPoint(point) {
  return point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

/** Raw Post row only: always apply the same privacy floor, including to the author.
 * Never snap an already enriched row twice. No coordinate leaves this module.
 */
function displayedPoint(post) {
  const point = post.latitude != null && post.longitude != null
    ? { latitude: post.latitude, longitude: post.longitude }
    : { latitude: post.effective_latitude, longitude: post.effective_longitude };
  if (!validPoint(point)) return null;
  applyLocationPrecision(point, leastPrecise(post.location_precision || 'approx_area', 'approx_area'));
  return validPoint(point) ? point : null;
}

/** One request's distance formatter. Home verification and density are never cached
 * across requests: an ended occupancy or a primary-home change takes effect at once.
 * A density lookup is bounded and conservative: if it cannot establish five distinct
 * verified homes, even after truncation, it returns only "nearby".
 */
async function distanceFormatter(viewerId, { publicResponse = false, homes } = {}) {
  if (!viewerId || publicResponse) return async () => null;
  const context = homes || await homeAreaContext(viewerId);
  const home = context.primary?.verified ? context.primary : context.homes.find(candidate => candidate.verified);
  if (!home) return async () => null;
  const { data, error } = await db.from('Home').select('location').eq('id', home.id).maybeSingle();
  if (error) throw error;
  const reader = parsePoint(data?.location);
  if (!validPoint(reader)) return async () => null;
  const bands = new Map();

  async function enoughHomes(band) {
    const { data: occupancies, error: densityError } = await db.rpc('pulse_distance_band_occupancies', {
      p_reader_home: home.id, p_low_m: band.low, p_high_m: band.high,
    }).select(HOME_SELECT).eq('is_active', true).eq('verification_status', 'verified').limit(1000);
    if (densityError) throw densityError;
    return new Set((occupancies || []).filter(verifiedHomeOccupancy).map(row => row.home_id)).size >= MIN_HOMES;
  }

  return async post => {
    const point = displayedPoint(post);
    if (!point) return null;
    const metres = haversineMeters(reader.latitude, reader.longitude, point.latitude, point.longitude);
    if (!Number.isFinite(metres)) return null;
    if (metres < GRID_METRES) return 'nearby';
    const band = distanceBand(metres);
    if (!bands.has(band.text)) bands.set(band.text, enoughHomes(band));
    return await bands.get(band.text) ? band.text : 'nearby';
  };
}

module.exports = { distanceFormatter };
