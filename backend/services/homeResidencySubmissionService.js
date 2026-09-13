const db = require('../config/supabaseAdmin');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const STATES = ['pending', 'completed', 'rejected', 'cancelled'];
const ROUTES = ['household_review', 'self_bootstrap', 'external_postcard', 'stale_authority_postcard'];
const MESSAGES = {
  RESIDENCY_SUBMISSION_INVALID: 'Check your relationship to this Home and try again.',
  RESIDENCY_ACCOUNT_UNAVAILABLE: 'Sign in again to recover this Home request.',
  RESIDENCY_SUBMISSION_NOT_FOUND: 'This request has not been found. Retry it or cancel it before starting again.',
  RESIDENCY_SUBMISSION_CONFLICT: 'This request has different details. Recover its original request.',
  HOME_NOT_FOUND: 'This Home is no longer available. Check the address again.',
  RESIDENCY_HOME_UNAVAILABLE: 'This Home cannot accept a residency request right now.',
  RESIDENCY_ADDRESS_CHANGED: 'This Home’s address has changed. Check the address and apartment again before submitting a new request.',
  OWNERSHIP_FLOW_REQUIRED: 'Use ownership verification to manage your ownership request.',
  MEMBERSHIP_RENEWAL_REQUIRED: 'Your previous access needs a new household review before it can be restored.',
  RESIDENCY_ALREADY_VERIFIED: 'This residency was already verified. Open My Homes to check current access.',
  RESIDENCY_EXISTING_REQUEST: 'Review your existing residency request before changing its details.',
};
function failure(code = 'RESIDENCY_SUBMISSION_UNAVAILABLE', statusCode = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not confirm your residency request. Keep its original details and retry.'), { code, statusCode });
}
function identity({ homeId, actorId, requestId }) {
  if (![homeId, actorId, requestId].every(value => typeof value === 'string' && UUID.test(value))) throw failure('RESIDENCY_SUBMISSION_INVALID', 400);
  return { p_home_id: homeId.toLowerCase(), p_actor_id: actorId.toLowerCase(), p_request_id: requestId.toLowerCase() };
}
async function rpc(name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch (_) { throw failure(); }
  if (!response || response.error || !response.data) throw failure();
  const r = response.data;
  if (r.ok === false && Object.hasOwn(MESSAGES, r.code) && [400, 403, 404, 409, 422].includes(r.status)) throw failure(r.code, r.status);
  if (r.ok !== true || !STATES.includes(r.state) || r.home_id !== args.p_home_id
    || r.command?.actor_id !== args.p_actor_id || r.command?.request_id !== args.p_request_id
    || ![r.command.created_at, r.command.updated_at].every(value => typeof value === 'string' && Number.isFinite(Date.parse(value)))) throw failure();
  if (r.state === 'completed') {
    if (!UUID.test(r.claim_id || '') || !UUID.test(r.occupancy_id || '')
      || !['renter', 'household'].includes(r.claimed_role) || !ROUTES.includes(r.routing)
      || (args.p_intent && r.claimed_role !== args.p_intent.claimed_role)) throw failure();
  } else if (r.claim_id !== null || r.occupancy_id !== null || r.claimed_role !== null || r.routing !== null) throw failure();
  if (r.state === 'rejected' && (!Object.hasOwn(MESSAGES, r.code) || ![400, 403, 404, 409, 422].includes(r.status))) throw failure();
  return r;
}
async function submit(input) {
  const args = identity(input), { intent } = input;
  const fields = { line1: 255, line2: 255, city: 100, state: 50, postal_code: 20, country: 100 };
  const address = intent?.address;
  if (!intent || typeof intent !== 'object' || Array.isArray(intent) || Object.keys(intent).some(key => !['claimed_role', 'address'].includes(key))
    || !['renter', 'household'].includes(intent.claimed_role)
    || !address || typeof address !== 'object' || Array.isArray(address)
    || Object.keys(address).some(key => !Object.hasOwn(fields, key))
    || Object.entries(fields).some(([key, max]) => typeof address[key] !== 'string' || address[key].length > max
      || (key !== 'line2' && !address[key].trim()))) throw failure('RESIDENCY_SUBMISSION_INVALID', 400);
  return rpc('submit_home_residency', { ...args, p_intent: intent });
}
async function read(input) { return rpc('get_home_residency_submission', identity(input)); }
async function cancel(input) { return rpc('cancel_home_residency_submission', identity(input)); }
function send(res, result) {
  res.set('Cache-Control', 'private, no-store');
  const body = { state: result.state, home_id: result.home_id, command: {
    actor_id: result.command.actor_id, request_id: result.command.request_id,
    created_at: result.command.created_at, updated_at: result.command.updated_at,
  } };
  if (result.state === 'completed') return res.status(result.replayed === false ? 201 : 200).json({ ...body,
    claim_id: result.claim_id, occupancy_id: result.occupancy_id, claimed_role: result.claimed_role,
    routing: result.routing, requires_verification: true, current_access: 'not_checked',
    next_step: result.routing === 'household_review' ? 'household_review' : 'address_verification',
    postcard_requested: false,
    message: 'Your residency request is saved. Open My Homes to check current access and the next verification step.',
  });
  if (result.state === 'rejected') return res.status(result.status).json({ ...body, code: result.code, error: MESSAGES[result.code] });
  if (result.state === 'cancelled') return res.status(200).json({ ...body, message: 'This request was cancelled. It cannot submit a residency claim.' });
  return res.status(202).json({ ...body, message: 'The original request is still being resolved. Check its status.' });
}
function sendError(res, error) {
  res.set('Cache-Control', 'private, no-store');
  const safe = Object.hasOwn(MESSAGES, error?.code) || error?.code === 'RESIDENCY_SUBMISSION_UNAVAILABLE' ? error : failure();
  return res.status(safe.statusCode).json({ code: safe.code, error: safe.message });
}
module.exports = { submit, read, cancel, send, sendError };
