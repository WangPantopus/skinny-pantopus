/**
 * Business inbox access, shared by routes/chats.js, routes/upload.js and socket/chatSocketio.js.
 *
 * A business (a User with account_type 'business') is a member of its conversations with customers. Its owner and
 * staff act for it there without becoming members themselves: a member row of their own would name their personal
 * account to the customer and list the conversation in their personal Messages, where its composer writes as them
 * (a business seat never exposes the person behind it). They read and write through the business's own membership,
 * after the permission check the shared inbox uses (gigs.manage or gigs.post).
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { hasPermission } = require('../utils/businessPermissions');

async function isBusinessAccount(userId) {
  const { data: user } = await supabaseAdmin
    .from('User')
    .select('id, account_type')
    .eq('id', userId)
    .maybeSingle();
  return Boolean(user && user.account_type === 'business');
}

async function canActAsBusiness(businessUserId, actorUserId) {
  if (!businessUserId || !actorUserId) return false;
  if (String(businessUserId) === String(actorUserId)) return true;
  if (!(await isBusinessAccount(businessUserId))) return false;
  const canManage = await hasPermission(businessUserId, actorUserId, 'gigs.manage');
  if (canManage) return true;
  return hasPermission(businessUserId, actorUserId, 'gigs.post');
}

// The business's own active membership of the room, when the actor may act for that business; otherwise null.
async function businessMembership(roomId, actorUserId, businessUserId) {
  if (!roomId || !actorUserId || !businessUserId) return null;
  if (!(await canActAsBusiness(businessUserId, actorUserId))) return null;
  const { data: membership } = await supabaseAdmin
    .from('ChatParticipant')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', businessUserId)
    .eq('is_active', true)
    .maybeSingle();
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
  if (error || !Array.isArray(members)) return null;
  for (const member of members) {
    if (member.user?.account_type !== 'business' || String(member.user_id) === String(actorUserId)) continue;
    if (await canActAsBusiness(member.user_id, actorUserId)) return String(member.user_id);
  }
  return null;
}

// Opening a business's conversation used to make the staff member an ordinary member of it (migration
// 20261020053000 removes those rows). One that comes back, say from an older API during a release,
// goes when they next open the conversation for the business: in a direct room, their own row is removed when
// someone else there is neither the business nor on its team (the customer). A team member's own conversation
// with their business, where nobody else is, keeps their row.
async function dropStaffMembership(roomId, actorUserId, businessUserId) {
  if (String(actorUserId) === String(businessUserId)) return;
  const [{ data: room }, { data: members }] = await Promise.all([
    supabaseAdmin.from('ChatRoom').select('type').eq('id', roomId).maybeSingle(),
    supabaseAdmin.from('ChatParticipant').select('user_id').eq('room_id', roomId),
  ]);
  if (room?.type !== 'direct' || !Array.isArray(members)) return;
  const ids = members.map((member) => String(member.user_id));
  const others = ids.filter((id) => id !== String(actorUserId) && id !== String(businessUserId));
  if (!ids.includes(String(actorUserId)) || others.length === 0) return;
  const { data: team, error: teamError } = await supabaseAdmin
    .from('BusinessTeam')
    .select('user_id')
    .eq('business_user_id', businessUserId)
    .in('user_id', others);
  if (teamError || !Array.isArray(team)) return;
  const teamIds = new Set(team.map((row) => String(row.user_id)));
  if (others.every((id) => teamIds.has(id))) return;
  const { error } = await supabaseAdmin
    .from('ChatParticipant')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', actorUserId);
  if (error) logger.warn('chat.business_staff_membership_not_removed', { roomId, error: error.message });
  else logger.info('chat.business_staff_membership_removed', { roomId });
}

module.exports = {
  isBusinessAccount,
  canActAsBusiness,
  businessMembership,
  actingBusinessInRoom,
  dropStaffMembership,
};
