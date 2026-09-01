/**
 * Block Service
 *
 * Provides a cached bidirectional block check: isBlocked(userId1, userId2)
 * returns true if EITHER user has blocked the other.
 *
 * Uses a short TTL in-memory cache (60s) keyed on the sorted user ID pair
 * to avoid hitting the DB on every message send or chat creation.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const CACHE_TTL_MS = 60_000; // 60 seconds
const cache = new Map(); // key: "uuid1:uuid2" (sorted) → { blocked: bool, expiresAt: number }

function cacheKey(id1, id2) {
  return id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
}

/**
 * Returns true if either userId1 has blocked userId2 or vice versa.
 */
async function isBlocked(userId1, userId2) {
  if (!userId1 || !userId2 || String(userId1) === String(userId2)) return false;

  const key = cacheKey(String(userId1), String(userId2));
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.blocked;
  }

  try {
    const { count, error } = await supabaseAdmin
      .from('UserBlock')
      .select('id', { count: 'exact', head: true })
      .or(
        `and(blocker_user_id.eq.${userId1},blocked_user_id.eq.${userId2}),` +
        `and(blocker_user_id.eq.${userId2},blocked_user_id.eq.${userId1})`
      );

    if (error) {
      logger.error('[blockService] isBlocked query failed', { error: error.message, userId1, userId2 });
      return false; // fail-open: don't block actions on DB errors
    }

    const blocked = (count || 0) > 0;
    cache.set(key, { blocked, expiresAt: Date.now() + CACHE_TTL_MS });
    return blocked;
  } catch (err) {
    logger.error('[blockService] isBlocked error', { error: err.message });
    return false;
  }
}

/**
 * Invalidate the cache entry for a user pair (call after block/unblock).
 */
function invalidateBlockCache(userId1, userId2) {
  const key = cacheKey(String(userId1), String(userId2));
  cache.delete(key);
}

module.exports = { isBlocked, invalidateBlockCache };
