/**
 * Browse Sections Cache — lightweight in-memory, grid-based cache.
 *
 * Cache key strategy: round lat/lng to a grid of ~1.1 km (0.01 degree).
 * Users in the same grid cell share a cached result.
 *
 * Features:
 *  - LRU eviction when size exceeds MAX_ENTRIES (100)
 *  - Configurable TTL per entry
 *  - Grid-cell-based invalidation for gig create/update
 */

const logger = require('../../utils/logger');

const MAX_ENTRIES = 100;
const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 minutes
const GRID_PRECISION = 2; // decimal places → 0.01° ≈ 1.1 km

/**
 * @typedef {Object} CacheEntry
 * @property {*}      value     The cached data
 * @property {number} expiresAt Epoch ms when the entry expires
 * @property {number} lastUsed  Epoch ms when the entry was last accessed
 */

/** @type {Map<string, CacheEntry>} */
const store = new Map();

/** Monotonic counter for strict LRU ordering (avoids Date.now() ties). */
let accessCounter = 0;

// ── Helpers ─────────────────────────────────────────────────

/**
 * Round a coordinate to the grid precision.
 * @param {number} coord
 * @returns {string}
 */
function roundToGrid(coord) {
  return coord.toFixed(GRID_PRECISION);
}

/**
 * Build a cache key from lat, lng, and radius.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radius
 * @returns {string}
 */
function buildKey(lat, lng, radius) {
  return `gig_browse:${roundToGrid(lat)}:${roundToGrid(lng)}:${radius}`;
}

/**
 * Build the grid-cell prefix for a location (used for invalidation).
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
function gridPrefix(lat, lng) {
  return `gig_browse:${roundToGrid(lat)}:${roundToGrid(lng)}:`;
}

/**
 * Evict the least-recently-used entry when over capacity.
 */
function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;

  let oldestKey = null;
  let oldestTime = Infinity;

  for (const [key, entry] of store) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    store.delete(oldestKey);
    logger.debug('Browse cache LRU eviction', { key: oldestKey });
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Retrieve a cached value. Returns null on miss or expiry.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radius
 * @returns {*|null}
 */
function get(lat, lng, radius) {
  const key = buildKey(lat, lng, radius);
  const entry = store.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  entry.lastUsed = ++accessCounter;
  return entry.value;
}

/**
 * Store a value in the cache.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radius
 * @param {*}      value
 * @param {number} [ttlMs=DEFAULT_TTL_MS]
 */
function set(lat, lng, radius, value, ttlMs = DEFAULT_TTL_MS) {
  const key = buildKey(lat, lng, radius);
  const now = Date.now();

  store.set(key, {
    value,
    expiresAt: now + ttlMs,
    lastUsed: ++accessCounter,
  });

  evictIfNeeded();
}

/**
 * Invalidate all cache entries whose grid cell matches the given location.
 * Called when a gig is created/updated near this location.
 * @param {number} lat
 * @param {number} lng
 */
function invalidateNear(lat, lng) {
  const prefix = gridPrefix(lat, lng);
  let count = 0;

  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      count++;
    }
  }

  if (count > 0) {
    logger.info('Browse cache invalidated', { lat, lng, prefix, entriesRemoved: count });
  }
}

/**
 * Clear the entire cache.
 */
function clear() {
  store.clear();
}

/**
 * Current cache size (for monitoring / tests).
 * @returns {number}
 */
function size() {
  return store.size;
}

module.exports = {
  get,
  set,
  invalidateNear,
  clear,
  size,
  buildKey,
  gridPrefix,
  // Exported for testing
  _store: store,
  DEFAULT_TTL_MS,
  MAX_ENTRIES,
  GRID_PRECISION,
};
