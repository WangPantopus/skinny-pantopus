const db = require('../config/supabaseAdmin');
const { applyOccupancyTemplate } = require('../utils/homePermissions');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const STATES = ['pending', 'completed', 'rejected', 'cancelled'];
const ROLE_BASE = { owner: 'admin', renter: 'lease_resident', household: 'member', property_manager: 'manager' };
const MESSAGES = {
  HOME_CREATE_INVALID: 'Check the Home details and try again.',
  HOME_CREATE_ACCOUNT_UNAVAILABLE: 'Sign in again to recover this Home request.',
  HOME_CREATE_COMMAND_NOT_FOUND: 'This request has not been found. Retry it or cancel it before starting again.',
  HOME_CREATE_INTENT_CONFLICT: 'This request has different details. Recover the original request before editing.',
  HOME_ALREADY_EXISTS: 'This Home already exists on Pantopus. Review its joining options.',
  HOME_CREATE_ROLE_INVALID: 'Choose your relationship to this Home again.',
  HOME_SECRET_INVALID: 'Check the optional Wi-Fi and access details, then try again.',
  HOME_SECRET_WRITE_DENIED: 'Your account cannot save those optional access details.',
};
function failure() {
  return Object.assign(new Error('Could not confirm this Home request. Keep its original details and retry.'), {
    code: 'HOME_CREATE_UNAVAILABLE', statusCode: 503,
  });
}
function refusal(status, body) {
  return Object.assign(new Error(body.error || body.message || 'Review this address before trying again.'), {
    homeCreateRefusal: true, statusCode: status, body,
  });
}
function identity(actorId, requestId) {
  if (![actorId, requestId].every(value => typeof value === 'string' && UUID.test(value))) {
    throw refusal(400, { error: MESSAGES.HOME_CREATE_INVALID, code: 'HOME_CREATE_INVALID' });
  }
  return { p_actor_id: actorId.toLowerCase(), p_request_id: requestId.toLowerCase() };
}
async function rpc(name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch (_) { throw failure(); }
  if (!response || response.error || !response.data || typeof response.data !== 'object') throw failure();
  const r = response.data;
  if (r.ok === false && Object.hasOwn(MESSAGES, r.code) && [400, 403, 404, 409].includes(r.status)) {
    throw refusal(r.status, { error: MESSAGES[r.code], code: r.code });
  }
  if (r.ok !== true || !STATES.includes(r.state) || r.command?.actor_id !== args.p_actor_id
    || r.command?.request_id !== args.p_request_id || !Number.isFinite(Date.parse(r.command.created_at))
    || !Number.isFinite(Date.parse(r.command.updated_at))
    || (r.state === 'completed' && (!UUID.test(r.home_id || '') || !Object.hasOwn(ROLE_BASE, r.role)
      || (r.ownership_claim_id !== null && !UUID.test(r.ownership_claim_id || ''))
      || !Array.isArray(r.access_secret_ids) || r.access_secret_ids.some(id => !UUID.test(id))))
    || (r.state === 'rejected' && (!/^[A-Z][A-Z0-9_]{1,79}$/.test(r.code || '') || ![400, 403, 404, 409, 422].includes(r.status)))
    || (r.worker_lease_id !== undefined && !UUID.test(r.worker_lease_id))) throw failure();
  return r;
}
async function begin(actorId, requestId, intent) {
  return rpc('begin_home_create_command', { ...identity(actorId, requestId), p_intent: intent });
}
async function read(actorId, requestId) {
  return rpc('get_home_create_command', identity(actorId, requestId));
}
async function cancel(actorId, requestId) {
  return rpc('cancel_home_create_command', identity(actorId, requestId));
}
async function finish(actorId, requestId, leaseId, error) {
  const terminal = error?.homeCreateRefusal && [400, 403, 404, 409, 422].includes(error.statusCode)
    && /^[A-Z][A-Z0-9_]{1,79}$/.test(error.body?.code || '');
  return rpc('finish_home_create_attempt', { ...identity(actorId, requestId), p_lease_id: leaseId,
    p_code: terminal ? error.body.code : null, p_status: terminal ? error.statusCode : null });
}
async function commit(actorId, requestId, leaseId, intent, prepared) {
  const role = intent.role || (intent.is_owner ? 'owner' : 'household');
  if (!Object.hasOwn(ROLE_BASE, role)) throw refusal(400, { code: 'HOME_CREATE_ROLE_INVALID', error: MESSAGES.HOME_CREATE_ROLE_INVALID });
  const templates = {};
  for (const ageBand of ['adult', 'teen', 'child']) {
    templates[ageBand] = (await applyOccupancyTemplate(null, actorId, ROLE_BASE[role],
      role === 'owner' ? 'pending_doc' : 'provisional_bootstrap', { ageBand, dryRun: true })).template;
  }
  return rpc('commit_home_create_command', { ...identity(actorId, requestId), p_lease_id: leaseId,
    p_intent: intent, p_home: prepared.home, p_canonical_address: prepared.canonicalAddress,
    p_templates: templates, p_step_up: prepared.stepUp });
}
function send(res, result, originalError = null) {
  // Explicit projection: worker leases, hashes and prepared/request data never
  // enter a response. Original outcome IDs confer no current Home authority.
  const body = { state: result.state, command: {
    actor_id: result.command.actor_id, request_id: result.command.request_id,
    created_at: result.command.created_at, updated_at: result.command.updated_at,
  } };
  if (result.state === 'completed') {
    return res.status(result.committed_now ? 201 : 200).json({ ...body,
      home: { id: result.home_id }, ownership_claim_id: result.ownership_claim_id,
      access_secret_ids: result.access_secret_ids, role: result.role,
      requires_verification: true, verification_type: result.role === 'owner' ? 'ownership' : 'residency',
      current_access: 'not_checked',
      message: 'Home saved. Open your Homes to check current access and verification options.',
    });
  }
  if (result.state === 'rejected') {
    const details = originalError?.homeCreateRefusal && originalError.body.code === result.code ? originalError.body : {};
    return res.status(result.status).json({ ...details, ...body, code: result.code,
      error: details.error || details.message || MESSAGES[result.code] || 'Review this address and its verification requirements before starting a new request.',
      ...(result.code === 'HOME_ALREADY_EXISTS' ? { home_id: result.conflict_home_id } : {}),
    });
  }
  if (result.state === 'cancelled') {
    return res.status(200).json({ ...body, message: 'This request was cancelled. It cannot create a Home.' });
  }
  if (originalError || result.retryable) {
    const details = originalError?.homeCreateRefusal && originalError.statusCode >= 500 && !result.worker_retired
      ? originalError.body : { code: 'HOME_CREATE_UNAVAILABLE', error: failure().message };
    return res.status(503).json({ ...details, ...body, retryable: true });
  }
  res.set('Retry-After', '2');
  return res.status(202).json({ ...body, retryable: true, message: 'This Home request is still being resolved. Retry the original request.' });
}
function sendError(res, error) {
  if (error?.homeCreateRefusal) return res.status(error.statusCode).json(error.body);
  return res.status(503).json({ error: failure().message, code: 'HOME_CREATE_UNAVAILABLE' });
}
module.exports = { begin, read, cancel, commit, finish, send, sendError, refusal, failure };
