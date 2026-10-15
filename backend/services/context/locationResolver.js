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
const { timezoneFromCoordinates: inferTimezone, validTimezone, coordinates } = require('../../utils/timezone');
const parseHomeLocation = require('../../utils/parsePostGISPoint');

const GEOHASH_PRECISION = 5;
const HOME_LOCATION_SELECT = 'id, name, address, city, state, map_center_lat, map_center_lng, location';

// Confidence scores by source type
const CONFIDENCE = {
  // A private bookmark, not a home or a pinned location (pilot brief WP2).
  saved_place: 0.60,
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
  timezone: 'UTC',
  geohash: null,
  confidence: 0.0,
  homeId: null,
};

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
function makeResult(lat, lng, label, source, homeId = null, fallbackTimezone = 'UTC') {
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
  const point = coordinates(vl?.latitude, vl?.longitude);
  if (!point) return null;
  const { latitude: lat, longitude: lng } = point;
  const source = preferredSource || (vl.is_pinned ? 'viewing_pinned' : 'viewing_recent');
  const label = vl.label || 'Viewing location';
  return makeResult(lat, lng, label, source, null, fallbackTimezone);
}

function makePrimaryHomeResult(occupancies, fallbackTimezone) {
  if (!occupancies?.length) return null;

  for (let i = 0; i < occupancies.length; i++) {
    const home = occupancies[i].home;
    if (!home) continue;

    // Prefer flat coords, fall back to PostGIS location column
    const parsed = parseHomeLocation(home.location);
    const point = coordinates(home.map_center_lat, home.map_center_lng)
      || coordinates(parsed?.latitude, parsed?.longitude);
    if (!point) continue;
    const { latitude: lat, longitude: lng } = point;

    const source = i === 0 ? 'primary_home' : 'home';
    const label = home.city
      ? `Near ${[home.city, home.state].filter(Boolean).join(', ')}`
      : 'Near Home';

    return { ...makeResult(lat, lng, label, source, home.id, fallbackTimezone), state: home.state || null };
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

// The Home the person chose as their default goes first when it is one of the candidates.
function preferDefaultHome(candidates, homeId) {
  const index = homeId ? candidates.findIndex((row) => (row?.home?.id || row?.home_id) === homeId) : -1;
  return index > 0 ? [candidates[index], ...candidates.slice(0, index), ...candidates.slice(index + 1)] : candidates;
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
    // The viewing location and the homes don't depend on the preferences, so
    // all three reads start together: one round trip instead of three (Today
    // resolves twice per load). Until awaited below, the two early reads hold
    // their outcome rather than reject, so a custom location still returns
    // without them and a thrown error surfaces where it always did.
    const settle = (read) => read.then((value) => ({ value }), (error) => ({ error }));
    const outcome = async (pending) => {
      const { value, error } = await pending;
      if (error) throw error;
      return value;
    };
    const viewingRead = settle(supabaseAdmin
      .from('UserViewingLocation')
      .select('latitude, longitude, label, is_pinned, type, updated_at')
      .eq('user_id', userId)
      .single());
    const homesRead = settle(Promise.all([
      supabaseAdmin
        .from('HomeOccupancy')
        .select(`home_id, home:home_id(${HOME_LOCATION_SELECT})`)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      loadFallbackHomeCandidates(userId),
    ]));
    // Read on its own so a database without the column (before its migration) keeps every other preference.
    const defaultHomeRead = settle(supabaseAdmin
      .from('UserNotificationPreferences')
      .select('default_home_id')
      .eq('user_id', userId)
      .maybeSingle());

    // ── Step 1: Read preferences ──
    const { data: prefs, error: prefsErr } = await supabaseAdmin
      .from('UserNotificationPreferences')
      .select('location_mode, custom_latitude, custom_longitude, custom_label, daily_briefing_timezone')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefsErr) {
      logger.warn('locationResolver: prefs query error', { userId, error: prefsErr.message });
    }

    const fallbackTimezone = validTimezone(prefs?.daily_briefing_timezone) || 'UTC';
    const locationMode = prefs?.location_mode || 'primary_home';

    const customPoint = coordinates(prefs?.custom_latitude, prefs?.custom_longitude);
    if (locationMode === 'custom' && customPoint) {
      const { latitude: lat, longitude: lng } = customPoint;
      const label = prefs.custom_label || 'Custom location';
      logger.debug('locationResolver: resolved via custom', { userId, label });
      return makeResult(lat, lng, label, 'custom', null, fallbackTimezone);
    }

    // ── Step 2: Load current viewing location ──
    const { data: vl, error: vlErr } = await outcome(viewingRead);

    if (vlErr && vlErr.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is expected
      logger.warn('locationResolver: VL query error', { userId, error: vlErr.message });
    }

    // ── Step 3: Load homes ──
    // Select both flat coords and PostGIS location for fallback.
    // Homes created before map_center_lat/lng were populated only have PostGIS location.
    const [{ data: occupancies, error: occErr }, fallbackHomes] = await outcome(homesRead);

    if (occErr) {
      logger.warn('locationResolver: occupancy query error', { userId, error: occErr.message });
    }

    const { value: defaultHome } = await defaultHomeRead;
    const homeCandidates = preferDefaultHome(
      dedupeHomeCandidates(occupancies || [], fallbackHomes),
      defaultHome?.error ? null : defaultHome?.data?.default_home_id || null,
    );

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
      const pinned = makeViewingLocationResult(vl, fallbackTimezone, 'viewing_pinned');
      if (pinned) return pinned;
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

    // A private saved address supplies Today and opted-in briefings without
    // creating residency. The existing explicit preferences, pinned location and
    // Home fallback above keep their priority.
    const { data: saved, error: savedError } = await supabaseAdmin
      .from('SavedPlace')
      .select('id, label, latitude, longitude, state')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (savedError) {
      logger.warn('locationResolver: saved place query error', { userId, error: savedError.message });
    }
    if (!savedError && saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)
      && Math.abs(saved.latitude) <= 90 && Math.abs(saved.longitude) <= 180
      && (saved.latitude !== 0 || saved.longitude !== 0)) {
      return { ...makeResult(saved.latitude, saved.longitude, saved.label, 'saved_place', null, fallbackTimezone), savedPlaceId: saved.id, state: saved.state || null };
    }

    // ── Step 6: Last known viewing location (not pinned) ──
    if (vl && vl.latitude != null && vl.longitude != null) {
      const recent = makeViewingLocationResult(vl, fallbackTimezone, 'viewing_recent');
      if (recent) return recent;
    }

    // ── Step 7: No location available ──
    logger.debug('locationResolver: no location found', { userId });
    return { ...EMPTY_RESULT, timezone: fallbackTimezone };
  } catch (err) {
    logger.error('locationResolver: unexpected error', { userId, error: err.message });
    return { ...EMPTY_RESULT };
  }
}

/**
 * A location anchor for EXPLICIT coordinates — the Place Intelligence
 * path, where the payload must be about the requested home, not about
 * wherever the viewer happens to be. Bypasses the per-user preference
 * hierarchy entirely; timezone and geohash are derived from the coords.
 *
 * @returns the standard location shape, or null for missing/invalid coords.
 */
function locationFromCoordinates({ latitude, longitude, label, homeId } = {}) {
  const point = coordinates(latitude, longitude);
  if (!point) return null;
  const { latitude: lat, longitude: lng } = point;
  return makeResult(lat, lng, label || 'Home', 'home', homeId || null);
}

async function resolveNotificationTimezone(userId, prefs) {
  if (prefs === undefined) {
    const { data, error } = await supabaseAdmin.from('UserNotificationPreferences')
      .select('daily_briefing_timezone').eq('user_id', userId).maybeSingle();
    if (error) throw new Error('Could not read notification timezone');
    prefs = data;
  }
  const explicit = validTimezone(prefs?.daily_briefing_timezone);
  if (explicit) return explicit;
  const location = await resolveLocation(userId);
  return location?.source !== 'none' ? validTimezone(location?.timezone) : null;
}

module.exports = { resolveLocation, locationFromCoordinates, inferTimezone, resolveNotificationTimezone };
