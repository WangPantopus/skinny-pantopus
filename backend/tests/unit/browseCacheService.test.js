// ============================================================
// TEST: Browse Cache Service — grid-based in-memory cache
// ============================================================

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const browseCache = require('../../services/gig/browseCacheService');

describe('browseCacheService', () => {
  afterEach(() => {
    browseCache.clear();
  });

  // ── Basic get/set ─────────────────────────────────────────

  it('returns null on cache miss', () => {
    expect(browseCache.get(37.77, -122.42, 8047)).toBeNull();
  });

  it('stores and retrieves a value', () => {
    const data = { sections: { best_matches: [] }, total_active: 5 };
    browseCache.set(37.77, -122.42, 8047, data);
    expect(browseCache.get(37.77, -122.42, 8047)).toEqual(data);
  });

  it('returns null after TTL expires', () => {
    browseCache.set(37.77, -122.42, 8047, { test: true }, 1); // 1ms TTL

    // Wait just beyond TTL
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy-wait 5ms

    expect(browseCache.get(37.77, -122.42, 8047)).toBeNull();
  });

  // ── Grid-based key strategy ───────────────────────────────

  it('users in same grid cell share cache', () => {
    const data = { shared: true };
    // 37.7700 and 37.7749 both round to 37.77
    browseCache.set(37.7700, -122.4200, 8047, data);
    expect(browseCache.get(37.7749, -122.4249, 8047)).toEqual(data);
  });

  it('users in different grid cells get different cache', () => {
    browseCache.set(37.77, -122.42, 8047, { cell1: true });
    browseCache.set(37.78, -122.42, 8047, { cell2: true });

    expect(browseCache.get(37.77, -122.42, 8047)).toEqual({ cell1: true });
    expect(browseCache.get(37.78, -122.42, 8047)).toEqual({ cell2: true });
  });

  it('different radius produces different cache key', () => {
    browseCache.set(37.77, -122.42, 8047, { r1: true });
    expect(browseCache.get(37.77, -122.42, 16000)).toBeNull();
  });

  // ── buildKey / gridPrefix ─────────────────────────────────

  it('buildKey produces expected format', () => {
    const key = browseCache.buildKey(37.7749, -122.4201, 8047);
    expect(key).toBe('gig_browse:37.77:-122.42:8047');
  });

  it('gridPrefix produces expected format', () => {
    const prefix = browseCache.gridPrefix(37.77, -122.42);
    expect(prefix).toBe('gig_browse:37.77:-122.42:');
  });

  // ── Invalidation ──────────────────────────────────────────

  it('invalidateNear removes matching entries', () => {
    browseCache.set(37.77, -122.42, 8047, { r1: true });
    browseCache.set(37.77, -122.42, 16000, { r2: true }); // same cell, diff radius
    browseCache.set(37.78, -122.42, 8047, { other: true }); // different cell

    browseCache.invalidateNear(37.77, -122.42);

    expect(browseCache.get(37.77, -122.42, 8047)).toBeNull();
    expect(browseCache.get(37.77, -122.42, 16000)).toBeNull();
    expect(browseCache.get(37.78, -122.42, 8047)).toEqual({ other: true });
  });

  it('invalidateNear with no matching entries does nothing', () => {
    browseCache.set(37.77, -122.42, 8047, { data: true });
    browseCache.invalidateNear(40.0, -74.0); // NYC — different cell
    expect(browseCache.get(37.77, -122.42, 8047)).toEqual({ data: true });
  });

  // ── LRU eviction ──────────────────────────────────────────

  it('evicts LRU entry when exceeding MAX_ENTRIES', () => {
    // Fill cache to max
    for (let i = 0; i < browseCache.MAX_ENTRIES; i++) {
      const lat = 30 + (i * 0.01);
      browseCache.set(lat, -100, 8047, { index: i });
    }

    expect(browseCache.size()).toBe(browseCache.MAX_ENTRIES);

    // Access the first entry to make it recently used
    browseCache.get(30.00, -100, 8047);

    // Add one more — should evict the least recently used (second entry, index 1)
    browseCache.set(99.00, -100, 8047, { overflow: true });

    // Cache should not exceed max
    expect(browseCache.size()).toBeLessThanOrEqual(browseCache.MAX_ENTRIES);

    // The first entry should still exist (was recently accessed)
    expect(browseCache.get(30.00, -100, 8047)).toEqual({ index: 0 });

    // The new entry should exist
    expect(browseCache.get(99.00, -100, 8047)).toEqual({ overflow: true });
  });

  // ── clear / size ──────────────────────────────────────────

  it('clear empties the cache', () => {
    browseCache.set(37.77, -122.42, 8047, { data: true });
    browseCache.set(37.78, -122.42, 8047, { data: true });
    expect(browseCache.size()).toBe(2);

    browseCache.clear();
    expect(browseCache.size()).toBe(0);
  });
});
