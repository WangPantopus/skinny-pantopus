/**
 * MapboxProvider — GeoProvider implementation backed by Mapbox Geocoding v5.
 *
 * Autocomplete pre-parses structured address components from the Mapbox
 * response and caches them keyed by suggestion_id so that resolve() can
 * return a NormalizedAddress without a second Mapbox call.
 */

const logger = require('../../utils/logger');
const { geoCache } = require('../../utils/geoCache');
const { GEO_SERVER_TOKEN } = require('../../config/geo');
const crypto = require('crypto');

// ── Helpers ──────────────────────────────────────────────────

function requireToken() {
  if (!GEO_SERVER_TOKEN) throw new Error('Missing env var: MAPBOX_ACCESS_TOKEN');
  return GEO_SERVER_TOKEN;
}

/**
 * Extract a context field by id prefix from a Mapbox feature.
 */
function findCtx(context, prefix) {
  return (context || []).find((c) => (c.id || '').startsWith(prefix));
}

/**
 * Mapbox v5 address features often split the house number into `address`
 * and the street name into `text`. Use both so the UI does not show
 * "Tacoma Court" when the actual selectable feature is "4014 Tacoma Court".
 */
function featureAddressLine(f) {
  const text = (f.text || '').trim();
  const houseNumber = (f.address || '').trim();

  if (houseNumber && text) {
    const lowerText = text.toLowerCase();
    const lowerHouseNumber = houseNumber.toLowerCase();
    if (!lowerText.startsWith(lowerHouseNumber)) {
      return `${houseNumber} ${text}`.trim();
    }
  }

  if (text) return text;
  return (f.place_name || '').split(',')[0].trim();
}

function makeSuggestionId(f) {
  const providerId = f.id || '';
  const fingerprint = crypto
    .createHash('sha1')
    .update(JSON.stringify([
      featureAddressLine(f),
      f.place_name || '',
      f.center || [],
      secondaryText(f),
    ]))
    .digest('hex')
    .slice(0, 12);

  return providerId ? `${providerId}::${fingerprint}` : fingerprint;
}

function providerIdFromSuggestionId(suggestionId) {
  return String(suggestionId || '').split('::')[0];
}

/**
 * Parse a Mapbox v5 feature into a NormalizedAddress.
 */
function featureToNormalized(f, source, mode) {
  const ctx = f.context || [];
  const postcode = findCtx(ctx, 'postcode')?.text || '';
  const place = findCtx(ctx, 'place')?.text || '';
  const region = findCtx(ctx, 'region')?.text || '';
  const regionShort = findCtx(ctx, 'region')?.short_code || '';

  const stateCode = regionShort?.includes('-')
    ? regionShort.split('-').pop().toUpperCase()
    : '';

  return {
    address: featureAddressLine(f) || f.place_name || '',
    city: place,
    state: stateCode || region,
    zipcode: postcode,
    latitude: f.center ? f.center[1] : null,
    longitude: f.center ? f.center[0] : null,
    place_id: f.id || null,
    verified: false,
    source,
    geocode_mode: mode || 'temporary',
  };
}

/**
 * Determine the "kind" of a Mapbox feature from its place_type array.
 */
function featureKind(f) {
  const types = f.place_type || [];
  if (types.includes('poi')) return 'poi';
  if (types.includes('address')) return 'address';
  if (types.includes('place')) return 'place';
  if (types.includes('locality')) return 'locality';
  if (types.includes('postcode')) return 'postcode';
  return types[0] || 'unknown';
}

/**
 * Great-circle distance between two coordinates, in meters.
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusM = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(a));
}

/**
 * Parse a Mapbox v5 feature into a NormalizedPlace (place-tagging wire
 * shape). distance_m is filled only when the query point is known.
 */
function featureToPlace(f, queryLat, queryLng) {
  const center = f.center
    ? { lat: f.center[1], lng: f.center[0] }
    : { lat: 0, lng: 0 };
  const hasQueryPoint = Number.isFinite(queryLat) && Number.isFinite(queryLng);

  return {
    place_id: f.id || null,
    // featureAddressLine re-joins the house number Mapbox v5 splits into
    // `f.address` for address-kind features ("4014" + "Tacoma Court"),
    // and falls back to the first place_name segment.
    name: featureAddressLine(f),
    category: f.properties?.category || null,
    address: f.properties?.address || secondaryText(f) || null,
    full_address: f.place_name || null,
    center,
    kind: featureKind(f),
    distance_m: hasQueryPoint && f.center
      ? Math.round(haversineMeters(queryLat, queryLng, center.lat, center.lng))
      : null,
  };
}

/**
 * True when a Mapbox feature carries a usable [lng, lat] center. Features
 * without one are dropped rather than defaulting to Null Island {0,0} —
 * a picked place's coordinates get persisted onto the post.
 */
function hasCenter(f) {
  return Array.isArray(f.center)
    && f.center.length >= 2
    && Number.isFinite(f.center[0])
    && Number.isFinite(f.center[1]);
}

/**
 * Build a display-friendly secondary text from context fields.
 */
function secondaryText(f) {
  const ctx = f.context || [];
  const place = findCtx(ctx, 'place')?.text || '';
  const regionShort = findCtx(ctx, 'region')?.short_code || '';
  const stateCode = regionShort?.includes('-')
    ? regionShort.split('-').pop().toUpperCase()
    : findCtx(ctx, 'region')?.text || '';
  const postcode = findCtx(ctx, 'postcode')?.text || '';

  return [place, stateCode, postcode].filter(Boolean).join(', ');
}

// ── Provider ─────────────────────────────────────────────────

// Cache key prefix for resolved suggestions (pre-parsed on autocomplete).
const RESOLVE_PREFIX = 'geo:resolve:';
const RESOLVE_TTL = 300_000; // 5 minutes

// TODO: Upgrade to Mapbox Search Box API v2 when access is available.
//       v2 provides structured address components natively and supports
//       session-based billing, reducing per-suggestion costs.

const mapboxProvider = {
  /**
   * @param {string} query
   * @param {{ sessionToken?: string, limit?: number, country?: string }} [options]
   * @returns {Promise<{ suggestions: import('./geoProvider').NormalizedSuggestion[] }>}
   */
  async autocomplete(query, options = {}) {
    const { limit = 6, country = 'us' } = options;
    const token = requireToken();

    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${encodeURIComponent(token)}` +
      `&autocomplete=true&limit=${limit}&country=${encodeURIComponent(country)}` +
      `&types=address,place,locality,postcode`;

    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      logger.warn('mapbox_autocomplete_error', { status: r.status, body: text });
      throw new Error(`Mapbox autocomplete failed: ${r.status}`);
    }

    const data = await r.json();
    const features = data.features || [];

    const suggestions = features.map((f) => {
      const suggestionId = makeSuggestionId(f);

      // Pre-parse and cache the normalized address so resolve() is free.
      const normalized = featureToNormalized(f, 'mapbox_geocode', 'temporary');
      geoCache.set(RESOLVE_PREFIX + suggestionId, normalized, RESOLVE_TTL);

      return {
        suggestion_id: suggestionId,
        primary_text: featureAddressLine(f),
        secondary_text: secondaryText(f),
        label: f.place_name || '',
        center: f.center
          ? { lat: f.center[1], lng: f.center[0] }
          : { lat: 0, lng: 0 },
        kind: featureKind(f),
      };
    });

    return { suggestions };
  },

  /**
   * @param {string} suggestionId
   * @param {string} [_sessionToken]
   * @returns {Promise<import('./geoProvider').NormalizedAddress>}
   */
  async resolve(suggestionId, _sessionToken) {
    // Check pre-parsed cache first (populated by autocomplete).
    const cached = geoCache.get(RESOLVE_PREFIX + suggestionId);
    if (cached) return cached;

    // Cache miss — fall back to forward geocode using the suggestion_id as a
    // Mapbox feature id lookup, or if that fails, treat it as text.
    logger.info('geo_resolve_cache_miss', { suggestion_id: suggestionId });

    const token = requireToken();
    const providerId = providerIdFromSuggestionId(suggestionId);
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(providerId)}.json` +
      `?access_token=${encodeURIComponent(token)}` +
      `&limit=1&country=us&types=address,place,locality,postcode`;

    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      logger.warn('mapbox_resolve_error', { status: r.status, body: text });
      throw new Error(`Mapbox resolve failed: ${r.status}`);
    }

    const data = await r.json();
    const f = (data.features || [])[0];
    if (!f) throw new Error('No result for suggestion_id');

    const normalized = featureToNormalized(f, 'mapbox_geocode', 'temporary');
    geoCache.set(RESOLVE_PREFIX + f.id, normalized, RESOLVE_TTL);
    return normalized;
  },

  /**
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<import('./geoProvider').NormalizedAddress>}
   */
  async reverseGeocode(lat, lng) {
    const token = requireToken();

    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lng)},${encodeURIComponent(lat)}.json` +
      `?access_token=${encodeURIComponent(token)}` +
      `&limit=1&types=address,place,locality,postcode`;

    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      logger.warn('mapbox_reverse_error', { status: r.status, body: text });
      throw new Error(`Mapbox reverse geocode failed: ${r.status}`);
    }

    const data = await r.json();
    const f = (data.features || [])[0];
    if (!f) throw new Error('No address found for that location');

    return featureToNormalized(f, 'mapbox_reverse', 'temporary');
  },

  /**
   * @param {string} address
   * @param {{ mode?: 'temporary'|'permanent' }} [options]
   * @returns {Promise<import('./geoProvider').NormalizedAddress>}
   */
  async forwardGeocode(address, options = {}) {
    const { mode = 'temporary' } = options;
    const token = requireToken();

    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json` +
      `?access_token=${encodeURIComponent(token)}` +
      `&limit=1&country=us&types=address,place,locality,postcode`;

    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      logger.warn('mapbox_forward_error', { status: r.status, body: text });
      throw new Error(`Mapbox forward geocode failed: ${r.status}`);
    }

    const data = await r.json();
    const f = (data.features || [])[0];
    if (!f) throw new Error('No result for address');

    return featureToNormalized(f, 'mapbox_geocode', mode);
  },

  /**
   * Named places (POIs) around a coordinate, plus the enclosing locality —
   * powers the Instagram-style place-tag picker.
   *
   * @param {number} lat
   * @param {number} lng
   * @param {{ limit?: number }} [options]
   * @returns {Promise<{ places: object[], locality: object|null }>}
   */
  async nearbyPlaces(lat, lng, options = {}) {
    const { limit = 10 } = options;
    const token = requireToken();

    const base =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lng)},${encodeURIComponent(lat)}.json` +
      `?access_token=${encodeURIComponent(token)}`;

    // Reverse geocoding only honors limit > 1 with a single `types` value,
    // so POIs and the locality come from two parallel calls.
    const [poiRes, localityRes] = await Promise.all([
      fetch(`${base}&types=poi&limit=${limit}`),
      fetch(`${base}&types=place&limit=1`),
    ]);

    if (!poiRes.ok) {
      const text = await poiRes.text();
      logger.warn('mapbox_nearby_places_error', { status: poiRes.status, body: text });
      throw new Error(`Mapbox nearby places failed: ${poiRes.status}`);
    }

    // The locality row is decorative (the contract allows locality: null),
    // so its call failing must not throw away a successful POI response.
    let localityData = { features: [] };
    if (localityRes.ok) {
      localityData = await localityRes.json();
    } else {
      const text = await localityRes.text();
      logger.warn('mapbox_nearby_locality_error', { status: localityRes.status, body: text });
    }

    const poiData = await poiRes.json();
    const places = (poiData.features || [])
      .filter(hasCenter)
      .map((f) => featureToPlace(f, lat, lng));
    const localityFeature = (localityData.features || []).find(hasCenter);
    const locality = localityFeature ? featureToPlace(localityFeature, lat, lng) : null;

    return { places, locality };
  },

  /**
   * Autocomplete search over POIs, places, and addresses for the place-tag
   * picker; proximity-biased when the caller's coordinates are known.
   *
   * @param {string} query
   * @param {{ lat?: number, lng?: number, limit?: number }} [options]
   * @returns {Promise<{ places: object[] }>}
   */
  async searchPlaces(query, options = {}) {
    const { lat, lng, limit = 8 } = options;
    const token = requireToken();

    let url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${encodeURIComponent(token)}` +
      `&autocomplete=true&limit=${limit}&country=us&types=poi,place,address`;
    const hasProximity = Number.isFinite(lat) && Number.isFinite(lng);
    if (hasProximity) {
      url += `&proximity=${encodeURIComponent(lng)},${encodeURIComponent(lat)}`;
    }

    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      logger.warn('mapbox_search_places_error', { status: r.status, body: text });
      throw new Error(`Mapbox place search failed: ${r.status}`);
    }

    const data = await r.json();
    const places = (data.features || [])
      .filter(hasCenter)
      .map((f) => featureToPlace(
        f,
        hasProximity ? lat : NaN,
        hasProximity ? lng : NaN,
      ));

    return { places };
  },
};

module.exports = mapboxProvider;
