/**
 * Offer Scoring Service for Gigs MVP
 *
 * Scores and ranks offers based on helper reliability, rating,
 * distance, experience, and response time.
 */

const PRO_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Roofing',
  'General Contractor',
  'Landscaping Pro',
  'Home Inspector',
  'Painting Pro',
  'Flooring',
];

/**
 * Infer engagement mode from category + schedule_type when not explicitly set.
 *
 * Rules:
 *   - schedule_type='asap' + non-pro category → 'instant_accept'
 *   - category in PRO_CATEGORIES             → 'quotes'
 *   - everything else                         → 'curated_offers'
 *
 * User-provided engagement_mode always overrides inference.
 */
function inferEngagementMode(category, scheduleType, userOverride) {
  if (userOverride) return userOverride;

  if (PRO_CATEGORIES.includes(category)) return 'quotes';
  if (scheduleType === 'asap') return 'instant_accept';
  return 'curated_offers';
}

/**
 * Score a single offer.  Each component is normalised to 0-100 and weighted.
 *
 * @param {object} offer        - offer row (must include joined User fields)
 * @param {object} gig          - the gig being bid on (used for distance calc)
 * @returns {number}            - composite score 0-100
 */
function computeScore(offer, gig) {
  // --- reliability (30%) ---
  const reliability = Number(offer.reliability_score ?? 100);

  // --- rating (25%) ---
  const avgRating = offer.average_rating != null ? Number(offer.average_rating) : 0;
  const ratingNorm = (avgRating / 5) * 100;

  // --- distance (20%) ---
  let distanceNorm = 50; // default when distance unknown
  if (offer.distance_miles != null) {
    const d = Number(offer.distance_miles);
    distanceNorm = d <= 1 ? 100 : Math.max(0, 100 - (d / 25) * 100);
  }

  // --- experience (15%) ---
  const completed = Number(offer.gigs_completed ?? 0);
  const experienceNorm = Math.min(100, Math.log2(completed + 1) * 15);

  // --- response time (10%) ---
  let responseNorm = 50; // default when data unavailable
  if (offer.avg_response_minutes != null) {
    const rt = Number(offer.avg_response_minutes);
    if (rt <= 5) responseNorm = 100;
    else if (rt >= 60) responseNorm = 0;
    else responseNorm = Math.max(0, 100 - ((rt - 5) / 55) * 100);
  }

  return (
    reliability * 0.30 +
    ratingNorm * 0.25 +
    distanceNorm * 0.20 +
    experienceNorm * 0.15 +
    responseNorm * 0.10
  );
}

/**
 * Score, rank, and enrich an array of offers.
 *
 * Mutates nothing — returns a new array sorted by match_score desc.
 * Rank-1 offer gets is_recommended = true.
 * Tie-breaking: higher gigs_completed wins.
 *
 * @param {object[]} offers - raw offer rows (with joined user fields)
 * @param {object}   gig    - the gig object
 * @returns {object[]}       - enriched copies sorted by score desc
 */
function scoreOffers(offers, gig) {
  if (!offers || offers.length === 0) return [];

  const scored = offers.map((offer) => ({
    ...offer,
    match_score: Math.round(computeScore(offer, gig) * 100) / 100,
  }));

  // Sort desc by score, tie-break by gigs_completed desc
  scored.sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    return (b.gigs_completed ?? 0) - (a.gigs_completed ?? 0);
  });

  // Assign ranks
  scored.forEach((o, i) => {
    o.match_rank = i + 1;
    o.is_recommended = i === 0;
  });

  return scored;
}

module.exports = {
  scoreOffers,
  computeScore,
  inferEngagementMode,
  PRO_CATEGORIES,
};
