const crypto = require('crypto');
const db = require('../config/supabaseAdmin');
const verificationAge = require('../utils/verificationAge');
const logger = require('../utils/logger');
const { nameUnlessMadeUp } = require('../utils/personalUsername');
const { loadChatPeople, chatPersonRow } = require('./chatPeople');
const MESSAGES = {
  INVITE_SENDER_NOT_FOUND: 'This invitation attempt has not been found. Retry or cancel its original attempt.',
  INVITE_SENDER_CONFLICT: 'This attempt has different details. Recover its original invitation command.',
  INVITE_SENDER_CHANGED: 'The invitation details changed. Review them before making a new attempt.',
  INVITE_ACCOUNT_UNAVAILABLE: 'Sign in again to recover your invitation decision.',
  INVITE_DECISION_NOT_FOUND: 'This decision has not been found. Retry or cancel its original attempt.',
  INVITE_DECISION_CONFLICT: 'This attempt has different details. Recover its original decision.',
  INVITE_DECISION_CHANGED: 'This invitation changed. Review its current details before making a new decision.',
  INVITE_INVALID: 'Check the invitation details and try again.',
  INVITE_DATES_INVALID: 'Choose valid access dates with an explicit time zone.',
  HOME_NOT_FOUND: 'Home not found.', USER_NOT_FOUND: 'User not found.',
  MEMBERS_MANAGE_REQUIRED: 'You do not have permission to manage invitations.',
  INVITER_ACCESS_CHANGED: 'The inviter can no longer grant access. Request a new invitation.',
  SELF_ADMISSION_FORBIDDEN: 'You cannot approve your own membership.',
  INVITE_POLICY_INVALID: 'Choose a supported role or preset.',
  INVITE_POLICY_CHANGED: 'This invitation’s access policy changed. Request a new invitation.',
  INVITE_SOURCE_CHANGED: 'This access request changed. Request a new invitation.',
  MEMBERSHIP_RENEWAL_REQUIRED: 'This person’s household access is under review, so an invitation can’t change it right now.',
  PROPOSED_ROLE_FORBIDDEN: 'That role exceeds the permitted authority or age limit.',
  PERMISSION_DELEGATION_FORBIDDEN: 'You cannot grant permissions that you do not hold.',
  OWNERSHIP_FLOW_REQUIRED: 'Use the ownership flow to add an owner.',
  CLAIM_MERGE_PRESET_FORBIDDEN: 'Claim-merge invitations use the ownership flow.',
  OWNER_INVITE_FORBIDDEN: 'Use the ownership flow to add an owner.',
  MEMBER_ALREADY_EXISTS: 'This person is already a member of this home.',
  INVITE_ALREADY_PENDING: 'A pending invitation already exists for this person.',
  TARGETED_INVITE_REQUIRED: 'This role needs an invitation addressed to a specific person.',
  INVITE_RECIPIENT_MISMATCH: 'The selected user and email address do not match.',
  INVITE_EMAIL_MISMATCH: 'This invitation is addressed to a different account.',
  INVITE_NOT_FOUND: 'Invitation not found.', INVITE_ALREADY_USED: 'This invitation is no longer available.',
  INVITE_EXPIRED: 'Invitation has expired.',
  REQUEST_NOT_FOUND: 'Request not found.', REQUEST_NOT_PENDING: 'This request is no longer pending.',
  HOME_ADMISSION_CLOSED: 'This home is not accepting membership requests.',
  VERIFIED_OWNER_REQUIRED: 'This home needs a verified owner before you can request an invitation.',
};
function failure(code = 'INVITE_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not confirm this invitation. Please retry.'),
    { code, status, statusCode: status });
}
async function rpc(name,args) {
  let response;
  try { response = await db.rpc(name,args); } catch (_) { throw failure(); }
  if (!response || response.error || !response.data) {
    if (response?.error?.code?.startsWith('22')) throw failure('INVITE_INVALID',400);
    throw failure();
  }
  const result = response.data;
  if (result.ok !== true) {
    if (Object.hasOwn(MESSAGES,result.code) && [400,403,404,409,410].includes(result.status)) throw failure(result.code,result.status);
    throw failure();
  }
  return result;
}
// People in invitations, requests to join and their notices (and the invite email) go by the name neighbors see on
// their posts and in chats (services/chatPeople.js): their Local Profile's name, handle and photo, or the account's for
// a business or anyone without one. The SQL names them by the account, so they are named here from its account ids.
async function personName(userId, fallback) {
  return (await loadChatPeople([userId])).get(String(userId))?.displayName || fallback;
}
// A person as the SQL returns them (an id and some of username, name, profile_picture_url), named that way in the keys
// it has, so each response keeps its shape. Anyone loadChatPeople can't read keeps the SQL's values.
function namedPerson(person, people) {
  const named = chatPersonRow(person, people);
  return Object.fromEntries(Object.keys(person).map((key) => [key, named[key]]));
}
async function inviterId(invitationId) {
  try {
    const { data, error } = await db.from('HomeInvite').select('invited_by').eq('id', invitationId).maybeSingle();
    return error ? null : data?.invited_by || null;
  } catch (_) { return null; }
}
// A preview's inviter ({ name, username, profilePicture }) carries no id; it is the invitation's invited_by. The SQL
// names them coalesce(name, first_name, username, 'Someone'), and a made-up username isn't a name.
async function namePreview(preview) {
  if (!preview?.inviter || typeof preview.inviter.name !== 'string') return preview;
  const invitedBy = await inviterId(preview.invitation?.id);
  const person = invitedBy ? (await loadChatPeople([invitedBy])).get(String(invitedBy)) : null;
  const inviter = person
    ? { ...preview.inviter, name: person.displayName, username: person.handle || null, profilePicture: person.avatarUrl || null }
    : { ...preview.inviter, name: nameUnlessMadeUp(preview.inviter.name, 'Someone') };
  return { ...preview, inviter };
}
async function write({ homeId, actorId, action, payload = {} }) {
  const result = await rpc('write_home_invitation', { p_home_id: homeId, p_actor_id: actorId, p_action: action,
    p_payload: payload, p_token: ['create','approve_request'].includes(action) ? crypto.randomBytes(32).toString('hex') : null });
  if (typeof result.replayed !== 'boolean') throw failure();
  if (['create','approve_request'].includes(action) && !result.replayed
    && (!result.invitation?.id || typeof result.invitation.token !== 'string')) throw failure();
  if (action==='request' && !Array.isArray(result.notify_user_ids)) throw failure();
  return result;
}
async function act({ actorId = null, invitationId = null, token = null, action }) {
  const result = await rpc('act_on_home_invitation', { p_invite_id: invitationId, p_token: token,
    p_actor_id: actorId, p_action: action, p_validity_days: verificationAge.validityDays() });
  if (action==='preview' && !result.invitation?.id) throw failure();
  if (action==='accept' && (result.kind==='claim_merge' ? !result.invitation?.id
    : (!result.occupancy?.id || !result.homeId || typeof result.replayed!=='boolean'))) throw failure();
  if (action==='decline' && typeof result.replayed!=='boolean') throw failure();
  return namePreview(result);
}
async function list(actorId,homeId=null) {
  const result = await rpc('list_home_invitations', { p_actor_id: actorId, p_home_id: homeId });
  if (!Array.isArray(result.invitations)) throw failure();
  const people = await loadChatPeople(result.invitations.map((invite) => invite?.inviter?.id));
  return result.invitations.map((invite) => (invite?.inviter ? { ...invite, inviter: namedPerson(invite.inviter, people) } : invite));
}
async function listRequests(homeId,actorId,status='pending') {
  const result=await rpc('list_home_household_requests',{p_home_id:homeId,p_actor_id:actorId,p_status:status});
  if (!Array.isArray(result.requests)) throw failure();
  const people = await loadChatPeople(result.requests.map((request) => request?.requester?.id));
  return result.requests.map((request) => (request?.requester ? { ...request, requester: namedPerson(request.requester, people) } : request));
}
async function notifyCreated(result,message) {
  if (result.replayed) return false;
  const invite = result.invitation;
  const inviterName = await personName(invite.invited_by, 'Someone');
  let emailSent = false;
  if (result.delivery_email) {
    try {
      const delivery = await require('./emailService').sendHomeInviteEmail({ toEmail: result.delivery_email,
        inviterName, homeName: result.home_label, homeCity: result.home_city,
        role: invite.proposed_role, token: invite.token, message: message || null, isExistingUser: !!invite.invitee_user_id });
      emailSent = delivery?.success === true && delivery?.preview !== true;
    } catch (err) { logger.error('Home invitation email failed after commit', { errorCode: err.code, inviteId: invite.id }); }
  }
  if (invite.invitee_user_id) {
    try { await require('./notificationService').notifyHomeInvite({ inviteeUserId: invite.invitee_user_id,
      inviterName, homeName: result.home_label, homeId: invite.home_id, inviteToken: invite.token });
    } catch (err) { logger.error('Home invitation notification failed after commit', { errorCode: err.code, inviteId: invite.id }); }
  }
  return emailSent;
}
async function notifySenderDelivery(result, message) {
  const invite = result.invitation;
  // A resend goes out in the original inviter's name, who may be another manager than the one resending.
  const inviterName = await personName(await inviterId(invite.id), 'Someone');
  const proof = { email: result.delivery_email ? 'unconfirmed' : 'not_requested',
    in_app: invite.invitee_user_id ? 'unconfirmed' : 'not_requested' };
  if (result.delivery_email) {
    try {
      const delivery = await require('./emailService').sendHomeInviteEmail({ toEmail:result.delivery_email,
        inviterName, homeName:result.home_label, homeCity:result.home_city,
        role:invite.proposed_role, token:invite.token, message:message || null, isExistingUser:!!invite.invitee_user_id });
      if (delivery?.success === true && delivery?.preview !== true) proof.email = 'provider_accepted';
    } catch { logger.warn('Home invitation email handoff unconfirmed', { inviteId:invite.id }); }
  }
  if (invite.invitee_user_id) {
    try {
      const notification = await require('./notificationService').notifyHomeInvite({ inviteeUserId:invite.invitee_user_id,
        inviterName, homeName:result.home_label, homeId:invite.home_id, inviteToken:invite.token });
      if (typeof notification?.id === 'string' && notification.id.length > 0 && notification.user_id === invite.invitee_user_id) proof.in_app = 'saved';
    } catch { logger.warn('Home invitation notification save unconfirmed', { inviteId:invite.id }); }
  }
  return proof;
}
async function notifyAccepted(result,actorId) {
  if (result.replayed) return;
  try {
    await require('./notificationService').notifyHomeInviteAccepted({ inviterUserId: result.inviter_id,
      accepterName: await personName(actorId, 'Someone'), homeName: result.home_label, homeId: result.homeId });
  } catch (err) { logger.error('Home invite acceptance notification failed after commit', { errorCode: err.code }); }
}
module.exports = { write, act, list, listRequests, notifyCreated, notifySenderDelivery, notifyAccepted, failure,
  personName, namePreview };
