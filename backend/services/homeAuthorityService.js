const db = require('../config/supabaseAdmin');

const MESSAGES = {
  MEMBERS_MANAGE_REQUIRED: 'You do not have permission to manage members.',
  TARGET_RANK_FORBIDDEN: 'You cannot change a member with equal or greater authority.',
  PROPOSED_ROLE_FORBIDDEN: 'That role exceeds the permitted authority or age limit.',
  PERMISSION_DELEGATION_FORBIDDEN: 'You cannot grant that permission.',
  OWNERSHIP_OR_SELF_ROLE_CHANGE_FORBIDDEN: 'Use the ownership flow for owners. You cannot change your own role here.',
  OWNERSHIP_FLOW_REQUIRED: 'Use the ownership flow to change an owner.',
  TRANSFER_REQUIRED: 'Primary owners must transfer ownership before leaving.',
  ACCESS_WINDOW_CHANGE_FORBIDDEN: 'Changing a role cannot change existing access dates.',
  HOME_NOT_FOUND: 'Home not found.', MEMBER_NOT_FOUND: 'Member not found.',
  MEMBER_ROLE_UNKNOWN: 'This member needs an authority review before their role can change.',
  INVALID_AUTHORITY_REQUEST: 'Check the member change and try again.',
  INVALID_PERMISSION: 'Unknown permission.', INVALID_ROLE: 'Unknown role.', UNKNOWN_PRESET: 'Unknown preset.',
  HOME_DELETE_STORAGE_CLEANUP_REQUIRED: 'This home has stored files that must be retired before it can be deleted.',
  HOME_DELETE_TASK_MEDIA_CLEANUP_REQUIRED: 'A task attachment changed while deleting this Home. Retry deletion.',
  HOME_DELETE_LINKED_DATA: 'This home has linked records that must be resolved before it can be deleted.',
  HOME_DELETE_ESTABLISHED_HOUSEHOLD: 'This home has household history and cannot be deleted as private setup.',
  HOME_DELETE_ACCESS_DENIED: 'You do not have permission to delete this home.',
  DELETE_HOME_NOT_PRIMARY: 'Only the primary owner can delete this home. Other members can leave instead.',
};

function fail(code = 'HOME_AUTHORITY_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not confirm this Home change. Please retry.'), {
    code, status, statusCode: status,
  });
}

async function rpc(name, args) {
  let result;
  try { result = await db.rpc(name, args); } catch (_) { throw fail(); }
  if (!result || result.error || !result.data) {
    if (result?.error?.code?.startsWith('22')) throw fail('INVALID_AUTHORITY_REQUEST', 400);
    throw fail();
  }
  return result.data;
}

async function mutateMember({ homeId, actorId, targetId, action, payload = {} }) {
  const result = await rpc('mutate_home_member', {
    p_home_id: homeId, p_actor_id: actorId, p_target_id: targetId, p_action: action, p_payload: payload,
  });
  if (result.ok !== true) throw fail(result.code, [400, 403, 404, 409].includes(result.status) ? result.status : 503);
  return result;
}

async function deleteEligibility(homeId, actorId) {
  const result = await rpc('home_delete_eligibility', { p_home_id: homeId, p_user_id: actorId });
  if (['HOME_DELETE_RETRY', 'HOME_DELETE_FAILED'].includes(result.code)) throw fail(result.code);
  if (typeof result.allowed !== 'boolean') throw fail();
  return result;
}

async function deleteHome(homeId, actorId) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const args = { p_home_id: homeId, p_user_id: actorId };
    const prepared = await rpc('prepare_home_task_media_home_delete', args);
    if (prepared.allowed !== true) throwDeleteResult(prepared);
    if (prepared.home_id !== homeId || !Array.isArray(prepared.cleanup)) throw fail();
    await require('./homeTaskMediaService').cleanupForHomeDelete(homeId, prepared.cleanup);
    const result = await rpc('delete_home_authorized', args);
    if (result.allowed === true && result.deleted === true) return result;
    if (attempt === 0 && result.allowed === false && result.code === 'HOME_DELETE_TASK_MEDIA_CLEANUP_REQUIRED') continue;
    throwDeleteResult(result);
  }
  throw fail();
}

function throwDeleteResult(result) {
  if (result.allowed !== false || typeof result.code !== 'string') throw fail();
  const status = result.code === 'HOME_NOT_FOUND' ? 404
    : ['HOME_DELETE_RETRY', 'HOME_DELETE_FAILED'].includes(result.code) ? 503
      : ['HOME_DELETE_STORAGE_CLEANUP_REQUIRED', 'HOME_DELETE_TASK_MEDIA_CLEANUP_REQUIRED', 'HOME_DELETE_LINKED_DATA', 'HOME_DELETE_ESTABLISHED_HOUSEHOLD'].includes(result.code) ? 409 : 403;
  throw fail(result.code, status);
}

module.exports = { mutateMember, deleteEligibility, deleteHome };
