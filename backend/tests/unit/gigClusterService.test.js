// ============================================================
// TEST: Gig Cluster Service
//
// Unit tests for clusterService (getGigClusters, getStackedGigs)
// and jaccardUtils (normalizeTitle, jaccardSimilarity).
// ============================================================

// Load the in-memory mock module before jest.mock runs
const mockAdmin = jest.requireActual('../__mocks__/supabaseAdmin');
const { setRpcMock, resetTables } = mockAdmin;

// ── Mock supabaseAdmin to use our in-memory mock ─────────────
jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));

const { normalizeTitle, jaccardSimilarity } = require('../../services/gig/jaccardUtils');
const { getGigClusters, getStackedGigs } = require('../../services/gig/clusterService');

// ─── Helpers ────────────────────────────────────────────────

function makeGig(overrides = {}) {
  return {
    id: overrides.id || `gig-${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title || 'Test gig',
    description: overrides.description || 'Test description',
    price: overrides.price ?? 50,
    category: overrides.category || 'Cleaning',
    status: 'open',
    created_at: overrides.created_at || new Date().toISOString(),
    distance_meters: overrides.distance_meters ?? 1000,
    ...overrides,
  };
}

// ─── Jaccard Tests ──────────────────────────────────────────

describe('jaccardUtils', () => {
  describe('normalizeTitle', () => {
    it('lowercases and strips punctuation', () => {
      expect(normalizeTitle('Fix My Sink!')).toEqual(['fix', 'sink']);
    });

    it('strips numbers', () => {
      expect(normalizeTitle('Clean 3 rooms for $50')).toEqual(['clean', 'rooms']);
    });

    it('removes stop words', () => {
      expect(normalizeTitle('I need help with the yard')).toEqual(['yard']);
    });

    it('returns empty array for null/empty input', () => {
      expect(normalizeTitle(null)).toEqual([]);
      expect(normalizeTitle('')).toEqual([]);
    });
  });

  describe('jaccardSimilarity', () => {
    it('returns 1.0 for identical token sets', () => {
      expect(jaccardSimilarity(['pet', 'sitter'], ['pet', 'sitter'])).toBe(1);
    });

    it('returns 0 for completely different sets', () => {
      expect(jaccardSimilarity(['fix', 'garbage'], ['yard', 'cleanup'])).toBe(0);
    });

    it('returns 0 for empty inputs', () => {
      expect(jaccardSimilarity([], ['pet'])).toBe(0);
      expect(jaccardSimilarity(null, ['pet'])).toBe(0);
    });

    it('similar pet sitter titles score >= 0.6', () => {
      const a = normalizeTitle('Need weekend pet sitter drop-ins');
      const b = normalizeTitle('Need weekend pet sitter drop ins');
      expect(jaccardSimilarity(a, b)).toBeGreaterThanOrEqual(0.6);
    });

    it('dissimilar titles score < 0.6', () => {
      const a = normalizeTitle('Fix garbage disposal leak');
      const b = normalizeTitle('Yard cleanup before weekend');
      expect(jaccardSimilarity(a, b)).toBeLessThan(0.6);
    });

    it('partial overlap gives intermediate score', () => {
      const a = normalizeTitle('Walk my dog Tuesday');
      const b = normalizeTitle('Walk my cat Tuesday');
      const score = jaccardSimilarity(a, b);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });
  });
});

// ─── getGigClusters Tests ───────────────────────────────────

describe('getGigClusters', () => {
  afterEach(() => {
    resetTables();
    setRpcMock(null);
  });

  it('returns empty array when no lat/lng provided', async () => {
    const result = await getGigClusters({});
    expect(result).toEqual([]);
  });

  it('returns empty array when RPC returns 0 gigs', async () => {
    setRpcMock(() => ({ data: [], error: null }));
    const result = await getGigClusters({ lat: 37.77, lng: -122.42 });
    expect(result).toEqual([]);
  });

  it('groups gigs by category with correct counts', async () => {
    const gigs = [
      makeGig({ category: 'Cleaning', price: 40, distance_meters: 500 }),
      makeGig({ category: 'Cleaning', price: 60, distance_meters: 1200 }),
      makeGig({ category: 'Cleaning', price: 80, distance_meters: 800 }),
      makeGig({ category: 'Pet Care', price: 30, distance_meters: 200 }),
      makeGig({ category: 'Pet Care', price: 50, distance_meters: 2000 }),
    ];
    setRpcMock(() => ({ data: gigs, error: null }));

    const clusters = await getGigClusters({ lat: 37.77, lng: -122.42 });

    expect(clusters).toHaveLength(2);
    expect(clusters[0].category).toBe('Cleaning');
    expect(clusters[0].count).toBe(3);
    expect(clusters[1].category).toBe('Pet Care');
    expect(clusters[1].count).toBe(2);
  });

  it('computes price_min, price_max, price_avg correctly', async () => {
    const gigs = [
      makeGig({ category: 'Cleaning', price: 40 }),
      makeGig({ category: 'Cleaning', price: 60 }),
      makeGig({ category: 'Cleaning', price: 80 }),
    ];
    setRpcMock(() => ({ data: gigs, error: null }));

    const clusters = await getGigClusters({ lat: 37.77, lng: -122.42 });

    expect(clusters[0].price_min).toBe(40);
    expect(clusters[0].price_max).toBe(80);
    expect(clusters[0].price_avg).toBe(60);
  });

  it('computes nearest_distance correctly', async () => {
    const gigs = [
      makeGig({ category: 'Cleaning', distance_meters: 500 }),
      makeGig({ category: 'Cleaning', distance_meters: 1200 }),
    ];
    setRpcMock(() => ({ data: gigs, error: null }));

    const clusters = await getGigClusters({ lat: 37.77, lng: -122.42 });

    expect(clusters[0].nearest_distance).toBe(500);
  });

  it('can cluster a provided gig list and exclude a user without calling RPC', async () => {
    let rpcCalled = false;
    setRpcMock(() => {
      rpcCalled = true;
      return { data: [], error: null };
    });

    const clusters = await getGigClusters({
      gigs: [
        makeGig({ id: 'mine', user_id: 'user-1', category: 'Cleaning' }),
        makeGig({ id: 'clean-2', user_id: 'user-2', category: 'Cleaning' }),
        makeGig({ id: 'pet-1', user_id: 'user-2', category: 'Pet Care' }),
        makeGig({ id: 'pet-2', user_id: 'user-3', category: 'Pet Care' }),
      ],
      excludeUserId: 'user-1',
    });

    expect(rpcCalled).toBe(false);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].category).toBe('Pet Care');
    expect(clusters[0].count).toBe(2);
  });

  it('excludes categories with fewer than 2 gigs', async () => {
    const gigs = [
      makeGig({ category: 'Cleaning' }),
      makeGig({ category: 'Cleaning' }),
      makeGig({ category: 'Moving' }), // singleton
    ];
    setRpcMock(() => ({ data: gigs, error: null }));

    const clusters = await getGigClusters({ lat: 37.77, lng: -122.42 });

    expect(clusters).toHaveLength(1);
    expect(clusters[0].category).toBe('Cleaning');
  });

  it('respects limit parameter', async () => {
    const gigs = [
      ...Array.from({ length: 5 }, () => makeGig({ category: 'Cleaning' })),
      ...Array.from({ length: 4 }, () => makeGig({ category: 'Pet Care' })),
      ...Array.from({ length: 3 }, () => makeGig({ category: 'Moving' })),
      ...Array.from({ length: 2 }, () => makeGig({ category: 'Delivery' })),
    ];
    setRpcMock(() => ({ data: gigs, error: null }));

    const clusters = await getGigClusters({ lat: 37.77, lng: -122.42, limit: 2 });

    expect(clusters).toHaveLength(2);
    expect(clusters[0].category).toBe('Cleaning');
    expect(clusters[1].category).toBe('Pet Care');
  });

  it('handles RPC error gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setRpcMock(() => ({ data: null, error: { message: 'RPC failed' } }));

    const result = await getGigClusters({ lat: 37.77, lng: -122.42 });

    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });
});

// ─── getStackedGigs Tests ───────────────────────────────────

describe('getStackedGigs', () => {
  afterEach(() => {
    resetTables();
    setRpcMock(null);
  });

  it('returns empty array with no category', async () => {
    const result = await getStackedGigs(null, { lat: 37.77, lng: -122.42 });
    expect(result).toEqual([]);
  });

  it('returns empty array when RPC returns 0 gigs', async () => {
    setRpcMock(() => ({ data: [], error: null }));
    const result = await getStackedGigs('Cleaning', { lat: 37.77, lng: -122.42 });
    expect(result).toEqual([]);
  });

  it('groups near-duplicate titles into stacks', async () => {
    const now = new Date().toISOString();
    const gigs = [
      makeGig({ id: 'g1', title: 'Need weekend pet sitter', created_at: now }),
      makeGig({ id: 'g2', title: 'Need weekend pet sitter drop-ins', created_at: now }),
      makeGig({ id: 'g3', title: 'Fix garbage disposal', created_at: now }),
    ];
    setRpcMock(() => ({ data: gigs, error: null }));

    const stacks = await getStackedGigs('Pet Care', { lat: 37.77, lng: -122.42 });

    // Should have 2 results: one stack (2 similar), one singleton
    const multiStack = stacks.find((s) => s.count >= 2);
    const singleton = stacks.find((s) => s.count === 1);

    expect(multiStack).toBeDefined();
    expect(multiStack.gig_ids).toContain('g1');
    expect(multiStack.gig_ids).toContain('g2');

    expect(singleton).toBeDefined();
    expect(singleton.gig_ids).toContain('g3');
  });

  it('returns singletons for dissimilar titles', async () => {
    const gigs = [
      makeGig({ id: 'g1', title: 'Walk my dog' }),
      makeGig({ id: 'g2', title: 'Fix broken faucet' }),
      makeGig({ id: 'g3', title: 'Mow the lawn' }),
    ];
    setRpcMock(() => ({ data: gigs, error: null }));

    const stacks = await getStackedGigs('Other', { lat: 37.77, lng: -122.42 });

    expect(stacks).toHaveLength(3);
    expect(stacks.every((s) => s.count === 1)).toBe(true);
  });

  it('stacks appear before singletons in results', async () => {
    const gigs = [
      makeGig({ id: 'g1', title: 'Weekend pet sitting' }),
      makeGig({ id: 'g2', title: 'Weekend pet sitting service' }),
      makeGig({ id: 'g3', title: 'Fix my broken window' }),
    ];
    setRpcMock(() => ({ data: gigs, error: null }));

    const stacks = await getStackedGigs('Pet Care', { lat: 37.77, lng: -122.42 });

    // Stacks (count > 1) should come first
    const firstMulti = stacks.findIndex((s) => s.count > 1);
    const firstSingle = stacks.findIndex((s) => s.count === 1);
    if (firstMulti !== -1 && firstSingle !== -1) {
      expect(firstMulti).toBeLessThan(firstSingle);
    }
  });

  it('computes stack price_min and price_max', async () => {
    const gigs = [
      makeGig({ id: 'g1', title: 'Clean apartment deep clean', price: 80 }),
      makeGig({ id: 'g2', title: 'Clean apartment deep cleaning', price: 120 }),
    ];
    setRpcMock(() => ({ data: gigs, error: null }));

    const stacks = await getStackedGigs('Cleaning', { lat: 37.77, lng: -122.42 });

    const stack = stacks.find((s) => s.count === 2);
    expect(stack).toBeDefined();
    expect(stack.price_min).toBe(80);
    expect(stack.price_max).toBe(120);
  });

  it('handles RPC error gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setRpcMock(() => ({ data: null, error: { message: 'RPC failed' } }));

    const result = await getStackedGigs('Cleaning', { lat: 37.77, lng: -122.42 });

    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });
});
