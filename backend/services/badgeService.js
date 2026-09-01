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

// References set once during init
let _io = null;
let _connectedUsers = null;

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

/**
 * Compute all badge counts for a given user.
 * Runs three lightweight queries in parallel.
 */
async function computeBadgeCounts(userId) {
  const [msgResult, offersResult, notifResult] = await Promise.allSettled([
    // 1) Total unread messages: sum unread_count from ChatParticipant
    supabaseAdmin
      .from('ChatParticipant')
      .select('room_id, unread_count')
      .eq('user_id', userId)
      .eq('is_active', true),

    // 2) Pending offers: find gigs owned by user, then count pending bids
    (async () => {
      const { data: myGigs } = await supabaseAdmin
        .from('Gig')
        .select('id')
        .eq('user_id', userId);
      const gigIds = (myGigs || []).map((g) => g.id);
      if (gigIds.length === 0) return { count: 0 };
      const { count, error } = await supabaseAdmin
        .from('GigBid')
        .select('id', { count: 'exact', head: true })
        .in('gig_id', gigIds)
        .eq('status', 'pending');
      if (error) return { count: 0 };
      return { count: count ?? 0 };
    })(),

    // 3) Unread notifications
    supabaseAdmin
      .from('Notification')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false),
  ]);

  let unreadMessages = 0;
  let totalMessages = 0;
  if (msgResult.status === 'fulfilled') {
    const val = msgResult.value;
    const rows = val?.data || val || [];
    if (Array.isArray(rows)) {
      unreadMessages = rows.reduce((s, r) => s + (Number(r.unread_count) || 0), 0);
      const roomIds = Array.from(new Set(rows.map((r) => String(r.room_id)).filter(Boolean)));
      if (roomIds.length > 0) {
        let countQuery = supabaseAdmin
          .from('ChatMessage')
          .select('id', { count: 'exact', head: true })
          .in('room_id', roomIds)
          .eq('deleted', false);
        let { count, error } = await countQuery;
        if (error && /deleted/i.test(String(error.message || ''))) {
          ({ count, error } = await supabaseAdmin
            .from('ChatMessage')
            .select('id', { count: 'exact', head: true })
            .in('room_id', roomIds));
        }
        if (!error) totalMessages = Number(count || 0);
      }
    }
  }

  let pendingOffers = 0;
  if (offersResult.status === 'fulfilled') {
    const val = offersResult.value;
    pendingOffers = val?.count ?? 0;
  }

  let notifications = 0;
  if (notifResult.status === 'fulfilled' && !notifResult.value?.error) {
    notifications = notifResult.value?.count ?? 0;
  }

  return { unreadMessages, totalMessages, pendingOffers, notifications };
}

/**
 * Emit a badge:update event to a specific user if they're connected.
 * Non-blocking — errors are logged but never thrown.
 */
async function emitBadgeUpdate(userId) {
  if (!_io || !_connectedUsers) return;

  const socketIds = getUserSocketIds(userId);
  if (socketIds.length === 0) return; // user not connected

  try {
    const counts = await computeBadgeCounts(userId);
    for (const socketId of socketIds) {
      _io.to(socketId).emit('badge:update', counts);
    }
  } catch (err) {
    logger.error('Badge update emit error', { error: err.message, userId });
  }
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
  emitBadgeUpdate,
  emitBadgeUpdateToMany,
};
