// A reply to a Moment is a direct chat message to its author (CONTRACT "Chat"). The stored message names the Moment in
// metadata.moment = { id, kind, expires_at }; every chat serializer adds the quote the apps draw above the text,
// `moment: { id, kind, thumb_url|null, ended }`, and both conversation lists add `last_message_moment` (with `from_me`).
// The picture is a fresh 15-minute link each time, never stored; once the Moment ends the quote says so and has none.

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const media = require('./momentMedia');
const { meta, hasEnded, KINDS, fail } = require('./momentStore');
const { isFeatureEnabled } = require('../featureFlagService');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function quotedMomentId(metadata) {
  const id = metadata?.moment?.id;
  return typeof id === 'string' && UUID.test(id) ? id : null;
}

// The quote from the message alone, for a Moment that can't be read: ended once its stored end time has passed.
function storedQuote(id, stored) {
  const ends = Date.parse(stored?.expires_at);
  return { id, kind: KINDS.includes(stored?.kind) ? stored.kind : null, thumb_url: null,
    ended: !Number.isFinite(ends) || ends <= Date.now() };
}

/**
 * The quotes of the Moments these chat messages name, by Moment id. A failed read leaves them to the stored quote.
 * `readerId`, on the reads made for one person (a thread, a conversation list): a Moment whose author and the reader
 * have a block between them reads as ended, with no picture ("You won't see each other's Moments"). The socket's
 * shared payloads pass none: a reply can't be sent across a block, so a new quote never crosses one.
 */
async function momentQuotes(messages, readerId = null) {
  const named = new Map();
  for (const message of messages || []) {
    const id = quotedMomentId(message?.metadata);
    if (id && !named.has(id)) named.set(id, message.metadata.moment);
  }
  const quotes = new Map();
  if (!named.size) return quotes;
  try {
    const ids = [...named.keys()];
    const pages = await Promise.all(Array.from({ length: Math.ceil(ids.length / 100) }, async (_, page) => {
      const { data, error } = await supabaseAdmin.from('Post')
        .select('id, user_id, story_expires_at, archived_at, moderation_state, post_metadata')
        .in('id', ids.slice(page * 100, page * 100 + 100)).eq('is_story', true);
      if (error) throw error;
      return data || [];
    }));
    const rows = new Map(pages.flat().map((row) => [row.id, row]));
    // The reader's blocks, read only when a quoted Moment is someone else's. A failed read throws: no pictures then.
    const others = readerId && [...rows.values()].some((row) => String(row.user_id) !== String(readerId));
    const blocked = new Set(others ? [...await require('../blockService').blockedUserIds(readerId)].map(String) : []);
    const acrossBlock = (row) => blocked.has(String(row.user_id));
    // A picture only while the Moment is live: not once it ended, nor while it's held for review, nor across a block.
    const thumbKey = (row) => (row && !hasEnded(row) && row.moderation_state === 'live' && !acrossBlock(row)
      ? meta(row).media?.thumb_key || null : null);
    const links = await media.signedLinks(undefined, [...rows.values()].map(thumbKey).filter(Boolean));
    for (const [id, stored] of named) {
      const row = rows.get(id);
      if (!row) {
        quotes.set(id, { ...storedQuote(id, stored), ended: true });
        continue;
      }
      const key = thumbKey(row);
      quotes.set(id, {
        id,
        kind: KINDS.includes(meta(row).kind) ? meta(row).kind : storedQuote(id, stored).kind,
        thumb_url: key ? links.get(key) || null : null,
        ended: hasEnded(row) || acrossBlock(row),
      });
    }
  } catch (error) {
    logger.warn('moments.chat_quotes_failed', { error: error.message });
  }
  return quotes;
}

/** A serialized chat message's `moment` field, or null when it names no Moment. */
function momentField(metadata, quotes) {
  const id = quotedMomentId(metadata);
  if (!id) return null;
  return quotes?.get(id) || storedQuote(id, metadata.moment);
}

// A PostgREST timestamp in microseconds, so two writes in the same millisecond still compare.
function micros(value) {
  const text = String(value || '');
  const millis = Date.parse(text.replace(/\.\d+/, ''));
  if (Number.isNaN(millis)) return null;
  const fraction = /\.(\d+)/.exec(text)?.[1] || '';
  return millis * 1000 + Number(fraction.padEnd(6, '0').slice(0, 6));
}

/**
 * `last_message_moment` for conversation rows: `rows` are { key, roomIds, lastAt } (the row's rooms and its last
 * message's time); answers key → { id, kind, thumb_url, ended, from_me } for the rows whose last message names a
 * Moment, `from_me` meaning `viewerId` sent it. A failed read answers none (the rows keep last_message_preview).
 */
// Conversation rows read per query: their room ids and times go in the request URL.
const ROWS_PER_READ = 40;

async function lastMessageMoments(rows, viewerId, flagUser) {
  const wanted = (rows || []).filter((row) => row.lastAt && row.roomIds?.length);
  const answer = new Map();
  if (!wanted.length) return answer;
  try {
    // While Moments are off for the person reading (`flagUser`, req.user), their lists don't look (the flag is cached).
    if (!(await isFeatureEnabled('moments', flagUser))) return answer;
    const batches = [];
    for (let at = 0; at < wanted.length; at += ROWS_PER_READ) batches.push(wanted.slice(at, at + ROWS_PER_READ));
    // Only the Moment replies among the last messages come back.
    const found = await Promise.all(batches.map(async (batch) => {
      const { data, error } = await supabaseAdmin.from('ChatMessage')
        .select('id, room_id, user_id, actor_user_id, created_at, metadata')
        .in('room_id', [...new Set(batch.flatMap((row) => row.roomIds))])
        .in('created_at', [...new Set(batch.map((row) => row.lastAt))])
        .eq('deleted', false)
        .not('metadata->moment', 'is', null);
      if (error) throw error;
      return data || [];
    }));
    const messages = found.flat();
    const last = new Map();
    for (const row of wanted) {
      const at = micros(row.lastAt);
      const rooms = new Set(row.roomIds.map(String));
      const message = messages.find((m) => rooms.has(String(m.room_id)) && micros(m.created_at) === at
        && quotedMomentId(m.metadata));
      if (message) last.set(row.key, message);
    }
    if (!last.size) return answer;
    const quotes = await momentQuotes([...last.values()], viewerId);
    for (const [key, message] of last) {
      answer.set(key, {
        ...momentField(message.metadata, quotes),
        from_me: [String(message.user_id), String(message.actor_user_id)].includes(String(viewerId)),
      });
    }
  } catch (error) {
    logger.warn('moments.last_message_moment_failed', { error: error.message });
  }
  return answer;
}

/**
 * Sends `text` as a reply to the Moment `row` by `author` (CONTRACT POST /api/moments/:id/reply): a message in the
 * replier's direct chat with the author, delivered like any other (push, badge, socket). → { room_id, message_id }.
 */
async function replyToMoment({ row, author, replierId, text, io, requestId }) {
  // The Pantopus curator takes no messages (POST /api/chat/direct refuses it too).
  if (author?.kind === 'pantopus') {
    throw fail(403, 'MOMENT_REPLY_UNAVAILABLE', "Pantopus Moments don't take replies.");
  }
  const { isBlocked } = require('../blockService');
  if (await isBlocked(replierId, row.user_id)) throw fail(403, 'MOMENT_REPLY_UNAVAILABLE', 'Unable to message this person.');

  const { data: roomId, error: roomError } = await supabaseAdmin.rpc('get_or_create_direct_chat', {
    p_user_id_1: replierId, p_user_id_2: row.user_id,
  });
  if (roomError || !roomId) throw new Error(`Failed to open the chat: ${roomError?.message || 'no room'}`);
  const { data: room, error: readError } = await supabaseAdmin.from('ChatRoom')
    .select('id, type, gig_id, is_active').eq('id', roomId).single();
  if (readError || !room) throw new Error(`Failed to read the chat: ${readError?.message || 'no room'}`);

  const { data: message, error } = await supabaseAdmin.from('ChatMessage').insert({
    push_delivery_requested: true,
    room_id: roomId,
    user_id: replierId,
    message: text,
    type: 'text',
    attachments: [],
    metadata: { moment: { id: row.id, kind: meta(row).kind, expires_at: row.story_expires_at } },
  // deliverNewMessage names the sender the way chats do (loadChatPeople), so no User join here.
  }).select('*').single();
  // The database re-checks a block inside the insert (20260916010000_direct_message_block_admission).
  if (error?.code === 'PT403') throw fail(403, 'MOMENT_REPLY_UNAVAILABLE', 'Unable to message this person.');
  if (error || !message) throw new Error(`Failed to send the reply: ${error?.message || 'no message'}`);

  const { deliverNewMessage } = require('../../routes/chats');
  deliverNewMessage(io, { room, message, actorUserId: replierId, senderUserId: replierId, requestId })
    .catch((deliveryError) => logger.warn('moments.reply_delivery_failed', { requestId, roomId, error: deliveryError.message }));
  return { room_id: roomId, message_id: message.id };
}

module.exports = { momentQuotes, momentField, lastMessageMoments, replyToMoment };
