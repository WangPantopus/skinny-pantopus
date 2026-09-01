// ============================================================
// TEST: Discovery Scoring — Composite Score with Verification
// Validates that VERIFICATION_MULTIPLIERS correctly affect the
// composite ranking score and that new-business phantom counts
// interact properly with verification status.
// ============================================================

const {
  computeCompositeScore,
  isNewBusiness,
  NEW_BUSINESS_PHANTOM_COUNT,
} = require('../utils/discoveryScoring');
const { VERIFICATION_MULTIPLIERS } = require('../utils/businessConstants');

// Helper: build a search result row with sensible defaults
function makeRow(overrides = {}) {
  return {
    neighbor_count: '5',
    distance_meters: '800',   // ~0.5 miles
    average_rating: '4.5',
    review_count: '20',
    profile_completeness: '80',
    last_activity_at: new Date().toISOString(),
    completed_gigs: '10',
    profile_created_at: '2024-01-01T00:00:00Z',
    verification_status: 'self_attested',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────

describe('computeCompositeScore — verification multipliers', () => {
  test('unverified scores lower than self_attested (same signals)', () => {
    const base = makeRow({ verification_status: 'self_attested' });
    const unverified = makeRow({ verification_status: 'unverified' });

    const baseScore = computeCompositeScore(base);
    const unverifiedScore = computeCompositeScore(unverified);

    expect(baseScore).toBeGreaterThan(0);
    expect(unverifiedScore).toBeGreaterThan(0);
    expect(unverifiedScore).toBeLessThan(baseScore);

    // Exact ratio should be 0.85 / 1.0
    expect(unverifiedScore / baseScore).toBeCloseTo(
      VERIFICATION_MULTIPLIERS.unverified / VERIFICATION_MULTIPLIERS.self_attested,
      5,
    );
  });

  test('document_verified scores higher than self_attested', () => {
    const selfAttested = makeRow({ verification_status: 'self_attested' });
    const docVerified = makeRow({ verification_status: 'document_verified' });

    const selfScore = computeCompositeScore(selfAttested);
    const docScore = computeCompositeScore(docVerified);

    expect(docScore).toBeGreaterThan(selfScore);

    // Exact ratio should be 1.10 / 1.0
    expect(docScore / selfScore).toBeCloseTo(
      VERIFICATION_MULTIPLIERS.document_verified / VERIFICATION_MULTIPLIERS.self_attested,
      5,
    );
  });

  test('verification multipliers stack correctly across all tiers', () => {
    const scores = {};
    for (const status of ['unverified', 'self_attested', 'document_verified', 'government_verified']) {
      scores[status] = computeCompositeScore(makeRow({ verification_status: status }));
    }

    // Ordering: unverified < self_attested < document_verified < government_verified
    expect(scores.unverified).toBeLessThan(scores.self_attested);
    expect(scores.self_attested).toBeLessThan(scores.document_verified);
    expect(scores.document_verified).toBeLessThan(scores.government_verified);

    // Ratios match VERIFICATION_MULTIPLIERS
    for (const status of ['unverified', 'document_verified', 'government_verified']) {
      const ratio = scores[status] / scores.self_attested;
      const expectedRatio = VERIFICATION_MULTIPLIERS[status] / VERIFICATION_MULTIPLIERS.self_attested;
      expect(ratio).toBeCloseTo(expectedRatio, 5);
    }
  });

  test('new business phantom count interacts with verification multiplier', () => {
    // New business: few gigs + recent creation → phantom count kicks in
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago

    const newUnverified = makeRow({
      neighbor_count: '0',
      completed_gigs: '1',
      profile_created_at: recentDate,
      verification_status: 'unverified',
    });

    const newVerified = makeRow({
      neighbor_count: '0',
      completed_gigs: '1',
      profile_created_at: recentDate,
      verification_status: 'document_verified',
    });

    // Verify the business is treated as new
    expect(isNewBusiness('1', recentDate)).toBe(true);

    const unverifiedScore = computeCompositeScore(newUnverified);
    const verifiedScore = computeCompositeScore(newVerified);

    // Both should have non-zero scores (phantom count makes neighbor > 0)
    expect(unverifiedScore).toBeGreaterThan(0);
    expect(verifiedScore).toBeGreaterThan(0);

    // Verified new business scores higher than unverified new business
    expect(verifiedScore).toBeGreaterThan(unverifiedScore);

    // Ratio should match verification multiplier ratio
    const expectedRatio = VERIFICATION_MULTIPLIERS.document_verified / VERIFICATION_MULTIPLIERS.unverified;
    expect(verifiedScore / unverifiedScore).toBeCloseTo(expectedRatio, 5);
  });
});
