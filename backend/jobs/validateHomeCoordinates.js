// ============================================================
// JOB: Validate Home Coordinates via Reverse-Geocode
//
// Finds recently-created homes that haven't been coordinate-validated
// and reverse-geocodes their lat/lng using Mapbox.
// Flags homes whose reverse-geocoded address doesn't match the
// stored address (potential misplaced pin or spoofed coordinates).
//
// Runs every 30 minutes.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const { GEO_SERVER_TOKEN: MAPBOX_ACCESS_TOKEN } = require('../config/geo');

// Rate limit: 10 requests per second (100ms between requests)
const MAPBOX_DELAY_MS = 100;

/**
 * Reverse-geocode a lat/lng via Mapbox.
 * Returns { city, state, postcode, country_code } or null on failure.
 */
async function reverseGeocode(lat, lng) {
  if (!MAPBOX_ACCESS_TOKEN) {
    logger.warn('[validateCoords] Missing MAPBOX_ACCESS_TOKEN');
    return null;
  }

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?access_token=${encodeURIComponent(MAPBOX_ACCESS_TOKEN)}` +
    `&types=address,place,region,postcode&limit=1`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    logger.warn('[validateCoords] Mapbox reverse geocode error', { status: res.status, lat, lng });
    return null;
  }

  const data = await res.json();
  const feature = (data.features || [])[0];
  if (!feature) return null;

  const context = feature.context || [];
  const findContext = (prefix) => {
    const entry = context.find(c => (c.id || '').startsWith(prefix));
    return entry?.text || null;
  };

  return {
    city: findContext('place'),
    state: findContext('region'),
    postcode: findContext('postcode'),
    country_code: findContext('country')?.toLowerCase() || null,
    display_name: feature.place_name || null,
  };
}

/**
 * Simple string similarity check: does the reverse-geocoded location
 * match the stored address's city + state?
 */
function doesLocationMatch(home, reverseResult) {
  if (!reverseResult) return { match: false, reason: 'reverse_geocode_failed' };

  const homeCity = (home.city || '').trim().toLowerCase();
  const homeState = (home.state || '').trim().toLowerCase();

  const revCity = (reverseResult.city || '').trim().toLowerCase();
  const revState = (reverseResult.state || '').trim().toLowerCase();

  // State must match (or be a 2-letter abbreviation match)
  const stateMatch = revState === homeState
    || revState.startsWith(homeState)
    || homeState.startsWith(revState);

  if (!stateMatch) {
    return { match: false, reason: 'state_mismatch', expected: homeState, got: revState };
  }

  // City: fuzzy match — one must contain the other
  const cityMatch = revCity === homeCity
    || revCity.includes(homeCity)
    || homeCity.includes(revCity);

  if (!cityMatch) {
    return { match: false, reason: 'city_mismatch', expected: homeCity, got: revCity };
  }

  return { match: true };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function validateHomeCoordinates() {
  // Find homes created in the last 7 days that haven't been validated yet
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: homes, error } = await supabaseAdmin
    .from('Home')
    .select('id, address, city, state, zipcode, map_center_lat, map_center_lng')
    .gte('created_at', sevenDaysAgo)
    .eq('home_status', 'active')
    .is('coordinate_validation', null)
    .limit(50);

  if (error) {
    const message = error.message || '';
    // Schema is not ready in this environment yet; skip quietly until the migration lands.
    if (
      message.includes('coordinate_validation') ||
      message.includes('latitude') ||
      message.includes('longitude')
    ) {
      logger.info('[validateCoords] home coordinate validation schema not yet added — skipping');
      return;
    }
    logger.error('[validateCoords] Failed to query homes', { error: error.message });
    return;
  }

  if (!homes || homes.length === 0) return;

  logger.info('[validateCoords] Found homes to validate', { count: homes.length });

  let validated = 0;
  let flagged = 0;
  let errors = 0;

  for (const home of homes) {
    try {
      const lat = home.map_center_lat;
      const lng = home.map_center_lng;

      if (!lat || !lng) {
        // No coordinates — flag as missing
        await supabaseAdmin
          .from('Home')
          .update({ coordinate_validation: 'missing_coordinates', updated_at: new Date().toISOString() })
          .eq('id', home.id);
        flagged++;
        continue;
      }

      // Basic sanity check: must be in continental US + Alaska + Hawaii
      const inUS = (lat >= 18 && lat <= 72) && (lng >= -180 && lng <= -65);
      if (!inUS) {
        await supabaseAdmin
          .from('Home')
          .update({ coordinate_validation: 'outside_us', updated_at: new Date().toISOString() })
          .eq('id', home.id);
        flagged++;
        continue;
      }

      // Rate-limited reverse geocode
      await sleep(MAPBOX_DELAY_MS);
      const reverseResult = await reverseGeocode(lat, lng);
      const check = doesLocationMatch(home, reverseResult);

      if (check.match) {
        await supabaseAdmin
          .from('Home')
          .update({ coordinate_validation: 'valid', updated_at: new Date().toISOString() })
          .eq('id', home.id);
        validated++;
      } else {
        await supabaseAdmin
          .from('Home')
          .update({
            coordinate_validation: `flagged:${check.reason}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', home.id);
        flagged++;

        logger.warn('[validateCoords] Coordinate mismatch', {
          homeId: home.id,
          reason: check.reason,
          expected: check.expected,
          got: check.got,
          lat, lng,
        });
      }
    } catch (err) {
      errors++;
      logger.error('[validateCoords] Failed to validate home', { error: err.message, homeId: home.id });
    }
  }

  logger.info('[validateCoords] Completed', { validated, flagged, errors, total: homes.length });
}

module.exports = validateHomeCoordinates;
