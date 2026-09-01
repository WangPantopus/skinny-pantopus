/**
 * Feature flag service.
 *
 * Audience Profile design v2 §19 acceptance criterion 15. The flag has
 * three tiers of access:
 *
 *   1. enabled_globally           — all users see the feature.
 *   2. enabled_for_internal_team  — users with role IN ('admin','staff').
 *   3. beta_user_ids              — explicit per-user enablement.
 *
 * A user gets the feature if ANY of those three is true. Unknown flags stay
 * off; shipped flags are enabled through migrations when they graduate from
 * beta rollout to normal app behavior.
 *
 * Caching: getFlag results are cached in-process for 60s. The cache is
 * primary-key'd by flag_name; admin updates invalidate the entry through
 * `invalidateFlagCache(flagName)` so flipping a flag from the admin route
 * takes effect on the next request rather than waiting for the TTL.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const FLAG_TTL_MS = 60_000;
const INTERNAL_ROLES = new Set(['admin', 'staff']);

const _flagCache = new Map(); // flag_name -> { value, expiresAt }

function _isFresh(entry) {
  return entry && entry.expiresAt > Date.now();
}

async function getFlag(flagName) {
  const cached = _flagCache.get(flagName);
  if (_isFresh(cached)) return cached.value;

  const { data, error } = await supabaseAdmin
    .from('FeatureFlag')
    .select('*')
    .eq('flag_name', flagName)
    .maybeSingle();

  if (error) {
    logger.warn('feature_flag.fetch_error', { flagName, error: error.message });
    return null;
  }

  // Cache `null` for unknown flags too — a misspelled flag name should not
  // hit the DB on every request. The 60s TTL gives an admin who creates
  // the flag a bounded propagation time. We snapshot the row so a later
  // caller mutating its return value can't poison the cache.
  const snapshot = data ? { ...data, beta_user_ids: Array.isArray(data.beta_user_ids) ? [...data.beta_user_ids] : [] } : null;
  _flagCache.set(flagName, { value: snapshot, expiresAt: Date.now() + FLAG_TTL_MS });
  return snapshot;
}

function invalidateFlagCache(flagName) {
  if (flagName) {
    _flagCache.delete(flagName);
    return;
  }
  _flagCache.clear();
}

function _flagAllowsUser(flag, user) {
  if (!flag) return false;
  if (flag.enabled_globally) return true;
  if (flag.enabled_for_internal_team && user && INTERNAL_ROLES.has(String(user.role || '').toLowerCase())) {
    return true;
  }
  const beta = Array.isArray(flag.beta_user_ids) ? flag.beta_user_ids : [];
  if (user?.id && beta.includes(user.id)) return true;
  return false;
}

async function _fetchUserMinimal(userId) {
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from('User')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}

/**
 * Returns true iff the user has the named flag enabled. Pass either:
 *   - a userId string (we'll fetch the User.role for the internal-team check), OR
 *   - a `{ id, role }` user object (preferred — saves a DB hit when the
 *     route already has the row from req.user).
 */
async function isFeatureEnabled(flagName, userOrId) {
  const flag = await getFlag(flagName);
  if (!flag) return false;
  if (flag.enabled_globally) return true;
  let user = userOrId;
  if (typeof userOrId === 'string') {
    user = await _fetchUserMinimal(userOrId);
  }
  return _flagAllowsUser(flag, user);
}

async function setFlag(flagName, updates = {}) {
  const allowed = ['enabled_globally', 'enabled_for_internal_team', 'beta_user_ids', 'description'];
  const payload = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in updates) payload[key] = updates[key];
  }
  const { data, error } = await supabaseAdmin
    .from('FeatureFlag')
    .update(payload)
    .eq('flag_name', flagName)
    .select()
    .maybeSingle();
  invalidateFlagCache(flagName);
  if (error) {
    logger.error('feature_flag.set_error', { flagName, error: error.message });
    return null;
  }
  return data || null;
}

module.exports = {
  isFeatureEnabled,
  getFlag,
  setFlag,
  invalidateFlagCache,
  // Exposed for tests + the admin route.
  INTERNAL_ROLES,
  _flagAllowsUser,
};
