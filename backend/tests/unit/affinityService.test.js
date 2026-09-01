// ============================================================
// TEST: Affinity Service — user category affinity tracking
// ============================================================

const mockAdmin = jest.requireActual('../__mocks__/supabaseAdmin');
const { resetTables } = mockAdmin;

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  recordInteraction,
  getUserAffinities,
  getCategoryAffinity,
  computeScore,
} = require('../../services/gig/affinityService');

describe('affinityService', () => {
  beforeEach(() => {
    resetTables();
  });

  // ── computeScore ─────────────────────────────────────────

  describe('computeScore', () => {
    it('computes score with all counters', () => {
      expect(computeScore({
        view_count: 10,
        bid_count: 2,
        completion_count: 1,
        dismiss_count: 1,
      })).toBe(10 * 1 + 2 * 5 + 1 * 10 - 1 * 3); // 10 + 10 + 10 - 3 = 27
    });

    it('returns 0 for all zeros', () => {
      expect(computeScore({})).toBe(0);
    });

    it('handles negative scores from many dismissals', () => {
      expect(computeScore({ dismiss_count: 5 })).toBe(-15);
    });
  });

  // ── recordInteraction ────────────────────────────────────

  describe('recordInteraction', () => {
    it('creates a new affinity row on first interaction', async () => {
      const result = await recordInteraction('user-1', 'Cleaning', 'bid');
      expect(result).not.toBeNull();
      expect(result.user_id).toBe('user-1');
      expect(result.category).toBe('Cleaning');
      expect(result.bid_count).toBe(1);
      expect(result.view_count).toBe(0);
      expect(result.affinity_score).toBe(5); // 1 bid * 5
    });

    it('increments bid_count on subsequent bids', async () => {
      await recordInteraction('user-1', 'Cleaning', 'bid');
      const result = await recordInteraction('user-1', 'Cleaning', 'bid');
      expect(result.bid_count).toBe(2);
      expect(result.affinity_score).toBe(10); // 2 bids * 5
    });

    it('tracks views separately from bids', async () => {
      await recordInteraction('user-1', 'Cleaning', 'view');
      await recordInteraction('user-1', 'Cleaning', 'view');
      await recordInteraction('user-1', 'Cleaning', 'bid');
      const result = await recordInteraction('user-1', 'Cleaning', 'view');
      expect(result.view_count).toBe(3);
      expect(result.bid_count).toBe(1);
      expect(result.affinity_score).toBe(3 * 1 + 1 * 5); // 8
    });

    it('tracks completions with weight 10', async () => {
      const result = await recordInteraction('user-1', 'Moving', 'completion');
      expect(result.completion_count).toBe(1);
      expect(result.affinity_score).toBe(10);
    });

    it('decreases score on dismiss', async () => {
      await recordInteraction('user-1', 'Cleaning', 'bid');
      const result = await recordInteraction('user-1', 'Cleaning', 'dismiss');
      expect(result.dismiss_count).toBe(1);
      expect(result.affinity_score).toBe(5 - 3); // 2
    });

    it('tracks different categories independently', async () => {
      await recordInteraction('user-1', 'Cleaning', 'bid');
      await recordInteraction('user-1', 'Moving', 'completion');

      const cleaning = await getCategoryAffinity('user-1', 'Cleaning');
      const moving = await getCategoryAffinity('user-1', 'Moving');
      expect(cleaning).toBe(5);
      expect(moving).toBe(10);
    });

    it('returns null for invalid args', async () => {
      expect(await recordInteraction(null, 'Cleaning', 'bid')).toBeNull();
      expect(await recordInteraction('user-1', null, 'bid')).toBeNull();
      expect(await recordInteraction('user-1', 'Cleaning', 'invalid')).toBeNull();
    });

    it('sets last_interaction_at on each interaction', async () => {
      const result = await recordInteraction('user-1', 'Cleaning', 'view');
      expect(result.last_interaction_at).toBeDefined();
    });
  });

  // ── getUserAffinities ────────────────────────────────────

  describe('getUserAffinities', () => {
    it('returns empty array for new user', async () => {
      const result = await getUserAffinities('new-user');
      expect(result).toEqual([]);
    });

    it('returns all categories for a user', async () => {
      await recordInteraction('user-1', 'Cleaning', 'bid');
      await recordInteraction('user-1', 'Moving', 'completion');
      await recordInteraction('user-1', 'Pet Care', 'view');

      const affinities = await getUserAffinities('user-1');
      expect(affinities).toHaveLength(3);
    });

    it('returns empty for null userId', async () => {
      const result = await getUserAffinities(null);
      expect(result).toEqual([]);
    });
  });

  // ── getCategoryAffinity ──────────────────────────────────

  describe('getCategoryAffinity', () => {
    it('returns 0 for unknown category', async () => {
      const score = await getCategoryAffinity('user-1', 'Nonexistent');
      expect(score).toBe(0);
    });

    it('returns correct score for tracked category', async () => {
      await recordInteraction('user-1', 'Cleaning', 'bid');
      await recordInteraction('user-1', 'Cleaning', 'completion');
      const score = await getCategoryAffinity('user-1', 'Cleaning');
      expect(score).toBe(5 + 10); // 15
    });

    it('returns 0 for null args', async () => {
      expect(await getCategoryAffinity(null, 'Cleaning')).toBe(0);
      expect(await getCategoryAffinity('user-1', null)).toBe(0);
    });
  });
});
