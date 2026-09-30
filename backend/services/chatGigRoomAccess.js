/**
 * Who may use an assigned task's gig chat room.
 *
 * A gig room belongs to its task. Once the task has an accepted worker, the room is the
 * owner's and that worker's conversation. Anyone else who still holds a ChatParticipant row
 * (someone who asked a pre-bid question while the task was open, or tapped "Send Message"
 * before GET /api/gigs/:gigId/chat-room stopped adding them) must not read, send, list or
 * receive it. The owner side is the owner, or a team member allowed to post as a business
 * owner (getGigOwnerMessagingContext, the rule chat already uses for business-owned tasks).
 *
 * Unchanged: non-gig rooms, and gig rooms of tasks with no accepted worker (pre-bid).
 * A failed task lookup refuses rather than allows.
 *
 * Shared by routes/chats.js and socket/chatSocketio.js so the REST routes and the socket
 * apply one rule.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const { hasPermission } = require('../utils/businessPermissions');

async function getGigOwnerMessagingContext(gigOwnerUserId, actorUserId) {
  if (String(gigOwnerUserId) === String(actorUserId)) {
    return { isOwnerActor: true, messageSenderUserId: actorUserId };
  }

  const { data: owner } = await supabaseAdmin
    .from('User')
    .select('id, account_type')
    .eq('id', gigOwnerUserId)
    .maybeSingle();

  if (!owner || owner.account_type !== 'business') {
    return { isOwnerActor: false, messageSenderUserId: actorUserId };
  }

  const canManage = await hasPermission(gigOwnerUserId, actorUserId, 'gigs.manage');
  const canPost = canManage ? true : await hasPermission(gigOwnerUserId, actorUserId, 'gigs.post');
  if (!canPost) {
    return { isOwnerActor: false, messageSenderUserId: actorUserId };
  }

  // For business-owned gig chats, authorized team members post as the business.
  return { isOwnerActor: true, messageSenderUserId: gigOwnerUserId };
}

function gigRoomAccessUnavailable() {
  return Object.assign(new Error('Chat authorization is temporarily unavailable. Please retry.'), {
    code: 'GIG_ROOM_ACCESS_UNAVAILABLE', status: 503,
  });
}

/**
 * The ids of `rooms` ({ id, type | room_type, gig_id }) closed to the actor.
 * `identityIds` adds identities the actor is acting as (a business inbox), already authorized
 * by the caller.
 */
async function closedGigRoomIds(rooms, actorUserId, identityIds = []) {
  const closed = new Set();
  const gigRooms = (rooms || []).filter((r) => r && r.gig_id && (r.type || r.room_type) === 'gig');
  if (gigRooms.length === 0) return closed;

  const gigIds = [...new Set(gigRooms.map((r) => String(r.gig_id)))];
  const { data: gigs, error } = await supabaseAdmin
    .from('Gig')
    .select('id, user_id, accepted_by')
    .in('id', gigIds);
  if (error || !Array.isArray(gigs)) throw gigRoomAccessUnavailable();

  const gigById = new Map(gigs.map((g) => [String(g.id), g]));
  const identities = new Set([String(actorUserId), ...identityIds.filter(Boolean).map(String)]);
  const ownerActorByOwner = new Map();

  for (const room of gigRooms) {
    const gig = gigById.get(String(room.gig_id));
    if (!gig || !gig.accepted_by) continue;
    if (identities.has(String(gig.accepted_by)) || identities.has(String(gig.user_id))) continue;
    const ownerKey = String(gig.user_id);
    if (!ownerActorByOwner.has(ownerKey)) {
      const { isOwnerActor } = await getGigOwnerMessagingContext(gig.user_id, actorUserId);
      ownerActorByOwner.set(ownerKey, isOwnerActor);
    }
    if (!ownerActorByOwner.get(ownerKey)) closed.add(String(room.id));
  }
  return closed;
}

/** Same as closedGigRoomIds, for room ids. */
async function closedGigRoomIdsByRoomId(roomIds, actorUserId, identityIds = []) {
  const ids = [...new Set((roomIds || []).filter(Boolean).map(String))];
  if (ids.length === 0) return new Set();
  const { data: rooms, error } = await supabaseAdmin
    .from('ChatRoom')
    .select('id, type, gig_id')
    .in('id', ids);
  if (error || !Array.isArray(rooms)) throw gigRoomAccessUnavailable();
  return closedGigRoomIds(rooms, actorUserId, identityIds);
}

async function isGigRoomClosedTo(roomId, actorUserId, identityIds = []) {
  if (!roomId) return false;
  const closed = await closedGigRoomIdsByRoomId([roomId], actorUserId, identityIds);
  return closed.has(String(roomId));
}

/**
 * Leftover members among `members` ({ room_id, user_id }) of the given `rooms`, as
 * `${room_id}:${user_id}` keys. They are left out of member lists, so the owner and the worker
 * don't see a stranger listed in their task room.
 */
async function hiddenGigRoomMembers(rooms, members) {
  const hidden = new Set();
  const gigRooms = (rooms || []).filter((r) => r && r.gig_id && (r.type || r.room_type) === 'gig');
  if (gigRooms.length === 0 || !members || members.length === 0) return hidden;

  const gigIds = [...new Set(gigRooms.map((r) => String(r.gig_id)))];
  const { data: gigs, error } = await supabaseAdmin
    .from('Gig')
    .select('id, user_id, accepted_by')
    .in('id', gigIds);
  if (error || !Array.isArray(gigs)) throw gigRoomAccessUnavailable();

  const gigById = new Map(gigs.map((g) => [String(g.id), g]));
  const assignedGigByRoom = new Map();
  for (const room of gigRooms) {
    const gig = gigById.get(String(room.gig_id));
    if (gig && gig.accepted_by) assignedGigByRoom.set(String(room.id), gig);
  }
  const ownerActor = new Map();
  for (const m of members) {
    const gig = assignedGigByRoom.get(String(m.room_id));
    if (!gig || !m.user_id) continue;
    const uid = String(m.user_id);
    if (uid === String(gig.accepted_by) || uid === String(gig.user_id)) continue;
    const key = `${gig.user_id}:${uid}`;
    if (!ownerActor.has(key)) {
      const { isOwnerActor } = await getGigOwnerMessagingContext(gig.user_id, uid);
      ownerActor.set(key, isOwnerActor);
    }
    if (!ownerActor.get(key)) hidden.add(`${m.room_id}:${uid}`);
  }
  return hidden;
}

/** The members of `userIds` the room ({ id, type, gig_id }) is open to, for notifications. */
async function gigRoomRecipients(room, userIds) {
  if (!room || room.type !== 'gig' || !room.gig_id || !userIds || userIds.length === 0) return userIds || [];
  const { data: gig, error } = await supabaseAdmin
    .from('Gig')
    .select('id, user_id, accepted_by')
    .eq('id', room.gig_id)
    .maybeSingle();
  if (error) throw gigRoomAccessUnavailable();
  if (!gig || !gig.accepted_by) return userIds;
  const open = [];
  for (const id of userIds) {
    if (String(id) === String(gig.accepted_by) || String(id) === String(gig.user_id)) {
      open.push(id);
      continue;
    }
    const { isOwnerActor } = await getGigOwnerMessagingContext(gig.user_id, id);
    if (isOwnerActor) open.push(id);
  }
  return open;
}

// A task chat retired when its worker was released or bidding reopened (ChatRoom.is_active
// false) keeps its history for the owner and that worker but takes no new messages, reactions
// or edits: edits after the fact would let either side rewrite the record. A failed lookup
// counts as closed. Deleting one's own message stays allowed.
async function isRoomClosedForWrites(roomId) {
  const { data, error } = await supabaseAdmin
    .from('ChatRoom')
    .select('is_active')
    .eq('id', roomId)
    .maybeSingle();
  if (error) return true;
  return data?.is_active === false;
}

module.exports = {
  getGigOwnerMessagingContext,
  gigRoomAccessUnavailable,
  closedGigRoomIds,
  closedGigRoomIdsByRoomId,
  isGigRoomClosedTo,
  hiddenGigRoomMembers,
  gigRoomRecipients,
  isRoomClosedForWrites,
};
