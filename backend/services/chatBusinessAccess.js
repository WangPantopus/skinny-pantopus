/**
 * Business inbox access, shared by routes/chats.js, routes/upload.js and socket/chatSocketio.js.
 *
 * A business (a User with account_type 'business') is a member of its conversations with customers and of the chat
 * rooms of the tasks it posts. Its owner and staff act for it there without becoming members themselves: a member row
 * of their own would name their personal account to the customer or the task's worker and list the conversation in
 * their personal Messages, where its composer writes as them (a business seat never exposes the person behind it).
 * They read and write through the business's own membership, after the permission check the shared inbox uses
 * (gigs.manage or gigs.post).
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { hasPermission } = require('../utils/businessPermissions');
const { unpublishedBusinessIds } = require('../utils/visibilityPolicy');

// A draft or closed business isn't public, so no chat names or reaches it (POST /direct). Nor does it start a
// conversation or write in a direct one as itself: the person would see neither who wrote nor a way to answer. Its
// inbox still lists and opens the conversations it has.
const UNPUBLISHED_BUSINESS_REFUSAL = {
  error: "This business isn't published, so it can't message people. Publish its profile first.",
  code: 'NOT_PUBLISHED',
};

// Nor does a person write to one in a direct conversation they already have: they can't see the business or reach it.
const UNPUBLISHED_BUSINESS_RECIPIENT_REFUSAL = {
  error: "This business isn't taking messages right now.",
  code: 'NOT_PUBLISHED',
};

// The refusal for writing as senderUserId in a direct room with these other active members when the sender or one of
// them is a draft or closed business; otherwise null. A failed read throws, so callers fail closed.
async function unpublishedDirectRoomRefusal(senderUserId, otherMemberIds) {
  const others = (otherMemberIds || []).map(String).filter((id) => id !== String(senderUserId));
  const unpublished = await unpublishedBusinessIds([senderUserId, ...others]);
  if (unpublished.has(String(senderUserId))) return UNPUBLISHED_BUSINESS_REFUSAL;
  return others.some((id) => unpublished.has(id)) ? UNPUBLISHED_BUSINESS_RECIPIENT_REFUSAL : null;
}

function chatAccessUnavailable() {
  return Object.assign(new Error('Chat authorization is temporarily unavailable. Please retry.'), {
    code: 'CHAT_UNAVAILABLE', status: 503,
  });
}

async function isBusinessAccount(userId) {
  const { data: user, error } = await supabaseAdmin
    .from('User')
    .select('id, account_type')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw chatAccessUnavailable();
  return Boolean(user && user.account_type === 'business');
}

async function canActAsBusiness(businessUserId, actorUserId) {
  if (!businessUserId || !actorUserId) return false;
  if (String(businessUserId) === String(actorUserId)) return true;
  if (!(await isBusinessAccount(businessUserId))) return false;
  const canManage = await hasPermission(businessUserId, actorUserId, 'gigs.manage', { throwOnError: true });
  if (canManage) return true;
  return hasPermission(businessUserId, actorUserId, 'gigs.post', { throwOnError: true });
}

// The owner and staff who may act for each of these businesses (active team members passing canActAsBusiness), as
// [{ businessUserId, userId }]. `include` skips team members before their permission check. Throws when the team
// can't be read.
async function businessStaff(businessUserIds, { include = () => true } = {}) {
  if (!Array.isArray(businessUserIds) || businessUserIds.length === 0) return [];
  const team = [];
  const ids = [...new Set(businessUserIds)];
  for (let offset = 0; offset < ids.length; offset += 100) {
    let after;
    for (;;) {
      let query = supabaseAdmin.from('BusinessTeam')
        .select('business_user_id, user_id').in('business_user_id', ids.slice(offset, offset + 100))
        .eq('is_active', true).order('business_user_id').order('user_id').limit(500);
      if (after) query = query.or(`business_user_id.gt.${after.business_user_id},and(business_user_id.eq.${after.business_user_id},user_id.gt.${after.user_id})`);
      const { data, error } = await query;
      if (error || !Array.isArray(data)) throw new Error(error?.message || 'business team unavailable');
      team.push(...data);
      if (data.length < 500) break;
      after = data.at(-1);
    }
  }
  const staff = [];
  for (const row of team) {
    const userId = String(row.user_id);
    if (!include(userId)) continue;
    if (await canActAsBusiness(row.business_user_id, userId)) {
      staff.push({ businessUserId: String(row.business_user_id), userId });
    }
  }
  return staff;
}

// The business's own active membership of the room, when the actor may act for that business; otherwise null.
async function businessMembership(roomId, actorUserId, businessUserId) {
  if (!roomId || !actorUserId || !businessUserId) return null;
  if (!(await canActAsBusiness(businessUserId, actorUserId))) return null;
  const { data: membership, error } = await supabaseAdmin
    .from('ChatParticipant')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', businessUserId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw chatAccessUnavailable();
  return membership || null;
}

// The business an actor who isn't a member of the room acts for there, for requests that don't name it (attachment
// uploads and downloads, joining the room's live updates): an active member that is a business they may act for.
async function actingBusinessInRoom(roomId, actorUserId) {
  if (!roomId || !actorUserId) return null;
  const { data: members, error } = await supabaseAdmin
    .from('ChatParticipant')
    .select('user_id, user:user_id(account_type)')
    .eq('room_id', roomId)
    .eq('is_active', true);
  if (error || !Array.isArray(members)) throw chatAccessUnavailable();
  for (const member of members) {
    if (member.user?.account_type !== 'business' || String(member.user_id) === String(actorUserId)) continue;
    if (await canActAsBusiness(member.user_id, actorUserId)) return String(member.user_id);
  }
  return null;
}

// In the chat room of a task a business posted, the business when the actor may act for it there. Its owner and staff
// answer the task's worker and askers as the business (services/chatGigRoomAccess counts them on the owner side, and
// their messages there go out as the business), whether or not the request names it. Null in any other room, for the
// business itself and for the task's worker.
async function taskBusinessInRoom(roomId, actorUserId) {
  if (!roomId || !actorUserId) return null;
  const { data: room, error: roomError } = await supabaseAdmin
    .from('ChatRoom')
    .select('type, gig_id')
    .eq('id', roomId)
    .maybeSingle();
  if (roomError) throw chatAccessUnavailable();
  if (room?.type !== 'gig' || !room.gig_id) return null;
  const { data: gig, error: gigError } = await supabaseAdmin
    .from('Gig')
    .select('user_id, accepted_by')
    .eq('id', room.gig_id)
    .maybeSingle();
  if (gigError) throw chatAccessUnavailable();
  if (!gig?.user_id || String(gig.user_id) === String(actorUserId)) return null;
  if (gig.accepted_by && String(gig.accepted_by) === String(actorUserId)) return null;
  return (await canActAsBusiness(gig.user_id, actorUserId)) ? String(gig.user_id) : null;
}

// Opening a business's conversation, or its task's chat, used to make the staff member an ordinary member of it
// (migrations 20261020053000 and 20261020090000 remove those rows). One that comes back, say from an older API during
// a release, goes when they next open the conversation for the business: in a direct room, their own row is removed
// when someone else there is neither the business nor on its team (the customer); in a task's room, when the business
// posted the task and they aren't its worker. A team member's own conversation with their business, where nobody else
// is, keeps their row.
async function dropStaffMembership(roomId, actorUserId, businessUserId) {
  if (String(actorUserId) === String(businessUserId)) return;
  const [{ data: room }, { data: members }] = await Promise.all([
    supabaseAdmin.from('ChatRoom').select('type, gig_id').eq('id', roomId).maybeSingle(),
    supabaseAdmin.from('ChatParticipant').select('user_id').eq('room_id', roomId),
  ]);
  if (!Array.isArray(members)) return;
  const ids = members.map((member) => String(member.user_id));
  if (!ids.includes(String(actorUserId))) return;
  if (room?.type === 'gig' && room.gig_id) {
    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('user_id, accepted_by')
      .eq('id', room.gig_id)
      .maybeSingle();
    if (gigError || !gig || String(gig.user_id) !== String(businessUserId)) return;
    if (gig.accepted_by && String(gig.accepted_by) === String(actorUserId)) return;
  } else {
    if (room?.type !== 'direct') return;
    const others = ids.filter((id) => id !== String(actorUserId) && id !== String(businessUserId));
    if (others.length === 0) return;
    const { data: team, error: teamError } = await supabaseAdmin
      .from('BusinessTeam')
      .select('user_id')
      .eq('business_user_id', businessUserId)
      .in('user_id', others);
    if (teamError || !Array.isArray(team)) return;
    const teamIds = new Set(team.map((row) => String(row.user_id)));
    if (others.every((id) => teamIds.has(id))) return;
  }
  const { error } = await supabaseAdmin
    .from('ChatParticipant')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', actorUserId);
  if (error) logger.warn('chat.business_staff_membership_not_removed', { roomId, error: error.message });
  else logger.info('chat.business_staff_membership_removed', { roomId });
}

module.exports = {
  chatAccessUnavailable,
  UNPUBLISHED_BUSINESS_REFUSAL,
  UNPUBLISHED_BUSINESS_RECIPIENT_REFUSAL,
  unpublishedDirectRoomRefusal,
  isBusinessAccount,
  canActAsBusiness,
  businessStaff,
  businessMembership,
  actingBusinessInRoom,
  taskBusinessInRoom,
  dropStaffMembership,
};
