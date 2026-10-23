const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const chatRealtime = require('./chatRealtime');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// A subscription/send is not evidence of reading. Only an explicit read after
// rendering history advances this boundary; legacy clients use request time.
async function markChatRead({ roomIds, userId, throughMessageId, requestAt, io }) {
  if (throughMessageId != null && (typeof throughMessageId !== 'string' || !UUID.test(throughMessageId))) {
    return { error: { code: '22023', message: 'Invalid read cursor' } };
  }
  const { data, error } = await supabaseAdmin.rpc('mark_chat_read_through', {
    p_user_id: userId,
    p_room_ids: roomIds,
    p_through_message_id: throughMessageId || null,
    p_request_at: requestAt || new Date().toISOString(),
  });
  if (error) return { error };
  for (const row of data || []) {
    if (row.through_message_id && io) chatRealtime.announce({ t: 'ChatRead', r: row.room_id, u: userId });
  }
  return { data: data || [], unreadCount: (data || []).reduce((sum, row) => sum + row.unread_count, 0) };
}

function timestampMicros(value) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const fraction = String(value).match(/\.(\d+)/)?.[1] || '';
  return BigInt(ms) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3, 6));
}

// Existing message DTOs already understand read_at. A direct conversation has
// one recipient; group reads need per-recipient semantics and stay unset.
async function applyDirectReadReceipts(messages, viewerId) {
  const own = messages.filter((m) => String(m.user_id) === String(viewerId)
    || String(m.actor_user_id) === String(viewerId));
  const roomIds = [...new Set(own.map((m) => m.room_id))];
  if (!roomIds.length) return;
  const { data, error } = await supabaseAdmin.from('ChatParticipant')
    .select('room_id, user_id, last_read_at, last_read_message_at, last_read_message_id, room:room_id!inner(type)')
    .in('room_id', roomIds).eq('room.type', 'direct').eq('is_active', true);
  if (error) {
    logger.warn('chat_read_receipts_unavailable', { code: error.code });
    return;
  }
  const byRoom = new Map();
  for (const p of data || []) {
    if (!byRoom.has(p.room_id)) byRoom.set(p.room_id, []);
    byRoom.get(p.room_id).push(p);
  }
  for (const m of own) {
    const others = (byRoom.get(m.room_id) || []).filter((p) => p.user_id !== m.user_id);
    if (others.length !== 1) continue;
    const reader = others[0];
    if (!reader.last_read_message_id || !reader.last_read_message_at) continue;
    const read = timestampMicros(reader.last_read_message_at);
    const sent = timestampMicros(m.created_at);
    if (read !== null && sent !== null && (read > sent
      || (read === sent && reader.last_read_message_id >= m.id))) m.read_at = reader.last_read_at;
  }
}

module.exports = { markChatRead, applyDirectReadReceipts };
