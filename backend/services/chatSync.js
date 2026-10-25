const supabaseAdmin = require('../config/supabaseAdmin');
const { loadChatPeople } = require('./chatPeople');

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

// A bounded room URL can still match thousands of group members. Page the
// membership rows separately so previews and delivery include the entire scope.
async function readChatParticipants(roomIds, columns, { activeOnly = true, excludeUserId } = {}) {
  const rows = [];
  const ids = [...new Set(roomIds)];
  for (let offset = 0; offset < ids.length; offset += 100) {
    let after;
    for (;;) {
      let query = supabaseAdmin.from('ChatParticipant')
        .select(`id, room_id, ${columns}`)
        .in('room_id', ids.slice(offset, offset + 100))
        .order('room_id').order('id').limit(500);
      if (activeOnly) query = query.eq('is_active', true);
      if (excludeUserId) query = query.neq('user_id', excludeUserId);
      if (after) query = query.or(`room_id.gt.${after.room_id},and(room_id.eq.${after.room_id},id.gt.${after.id})`);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...data || []);
      if (!data || data.length < 500) break;
      after = data.at(-1);
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
  if (resetRequired) return { ...base, messages: [], hasMore: false, syncCursors: {}, untilCursors: {}, changedRoomIds: [] };

  // Only rooms whose revision moved past the cursor can hold changes, so a quiet scope reads no messages.
  const changedRoomIds = roomIds.filter((id) => target[id] > cursor[id]);
  const changedOnly = (cursors) => Object.fromEntries(changedRoomIds.map((id) => [id, cursors[id]]));
  const { data, error } = changedRoomIds.length ? await supabaseAdmin.rpc('get_chat_message_changes', {
    p_user_id: identityUserId, p_room_ids: changedRoomIds, p_after: changedOnly(cursor), p_until: changedOnly(target),
    p_limit: limit + 1,
  }) : { data: [] };
  if (error) throw error;
  const messages = (data || []).slice(0, limit);
  const hasMore = (data || []).length > limit;
  const syncCursors = Object.fromEntries(roomIds.map((id) => [id, hasMore ? cursor[id] : target[id]]));
  if (hasMore) for (const message of messages) syncCursors[message.room_id] = message.sync_version;

  // untilCursors pins the later pages of one snapshot; a complete, unpinned page has nothing to pin.
  return { ...base, messages, hasMore, syncCursors, changedRoomIds,
    untilCursors: until || hasMore ? Object.fromEntries(roomIds.map((id) => [id, target[id]])) : {} };
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

/**
 * Build a reaction summary array for the given message IDs.
 * Returns a Map<messageId, ReactionSummary[]> where each entry is:
 *   { reaction, count, users: [{ id, name, username, identity }], reacted_by_me }
 */
async function buildReactionSummary(messageIds, requestingUserId) {
  if (!messageIds || messageIds.length === 0) return new Map();

  const reactions = [];
  const uniqueIds = [...new Set(messageIds)];
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    let after;
    for (;;) {
      let query = supabaseAdmin.from('MessageReaction')
        .select('id, message_id, reaction, user_id')
        .in('message_id', uniqueIds.slice(offset, offset + 100))
        .order('message_id').order('id').limit(500);
      if (after) query = query.or(`message_id.gt.${after.message_id},and(message_id.eq.${after.message_id},id.gt.${after.id})`);
      const { data, error } = await query;
      if (error) throw error;
      reactions.push(...data || []);
      if (!data || data.length < 500) break;
      after = data[data.length - 1];
    }
  }
  if (!reactions.length) return new Map();

  // The people who reacted, as the chat list names them
  const people = new Map();
  const userIds = [...new Set(reactions.map((r) => r.user_id))];
  for (let offset = 0; offset < userIds.length; offset += 100) {
    for (const [id, person] of await loadChatPeople(userIds.slice(offset, offset + 100))) people.set(id, person);
  }

  // Group: messageId -> reaction -> [user_id, ...]
  // Reaction text is user input: Map also handles keys such as "toString".
  const grouped = new Map();
  for (const r of reactions) {
    if (!grouped.has(r.message_id)) grouped.set(r.message_id, new Map());
    const byReaction = grouped.get(r.message_id);
    if (!byReaction.has(r.reaction)) byReaction.set(r.reaction, []);
    byReaction.get(r.reaction).push(r.user_id);
  }

  const result = new Map();
  for (const [msgId, reactionMap] of grouped) {
    const summary = [...reactionMap].map(([reaction, uids]) => ({
      reaction,
      count: uids.length,
      users: uids.map((uid) => {
        const identity = people.get(String(uid)) || null;
        return {
          id: identity?.id || uid,
          name: identity?.displayName || 'Unknown',
          username: identity?.handle || null,
          identity,
        };
      }),
      reacted_by_me: uids.includes(requestingUserId),
    }));
    result.set(msgId, summary);
  }
  return result;
}

module.exports = { parseSyncCursor, chatSyncSnapshot, chatChanges, chatReadReceipts, readChatRoomBatches, readChatParticipants, buildReactionSummary };
