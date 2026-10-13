'use strict';

/**
 * A plan's group chat, on the existing chat tables (ChatRoom type 'plan').
 *
 * Membership changes only here, through the Plans endpoints: the host and the
 * people who are in. The generic participant routes refuse plan rooms
 * (routes/chats.js). Someone who leaves or is removed loses the room row
 * entirely, so they can't read it later. The room closes (is_active = false,
 * read-only) when the plan is cancelled and 24 hours after it ends.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

function socketHelpers() {
  // Lazily: the socket module wires itself to the server at boot.
  try {
    return require('../../socket/chatSocketio');
  } catch (_) {
    return null;
  }
}

function joinSockets(io, userId, roomId) {
  const sockets = socketHelpers()?.connectedUsers?.get(String(userId));
  if (!io || !sockets) return;
  for (const socketId of sockets) io.to(socketId).socketsJoin(roomId);
}

function leaveSockets(io, userId, roomId) {
  const sockets = socketHelpers()?.connectedUsers?.get(String(userId));
  if (!io || !sockets) return;
  for (const socketId of sockets) io?.sockets?.sockets?.get(socketId)?.leave(roomId);
}

/** The plan's room, made at the first acceptance with the host as its owner. */
async function ensureRoom(plan, { io = null } = {}) {
  if (plan.chat_room_id) return plan.chat_room_id;
  const { data: room, error } = await supabaseAdmin
    .from('ChatRoom')
    .insert({
      type: 'plan',
      name: String(plan.post?.title || 'Plan').slice(0, 100),
      description: null,
      is_active: true,
      max_participants: Math.min(Number(plan.spots || 0) + 1, 31) || 31,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to open the plan's chat: ${error.message}`);

  // Only the first writer keeps its room; a concurrent acceptance uses that one.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('Plan')
    .update({ chat_room_id: room.id, updated_at: new Date().toISOString() })
    .eq('post_id', plan.post_id)
    .is('chat_room_id', null)
    .select('chat_room_id');
  if (claimError) throw new Error(`Failed to link the plan's chat: ${claimError.message}`);
  if (!claimed || claimed.length === 0) {
    await supabaseAdmin.from('ChatRoom').delete().eq('id', room.id);
    const { data: current } = await supabaseAdmin.from('Plan').select('chat_room_id').eq('post_id', plan.post_id).single();
    plan.chat_room_id = current?.chat_room_id || null;
    return plan.chat_room_id;
  }
  plan.chat_room_id = room.id;
  await addMember(room.id, plan.host_user_id, { role: 'owner', io });
  // Everyone already in joins too (the room opens with the first acceptance).
  const { data: inAlready } = await supabaseAdmin
    .from('PlanRequest').select('user_id').eq('post_id', plan.post_id).eq('status', 'accepted');
  for (const row of inAlready || []) await addMember(room.id, row.user_id, { io });
  await systemLine(room.id, plan.host_user_id, 'This chat closes 24 hours after the plan ends');
  return room.id;
}

async function addMember(roomId, userId, { role = 'member', io = null } = {}) {
  const { error } = await supabaseAdmin
    .from('ChatParticipant')
    .upsert(
      { room_id: roomId, user_id: userId, role, is_active: true, left_at: null },
      { onConflict: 'room_id,user_id' },
    );
  if (error) throw new Error(`Failed to add to the plan's chat: ${error.message}`);
  joinSockets(io, userId, roomId);
}

/** Leaves no row behind: a person who's out can't open the room again. */
async function removeMember(roomId, userId, { io = null } = {}) {
  if (!roomId) return;
  const { error } = await supabaseAdmin
    .from('ChatParticipant')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);
  if (error) throw new Error(`Failed to remove from the plan's chat: ${error.message}`);
  leaveSockets(io, userId, roomId);
}

/** A grey line in the chat ("Sam let in Priya + 1"). Never fails the action that wrote it. */
async function systemLine(roomId, actorUserId, text) {
  if (!roomId) return;
  const { error } = await supabaseAdmin
    .from('ChatMessage')
    .insert({ room_id: roomId, user_id: actorUserId, message: text, type: 'system', metadata: { plan_system: true } });
  if (error) logger.warn('plans.chat.system_line_not_recorded', { roomId, error: error.message });
}

/** Read-only from now on. */
async function closeRoom(plan) {
  const now = new Date().toISOString();
  if (plan.chat_room_id) {
    const { error } = await supabaseAdmin
      .from('ChatRoom')
      .update({ is_active: false, updated_at: now })
      .eq('id', plan.chat_room_id);
    if (error) throw new Error(`Failed to close the plan's chat: ${error.message}`);
  }
  const { error: planError } = await supabaseAdmin
    .from('Plan')
    .update({ chat_closed_at: now, updated_at: now })
    .eq('post_id', plan.post_id)
    .is('chat_closed_at', null);
  if (planError) throw new Error(`Failed to close the plan's chat: ${planError.message}`);
}

async function renameRoom(plan, title) {
  if (!plan.chat_room_id) return;
  const { error } = await supabaseAdmin
    .from('ChatRoom')
    .update({ name: String(title).slice(0, 100), updated_at: new Date().toISOString() })
    .eq('id', plan.chat_room_id);
  if (error) logger.warn('plans.chat.rename_failed', { error: error.message });
}

module.exports = {
  ensureRoom,
  addMember,
  removeMember,
  systemLine,
  closeRoom,
  renameRoom,
};
