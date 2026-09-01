/**
 * Location Resolver — resolves the best location anchor for context,
 * weather, and daily briefing requests.
 *
 * Preference-aware hierarchy:
 *   1. Honor explicit location_mode when possible
 *   2. Fall back to the best available location
 *   3. null (no location available)
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const ngeohash = require('ngeohash');

const GEOHASH_PRECISION = 5;
const HOME_LOCATION_SELECT = 'id, name, address, city, state, map_center_lat, map_center_lng, location';

// Confidence scores by source type
const CONFIDENCE = {
  custom: 0.95,
  viewing_pinned: 0.90,
  primary_home: 0.95,
  home: 0.85,
  viewing_recent: 0.70,
  none: 0.0,
};

const EMPTY_RESULT = {
  latitude: null,
  longitude: null,
  label: 'Unknown',
  source: 'none',
  timezone: 'America/Los_Angeles',
  geohash: null,
  confidence: 0.0,
  homeId: null,
};

function inBounds(lat, lng, bounds) {
  return lat >= bounds.minLat
    && lat <= bounds.maxLat
    && lng >= bounds.minLng
    && lng <= bounds.maxLng;
}

function inferTimezone(lat, lng, fallback = 'America/Los_Angeles') {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) {
    return fallback;
  }

  // Hawaii
  if (lat < 23 && lng < -154) return 'Pacific/Honolulu';
  // Alaska
  if (lat > 51 || lng < -130) return 'America/Anchorage';
  // Arizona does not observe DST, except the Navajo Nation in the northeast corner.
  if (inBounds(lat, lng, { minLat: 31.0, maxLat: 37.1, minLng: -114.9, maxLng: -109.0 })) {
    if (inBounds(lat, lng, { minLat: 35.8, maxLat: 37.1, minLng: -110.9, maxLng: -109.0 })) {
      return 'America/Denver';
    }
    return 'America/Phoenix';
  }
  // Pacific
  if (lng < -114.5) return 'America/Los_Angeles';
  // Mountain
  if (lng < -102) return 'America/Denver';
  // Central
  if (lng < -87) return 'America/Chicago';
  // Eastern
  return 'America/New_York';
}

/**
 * Compute geohash5 from coordinates, or null if invalid.
 */
function computeGeohash(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) return null;
  try {
    return ngeohash.encode(lat, lng, GEOHASH_PRECISION);
  } catch {
    return null;
  }
}

/**
 * Build the standard result shape.
 */
function makeResult(lat, lng, label, source, homeId = null, fallbackTimezone = 'America/Los_Angeles') {
  return {
    latitude: lat,
    longitude: lng,
    label,
    source,
    timezone: inferTimezone(lat, lng, fallbackTimezone),
    geohash: computeGeohash(lat, lng),
    confidence: CONFIDENCE[source] ?? 0.0,
    homeId,
  };
}

function makeViewingLocationResult(vl, fallbackTimezone, preferredSource = null) {
  if (!vl || vl.latitude == null || vl.longitude == null) return null;
  const lat = Number(vl.latitude);
  const lng = Number(vl.longitude);
  // Reject (0, 0) — "Null Island" in the Gulf of Guinea, never a real user location
  if (lat === 0 && lng === 0) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const source = preferredSource || (vl.is_pinned ? 'viewing_pinned' : 'viewing_recent');
  const label = vl.label || 'Viewing location';
  return makeResult(lat, lng, label, source, null, fallbackTimezone);
}

/**
 * Parse PostGIS location (GeoJSON, WKT POINT, or binary) into {latitude, longitude}.
 */
function parseHomeLocation(loc) {
  if (!loc) return null;
  // GeoJSON: { type: "Point", coordinates: [lng, lat] }
  if (typeof loc === 'object' && loc.coordinates) {
    const lng = loc.coordinates[0];
    const lat = loc.coordinates[1];
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { latitude: lat, longitude: lng };
  }
  // WKT: POINT(lng lat)
  if (typeof loc === 'string') {
    const m = loc.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (m) {
      const lng = parseFloat(m[1]);
      const lat = parseFloat(m[2]);
      if (Number.isFinite(lng) && Number.isFinite(lat)) return { latitude: lat, longitude: lng };
    }
  }
  return null;
}

function makePrimaryHomeResult(occupancies, fallbackTimezone) {
  if (!occupancies?.length) return null;

  for (let i = 0; i < occupancies.length; i++) {
    const home = occupancies[i].home;
    if (!home) continue;

    // Prefer flat coords, fall back to PostGIS location column
    let lat = home.map_center_lat != null ? Number(home.map_center_lat) : null;
    let lng = home.map_center_lng != null ? Number(home.map_center_lng) : null;

    if (lat == null || lng == null) {
      const parsed = parseHomeLocation(home.location);
      if (parsed) {
        lat = parsed.latitude;
        lng = parsed.longitude;
      }
    }

    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const source = i === 0 ? 'primary_home' : 'home';
    const label = home.city
      ? `Near ${[home.city, home.state].filter(Boolean).join(', ')}`
      : 'Near Home';

    return makeResult(lat, lng, label, source, home.id, fallbackTimezone);
  }

  return null;
}

function dedupeHomeCandidates(...candidateLists) {
  const merged = [];
  const seen = new Set();

  for (const list of candidateLists) {
    for (const row of list || []) {
      const homeId = row?.home?.id || row?.home_id || row?.id || null;
      if (!homeId || seen.has(homeId)) continue;
      seen.add(homeId);
      merged.push(row.home ? row : { home_id: homeId, home: row });
    }
  }

  return merged;
}

async function loadFallbackHomeCandidates(userId) {
  const [ownerResult, legacyResult] = await Promise.all([
    supabaseAdmin
      .from('HomeOwner')
      .select(`home_id, home:home_id(${HOME_LOCATION_SELECT})`)
      .eq('subject_id', userId)
      .eq('owner_status', 'verified')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('Home')
      .select(HOME_LOCATION_SELECT)
      .eq('owner_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  if (ownerResult.error) {
    logger.warn('locationResolver: owner fallback query error', {
      userId,
      error: ownerResult.error.message,
    });
  }

  if (legacyResult.error) {
    logger.warn('locationResolver: legacy owner fallback query error', {
      userId,
      error: legacyResult.error.message,
    });
  }

  return dedupeHomeCandidates(
    (ownerResult.data || []).filter((row) => row?.home),
    legacyResult.data || []
  );
}

/**
 * Resolve the best location for a user.
 *
 * @param {string} userId
 * @returns {Promise<{latitude: number|null, longitude: number|null, label: string, source: string, timezone: string, geohash: string|null, confidence: number, homeId: string|null}>}
 */
async function resolveLocation(userId) {
  try {
    // ── Step 1: Read preferences ──
    const { data: prefs, error: prefsErr } = await supabaseAdmin
      .from('UserNotificationPreferences')
      .select('location_mode, custom_latitude, custom_longitude, custom_label, daily_briefing_timezone')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefsErr) {
      logger.warn('locationResolver: prefs query error', { userId, error: prefsErr.message });
    }

    const fallbackTimezone = prefs?.daily_briefing_timezone || 'America/Los_Angeles';
    const locationMode = prefs?.location_mode || 'primary_home';

    if (locationMode === 'custom' && prefs?.custom_latitude != null && prefs.custom_longitude != null) {
      const lat = Number(prefs.custom_latitude);
      const lng = Number(prefs.custom_longitude);
      const label = prefs.custom_label || 'Custom location';
      logger.debug('locationResolver: resolved via custom', { userId, label });
      return makeResult(lat, lng, label, 'custom', null, fallbackTimezone);
    }

    // ── Step 2: Load current viewing location ──
    const { data: vl, error: vlErr } = await supabaseAdmin
      .from('UserViewingLocation')
      .select('latitude, longitude, label, is_pinned, type, updated_at')
      .eq('user_id', userId)
      .single();

    if (vlErr && vlErr.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is expected
      logger.warn('locationResolver: VL query error', { userId, error: vlErr.message });
    }

    // ── Step 3: Load homes ──
    // Select both flat coords and PostGIS location for fallback.
    // Homes created before map_center_lat/lng were populated only have PostGIS location.
    const [{ data: occupancies, error: occErr }, fallbackHomes] = await Promise.all([
      supabaseAdmin
        .from('HomeOccupancy')
        .select(`home_id, home:home_id(${HOME_LOCATION_SELECT})`)
        .eq('user_id', userId)
        .eq('is_active', true),
      loadFallbackHomeCandidates(userId),
    ]);

    if (occErr) {
      logger.warn('locationResolver: occupancy query error', { userId, error: occErr.message });
    }

    const homeCandidates = dedupeHomeCandidates(occupancies || [], fallbackHomes);

    // ── Step 4: Honor the explicit location_mode when possible ──
    if (locationMode === 'viewing_location') {
      const preferredViewing = makeViewingLocationResult(vl, fallbackTimezone);
      if (preferredViewing) {
        logger.debug('locationResolver: resolved via viewing location preference', {
          userId,
          label: preferredViewing.label,
        });
        return preferredViewing;
      }
    }

    if (locationMode === 'device_location') {
      const deviceLocation = makeViewingLocationResult(vl, fallbackTimezone);
      if (deviceLocation) {
        logger.debug('locationResolver: resolved via device location preference', {
          userId,
          label: deviceLocation.label,
          type: vl?.type,
        });
        return deviceLocation;
      }
    }

    if (locationMode === 'primary_home') {
      const preferredHome = makePrimaryHomeResult(homeCandidates, fallbackTimezone);
      if (preferredHome) {
        logger.debug('locationResolver: resolved via primary home preference', {
          userId,
          homeId: preferredHome.homeId,
        });
        return preferredHome;
      }
    }

    // ── Step 5: Best-available fallback chain ──
    if (vl?.is_pinned && vl.latitude != null && vl.longitude != null) {
      logger.debug('locationResolver: resolved via pinned VL', { userId, label: vl.label });
      return makeViewingLocationResult(vl, fallbackTimezone, 'viewing_pinned');
    }

    const homeLocation = makePrimaryHomeResult(homeCandidates, fallbackTimezone);
    if (homeLocation) {
      logger.debug('locationResolver: resolved via home fallback', {
        userId,
        source: homeLocation.source,
        homeId: homeLocation.homeId,
      });
      return homeLocation;
    }

    // ── Step 6: Last known viewing location (not pinned) ──
    if (vl && vl.latitude != null && vl.longitude != null) {
      logger.debug('locationResolver: resolved via recent VL', { userId, label: vl.label });
      return makeViewingLocationResult(vl, fallbackTimezone, 'viewing_recent');
    }

    // ── Step 7: No location available ──
    logger.debug('locationResolver: no location found', { userId });
    return { ...EMPTY_RESULT };
  } catch (err) {
    logger.error('locationResolver: unexpected error', { userId, error: err.message });
    return { ...EMPTY_RESULT };
  }
}

module.exports = { resolveLocation };
