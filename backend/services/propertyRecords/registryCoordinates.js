'use strict';

/**
 * Google's terms keep its coordinates for 30 days, then delete (cost-and-rights.md,
 * section 6). This replaces older ones with Pantopus's own: the registry's point
 * for the address, on HomeAddress and on the Homes that copied it. The pin barely
 * moves, and nothing about the address itself changes.
 *
 * ADDRESS_REGISTRY_COORDINATES turns it on (config/addressRegistry.js), and a state
 * has to be live. Where the registry has no point, or only for the building when a
 * unit was asked for, the rule below decides; the counts in the log say how many
 * stayed, and why. A person's own pin (user_asserted) is theirs and stays.
 */

const logger = require('../../utils/logger');
const supabaseAdmin = require('../../config/supabaseAdmin');
const config = require('../../config/addressRegistry');
const registry = require('./registry');

const REGISTRY_PROVIDER = 'pantopus_registry';
const GOOGLE_DAYS = 30;
// Further apart than this and one of the two is wrong: leave it for someone to look at rather than move a pin across town.
const MAX_MOVE_METERS = 5000;
// A building's or address's point serves its units: they are one place on a map.
const USABLE = new Set(['exact', 'building_only']);

function meters(lat1, lng1, lat2, lng2) {
  const scale = Math.cos((lat1 * Math.PI) / 180);
  const dx = (lng1 - lng2) * scale * 111320;
  const dy = (lat1 - lat2) * 110540;
  return Math.sqrt(dx * dx + dy * dy);
}

/** The registry's point for an address, and what it says about it. Null with the reason why not. */
async function pointFor(address, serves) {
  let answer;
  try {
    answer = await registry.lookup(address, { serves });
  } catch (err) {
    return { why: 'storage' };
  }
  if (!USABLE.has(answer.match)) return { why: answer.match };
  const point = answer.record?.point;
  if (!point) return { why: 'no_point' };
  return {
    point: { lat: point[1], lng: point[0] },
    id: answer.subject?.id || null,
    release: answer.release || null,
    accuracy: answer.record.q || 'unknown',
  };
}

function registryFields(found, now) {
  return {
    geocode_provider: REGISTRY_PROVIDER,
    geocode_mode: 'verified',
    geocode_accuracy: found.accuracy,
    geocode_source_flow: 'registry_coordinates',
    geocode_created_at: now,
  };
}

async function replaceOnAddresses({ cutoff, limit, serves, apply, counts }) {
  const { data: rows, error } = await supabaseAdmin
    .from('HomeAddress')
    .select('id, address_line1_norm, address_line2_norm, city_norm, state, postal_code, geocode_lat, geocode_lng, geocode_provider, last_validated_at, provider_versions')
    .not('geocode_lat', 'is', null)
    .or(`geocode_provider.is.null,geocode_provider.neq.${REGISTRY_PROVIDER}`)
    .or(`last_validated_at.is.null,last_validated_at.lt.${cutoff}`)
    .lt('geocode_created_at', cutoff)
    .limit(limit);
  if (error) throw new Error(error.message);
  for (const row of rows || []) {
    counts.addresses += 1;
    const found = await pointFor({ line1: row.address_line1_norm, unit: row.address_line2_norm, city: row.city_norm, state: row.state, zip: row.postal_code }, serves);
    if (!found.point) {
      counts[`stayed_${found.why}`] = (counts[`stayed_${found.why}`] || 0) + 1;
      continue;
    }
    if (meters(row.geocode_lat, row.geocode_lng, found.point.lat, found.point.lng) > MAX_MOVE_METERS) {
      counts.stayed_far = (counts.stayed_far || 0) + 1;
      continue;
    }
    counts.addresses_replaced += 1;
    if (!apply) continue;
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin.from('HomeAddress').update({
      geocode_lat: found.point.lat,
      geocode_lng: found.point.lng,
      ...registryFields(found, now),
      provider_versions: { ...(row.provider_versions || {}), address_registry: { id: found.id, release: found.release } },
      updated_at: now,
    }).eq('id', row.id);
    if (updateError) {
      counts.failed += 1;
      logger.warn('registryCoordinates: address update failed', { error: updateError.message });
    }
  }
}

async function replaceOnHomes({ cutoff, limit, serves, apply, counts }) {
  const { data: rows, error } = await supabaseAdmin
    .from('Home')
    .select('id, address, address2, city, state, zipcode, map_center_lat, map_center_lng')
    .eq('geocode_provider', 'google_validation')
    .lt('geocode_created_at', cutoff)
    .limit(limit);
  if (error) throw new Error(error.message);
  for (const row of rows || []) {
    counts.homes += 1;
    const found = await pointFor({ line1: row.address, unit: row.address2, city: row.city, state: row.state, zip: row.zipcode }, serves);
    if (!found.point) {
      counts[`stayed_${found.why}`] = (counts[`stayed_${found.why}`] || 0) + 1;
      continue;
    }
    if (Number.isFinite(row.map_center_lat) && meters(row.map_center_lat, row.map_center_lng, found.point.lat, found.point.lng) > MAX_MOVE_METERS) {
      counts.stayed_far = (counts.stayed_far || 0) + 1;
      continue;
    }
    counts.homes_replaced += 1;
    if (!apply) continue;
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin.from('Home').update({
      location: `POINT(${found.point.lng} ${found.point.lat})`,
      map_center_lat: found.point.lat,
      map_center_lng: found.point.lng,
      ...registryFields(found, now),
      updated_at: now,
    }).eq('id', row.id);
    if (updateError) {
      counts.failed += 1;
      logger.warn('registryCoordinates: home update failed', { error: updateError.message });
    }
  }
}

/**
 * One pass. Off unless the switch says otherwise.
 * @param {object} [options] { limit: rows per table per pass }
 * @returns {Promise<object>} Counts only.
 */
async function replaceExpiredCoordinates({ limit = 500 } = {}) {
  const mode = config.coordinatesMode();
  if (mode === 'off') return { mode };
  const apply = mode === 'on';
  // In shadow, count for states being watched as well.
  const serves = (state) => (apply ? config.modeFor(state) === 'live' : config.modeFor(state) !== 'off');
  const cutoff = new Date(Date.now() - GOOGLE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const counts = { mode, addresses: 0, addresses_replaced: 0, homes: 0, homes_replaced: 0, failed: 0 };
  await replaceOnAddresses({ cutoff, limit, serves, apply, counts });
  await replaceOnHomes({ cutoff, limit, serves, apply, counts });
  return counts;
}

module.exports = { replaceExpiredCoordinates, REGISTRY_PROVIDER };
