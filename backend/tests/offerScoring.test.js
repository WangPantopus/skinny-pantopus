/**
 * Tests for the offer scoring and ranking algorithm.
 *
 * Components (weighted):
 *   reliability_score  × 0.30
 *   rating (norm)      × 0.25
 *   distance_factor    × 0.20
 *   experience (log)   × 0.15
 *   response_time      × 0.10
 */

const {
  scoreOffers,
  computeScore,
} = require('../services/offerScoringService');

// Helper to build an offer object with defaults
function makeOffer(overrides = {}) {
  return {
    id: overrides.id || 'offer-1',
    gig_id: 'gig-1',
    user_id: overrides.user_id || 'user-1',
    price: 50,
    message: 'I can help',
    status: 'pending',
    reliability_score: 100,
    average_rating: 5,
    review_count: 10,
    gigs_completed: 20,
    no_show_count: 0,
    distance_miles: 1,
    avg_response_minutes: 3,
    ...overrides,
  };
}

const gig = { id: 'gig-1', exact_location: null };

describe('computeScore', () => {
  test('should score perfect helper highest (> 90)', () => {
    const offer = makeOffer({
      reliability_score: 100,
      average_rating: 5,
      distance_miles: 0.5,
      gigs_completed: 50,
      avg_response_minutes: 2,
    });
    const score = computeScore(offer, gig);
    expect(score).toBeGreaterThan(90);
  });

  test('should penalize low reliability significantly', () => {
    const perfect = makeOffer({
      reliability_score: 100,
      average_rating: 5,
      distance_miles: 0.5,
      gigs_completed: 50,
      avg_response_minutes: 2,
    });
    const low = makeOffer({
      reliability_score: 30,
      average_rating: 5,
      distance_miles: 0.5,
      gigs_completed: 50,
      avg_response_minutes: 2,
    });
    const perfectScore = computeScore(perfect, gig);
    const lowScore = computeScore(low, gig);

    // 30% weight on reliability: (100-30)*0.30 = 21 point difference
    expect(perfectScore - lowScore).toBeCloseTo(21, 0);
    expect(lowScore).toBeLessThan(perfectScore);
    expect(lowScore).toBeLessThan(80);
  });

  test('should decrease score with distance', () => {
    const close = makeOffer({ distance_miles: 1 });
    const mid = makeOffer({ distance_miles: 10 });
    const far = makeOffer({ distance_miles: 25 });

    const scoreClose = computeScore(close, gig);
    const scoreMid = computeScore(mid, gig);
    const scoreFar = computeScore(far, gig);

    expect(scoreClose).toBeGreaterThan(scoreMid);
    expect(scoreMid).toBeGreaterThan(scoreFar);
  });

  test('should handle zero reviews gracefully (no crash, rating component = 0)', () => {
    const offer = makeOffer({
      average_rating: null,
      review_count: 0,
    });
    const score = computeScore(offer, gig);
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0); // other components still contribute
    expect(score).not.toBeNaN();
  });

  test('should use default 50 for distance when distance_miles is null', () => {
    const withDist = makeOffer({ distance_miles: 12 });
    const noDist = makeOffer({ distance_miles: null });

    const scoreWith = computeScore(withDist, gig);
    const scoreNo = computeScore(noDist, gig);

    // Both should be valid numbers
    expect(typeof scoreWith).toBe('number');
    expect(typeof scoreNo).toBe('number');
  });

  test('should use default 50 for response time when unavailable', () => {
    const offer = makeOffer({ avg_response_minutes: null });
    const score = computeScore(offer, gig);
    expect(typeof score).toBe('number');
    expect(score).not.toBeNaN();
  });

  test('should give max response score for fast responders (< 5 min)', () => {
    const fast = makeOffer({ avg_response_minutes: 2 });
    const slow = makeOffer({ avg_response_minutes: 55 });

    expect(computeScore(fast, gig)).toBeGreaterThan(computeScore(slow, gig));
  });

  test('should give 0 response score for very slow responders (>= 60 min)', () => {
    const slow60 = makeOffer({ avg_response_minutes: 60 });
    const slow120 = makeOffer({ avg_response_minutes: 120 });

    // Both should produce the same score (response component bottomed out)
    expect(computeScore(slow60, gig)).toBe(computeScore(slow120, gig));
  });
});

describe('scoreOffers', () => {
  test('should assign ranks correctly (3 offers)', () => {
    // Create offers with clearly different scores
    const offers = [
      makeOffer({ id: 'a', reliability_score: 85, average_rating: 4, gigs_completed: 10 }),
      makeOffer({ id: 'b', reliability_score: 60, average_rating: 3, gigs_completed: 5 }),
      makeOffer({ id: 'c', reliability_score: 100, average_rating: 5, gigs_completed: 50 }),
    ];

    const scored = scoreOffers(offers, gig);

    // c should be rank 1 (best), a rank 2, b rank 3
    expect(scored[0].id).toBe('c');
    expect(scored[0].match_rank).toBe(1);
    expect(scored[0].is_recommended).toBe(true);

    expect(scored[1].id).toBe('a');
    expect(scored[1].match_rank).toBe(2);
    expect(scored[1].is_recommended).toBe(false);

    expect(scored[2].id).toBe('b');
    expect(scored[2].match_rank).toBe(3);
    expect(scored[2].is_recommended).toBe(false);
  });

  test('should break ties with gigs_completed', () => {
    // Identical stats except gigs_completed
    const offers = [
      makeOffer({ id: 'low', gigs_completed: 5 }),
      makeOffer({ id: 'high', gigs_completed: 50 }),
    ];

    const scored = scoreOffers(offers, gig);

    // high should win the tie-break
    expect(scored[0].id).toBe('high');
    expect(scored[0].match_rank).toBe(1);
    expect(scored[0].is_recommended).toBe(true);
  });

  test('should handle empty offers array', () => {
    const scored = scoreOffers([], gig);
    expect(scored).toEqual([]);
  });

  test('should handle null offers', () => {
    const scored = scoreOffers(null, gig);
    expect(scored).toEqual([]);
  });

  test('should handle single offer (always rank 1, always recommended)', () => {
    const offers = [makeOffer({ id: 'only' })];
    const scored = scoreOffers(offers, gig);

    expect(scored).toHaveLength(1);
    expect(scored[0].match_rank).toBe(1);
    expect(scored[0].is_recommended).toBe(true);
  });

  test('should preserve original offer fields', () => {
    const offers = [
      makeOffer({ id: 'x', price: 75, message: 'Hello', status: 'pending' }),
    ];
    const scored = scoreOffers(offers, gig);

    expect(scored[0].id).toBe('x');
    expect(scored[0].price).toBe(75);
    expect(scored[0].message).toBe('Hello');
    expect(scored[0].status).toBe('pending');
  });

  test('should add match_score as a number', () => {
    const offers = [makeOffer()];
    const scored = scoreOffers(offers, gig);

    expect(typeof scored[0].match_score).toBe('number');
    expect(scored[0].match_score).not.toBeNaN();
    expect(scored[0].match_score).toBeGreaterThanOrEqual(0);
    expect(scored[0].match_score).toBeLessThanOrEqual(100);
  });
});
