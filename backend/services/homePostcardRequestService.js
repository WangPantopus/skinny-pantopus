const { randomUUID } = require('node:crypto');
const db = require('../config/supabaseAdmin');
const material = require('../utils/homePostcardCodeMaterial');
const { hashPostcardCode, dispatchPostcardCode } = require('../utils/postcardDispatch');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const STATES = ['pending', 'completed', 'rejected', 'cancelled'];
const { MESSAGES, STATUS_CODES, failure } = require('../utils/homePostcardErrors');
function identity({ homeId, actorId, requestId }, requireRequest = true) {
  if (![homeId, actorId, ...(requireRequest ? [requestId] : [])].every(v => typeof v === 'string' && UUID.test(v))) throw failure('POSTCARD_REQUEST_INVALID', 400);
  return { p_home_id: homeId.toLowerCase(), p_actor_id: actorId.toLowerCase(), ...(requireRequest ? { p_request_id: requestId.toLowerCase() } : {}) };
}
function validAddress(address) {
  const fields = { line1: 255, line2: 255, city: 100, state: 50, postal_code: 20, country: 100 };
  return !!address && typeof address === 'object' && !Array.isArray(address)
    && Object.keys(address).length === 6 && Object.keys(address).every(k => Object.hasOwn(fields, k))
    && Object.entries(fields).every(([k, max]) => typeof address[k] === 'string' && address[k].length <= max && (k === 'line2' || address[k].trim()));
}
function safeFailure(r) {
  return Object.hasOwn(MESSAGES, r?.code) && STATUS_CODES.includes(r.status) ? failure(r.code, r.status) : failure();
}
async function rpc(name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch (_) { throw failure(); }
  if (!response || response.error || !response.data || typeof response.data !== 'object') throw failure();
  if (response.data.ok !== true) throw safeFailure(response.data);
  return response.data;
}
const date = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
function projectCommand(r, args) {
  if (!STATES.includes(r.state) || r.home_id !== args.p_home_id || r.command?.actor_id !== args.p_actor_id
    || (args.p_request_id && r.command?.request_id !== args.p_request_id) || !UUID.test(r.command?.request_id || '')
    || !date(r.command.created_at) || !date(r.command.updated_at)
    || (r.state === 'completed' ? !UUID.test(r.postcard_id || '') : r.postcard_id !== null)
    || (r.state === 'rejected' && (!Object.hasOwn(MESSAGES, r.code) || !STATUS_CODES.includes(r.status)))) throw failure();
  return { state: r.state, home_id: r.home_id, command: {
    actor_id: r.command.actor_id, request_id: r.command.request_id,
    created_at: r.command.created_at, updated_at: r.command.updated_at,
  }, postcard_id: r.postcard_id, ...(r.state === 'rejected' ? { code: r.code, status: r.status, error: MESSAGES[r.code] } : {}) };
}
async function read(input) {
  const args = identity(input);
  return projectCommand(await rpc('get_home_postcard_request', args), args);
}
async function cancel(input) {
  const args = identity(input);
  return projectCommand(await rpc('cancel_home_postcard_request', args), args);
}
async function current(input) {
  const args = identity(input, false);
  const r = await rpc('get_home_postcard_current_status', args);
  if (r.home_id !== args.p_home_id || r.actor_id !== args.p_actor_id || !date(r.checked_at)
    || !['can_request', 'can_resume', 'can_verify'].every(k => typeof r[k] === 'boolean')
    || (r.restriction !== null && !Object.hasOwn(MESSAGES, r.restriction))) throw failure();
  const p = r.postcard;
  if (p !== null && (!p || !UUID.test(p.id || '') || !date(p.requested_at) || !date(p.expires_at)
    || !['pending', 'verified', 'expired', 'cancelled'].includes(p.status)
    || !['not_started', 'accepted', 'unknown', 'rejected'].includes(p.delivery)
    || !Number.isInteger(p.attempts_remaining) || p.attempts_remaining < 0 || p.attempts_remaining > 5)) throw failure();
  let request = null;
  if (r.request !== null) {
    request = projectCommand(r.request, args);
    if (request.state !== 'completed' || request.postcard_id !== p?.id || !validAddress(r.request.address)) throw failure();
    request.address = { ...r.request.address };
  }
  return { home_id: r.home_id, actor_id: r.actor_id, checked_at: r.checked_at,
    can_request: r.can_request, can_resume: r.can_resume, can_verify: r.can_verify,
    restriction: r.restriction, restriction_message: r.restriction ? MESSAGES[r.restriction] : null,
    request, postcard: p === null ? null : { id: p.id, requested_at: p.requested_at, expires_at: p.expires_at,
      status: p.status, delivery: p.delivery, attempts_remaining: p.attempts_remaining },
    current_access: 'not_checked',
  };
}
async function submit(input) {
  const args = identity(input);
  if (!validAddress(input.address)) throw failure('POSTCARD_REQUEST_INVALID', 400);
  let candidate = null, codeHash = null, keyId = null;
  try {
    keyId = material.activeKeyId(); candidate = randomUUID();
    codeHash = hashPostcardCode(material.deriveCode({ actorId: args.p_actor_id, homeId: args.p_home_id, postcardId: candidate, keyId }));
  } catch (_) {
    // Missing new-code configuration must not hide an already saved request.
    candidate = null; codeHash = null; keyId = null;
  }
  const work = await rpc('begin_home_postcard_request', { ...args, p_address: input.address,
    p_candidate_id: candidate, p_code_hash: codeHash, p_code_key_id: keyId });
  const result = projectCommand(work, args);
  if (result.state !== 'completed') return result;
  result.current_access = 'not_checked';
  const card = work.postcard;
  if (!card || card.id !== result.postcard_id || card.home_id !== args.p_home_id || card.user_id !== args.p_actor_id) {
    result.dispatch_error = 'POSTCARD_NO_LONGER_AVAILABLE'; return result;
  }
  if (card.status !== 'pending' || card.dispatch_status !== 'pending' || !work.code_key_id) return result;
  try {
    const code = material.deriveCode({ actorId: args.p_actor_id, homeId: args.p_home_id, postcardId: card.id, keyId: work.code_key_id });
    const claimed = await rpc('claim_home_postcard_current_dispatch', { ...args, p_postcard_id: card.id, p_code_hash: hashPostcardCode(code) });
    if (claimed.claimed === false) return result;
    if (claimed.claimed !== true || claimed.postcard?.id !== card.id || claimed.postcard.home_id !== args.p_home_id
      || claimed.postcard.user_id !== args.p_actor_id || claimed.postcard.code_hash !== hashPostcardCode(code)
      || !claimed.postcard.destination || typeof claimed.postcard.destination !== 'object') throw failure();
    let sent;
    try { sent = await dispatchPostcardCode(claimed.postcard.destination, code, card.id, args.p_home_id); }
    catch (_) { sent = { success: false, deliveryUnknown: true }; }
    const accepted = sent?.success === true && typeof sent.vendorJobId === 'string' && sent.vendorJobId.length > 0 && sent.vendorJobId.length <= 200;
    const rejected = sent?.success === false && sent.deliveryUnknown === false;
    await rpc('record_home_postcard_current_dispatch', { p_home_id: args.p_home_id, p_actor_id: args.p_actor_id, p_postcard_id: card.id,
      p_outcome: accepted ? 'accepted' : rejected ? 'rejected' : 'delivery_unknown', p_vendor_job_id: accepted ? sent.vendorJobId : null });
  } catch (error) {
    result.dispatch_error = Object.hasOwn(MESSAGES, error?.code) ? error.code : 'POSTCARD_REQUEST_UNAVAILABLE';
  }
  return result;
}
function send(res, result) {
  res.set('Cache-Control', 'private, no-store');
  if (result.state === 'rejected') return res.status(result.status).json(result);
  const message = result.state === 'completed'
    ? 'Your request is saved. Check postcard status for the mailing outcome and your residency status for current access.'
    : result.state === 'cancelled' ? 'This request was cancelled before admission. It cannot request a postcard.'
      : 'The original request is still being resolved. Check its status.';
  return res.status(result.state === 'pending' ? 202 : 200).json({ ...result, message });
}
function sendError(res, error) {
  res.set('Cache-Control', 'private, no-store');
  const safe = (Object.hasOwn(MESSAGES, error?.code) || error?.code === 'POSTCARD_REQUEST_UNAVAILABLE') && STATUS_CODES.includes(error.statusCode) ? error : failure();
  return res.status(safe.statusCode).json({ code: safe.code, error: safe.message });
}
module.exports = { submit, read, cancel, current, send, sendError };
