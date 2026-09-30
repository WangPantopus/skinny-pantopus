const db = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

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

// Account deletion (decision 9, 2026-09-30): a Home that nobody else keeps goes
// with the person deleting their account. Called by DELETE /api/users/account for
// each Home they created or occupy, after its dry run and before it nulls their
// attribution columns (private-setup records are still recognisable as theirs).
// - Anyone else still has access or verified ownership: nothing changes; their
//   records stay -> 'kept'.
//   Checked first: a primary owner may delete a Home with members in it, but an
//   account deletion never takes a Home away from the people who still live there.
// - Deletable (private setup, or the primary owner as the last member): deleted
//   exactly like the owner's Delete Home, stored files included -> 'deleted'.
// - Not deletable and nobody else keeps it: the household records and files are
//   purged (homeRecordService) and the shell stays, so a later resident never
//   inherits them. Applications nobody can review any more are then closed
//   (closeStrandedApplications) -> 'purged'.
// A Home that no longer exists needs nothing ('kept', HOME_NOT_FOUND). Any other
// failure throws, so the account deletion stops before anything is removed.
async function retireHomeForDeletedAccount(homeId, userId) {
  if (await othersKeepHome(homeId, userId)) return { action: 'kept', reason: 'OTHER_MEMBERS' };
  const eligibility = await deleteEligibility(homeId, userId);
  if (eligibility.allowed) {
    await deleteHome(homeId, userId);
    return { action: 'deleted', reason: eligibility.code || null };
  }
  if (eligibility.code === 'HOME_NOT_FOUND') return { action: 'kept', reason: 'HOME_NOT_FOUND' };
  const purge = await require('./homeRecordService').purgeHouseholdRecords(homeId, userId);
  const closed = await closeStrandedApplications(homeId, userId);
  return { action: 'purged', reason: eligibility.code || null, purge, closed };
}

// After a purge nobody is left to review the Home's household applications, so
// they are closed the way a reviewer's decline closes them, with the same notice
// types (a notice failure is logged; the decision stands):
// - pending household-review residency claims are rejected. The person keeps
//   their pending occupancy and can resubmit, which routes them to verify by
//   mail because the Home has no reviewers;
// - pending household access requests are rejected.
// Occupancies are not ended: that would stop the person from applying again.
// Claims already on the mail route, and ownership claims (platform review),
// still have a way forward and are left as they are. Only pending rows change,
// so a retry after a failure repeats nothing.
async function closeStrandedApplications(homeId, userId) {
  const at = new Date().toISOString();
  let claims; let requests;
  try {
    [claims, requests] = await Promise.all([
      db.from('HomeResidencyClaim').update({
        status: 'rejected', reviewed_by: null, reviewed_at: at, review_note: 'No household reviewer remains', updated_at: at,
      }).eq('home_id', homeId).eq('status', 'pending').is('cold_start_mode', null).neq('user_id', userId)
        .select('id, user_id'),
      db.from('HomeHouseholdAccessRequest').update({ status: 'rejected', resolved_by: null, resolved_at: at, updated_at: at })
        .eq('home_id', homeId).eq('status', 'pending').neq('requester_user_id', userId).select('id, requester_user_id'),
    ]);
  } catch (_) { throw fail(); }
  if (claims?.error || requests?.error || !Array.isArray(claims?.data) || !Array.isArray(requests?.data)) throw fail();
  const { createNotification } = require('./notificationService');
  const notices = [
    ...claims.data.map(claim => ({
      userId: claim.user_id, type: 'residency_rejected', title: 'Verification update',
      body: 'No one at this home can review your request anymore. You can verify by mail instead.',
      icon: '📬', link: `/homes/${homeId}/waiting-room`, metadata: { home_id: homeId, claim_id: claim.id },
      idempotencyKey: `home-reviewers-gone:residency:${claim.id}`,
    })),
    ...requests.data.map(request => ({
      userId: request.requester_user_id, type: 'home_access_request_rejected', title: 'Request not approved',
      body: 'Your request to join this home was closed because no one there can approve it anymore.',
      icon: '🏠', metadata: { home_id: homeId, request_id: request.id },
      idempotencyKey: `home-reviewers-gone:access-request:${request.id}`,
    })),
  ];
  for (const notice of notices) {
    try { await createNotification(notice); } catch (err) { logger.error('Stranded application notice failed', { code: err.code }); }
  }
  return { residencyClaims: claims.data.length, accessRequests: requests.data.length };
}

// Who keeps a Home is the same test as purge_home_household_records' guard
// (HOME_PURGE_HOUSEHOLD_PRESENT), so the two can't disagree: any other verified
// owner (a person or a business), or anyone else home_effective_access still
// lets in, among the other occupants and a legacy Home.owner_id owner. A pending
// or unverified occupant has no access, so they don't keep it.
async function othersKeepHome(homeId, userId) {
  let occupancies; let owners; let home;
  try {
    [occupancies, owners, home] = await Promise.all([
      db.from('HomeOccupancy').select('user_id').eq('home_id', homeId).neq('user_id', userId),
      db.from('HomeOwner').select('subject_type, subject_id').eq('home_id', homeId).eq('owner_status', 'verified'),
      db.from('Home').select('owner_id').eq('id', homeId).maybeSingle(),
    ]);
  } catch (_) { throw fail(); }
  if (occupancies?.error || owners?.error || home?.error || !Array.isArray(occupancies?.data) || !Array.isArray(owners?.data)) throw fail();
  if (owners.data.some(row => row.subject_type !== 'user' || row.subject_id !== userId)) return true;
  const others = new Set(occupancies.data.map(row => row.user_id).filter(Boolean));
  if (home.data?.owner_id && home.data.owner_id !== userId) others.add(home.data.owner_id);
  for (const other of others) {
    const access = await rpc('home_effective_access', { p_home_id: homeId, p_user_id: other });
    if (access.has_access === true) return true;
  }
  return false;
}

function throwDeleteResult(result) {
  if (result.allowed !== false || typeof result.code !== 'string') throw fail();
  const status = result.code === 'HOME_NOT_FOUND' ? 404
    : ['HOME_DELETE_RETRY', 'HOME_DELETE_FAILED'].includes(result.code) ? 503
      : ['HOME_DELETE_STORAGE_CLEANUP_REQUIRED', 'HOME_DELETE_TASK_MEDIA_CLEANUP_REQUIRED', 'HOME_DELETE_LINKED_DATA', 'HOME_DELETE_ESTABLISHED_HOUSEHOLD'].includes(result.code) ? 409 : 403;
  throw fail(result.code, status);
}

module.exports = { mutateMember, deleteEligibility, deleteHome, retireHomeForDeletedAccount };
