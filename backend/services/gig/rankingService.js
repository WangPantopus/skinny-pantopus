// ============================================================
// Ranking Service — composite relevance scoring for gigs
//
// Scores gigs on a 0–100 scale across four dimensions:
//   distance_score  (0-40): closer = higher
//   recency_score   (0-30): newer = higher
//   affinity_score  (0-20): user's category affinity
//   price_score     (0-10): proximity to category median price
//
// Exports:
//   computeRelevanceScore(gig, userContext) → number (0–100)
//   rankGigs(gigs, userContext)             → Gig[] sorted by score DESC
// ============================================================

const logger = require('../../utils/logger');

// ── Score weights ───────────────────────────────────────────

const MAX_DISTANCE_SCORE = 40;
const MAX_RECENCY_SCORE = 30;
const MAX_AFFINITY_SCORE = 20;
const MAX_PRICE_SCORE = 10;

const RECENCY_WINDOW_HOURS = 168; // 1 week

// ── Helpers ─────────────────────────────────────────────────

/**
 * Compute category median prices from a gig list.
 * Returns Map<category, median_price>.
 */
function computeCategoryMedians(gigs) {
  const byCategory = new Map();
  for (const g of gigs) {
    const price = parseFloat(g.price);
    if (!Number.isFinite(price) || !g.category) continue;
    if (!byCategory.has(g.category)) byCategory.set(g.category, []);
    byCategory.get(g.category).push(price);
  }

  const medians = new Map();
  for (const [cat, prices] of byCategory) {
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const median = prices.length % 2 === 0
      ? (prices[mid - 1] + prices[mid]) / 2
      : prices[mid];
    medians.set(cat, median);
  }
  return medians;
}

/**
 * Build an affinity lookup map from affinity rows.
 * Returns { byCategory: Map<category, row>, topScore: number }
 */
function buildAffinityLookup(affinities) {
  const byCategory = new Map();
  let topScore = 0;
  for (const row of affinities || []) {
    byCategory.set(row.category, row);
    if (row.affinity_score > topScore) topScore = row.affinity_score;
  }
  return { byCategory, topScore };
}

// ── Main scoring function ───────────────────────────────────

/**
 * Compute a composite relevance score for a single gig.
 *
 * @param {Object} gig - Gig with distance_meters, created_at, price, category
 * @param {Object} userContext
 * @param {number} userContext.maxRadius - the search radius in meters
 * @param {Array}  userContext.affinities - user affinity rows (from affinityService)
 * @param {Object} userContext._affinityLookup - pre-built lookup (internal, set by rankGigs)
 * @param {Map}    userContext._categoryMedians - pre-built medians (internal, set by rankGigs)
 * @returns {number} Score 0–100
 */
function computeRelevanceScore(gig, userContext) {
  const { maxRadius = 8047 } = userContext;

  // ── Distance score (0–40) ──
  const dist = parseFloat(gig.distance_meters);
  const distScore = Number.isFinite(dist)
    ? Math.max(0, MAX_DISTANCE_SCORE * (1 - dist / maxRadius))
    : 0;

  // ── Recency score (0–30) ──
  let recencyScore = 0;
  if (gig.created_at) {
    const ageHours = (Date.now() - new Date(gig.created_at).getTime()) / 3600000;
    recencyScore = Math.max(0, MAX_RECENCY_SCORE * (1 - ageHours / RECENCY_WINDOW_HOURS));
  }

  // ── Affinity score (0–20) ──
  let affinityScore = MAX_AFFINITY_SCORE / 2; // neutral default (10)
  const lookup = userContext._affinityLookup || buildAffinityLookup(userContext.affinities);

  if (lookup.byCategory.size > 0 && gig.category) {
    const row = lookup.byCategory.get(gig.category);
    if (row) {
      if (row.dismiss_count > 0 && row.affinity_score <= 0) {
        // Dismissed category with no positive signal
        affinityScore = 0;
      } else if (lookup.topScore > 0) {
        // Normalize to 0–20 range
        affinityScore = Math.max(0, (row.affinity_score / lookup.topScore) * MAX_AFFINITY_SCORE);
      } else {
        affinityScore = MAX_AFFINITY_SCORE / 2;
      }
    } else {
      // User has affinity data but not for this category — slight neutral
      affinityScore = MAX_AFFINITY_SCORE / 4; // 5 points
    }
  }

  // ── Price score (0–10) ──
  let priceScore = MAX_PRICE_SCORE / 2; // neutral default (5)
  const medians = userContext._categoryMedians;
  const price = parseFloat(gig.price);

  if (medians && gig.category && Number.isFinite(price)) {
    const median = medians.get(gig.category);
    if (median && median > 0) {
      const deviation = Math.abs(price - median) / median;
      priceScore = Math.max(0, Math.min(MAX_PRICE_SCORE, MAX_PRICE_SCORE - deviation * MAX_PRICE_SCORE));
    }
  }

  return Math.round((distScore + recencyScore + affinityScore + priceScore) * 100) / 100;
}

/**
 * Rank an array of gigs by composite relevance score.
 *
 * @param {Array}  gigs - Array of gig objects
 * @param {Object} userContext - { maxRadius, affinities, recentBidCategories }
 * @returns {Array} Gigs sorted by relevance score (descending), with _relevanceScore attached
 */
function rankGigs(gigs, userContext = {}) {
  if (!gigs || gigs.length === 0) return [];

  // Pre-compute shared data structures (avoid recomputing per gig)
  const ctx = {
    ...userContext,
    _affinityLookup: buildAffinityLookup(userContext.affinities),
    _categoryMedians: computeCategoryMedians(gigs),
  };

  const scored = gigs.map((gig) => ({
    ...gig,
    _relevanceScore: computeRelevanceScore(gig, ctx),
  }));

  scored.sort((a, b) => b._relevanceScore - a._relevanceScore);

  return scored;
}

module.exports = {
  computeRelevanceScore,
  rankGigs,
  // Exported for testing
  computeCategoryMedians,
  buildAffinityLookup,
};
