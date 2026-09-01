/**
 * Lightweight in-memory LRU cache with per-entry TTL.
 * No external dependencies. Max entries enforced via LRU eviction.
 */
class GeoCache {
  constructor(maxEntries = 2000) {
    this.maxEntries = maxEntries;
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this._map = new Map();
  }

  /**
   * Get a cached value by key. Returns undefined on miss or expiry.
   * Promotes the entry to most-recently-used on hit.
   */
  get(key) {
    const entry = this._map.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this._map.delete(key);
      return undefined;
    }

    // Promote to most-recently-used by reinserting
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  /**
   * Set a value with a TTL in milliseconds.
   */
  set(key, value, ttlMs) {
    // Delete first so reinsertion puts it at the end (most recent)
    this._map.delete(key);

    // Evict least-recently-used entries if at capacity
    while (this._map.size >= this.maxEntries) {
      const oldest = this._map.keys().next().value;
      this._map.delete(oldest);
    }

    this._map.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Clear all entries.
   */
  clear() {
    this._map.clear();
  }

  /**
   * Current number of entries (including possibly expired ones).
   */
  get size() {
    return this._map.size;
  }
}

// Export singleton instance and class for testing
const geoCache = new GeoCache();
module.exports = { GeoCache, geoCache };
