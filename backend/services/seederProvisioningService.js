/**
 * Instant Region Provisioning for the Community Content Seeder
 *
 * When a user sets their viewing location and no seeder region covers that area,
 * this service auto-provisions a lightweight region with P1+P2 sources so the
 * next fetcher cycle starts delivering local content.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// Earth radius in meters
const EARTH_RADIUS_M = 6_371_000;

// Default radius for auto-provisioned regions
const DEFAULT_RADIUS_M = 25_000;

// Cooldown: don't re-check provisioning for the same user within this window
const PROVISION_CHECK_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// Simple in-memory cache to avoid spamming DB checks on every location update
const _recentChecks = new Map(); // userId -> timestamp

function hasUsableCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(Number(latitude) === 0 && Number(longitude) === 0);
}

/**
 * Haversine distance in meters between two lat/lng points.
 */
function haversineM(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Derive a US timezone from longitude. Covers CONUS + Alaska + Hawaii.
 * Falls back to America/Chicago for ambiguous cases.
 */
function timezoneFromLng(lat, lng) {
  // Hawaii
  if (lat < 23 && lng < -154) return 'Pacific/Honolulu';
  // Alaska
  if (lat > 51 || lng < -130) return 'America/Anchorage';
  // Arizona does not observe DST, except the Navajo Nation in the northeast corner.
  if (lat >= 31.0 && lat <= 37.1 && lng >= -114.9 && lng <= -109.0) {
    if (lat >= 35.8 && lng >= -110.9) {
      return 'America/Denver';
    }
    return 'America/Phoenix';
  }
  // Pacific (west of ~-114.5)
  if (lng < -114.5) return 'America/Los_Angeles';
  // Mountain (-114.5 to -102)
  if (lng < -102) return 'America/Denver';
  // Central (-102 to -87)
  if (lng < -87) return 'America/Chicago';
  // Eastern
  return 'America/New_York';
}

/**
 * Create a URL-safe region slug from city + state.
 * e.g. "Miami, FL" -> "miami_fl"
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Check if the given coordinates are covered by any existing seeder region.
 * If not, auto-provision a new region with P1+P2 sources.
 *
 * This runs in the background (fire-and-forget) from the location endpoint
 * so it doesn't slow down the user's location update.
 */
async function ensureRegionCoverage({ latitude, longitude, city, state, userId }) {
  // Skip if no valid coordinates
  if (!hasUsableCoordinates(latitude, longitude)) return;

  // Cooldown check
  const lastCheck = _recentChecks.get(userId);
  if (lastCheck && Date.now() - lastCheck < PROVISION_CHECK_COOLDOWN_MS) return;
  _recentChecks.set(userId, Date.now());

  // Evict old cache entries periodically (keep map from growing)
  if (_recentChecks.size > 10_000) {
    const cutoff = Date.now() - PROVISION_CHECK_COOLDOWN_MS;
    for (const [uid, ts] of _recentChecks) {
      if (ts < cutoff) _recentChecks.delete(uid);
    }
  }

  try {
    // Load all active seeder regions
    const { data: regions, error: regErr } = await supabaseAdmin
      .from('seeder_config')
      .select('region, lat, lng, radius_meters')
      .eq('active', true);

    if (regErr) throw regErr;

    // Check if user is within any existing region
    const covered = (regions || []).some((r) =>
      haversineM(latitude, longitude, r.lat, r.lng) <= (r.radius_meters || DEFAULT_RADIUS_M)
    );

    if (covered) {
      return; // User is already in a covered region — nothing to do
    }

    logger.info('User outside all seeder regions, provisioning instant region', {
      userId,
      latitude,
      longitude,
      city,
      state,
    });

    await provisionInstantRegion({ latitude, longitude, city, state });
  } catch (err) {
    // Non-critical: log and move on. User's location update should not fail.
    logger.error('Instant region provisioning failed', { error: err.message, userId });
  }
}

/**
 * Provision a new region at the given coordinates with P1 + P2 sources.
 */
async function provisionInstantRegion({ latitude, longitude, city, state }) {
  if (!hasUsableCoordinates(latitude, longitude)) {
    logger.warn('Skipping instant region provisioning for unusable coordinates', {
      latitude,
      longitude,
      city,
      state,
    });
    return;
  }

  // Build region name
  const displayName = [city, state].filter(Boolean).join(', ') || `Region (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
  const regionId = city
    ? slugify(`${city}_${state || ''}`)
    : slugify(`region_${latitude.toFixed(1)}_${longitude.toFixed(1)}`);
  const timezone = timezoneFromLng(latitude, longitude);
  const newsQuery = city
    ? `${city} ${state || ''} local news`.trim()
    : `${latitude.toFixed(2)} ${longitude.toFixed(2)} local news`;

  // Check if region already exists (race condition guard)
  const { data: existing } = await supabaseAdmin
    .from('seeder_config')
    .select('region')
    .eq('region', regionId)
    .single();

  if (existing) {
    logger.info('Region already exists, skipping provisioning', { regionId });
    return;
  }

  // Find the curator user ID
  const { data: curatorRow } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('account_type', 'curator')
    .limit(1)
    .single();

  if (!curatorRow) {
    logger.error('No curator user found — cannot provision instant region');
    return;
  }

  const curatorUserId = curatorRow.id;

  // Create seeder_config row
  const { error: configErr } = await supabaseAdmin
    .from('seeder_config')
    .upsert(
      {
        region: regionId,
        curator_user_id: curatorUserId,
        active: true,
        active_sources: [
          `nws_alerts:${regionId}`,
          `usgs_earthquakes:${regionId}`,
          `google_news:${regionId}`,
          `seasonal:${regionId}`,
        ],
        lat: latitude,
        lng: longitude,
        radius_meters: DEFAULT_RADIUS_M,
        timezone,
        display_name: displayName,
        provisioned_by: 'instant',
      },
      { onConflict: 'region' }
    );

  if (configErr) {
    logger.error('Failed to create seeder_config', { regionId, error: configErr.message });
    return;
  }

  // Create P1 + P2 sources (active by default)
  const coordStr = `${latitude},${longitude}`;
  const sources = [
    // P1: Critical — always active
    {
      source_id: `nws_alerts:${regionId}`,
      source_type: 'nws_alerts',
      url: coordStr,
      category: 'weather',
      display_name: 'NWS Weather Alerts',
      region: regionId,
      active: true,
      priority: 1,
    },
    {
      source_id: `usgs_earthquakes:${regionId}`,
      source_type: 'usgs_earthquakes',
      url: coordStr,
      category: 'earthquake',
      display_name: 'USGS Earthquakes',
      region: regionId,
      active: true,
      priority: 1,
    },
    // P2: Core — always active
    {
      source_id: `google_news:${regionId}`,
      source_type: 'google_news',
      url: newsQuery,
      category: 'local_news',
      display_name: `Google News (${displayName})`,
      region: regionId,
      active: true,
      priority: 2,
    },
    {
      source_id: `seasonal:${regionId}`,
      source_type: 'seasonal',
      url: null,
      category: 'seasonal',
      display_name: 'Pantopus Seasonal',
      region: regionId,
      active: true,
      priority: 2,
    },
  ];

  for (const src of sources) {
    const { error: srcErr } = await supabaseAdmin
      .from('seeder_sources')
      .upsert(src, { onConflict: 'source_id,region' });

    if (srcErr) {
      logger.warn('Failed to create source', { sourceId: src.source_id, regionId, error: srcErr.message });
    }
  }

  logger.info('Instant region provisioned', {
    regionId,
    displayName,
    latitude,
    longitude,
    timezone,
    sources: sources.length,
  });
}

module.exports = {
  ensureRegionCoverage,
  provisionInstantRegion,
  // Exported for testing
  haversineM,
  hasUsableCoordinates,
  timezoneFromLng,
  slugify,
};
