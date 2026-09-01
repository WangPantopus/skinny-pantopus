/**
 * Invite Reward Service
 *
 * Tracks invite progress and manages feature unlocks based on
 * successful referrals (UserReferral rows where referred_user_id IS NOT NULL).
 *
 * Tiers:
 *   1 invite  → activity_map (Neighborhood Activity Map)
 *   3 invites → neighborhood_insights (Community Intelligence Dashboard)
 *   5 invites → priority_matching (Gigs shown first to nearby workers)
 *  10 invites → founding_badge (Founding Neighbor badge on profile)
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// ── Feature unlock tiers ──────────────────────────────────────────

const FEATURE_TIERS = [
  { key: 'activity_map', label: 'Neighborhood Activity Map', threshold: 1 },
  { key: 'neighborhood_insights', label: 'Neighborhood Insights', threshold: 3 },
  { key: 'priority_matching', label: 'Priority Matching', threshold: 5 },
  { key: 'founding_badge', label: 'Founding Neighbor Badge', threshold: 10 },
];

const FEATURE_KEYS = FEATURE_TIERS.map((t) => t.key);

// ── In-memory cache (TTL = 5 minutes) ─────────────────────────────

const _cache = new Map(); // userId -> { data, expiresAt }
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(userId) {
  const entry = _cache.get(userId);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  _cache.delete(userId);
  return null;
}

function setCache(userId, data) {
  _cache.set(userId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Core functions ────────────────────────────────────────────────

/**
 * Get a user's invite progress: total invites, conversions, unlocked features,
 * and the next unlock milestone.
 */
async function getInviteProgress(userId) {
  const cached = getCached(userId);
  if (cached) return cached;

  try {
    // Count all referral rows for this user
    const { count: totalInvited, error: invErr } = await supabaseAdmin
      .from('UserReferral')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', userId);

    if (invErr) {
      logger.warn('inviteRewardService: failed to count invites', { userId, error: invErr.message });
    }

    // Count converted referrals (referred_user_id is NOT NULL)
    const { count: totalConverted, error: convErr } = await supabaseAdmin
      .from('UserReferral')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', userId)
      .not('referred_user_id', 'is', null);

    if (convErr) {
      logger.warn('inviteRewardService: failed to count conversions', { userId, error: convErr.message });
    }

    const converted = totalConverted || 0;

    // Determine unlocked features
    const unlocked_features = FEATURE_TIERS
      .filter((t) => converted >= t.threshold)
      .map((t) => t.key);

    // Determine next unlock
    const nextTier = FEATURE_TIERS.find((t) => converted < t.threshold) || null;
    const next_unlock = nextTier
      ? {
          feature: nextTier.key,
          label: nextTier.label,
          invites_needed: nextTier.threshold,
          invites_remaining: nextTier.threshold - converted,
        }
      : null;

    const result = {
      total_invited: totalInvited || 0,
      total_converted: converted,
      unlocked_features,
      next_unlock,
    };

    setCache(userId, result);
    return result;
  } catch (err) {
    logger.error('inviteRewardService: getInviteProgress failed', { userId, error: err.message });
    return {
      total_invited: 0,
      total_converted: 0,
      unlocked_features: [],
      next_unlock: FEATURE_TIERS[0]
        ? { feature: FEATURE_TIERS[0].key, label: FEATURE_TIERS[0].label, invites_needed: FEATURE_TIERS[0].threshold, invites_remaining: FEATURE_TIERS[0].threshold }
        : null,
    };
  }
}

/**
 * Check if a user has access to a specific feature.
 */
async function checkFeatureAccess(userId, featureKey) {
  const progress = await getInviteProgress(userId);
  return progress.unlocked_features.includes(featureKey);
}

/**
 * Express middleware: require a feature to be unlocked.
 * Usage: router.get('/endpoint', verifyToken, requireFeature('neighborhood_insights'), handler)
 */
function requireFeature(featureKey) {
  const tier = FEATURE_TIERS.find((t) => t.key === featureKey);

  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasAccess = await checkFeatureAccess(userId, featureKey);
      if (!hasAccess) {
        const progress = await getInviteProgress(userId);
        const needed = tier ? tier.threshold : 0;
        const remaining = needed - progress.total_converted;
        return res.status(403).json({
          error: `Invite ${remaining} neighbor${remaining !== 1 ? 's' : ''} to unlock this feature`,
          feature: featureKey,
          invites_needed: needed,
          invites_remaining: remaining,
        });
      }

      next();
    } catch (err) {
      logger.error('requireFeature middleware error', { featureKey, error: err.message });
      return res.status(500).json({ error: 'Failed to check feature access' });
    }
  };
}

module.exports = {
  FEATURE_KEYS,
  FEATURE_TIERS,
  getInviteProgress,
  checkFeatureAccess,
  requireFeature,
};
