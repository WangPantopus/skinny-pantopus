/**
 * Badge Service
 *
 * Computes aggregated badge/unread counts for a user and emits
 * them over Socket.IO so frontends can update in real-time
 * instead of polling.
 *
 * Event shape emitted to client:
 *   socket.emit('badge:update', {
 *     unreadMessages: 3,
 *     totalMessages: 120,
 *     pendingOffers: 1,
 *     notifications: 5,
 *   });
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { excludeHiddenLaunchNotifications, isLaunchFeatureEnabled } = require('../utils/featureFlags');
const { notificationBlockFilter } = require('./blockService');

// References set once during init
let _io = null;
let _connectedUsers = null;
const pending = new Map();
let running = 0;
let drainTimer;
let drainAt = 0;

/**
 * Initialize the badge service with Socket.IO instance and
 * the connected-users map from chatSocketio.
 */
function init(io, connectedUsers) {
  _io = io;
  _connectedUsers = connectedUsers;

}

function getUserSocketIds(userId) {
  const entry = _connectedUsers?.get(userId);
  if (!entry) return [];
  if (entry instanceof Set) return Array.from(entry);
  return [entry];
}

/** Read all chat counters in one database snapshot without fetching history. */
async function getChatStatistics(userId) {
  const { data, error } = await supabaseAdmin.rpc('get_chat_statistics', { p_user_id: userId });
  const fields = ['total_chats', 'total_messages', 'total_unread', 'direct_chats', 'gig_chats', 'home_chats'];
  if (error || !data || fields.some((key) => !Number.isSafeInteger(data[key]) || data[key] < 0)) {
    throw Object.assign(new Error('Chat statistics are temporarily unavailable'), { status: 503, code: 'CHAT_UNAVAILABLE' });
  }
  return data;
}

/** A failed query is unknown, never an authoritative zero badge. */
async function computeBadgeCounts(userId) {
  const withoutBlocked = await notificationBlockFilter(userId);
  const { notificationPostFilter } = require('./pulse/readAccess');
  const readablePost = await notificationPostFilter(userId);
  const [stats, offers, notifications] = await Promise.all([
    getChatStatistics(userId),
    (async () => {
      if (!isLaunchFeatureEnabled('open_gigs')) return { count: 0 };
      const { data: gigs, error } = await supabaseAdmin.from('Gig').select('id').eq('user_id', userId);
      if (error || !Array.isArray(gigs)) throw new Error('Offer badges unavailable');
      if (!gigs.length) return { count: 0 };
      const result = await supabaseAdmin.from('GigBid').select('id', { count: 'exact', head: true })
        .in('gig_id', gigs.map((gig) => gig.id)).eq('status', 'pending');
      if (result.error || result.count == null) throw new Error('Offer badges unavailable');
      return result;
    })(),
    readablePost(withoutBlocked(excludeHiddenLaunchNotifications(supabaseAdmin.from('Notification')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)))),
  ]);
  if (notifications.error || notifications.count == null) throw new Error('Notification badges unavailable');
  return { unreadMessages: stats.total_unread, totalMessages: stats.total_messages,
    pendingOffers: offers.count, notifications: notifications.count };
}

function scheduleDrain(delay = 100) {
  const nextAt = Date.now() + delay;
  if (drainTimer && drainAt <= nextAt) return;
  if (drainTimer) clearTimeout(drainTimer);
  drainAt = nextAt;
  drainTimer = setTimeout(drain, delay);
  drainTimer.unref?.();
}

function schedulePending() {
  const waiting = [...pending.values()].filter((entry) => !entry.running);
  if (running < 4 && waiting.length) {
    scheduleDrain(Math.max(100, Math.min(...waiting.map((entry) => entry.dueAt)) - Date.now()));
  }
}

function drain() {
  drainTimer = null;
  for (const [userId, entry] of pending) {
    if (running >= 4) break;
    if (entry.running || entry.dueAt > Date.now()) continue;
    entry.running = true;
    entry.dirty = false;
    running += 1;
    Promise.resolve().then(async () => {
      if (!getUserSocketIds(userId).length) return;
      const counts = await computeBadgeCounts(userId);
      // Re-read connected sockets after I/O; never send to an old session's id.
      for (const socketId of getUserSocketIds(userId)) _io.to(socketId).emit('badge:update', counts);
      entry.failures = 0;
    }).catch((error) => {
      logger.warn('Badge update unavailable', { code: error.code });
      entry.failures += 1;
      if (entry.failures <= 3 && getUserSocketIds(userId).length) {
        entry.dirty = true;
        entry.dueAt = Date.now() + 1000 * (2 ** entry.failures);
      }
    }).finally(() => {
      running -= 1;
      entry.running = false;
      if (!entry.dirty) { pending.delete(userId); entry.resolve(); }
      schedulePending();
    });
  }
  schedulePending();
}

/**
 * Emit a badge:update event to a specific user if they're connected.
 * Non-blocking — errors are logged but never thrown.
 */
function emitBadgeUpdate(userId) {
  if (!_io || !_connectedUsers || !getUserSocketIds(userId).length) return Promise.resolve();
  const previous = pending.get(userId);
  if (previous) { previous.dirty = true; return previous.promise; }
  // Bound burst work. The existing sync invalidation/fallback readers reconcile
  // the exceptional overflow instead of queuing unlimited queries.
  if (pending.size >= 1000) return Promise.resolve();
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  pending.set(userId, { promise, resolve, dirty: false, running: false, dueAt: 0, failures: 0 });
  scheduleDrain();
  return promise;
}

/**
 * Emit badge:update to multiple users (e.g. all participants in a room).
 */
async function emitBadgeUpdateToMany(userIds) {
  await Promise.allSettled(userIds.map((id) => emitBadgeUpdate(id)));
}

module.exports = {
  init,
  computeBadgeCounts,
  getChatStatistics,
  emitBadgeUpdate,
  emitBadgeUpdateToMany,
};
