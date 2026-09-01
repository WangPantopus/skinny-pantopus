// ============================================================
// TEST: Ranking Service — composite relevance scoring
// ============================================================

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  computeRelevanceScore,
  rankGigs,
  computeCategoryMedians,
  buildAffinityLookup,
} = require('../../services/gig/rankingService');

// ─── Helpers ────────────────────────────────────────────────

function makeGig(overrides = {}) {
  return {
    id: overrides.id || `gig-${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title || 'Test gig',
    price: overrides.price ?? 50,
    category: overrides.category || 'Cleaning',
    distance_meters: overrides.distance_meters ?? 1000,
    created_at: overrides.created_at || new Date().toISOString(),
    ...overrides,
  };
}

function makeAffinity(category, score, dismissCount = 0) {
  return {
    user_id: 'user-1',
    category,
    affinity_score: score,
    view_count: 0,
    bid_count: 0,
    completion_count: 0,
    dismiss_count: dismissCount,
  };
}

// ─── computeCategoryMedians ─────────────────────────────────

describe('computeCategoryMedians', () => {
  it('computes median for a single category', () => {
    const gigs = [
      makeGig({ category: 'Cleaning', price: 30 }),
      makeGig({ category: 'Cleaning', price: 50 }),
      makeGig({ category: 'Cleaning', price: 70 }),
    ];
    const medians = computeCategoryMedians(gigs);
    expect(medians.get('Cleaning')).toBe(50);
  });

  it('computes median for even number of prices', () => {
    const gigs = [
      makeGig({ category: 'Moving', price: 40 }),
      makeGig({ category: 'Moving', price: 60 }),
    ];
    const medians = computeCategoryMedians(gigs);
    expect(medians.get('Moving')).toBe(50);
  });

  it('computes separate medians per category', () => {
    const gigs = [
      makeGig({ category: 'Cleaning', price: 30 }),
      makeGig({ category: 'Moving', price: 100 }),
    ];
    const medians = computeCategoryMedians(gigs);
    expect(medians.get('Cleaning')).toBe(30);
    expect(medians.get('Moving')).toBe(100);
  });

  it('skips gigs with no price', () => {
    const gigs = [makeGig({ price: null }), makeGig({ price: 50 })];
    const medians = computeCategoryMedians(gigs);
    expect(medians.get('Cleaning')).toBe(50);
  });
});

// ─── buildAffinityLookup ────────────────────────────────────

describe('buildAffinityLookup', () => {
  it('builds lookup map from affinity rows', () => {
    const rows = [makeAffinity('Cleaning', 15), makeAffinity('Moving', 10)];
    const lookup = buildAffinityLookup(rows);
    expect(lookup.byCategory.size).toBe(2);
    expect(lookup.topScore).toBe(15);
  });

  it('handles empty array', () => {
    const lookup = buildAffinityLookup([]);
    expect(lookup.byCategory.size).toBe(0);
    expect(lookup.topScore).toBe(0);
  });

  it('handles null input', () => {
    const lookup = buildAffinityLookup(null);
    expect(lookup.byCategory.size).toBe(0);
  });
});

// ─── computeRelevanceScore ──────────────────────────────────

describe('computeRelevanceScore', () => {
  it('returns score in 0-100 range', () => {
    const gig = makeGig({ distance_meters: 100, created_at: new Date().toISOString() });
    const score = computeRelevanceScore(gig, { maxRadius: 8047 });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('gives higher score to closer gigs', () => {
    const nearGig = makeGig({ distance_meters: 100 });
    const farGig = makeGig({ distance_meters: 7000 });
    const ctx = { maxRadius: 8047 };
    expect(computeRelevanceScore(nearGig, ctx)).toBeGreaterThan(
      computeRelevanceScore(farGig, ctx)
    );
  });

  it('gives higher score to newer gigs', () => {
    const newGig = makeGig({ created_at: new Date().toISOString() });
    const oldGig = makeGig({ created_at: new Date(Date.now() - 5 * 24 * 3600000).toISOString() });
    const ctx = { maxRadius: 8047 };
    expect(computeRelevanceScore(newGig, ctx)).toBeGreaterThan(
      computeRelevanceScore(oldGig, ctx)
    );
  });

  it('gives neutral affinity (10) when no affinity data', () => {
    const gig = makeGig({ distance_meters: 4000, created_at: new Date(Date.now() - 84 * 3600000).toISOString() });
    const score = computeRelevanceScore(gig, { maxRadius: 8047, affinities: [] });
    // With neutral affinity (10) and mid-range distance+recency, score should be reasonable
    expect(score).toBeGreaterThan(10);
    expect(score).toBeLessThan(80);
  });

  it('boosts gigs in high-affinity categories', () => {
    const gig = makeGig({ category: 'Cleaning', distance_meters: 4000 });
    const affinities = [makeAffinity('Cleaning', 20), makeAffinity('Moving', 5)];
    const ctx = { maxRadius: 8047, affinities };

    const scoreWithAffinity = computeRelevanceScore(gig, ctx);
    const scoreWithout = computeRelevanceScore(gig, { maxRadius: 8047, affinities: [] });

    expect(scoreWithAffinity).toBeGreaterThan(scoreWithout);
  });

  it('penalizes dismissed categories with negative scores', () => {
    const gig = makeGig({ category: 'Yard Work', distance_meters: 1000 });
    const affinities = [
      makeAffinity('Cleaning', 20),
      makeAffinity('Yard Work', -3, 2), // dismissed
    ];
    const ctx = { maxRadius: 8047, affinities };

    const scoreWithDismiss = computeRelevanceScore(gig, ctx);
    const scoreNeutral = computeRelevanceScore(gig, { maxRadius: 8047, affinities: [] });

    expect(scoreWithDismiss).toBeLessThan(scoreNeutral);
  });

  it('gives price score based on proximity to median', () => {
    const medianGig = makeGig({ category: 'Cleaning', price: 50, distance_meters: 4000 });
    const outlierGig = makeGig({ category: 'Cleaning', price: 200, distance_meters: 4000 });

    // Build context with pre-computed medians
    const gigs = [
      makeGig({ category: 'Cleaning', price: 40 }),
      makeGig({ category: 'Cleaning', price: 50 }),
      makeGig({ category: 'Cleaning', price: 60 }),
    ];
    const medians = computeCategoryMedians(gigs);
    const ctx = { maxRadius: 8047, affinities: [], _categoryMedians: medians };

    expect(computeRelevanceScore(medianGig, ctx)).toBeGreaterThan(
      computeRelevanceScore(outlierGig, ctx)
    );
  });

  it('handles gig with missing distance_meters', () => {
    const gig = makeGig({ distance_meters: undefined });
    const score = computeRelevanceScore(gig, { maxRadius: 8047 });
    // Should still compute without error (distance component = 0)
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('handles gig with missing created_at', () => {
    const gig = makeGig({ created_at: undefined, distance_meters: 1000 });
    const score = computeRelevanceScore(gig, { maxRadius: 8047 });
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ─── rankGigs ───────────────────────────────────────────────

describe('rankGigs', () => {
  it('sorts gigs by relevance score descending', () => {
    const gigs = [
      makeGig({ id: 'far-old', distance_meters: 7000, created_at: new Date(Date.now() - 6 * 24 * 3600000).toISOString() }),
      makeGig({ id: 'near-new', distance_meters: 100, created_at: new Date().toISOString() }),
      makeGig({ id: 'mid', distance_meters: 3000, created_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString() }),
    ];

    const ranked = rankGigs(gigs, { maxRadius: 8047 });
    expect(ranked[0].id).toBe('near-new');
    expect(ranked[ranked.length - 1].id).toBe('far-old');
  });

  it('attaches _relevanceScore to each gig', () => {
    const gigs = [makeGig()];
    const ranked = rankGigs(gigs, { maxRadius: 8047 });
    expect(ranked[0]._relevanceScore).toBeDefined();
    expect(typeof ranked[0]._relevanceScore).toBe('number');
  });

  it('returns empty array for empty input', () => {
    expect(rankGigs([], {})).toEqual([]);
    expect(rankGigs(null, {})).toEqual([]);
  });

  it('ranks pet_care gigs higher for user with pet_care affinity', () => {
    const gigs = [
      makeGig({ id: 'cleaning', category: 'Cleaning', distance_meters: 2000 }),
      makeGig({ id: 'pet_care', category: 'Pet Care', distance_meters: 2000 }),
    ];
    const affinities = [makeAffinity('Pet Care', 20)];
    const ranked = rankGigs(gigs, { maxRadius: 8047, affinities });
    expect(ranked[0].id).toBe('pet_care');
  });

  it('pre-computes category medians across all gigs', () => {
    const gigs = [
      makeGig({ category: 'Cleaning', price: 50 }),
      makeGig({ category: 'Cleaning', price: 50 }),
      makeGig({ category: 'Cleaning', price: 500 }), // outlier
    ];
    const ranked = rankGigs(gigs, { maxRadius: 8047 });
    // Outlier should rank lower than median-priced gigs (all else equal)
    const outlier = ranked.find(g => g.price === 500);
    const median = ranked.find(g => g.price === 50);
    expect(median._relevanceScore).toBeGreaterThanOrEqual(outlier._relevanceScore);
  });

  it('performance: ranks 100 gigs in under 50ms', () => {
    const gigs = Array.from({ length: 100 }, (_, i) =>
      makeGig({
        id: `gig-${i}`,
        distance_meters: Math.random() * 8000,
        price: 20 + Math.random() * 200,
        category: ['Cleaning', 'Moving', 'Pet Care', 'Yard Work'][i % 4],
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 3600000).toISOString(),
      })
    );
    const affinities = [
      makeAffinity('Cleaning', 15),
      makeAffinity('Pet Care', 10),
    ];

    const start = Date.now();
    const ranked = rankGigs(gigs, { maxRadius: 8047, affinities });
    const elapsed = Date.now() - start;

    expect(ranked).toHaveLength(100);
    expect(elapsed).toBeLessThan(50);
  });
});
