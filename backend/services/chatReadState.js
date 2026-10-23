const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const chatRealtime = require('./chatRealtime');
const { readChatRoomBatches } = require('./chatSync');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// A subscription/send is not evidence of reading. Only an explicit read after
// rendering history advances this boundary; legacy clients use request time.
async function markChatRead({ roomIds, userId, topicId, otherUserId, throughMessageId, throughMessageIds, requestAt, io }) {
  if (topicId != null && (typeof topicId !== 'string' || !UUID.test(topicId))) {
    return { error: { code: '22023', message: 'Invalid topic' } };
  }
  if (throughMessageId != null && (typeof throughMessageId !== 'string' || !UUID.test(throughMessageId))) {
    return { error: { code: '22023', message: 'Invalid read cursor' } };
  }
  let boundaries = null;
  if (throughMessageIds != null) {
    if (typeof throughMessageIds !== 'object' || Array.isArray(throughMessageIds)
      || Object.keys(throughMessageIds).length > 500) {
      return { error: { code: '22023', message: 'Invalid read cursor' } };
    }
    const allowedRooms = new Set(roomIds.map((id) => String(id).toLowerCase()));
    boundaries = Object.create(null);
    for (const [room, message] of Object.entries(throughMessageIds)) {
      if (!UUID.test(room) || !allowedRooms.has(room.toLowerCase())
        || typeof message !== 'string' || !UUID.test(message) || boundaries[room.toLowerCase()]) {
        return { error: { code: '22023', message: 'Invalid read cursor' } };
      }
      boundaries[room.toLowerCase()] = message.toLowerCase();
    }
    if (throughMessageId && !Object.values(boundaries).includes(throughMessageId.toLowerCase())) {
      return { error: { code: '22023', message: 'Invalid read cursor' } };
    }
  }
  const { data, error } = await supabaseAdmin.rpc(topicId ? 'mark_chat_topic_read_boundaries' : 'mark_chat_read_boundaries', {
    p_user_id: userId,
    p_room_ids: roomIds,
    p_boundaries: boundaries,
    p_through_message_id: throughMessageId || null,
    p_request_at: requestAt || new Date().toISOString(),
    ...(topicId ? { p_topic_id: topicId, p_other_user_id: otherUserId || null } : {}),
  });
  if (error) return { error };
  // One JSON response keeps complete totals even above PostgREST's row cap.
  if (!Array.isArray(data?.data) || !Number.isSafeInteger(data.unreadCount) || data.unreadCount < 0) {
    return { error: { code: 'XX000', message: 'Read state unavailable' } };
  }
  for (const row of data.data) {
    if (row.through_message_id && io) chatRealtime.announce({
      t: topicId ? 'ChatTopicRead' : 'ChatRead', r: row.room_id, u: userId, ...(topicId ? { q: topicId } : {}),
    });
  }
  return { data: data.data, unreadCount: data.unreadCount };
}

function timestampMicros(value) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const fraction = String(value).match(/\.(\d+)/)?.[1] || '';
  return BigInt(ms) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3, 6));
}

// Existing message DTOs already understand read_at. A direct conversation has
// one recipient; group reads need per-recipient semantics and stay unset.
async function applyDirectReadReceipts(messages, viewerId, { required = false } = {}) {
  const own = messages.filter((m) => String(m.user_id) === String(viewerId)
    || String(m.actor_user_id) === String(viewerId));
  const roomIds = [...new Set(own.map((m) => m.room_id))];
  if (!roomIds.length) return;
  // Per-message receipts cover both room and topic boundaries. Bound by the
  // actual authorized window rather than every topic ever used in these rooms.
  let legacy = false;
  for (let start = 0; start < own.length; start += 500) {
    const batch = own.slice(start, start + 500);
    const { data: receipts, error } = await supabaseAdmin.rpc('get_chat_message_receipts', {
      p_user_id: viewerId, p_message_ids: batch.map((m) => m.id),
    });
    if (error) {
      // A rolling deployment may reach an older schema. Its room boundaries
      // remain truthful; never infer a topic read from a missing function.
      if (['42883', 'PGRST202'].includes(error.code)) { legacy = true; break; }
      logger.warn('chat_read_receipts_unavailable', { code: error.code });
      if (required) throw error;
      return;
    }
    const byMessage = new Map((receipts || []).map((row) => [String(row.message_id), row.read_at]));
    for (const message of batch) if (byMessage.get(String(message.id))) message.read_at = byMessage.get(String(message.id));
  }
  if (!legacy) return;
  let data;
  try {
    data = await readChatRoomBatches(roomIds, (ids) => supabaseAdmin.from('ChatParticipant')
      .select('room_id, user_id, last_read_at, last_read_message_at, last_read_message_id, room:room_id!inner(type)')
      .in('room_id', ids).eq('room.type', 'direct').eq('is_active', true));
  } catch (error) {
    logger.warn('chat_read_receipts_unavailable', { code: error.code });
    if (required) throw error;
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

module.exports = { markChatRead, applyDirectReadReceipts, timestampMicros };
