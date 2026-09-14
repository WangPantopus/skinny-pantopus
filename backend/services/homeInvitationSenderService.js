const db = require('../config/supabaseAdmin');
const invitations = require('./homeInvitationService');
const decisions = require('./homeInvitationDecisionService');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const ACTIONS = ['create', 'resend', 'withdraw'];
const INVITATION_FIELDS = ['id','home_id','invited_by','invitee_user_id','invitee_email','proposed_role','proposed_role_base','proposed_preset_key','status','created_at','expires_at','is_open_invite','access_start_at','access_end_at','accepted_by_user_id','accepted_at','source_request_id','invitee'];
const failure = invitations.failure;
const uuid = value => typeof value === 'string' && UUID.test(value);
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
function identity(actorId, requestId) {
  if (!uuid(actorId) || (requestId !== undefined && !uuid(requestId))) throw failure('INVITE_INVALID', 400);
  return { p_actor_id: actorId.toLowerCase(), ...(requestId === undefined ? {} : { p_request_id: requestId.toLowerCase() }) };
}
function intentValue(value, prepared) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !uuid(value.home_id) || !ACTIONS.includes(value.action)) throw failure('INVITE_INVALID', 400);
  const keys = ['home_id', 'action', value.action === 'create' ? 'payload' : 'invitation_id', ...(prepared ? ['decision_token'] : [])];
  if (Object.keys(value).some(key => !keys.includes(key)) || (prepared && !HASH.test(value.decision_token || ''))) throw failure('INVITE_INVALID', 400);
  if (value.action === 'create') {
    const payload = value.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || Object.entries(payload).some(([key, item]) => !['email','user_id','username','relationship','preset_key','start_at','end_at','message'].includes(key)
        || !(item === null || typeof item === 'string'))) throw failure('INVITE_INVALID', 400);
  } else if (!uuid(value.invitation_id)) throw failure('INVITE_INVALID', 400);
  return { ...value, home_id: value.home_id.toLowerCase(), ...(value.action === 'create' ? {} : { invitation_id: value.invitation_id.toLowerCase() }) };
}
async function rpc(name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch { throw failure(); }
  if (!response || response.error || !response.data) throw failure();
  const r = response.data;
  if (r.ok === false && typeof r.code === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(r.code)
    && [400,403,404,409,410,422].includes(r.status)) throw failure(r.code, r.status);
  if (r.ok !== true) throw failure();
  return r;
}
function validateResult(r, args) {
  if (!['pending','completed','rejected','cancelled'].includes(r.state) || !uuid(r.home_id)
    || !(r.invitation_id === null || uuid(r.invitation_id)) || !ACTIONS.includes(r.action)
    || (r.state === 'completed' && !uuid(r.invitation_id)) || (r.action !== 'create' && !uuid(r.invitation_id))
    || !HASH.test(r.decision_token || '') || r.command?.actor_id !== args.p_actor_id || r.command?.request_id !== args.p_request_id
    || ![r.command.created_at,r.command.updated_at].every(date)
    || !['not_requested','unconfirmed','provider_accepted'].includes(r.delivery?.email)
    || !['not_requested','unconfirmed','saved'].includes(r.delivery?.in_app)
    || (r.action === 'withdraw' && (r.delivery.email !== 'not_requested' || r.delivery.in_app !== 'not_requested'))
    || (args.p_intent && ['home_id','action','decision_token', ...(args.p_intent.action === 'create' ? [] : ['invitation_id'])].some(key => r[key] !== args.p_intent[key]))) throw failure();
  if (r.state === 'rejected') {
    if (typeof r.code !== 'string' || !/^[A-Z][A-Z0-9_]{1,79}$/.test(r.code) || ![400,403,404,409,410,422].includes(r.status)) throw failure();
  } else if (r.code !== null || r.status !== null) throw failure();
  return r;
}
async function prepare({ actorId, intent }) {
  const args = { ...identity(actorId), p_intent: intentValue(intent, false) };
  const r = await rpc('prepare_home_invitation_sender', args);
  if (r.home_id !== args.p_intent.home_id || r.action !== args.p_intent.action || !HASH.test(r.decision_token || '')
    || (r.action === 'create' ? r.invitation !== null : r.invitation?.id !== args.p_intent.invitation_id || r.invitation?.home_id !== r.home_id || r.invitation?.status !== 'pending')) throw failure();
  // Project current sender context, never forwarding capabilities or policy data.
  let invitation = null;
  if (r.invitation) {
    invitation = Object.fromEntries(INVITATION_FIELDS.filter(key => Object.hasOwn(r.invitation,key)).map(key => [key,r.invitation[key]]));
  }
  if (invitation) validateInvitee(invitation);
  return { home_id: r.home_id, action: r.action, decision_token: r.decision_token, invitation };
}
function validateInvitee(invitation) {
  const invitee = invitation.invitee;
  if (invitee === null) return;
  if (!invitee || !uuid(invitee.id) || invitee.id !== invitation.invitee_user_id
    || !(invitee.username === null || typeof invitee.username === 'string')
    || !(invitee.name === null || typeof invitee.name === 'string')) throw failure();
  invitation.invitee = { id:invitee.id, username:invitee.username, name:invitee.name };
}
async function list({ actorId, homeId }) {
  if (!uuid(homeId)) throw failure('INVITE_INVALID',400);
  const r = await rpc('list_home_invitation_sender',{...identity(actorId),p_home_id:homeId.toLowerCase()});
  if (!Array.isArray(r.invitations)) throw failure();
  for (const invitation of r.invitations) {
    if (!uuid(invitation?.id) || invitation.home_id !== homeId.toLowerCase() || invitation.status !== 'pending') throw failure();
    validateInvitee(invitation);
  }
  return r.invitations.map(invitation => Object.fromEntries(INVITATION_FIELDS.filter(key => Object.hasOwn(invitation,key)).map(key => [key,invitation[key]])));
}
async function read({ actorId, requestId }) {
  const args = identity(actorId, requestId);
  return validateResult(await rpc('get_home_invitation_sender', args), args);
}
async function resolve({ actorId, requestId, token = null, intent, cancel = false }) {
  const args = { ...identity(actorId, requestId), p_intent: intentValue(intent, true), p_token: token, p_cancel: cancel };
  if (intent.action === 'withdraw' ? token !== null : typeof token !== 'string' || !HASH.test(token)) throw failure('INVITE_INVALID', 400);
  let r = validateResult(await rpc('resolve_home_invitation_sender', args), args);
  if (typeof r.replayed !== 'boolean') throw failure();
  if (r.state === 'completed' && r.action !== 'withdraw' && !r.replayed && !cancel) {
    // Saving is independent of best-effort delivery. A failed/lost claim or
    // outcome write leaves conservative durable 'unconfirmed' proof; never
    // automatically re-send a replayed command or undo its saved result.
    try {
      const dispatch = await rpc('claim_home_invitation_sender_delivery', { ...identity(actorId,requestId), p_token: token });
      if (dispatch.dispatch === true && dispatch.invitation?.id === r.invitation_id && dispatch.invitation?.home_id === r.home_id
        && dispatch.invitation?.token === token) {
        const delivery = await invitations.notifySenderDelivery(dispatch, intent.action === 'create' ? intent.payload.message : null);
        const recorded = validateResult(await rpc('record_home_invitation_sender_delivery', { ...identity(actorId,requestId), p_email: delivery.email, p_in_app: delivery.in_app }), args);
        r = { ...recorded, replayed: false };
      }
    } catch { /* Saved receipt remains truthful when delivery proof is unavailable. */ }
  }
  return r;
}
function send(res, r, session) {
  const body = { state: r.state, home_id: r.home_id, invitation_id: r.invitation_id, action: r.action, decision_token: r.decision_token,
    command: { actor_id:r.command.actor_id, request_id:r.command.request_id, created_at:r.command.created_at, updated_at:r.command.updated_at },
    delivery: { email:r.delivery.email, in_app:r.delivery.in_app }, session };
  res.set('Cache-Control','private, no-store');
  if (r.state === 'rejected') return res.status(r.status).json({ ...body, code:r.code, error:failure(r.code,r.status).message });
  const message = r.state === 'cancelled' ? 'This attempt was cancelled. It cannot create, resend or withdraw the invitation.'
    : r.state === 'completed' ? r.action === 'withdraw' ? 'The invitation was withdrawn. Existing membership was preserved.'
      : 'The invitation is saved. Check the separate delivery status.' : 'The original attempt is still being resolved. Check its status.';
  return res.status(r.state === 'pending' ? 202 : r.replayed === false && r.state === 'completed' ? 201 : 200).json({ ...body, message });
}
module.exports = { prepare, list, read, resolve, send, sendError:decisions.sendError };
