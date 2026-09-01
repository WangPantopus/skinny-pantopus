/**
 * Discovery scoring utilities.
 *
 * Extracted from routes/businessDiscovery.js so the pure scoring logic
 * can be unit-tested without pulling in Express or Supabase.
 */

const { VERIFICATION_MULTIPLIERS, FOUNDING_BUSINESS_MULTIPLIER } = require('./businessConstants');

// Cold-start thresholds
const NEW_BUSINESS_GIG_THRESHOLD = 3;
const NEW_BUSINESS_MAX_AGE_DAYS = 30;
const NEW_BUSINESS_PHANTOM_COUNT = 3;

// Ranking weights (Feature 3.1)
const WEIGHT_NEIGHBOR = 0.35;
const WEIGHT_DISTANCE = 0.25;
const WEIGHT_RATING = 0.20;
const WEIGHT_PROFILE = 0.10;
const WEIGHT_RECENCY = 0.10;

// Neighbor count normalization: 20+ completions = full score
const NEIGHBOR_LOG_CAP = Math.log(1 + 20);

const MILES_TO_METERS = 1609.34;

// Entity types that inherently have fewer gig transactions — skip gig_count penalty
const COMMUNITY_ENTITY_TYPES = new Set(['nonprofit_501c3', 'religious_org', 'community_group']);

// Median phantom neighbor count for community entity types (so they rank mid-tier, not bottom)
const COMMUNITY_PHANTOM_NEIGHBOR = 5;

/**
 * Determine new-business status from pre-fetched search result fields.
 */
function isNewBusiness(completedGigs, profileCreatedAt) {
  const gigCount = parseInt(completedGigs, 10) || 0;
  if (gigCount >= NEW_BUSINESS_GIG_THRESHOLD) return false;
  if (!profileCreatedAt) return false;
  const days = (Date.now() - new Date(profileCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= NEW_BUSINESS_MAX_AGE_DAYS;
}

/**
 * Compute the composite ranking score for a search result.
 * Feature 3.1: 35% neighbor + 25% distance + 20% rating + 10% profile + 10% recency
 */
function computeCompositeScore(row) {
  const nc = parseInt(row.neighbor_count, 10) || 0;
  const isNew = isNewBusiness(row.completed_gigs, row.profile_created_at);

  // --- Neighbor count signal (35%) ---
  // Cold-start: treat new businesses as if neighbor_count = 3 for ranking only
  // Community types (nonprofits, religious orgs, community groups): use phantom count
  // so they rank at median rather than bottom due to inherently fewer gig transactions
  const isCommunityType = COMMUNITY_ENTITY_TYPES.has(row.business_type);
  let effectiveCount;
  if (isCommunityType) {
    effectiveCount = Math.max(nc, COMMUNITY_PHANTOM_NEIGHBOR);
  } else if (isNew) {
    effectiveCount = Math.max(nc, NEW_BUSINESS_PHANTOM_COUNT);
  } else {
    effectiveCount = nc;
  }
  const neighborScore = Math.min(Math.log(1 + effectiveCount) / NEIGHBOR_LOG_CAP, 1) * 100;

  // --- Distance signal (25%) ---
  const distMiles = (parseInt(row.distance_meters, 10) || 0) / MILES_TO_METERS;
  let distanceScore;
  if (distMiles <= 0.5) distanceScore = 100;
  else if (distMiles <= 1) distanceScore = 80;
  else if (distMiles <= 3) distanceScore = 60;
  else if (distMiles <= 5) distanceScore = 30;
  else distanceScore = 10;

  // --- Rating signal (20%) ---
  const rating = parseFloat(row.average_rating) || 0;
  const reviewCount = parseInt(row.review_count, 10) || 0;
  const ratingDamping = Math.min(reviewCount, 20) / 20;
  const ratingScore = rating * ratingDamping * 20; // max = 5 * 1 * 20 = 100

  // --- Profile completeness signal (10%) ---
  const profileScore = parseInt(row.profile_completeness, 10) || 0;

  // --- Activity recency signal (10%) ---
  let recencyScore = 0;
  if (row.last_activity_at) {
    const daysSince = (Date.now() - new Date(row.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 7) recencyScore = 100;
    else if (daysSince <= 30) recencyScore = 60;
    else if (daysSince <= 90) recencyScore = 20;
  }

  const compositeScore = (
    neighborScore * WEIGHT_NEIGHBOR
    + distanceScore * WEIGHT_DISTANCE
    + ratingScore * WEIGHT_RATING
    + profileScore * WEIGHT_PROFILE
    + recencyScore * WEIGHT_RECENCY
  );

  // Apply verification multiplier (unverified = 0.85x penalty, verified = bonus)
  const verificationMultiplier = VERIFICATION_MULTIPLIERS[row.verification_status] ?? VERIFICATION_MULTIPLIERS.unverified;
  let finalScore = compositeScore * verificationMultiplier;

  // Apply founding business boost (+20%) if active
  if (row.founding_badge && (!row.founding_benefit_expires_at || new Date(row.founding_benefit_expires_at) > new Date())) {
    finalScore *= FOUNDING_BUSINESS_MULTIPLIER;
  }

  // Cap at maximum observable score (100 base * 1.15 verification * 1.20 founding = 138)
  return Math.min(finalScore, 138);
}

module.exports = {
  isNewBusiness,
  computeCompositeScore,
  NEW_BUSINESS_GIG_THRESHOLD,
  NEW_BUSINESS_MAX_AGE_DAYS,
  NEW_BUSINESS_PHANTOM_COUNT,
  WEIGHT_NEIGHBOR,
  WEIGHT_DISTANCE,
  WEIGHT_RATING,
  WEIGHT_PROFILE,
  WEIGHT_RECENCY,
  NEIGHBOR_LOG_CAP,
  MILES_TO_METERS,
};
