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
let revision = 0;

function blockCheckUnavailable() {
  return Object.assign(new Error('Messaging authorization is temporarily unavailable. Please retry.'), {
    code: 'BLOCK_CHECK_UNAVAILABLE', status: 503,
  });
}

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

  // A block/unblock can complete while the query is in flight. Never publish
  // its old result after invalidation; re-read the current persisted decision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const started = revision;
    try {
      const { count, error } = await supabaseAdmin
        .from('UserBlock')
        .select('id', { count: 'exact', head: true })
        .or(
          `and(blocker_user_id.eq.${userId1},blocked_user_id.eq.${userId2}),` +
          `and(blocker_user_id.eq.${userId2},blocked_user_id.eq.${userId1})`
        );

      if (error || !Number.isInteger(count) || count < 0) {
        throw error || new Error('Missing block count');
      }

      if (started !== revision) continue;
      const blocked = count > 0;
      cache.set(key, { blocked, expiresAt: Date.now() + CACHE_TTL_MS });
      return blocked;
    } catch (err) {
      logger.error('[blockService] isBlocked error', { error: err.message });
      throw blockCheckUnavailable();
    }
  }
  throw blockCheckUnavailable();
}

/**
 * Invalidate the cache entry for a user pair (call after block/unblock).
 */
function invalidateBlockCache(userId1, userId2) {
  const key = cacheKey(String(userId1), String(userId2));
  revision++;
  cache.delete(key);
}

/**
 * Every counterpart the user has blocked or is blocked by (UserBlock, both
 * directions). Same unavailable contract as isBlocked: a failed read throws
 * rather than reporting "nobody blocked".
 */
async function blockedUserIds(userId) {
  if (!userId) return new Set();
  const { data, error } = await supabaseAdmin
    .from('UserBlock')
    .select('blocker_user_id, blocked_user_id')
    .or(`blocker_user_id.eq.${userId},blocked_user_id.eq.${userId}`);
  if (error || !Array.isArray(data)) {
    logger.warn('blockService.blockedUserIds unavailable', { userId, error: error?.message });
    throw blockCheckUnavailable();
  }
  const ids = new Set();
  for (const row of data) {
    ids.add(String(row.blocker_user_id) === String(userId) ? row.blocked_user_id : row.blocker_user_id);
  }
  ids.delete(userId);
  return ids;
}

/**
 * Whether blockerId has a personal block (UserBlock) on viewerId, in that one direction. Profiles and search hide a
 * blocker from the person they blocked, while the blocker still sees them (routes/users.js personalBlockersOf). Same
 * unavailable contract as isBlocked: a failed read throws rather than reporting "not blocked".
 */
async function hasBlocked(blockerId, viewerId) {
  if (!blockerId || !viewerId || String(blockerId) === String(viewerId)) return false;
  const { count, error } = await supabaseAdmin
    .from('UserBlock')
    .select('id', { count: 'exact', head: true })
    .eq('blocker_user_id', blockerId)
    .eq('blocked_user_id', viewerId);
  if (error || !Number.isInteger(count)) {
    logger.warn('blockService.hasBlocked unavailable', { error: error?.message });
    throw blockCheckUnavailable();
  }
  return count > 0;
}

/**
 * A filter for Notification queries (lists and counts) that leaves out the notices whose actor
 * (metadata.user_id) is across a block from userId, in either direction: blocks hide people from
 * each other, including what they did before the block. A notice with no actor stays. If the block
 * list can't be read, the notices stay as they are: the person already received them.
 * @returns {Promise<(query: object) => object>}
 */
async function notificationBlockFilter(userId) {
  let blocked;
  try {
    blocked = await blockedUserIds(userId);
  } catch {
    return (query) => query;
  }
  if (!blocked.size) return (query) => query;
  const ids = [...blocked].join(',');
  return (query) => query.or(`metadata->>user_id.is.null,metadata->>user_id.not.in.(${ids})`);
}

module.exports = {
  isBlocked, hasBlocked, blockedUserIds, notificationBlockFilter, invalidateBlockCache, blockCheckUnavailable,
};
