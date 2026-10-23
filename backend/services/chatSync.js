const supabaseAdmin = require('../config/supabaseAdmin');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseSyncCursor(raw, { optional = false } = {}) {
  if (raw == null && optional) return null;
  let value;
  try {
    // POST readers send a JSON object so room maps do not overflow HTTP URLs.
    // Keep GET/string compatibility and a bounded body for malformed requests.
    if (typeof raw === 'string' && raw.length > 1024 * 1024) throw new Error();
    value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length > 10000) throw new Error();
    const normalized = {};
    for (const [roomId, version] of Object.entries(value)) {
      if (!UUID.test(roomId) || !Number.isSafeInteger(version) || version < 0
        || Object.hasOwn(normalized, roomId.toLowerCase())) throw new Error();
      normalized[roomId.toLowerCase()] = version;
    }
    value = normalized;
  } catch {
    const error = new Error('Invalid chat sync cursor');
    error.status = 400;
    throw error;
  }
  return value;
}

// Bounded URLs and four requests at a time. Callers only use this for compact
// room/participant state, never for unbounded message bodies.
async function readChatRoomBatches(roomIds, query) {
  const rows = [];
  for (let offset = 0; offset < roomIds.length; offset += 400) {
    const batch = [];
    for (let start = offset; start < Math.min(roomIds.length, offset + 400); start += 100) {
      batch.push(query(roomIds.slice(start, start + 100)));
    }
    const results = await Promise.all(batch);
    for (const result of results) {
      if (result.error) throw result.error;
      rows.push(...(result.data || []));
    }
  }
  return rows;
}

async function chatSyncSnapshot(roomIds) {
  if (!roomIds.length) return { cursors: {}, resets: {} };
  const data = await readChatRoomBatches(roomIds, (ids) => supabaseAdmin.from('ChatRoom')
    .select('id, message_revision, history_reset_revision').in('id', ids));
  if (data.length !== new Set(roomIds).size) throw new Error('Chat sync scope changed; retry');
  return {
    cursors: Object.fromEntries((data || []).map((row) => [row.id, row.message_revision])),
    resets: Object.fromEntries((data || []).map((row) => [row.id, row.history_reset_revision])),
  };
}

async function chatChanges({ roomIds, identityUserId, cursor, until, limit }) {
  const snapshot = await chatSyncSnapshot(roomIds);
  const roomSet = new Set(roomIds);
  const removedRoomIds = Object.keys(cursor).filter((roomId) => !roomSet.has(roomId));
  const target = until || snapshot.cursors;
  const resetRequired = roomIds.some((roomId) => cursor[roomId] == null || target[roomId] == null
    || cursor[roomId] < snapshot.resets[roomId] || cursor[roomId] > target[roomId]
    || target[roomId] > snapshot.cursors[roomId]);
  const base = { roomIds, removedRoomIds, resetRequired };
  if (resetRequired) return { ...base, messages: [], hasMore: false, syncCursors: {}, untilCursors: {} };

  const { data, error } = roomIds.length ? await supabaseAdmin.rpc('get_chat_message_changes', {
    p_user_id: identityUserId, p_room_ids: roomIds, p_after: cursor, p_until: target, p_limit: limit + 1,
  }) : { data: [] };
  if (error) throw error;
  const messages = (data || []).slice(0, limit);
  const hasMore = (data || []).length > limit;
  const syncCursors = Object.fromEntries(roomIds.map((id) => [id, hasMore ? cursor[id] : target[id]]));
  if (hasMore) for (const message of messages) syncCursors[message.room_id] = message.sync_version;

  return { ...base, messages, hasMore, syncCursors,
    untilCursors: Object.fromEntries(roomIds.map((id) => [id, target[id]])) };
}

async function chatReadReceipts(roomIds) {
  if (!roomIds.length) return [];
  const data = await readChatRoomBatches(roomIds, (ids) => supabaseAdmin.from('ChatParticipant')
    .select('user_id, room_id, last_read_at, last_read_message_id, last_read_message_at, room:room_id!inner(type)')
    .in('room_id', ids).eq('room.type', 'direct').eq('is_active', true)
    .not('last_read_message_id', 'is', null));
  return (data || []).map((row) => ({ userId: row.user_id, roomId: row.room_id,
    readAt: row.last_read_at, throughMessageId: row.last_read_message_id,
    throughCreatedAt: row.last_read_message_at }));
}

module.exports = { parseSyncCursor, chatSyncSnapshot, chatChanges, chatReadReceipts, readChatRoomBatches };
