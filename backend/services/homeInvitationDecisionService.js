const db = require('../config/supabaseAdmin');
const invitations = require('./homeInvitationService');
const verificationAge = require('../utils/verificationAge');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const STATES = ['pending', 'completed', 'rejected', 'cancelled'];
const failure = invitations.failure;
const uuid = value => typeof value === 'string' && UUID.test(value);
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
function identity(actorId, requestId) {
  if (!uuid(actorId) || (requestId !== undefined && !uuid(requestId))) throw failure('INVITE_INVALID', 400);
  return { p_actor_id: actorId.toLowerCase(), ...(requestId === undefined ? {} : { p_request_id: requestId.toLowerCase() }) };
}
function tokenValue(token) {
  if (typeof token !== 'string' || token.length < 1 || token.length > 512) throw failure('INVITE_INVALID', 400);
  return token;
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
async function prepare({ actorId, token }) {
  const r = await rpc('prepare_home_invitation_decision', { ...identity(actorId), p_token: tokenValue(token) });
  if (!uuid(r.home_id) || !uuid(r.invitation_id) || !HASH.test(r.decision_token || '')
    || r.preview?.home?.id !== r.home_id || r.preview?.invitation?.id !== r.invitation_id
    || r.preview.invitation.status !== 'pending' || typeof r.preview.invitation.proposed_role !== 'string'
    || !date(r.preview.invitation.created_at)
    || !(r.preview.invitation.expires_at === null || date(r.preview.invitation.expires_at))) throw failure();
  return { home_id: r.home_id, invitation_id: r.invitation_id, decision_token: r.decision_token, preview: r.preview };
}
function validateResult(r, args) {
  if (!STATES.includes(r.state) || !uuid(r.home_id) || !uuid(r.invitation_id)
    || !['accept','decline'].includes(r.action) || !HASH.test(r.decision_token || '')
    || r.command?.actor_id !== args.p_actor_id || r.command?.request_id !== args.p_request_id
    || ![r.command.created_at, r.command.updated_at].every(date)
    || (args.p_intent && ['home_id','invitation_id','action','decision_token'].some(key => r[key] !== args.p_intent[key]))
    || (args.p_intent && typeof r.replayed !== 'boolean')) throw failure();
  if (r.state === 'completed' && r.action === 'accept' ? !uuid(r.occupancy_id) : r.occupancy_id !== null) throw failure();
  if (r.state === 'rejected') {
    if (typeof r.code !== 'string' || !/^[A-Z][A-Z0-9_]{1,79}$/.test(r.code)
      || ![400,403,404,409,410,422].includes(r.status)) throw failure();
  } else if (r.code !== null || r.status !== null) throw failure();
  return r;
}
async function read({ actorId, requestId }) {
  const args = identity(actorId, requestId);
  return validateResult(await rpc('get_home_invitation_decision', args), args);
}
async function resolve({ actorId, requestId, token, intent, cancel = false }) {
  const args = identity(actorId, requestId);
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)
    || Object.keys(intent).some(key => !['home_id','invitation_id','action','decision_token'].includes(key))
    || !uuid(intent.home_id) || !uuid(intent.invitation_id) || !['accept','decline'].includes(intent.action)
    || typeof intent.decision_token !== 'string' || !HASH.test(intent.decision_token)) throw failure('INVITE_INVALID', 400);
  args.p_token = tokenValue(token);
  args.p_intent = { ...intent, home_id: intent.home_id.toLowerCase(), invitation_id: intent.invitation_id.toLowerCase() };
  args.p_cancel = cancel; args.p_validity_days = verificationAge.validityDays();
  const r = validateResult(await rpc('resolve_home_invitation_decision', args), args);
  if (r.state === 'completed' && r.action === 'accept' && !r.replayed && r.notification) {
    if (!uuid(r.notification.inviter_id) || typeof r.notification.home_label !== 'string') throw failure();
    await invitations.notifyAccepted({ replayed: false, homeId: r.home_id,
      inviter_id: r.notification.inviter_id, home_label: r.notification.home_label }, args.p_actor_id);
  }
  return r;
}
function send(res, r, session) {
  // Only allowlisted historical fields leave the service. Current access is a
  // separate read, even after an accepted command is replayed successfully.
  const body = { state: r.state, home_id: r.home_id, invitation_id: r.invitation_id,
    action: r.action, decision_token: r.decision_token, occupancy_id: r.occupancy_id,
    command: { actor_id: r.command.actor_id, request_id: r.command.request_id,
      created_at: r.command.created_at, updated_at: r.command.updated_at },
    current_access: 'not_checked', session };
  res.set('Cache-Control', 'private, no-store');
  if (r.state === 'rejected') return res.status(r.status).json({ ...body, code: r.code, error: failure(r.code, r.status).message });
  const message = r.state === 'cancelled' ? 'This attempt was cancelled. It cannot accept or decline the invitation.'
    : r.state === 'completed' ? 'Your invitation decision is saved. Check My Homes for current access.'
      : 'The original decision is still being resolved. Check its status.';
  return res.status(r.state === 'pending' ? 202 : r.replayed === false && r.state === 'completed' ? 201 : 200).json({ ...body, message });
}
function sendError(res, error) {
  const safe = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(error.code)
    && [400,403,404,409,410,422,503].includes(error.statusCode) ? failure(error.code, error.statusCode) : failure();
  return res.set('Cache-Control', 'private, no-store').status(safe.statusCode).json({ code: safe.code, error: safe.message });
}
module.exports = { prepare, read, resolve, send, sendError };
