/**
 * Discovery Cache Service — geohash-based cache for marketplace discovery.
 *
 * Caches discovery sections (free_nearby, just_listed, nearby_deals,
 * wanted_nearby, by_category) in DiscoveryCache table keyed by 4-char
 * geohash prefix. Falls back to live discoverListings on cache miss.
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const {
  discoverListings,
  getSavedListingIds,
  getMuteAndBlockFilters,
  applyListingExclusions,
} = require('./marketplaceService');

// ─── Geohash encoding / decoding ────────────────────────────────────────────

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode latitude and longitude into a 4-character geohash.
 * Standard base32 geohash algorithm: interleave lon/lat bits, pack into
 * 5-bit groups, map to base32 characters.
 * 4 chars = 20 bits total → 10 bits longitude, 10 bits latitude.
 */
function encodeGeohash(lat, lng) {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let bits = 0;
  let hash = '';
  let bitCount = 0;
  let isLng = true; // start with longitude

  while (hash.length < 4) {
    if (isLng) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        bits = (bits << 1) | 1;
        lngMin = mid;
      } else {
        bits = bits << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        bits = (bits << 1) | 1;
        latMin = mid;
      } else {
        bits = bits << 1;
        latMax = mid;
      }
    }
    isLng = !isLng;
    bitCount++;

    if (bitCount === 5) {
      hash += BASE32[bits];
      bits = 0;
      bitCount = 0;
    }
  }

  return hash;
}

/**
 * Decode a 4-character geohash back to a center lat/lng.
 */
function decodeGeohash(hash) {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let isLng = true;

  for (const char of hash) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) continue;

    for (let bit = 4; bit >= 0; bit--) {
      const val = (idx >> bit) & 1;
      if (isLng) {
        const mid = (lngMin + lngMax) / 2;
        if (val) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (val) latMin = mid;
        else latMax = mid;
      }
      isLng = !isLng;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
  };
}

// ─── Section keys ────────────────────────────────────────────────────────────

const SECTION_KEYS = ['free_nearby', 'just_listed', 'nearby_deals', 'wanted_nearby', 'by_category'];
const METERS_PER_MILE = 1609.34;
const DEFAULT_DISCOVERY_RADIUS_METERS = Math.round(100 * METERS_PER_MILE);

function normalizeRadiusMeters(radius) {
  const parsed = Number(radius);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed)
    : DEFAULT_DISCOVERY_RADIUS_METERS;
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

async function upsertSections(geohashPrefix, sections) {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  const rows = SECTION_KEYS
    .filter((key) => sections[key] !== undefined)
    .map((key) => ({
      geohash_prefix: geohashPrefix,
      section_key: key,
      payload: JSON.stringify(sections[key]),
      computed_at: now,
      expires_at: expiresAt,
    }));

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin
    .from('DiscoveryCache')
    .upsert(rows, { onConflict: 'geohash_prefix,section_key' });

  if (error) {
    logger.warn('DiscoveryCache upsert failed', { geohashPrefix, error: error.message });
  }
}

// ─── Enrichment (user-specific) ──────────────────────────────────────────────

function collectListingIds(sections) {
  const ids = [];
  for (const key of SECTION_KEYS) {
    const items = sections[key];
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item?.id) ids.push(item.id);
      }
    }
  }
  return ids;
}

function markSaved(sections, savedIds) {
  for (const key of SECTION_KEYS) {
    const items = sections[key];
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item?.id) item.is_saved = savedIds.has(item.id);
      }
    }
  }
}

function applySectionFilters(sections, filters) {
  const result = {};
  for (const key of SECTION_KEYS) {
    const items = sections[key];
    if (Array.isArray(items)) {
      result[key] = applyListingExclusions(items, filters);
    } else {
      result[key] = items;
    }
  }
  return result;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get cached discovery sections for a location, falling back to live query.
 */
async function getCachedDiscovery({ lat, lng, userId, radius }) {
  const radiusMeters = normalizeRadiusMeters(radius);

  if (radiusMeters !== DEFAULT_DISCOVERY_RADIUS_METERS) {
    return discoverListings({ lat, lng, userId, radius: radiusMeters });
  }

  const geohash = encodeGeohash(lat, lng);

  // Try cache first
  const { data: rows, error } = await supabaseAdmin
    .from('DiscoveryCache')
    .select('section_key, payload')
    .eq('geohash_prefix', geohash)
    .gt('expires_at', new Date().toISOString());

  if (!error && rows && rows.length >= 4) {
    // Cache hit — assemble sections from cached rows
    const sections = {};
    for (const row of rows) {
      try {
        sections[row.section_key] = typeof row.payload === 'string'
          ? JSON.parse(row.payload)
          : row.payload;
      } catch {
        // Skip malformed payload
      }
    }

    // User-specific enrichment
    if (userId) {
      const [savedIds, filters] = await Promise.all([
        getSavedListingIds(userId, collectListingIds(sections)),
        getMuteAndBlockFilters(userId),
      ]);
      markSaved(sections, savedIds);
      const filtered = applySectionFilters(sections, filters);
      return { sections: filtered, total_active: 0, free_count: 0, cached: true };
    }

    return { sections, total_active: 0, free_count: 0, cached: true };
  }

  // Cache miss — live query
  const result = await discoverListings({ lat, lng, userId, radius: radiusMeters });

  // Fire-and-forget: cache sections
  upsertSections(geohash, result.sections).catch((err) => {
    logger.warn('Background cache upsert failed', { geohash, error: err.message });
  });

  return result;
}

/**
 * Refresh the discovery cache for a specific geohash prefix (background job).
 */
async function refreshDiscoveryForGeohash(geohashPrefix) {
  const { lat, lng } = decodeGeohash(geohashPrefix);

  const result = await discoverListings({ lat, lng, userId: null });

  await upsertSections(geohashPrefix, result.sections);

  return { sections: Object.keys(result.sections).length, geohash: geohashPrefix };
}

/**
 * Get all geohash prefixes that have been active recently (computed_at within 1 hour).
 */
async function getActiveGeohashes() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('DiscoveryCache')
    .select('geohash_prefix')
    .gt('computed_at', oneHourAgo);

  if (error) {
    logger.error('getActiveGeohashes error', { error: error.message });
    return [];
  }

  // Deduplicate
  return [...new Set((data || []).map((r) => r.geohash_prefix))];
}

module.exports = {
  getCachedDiscovery,
  refreshDiscoveryForGeohash,
  getActiveGeohashes,
  // Exported for testing
  encodeGeohash,
  decodeGeohash,
};
