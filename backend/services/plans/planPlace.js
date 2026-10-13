'use strict';

/**
 * Where a plan happens: the exact place (kept on Plan) and the public area that
 * everyone else sees (stored on the Post).
 */

const logger = require('../../utils/logger');
const { applyLocationPrecision } = require('../../utils/locationPrivacy');
const { geoCache } = require('../../utils/geoCache');
const { inferTimezone } = require('../context/locationResolver');

const AREA_LABEL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAPBOX_TIMEOUT_MS = 5000;

/**
 * The public point for a plan: the exact point through the same helper the
 * posts use (`approx_area`), or `neighborhood_only` (about 1 km) for playdates.
 */
function areaPointFor(kind, latitude, longitude) {
  const point = { latitude: Number(latitude), longitude: Number(longitude) };
  applyLocationPrecision(point, kind === 'playdate' ? 'neighborhood_only' : 'approx_area', false, { setUnlockedFlag: false });
  return point;
}

function locationPrecisionFor(kind) {
  return kind === 'playdate' ? 'neighborhood_only' : 'approx_area';
}

function timezoneFor(latitude, longitude) {
  return inferTimezone(Number(latitude), Number(longitude));
}

function featureText(feature) {
  return typeof feature?.text === 'string' ? feature.text.trim() : '';
}

/**
 * The area's public name, from the area point (never the exact place):
 * "Near Prune Hill" from Mapbox's neighborhood or locality, else the city.
 * Returns { label, city }; falls back to the given city, then "Nearby".
 */
async function areaLabelFor(area, { fallbackCity = null } = {}) {
  const key = `plans:area:${area.latitude.toFixed(3)}:${area.longitude.toFixed(3)}`;
  const cached = geoCache.get(key);
  if (cached) return cached;

  const token = process.env.MAPBOX_ACCESS_TOKEN;
  let result = null;
  if (token) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${area.longitude},${area.latitude}.json`
        + `?access_token=${encodeURIComponent(token)}&types=neighborhood,locality,place&limit=1`;
      const response = await fetch(url, { signal: AbortSignal.timeout(MAPBOX_TIMEOUT_MS) });
      if (response.ok) {
        const data = await response.json();
        const feature = (data.features || [])[0];
        if (feature) {
          const types = feature.place_type || [];
          const cityFromContext = featureText((feature.context || []).find((c) => String(c.id || '').startsWith('place.')));
          if (types.includes('place')) {
            const city = featureText(feature);
            result = { label: city || 'Nearby', city: city || null };
          } else {
            const name = featureText(feature);
            const city = cityFromContext || fallbackCity || null;
            result = { label: name ? (/^downtown\b/i.test(name) && city ? `Downtown ${city}` : `Near ${name}`) : (city || 'Nearby'), city };
          }
        }
      } else {
        logger.warn('plans.area_label.mapbox_error', { status: response.status });
      }
    } catch (err) {
      logger.warn('plans.area_label.failed', { error: err.message });
    }
  }
  if (!result) result = { label: fallbackCity || 'Nearby', city: fallbackCity || null };
  result.label = result.label.slice(0, 80);
  geoCache.set(key, result, AREA_LABEL_TTL_MS);
  return result;
}

/** A home's one-line street address, as people who are in see it. */
function homeAddressLine(home) {
  if (!home) return null;
  const street = [home.address, home.address2].filter(Boolean).join(' ').trim();
  const cityLine = [home.city, [home.state, home.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, cityLine].filter(Boolean).join(', ') || null;
}

module.exports = {
  areaPointFor,
  locationPrecisionFor,
  timezoneFor,
  areaLabelFor,
  homeAddressLine,
};
