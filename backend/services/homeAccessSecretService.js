const db = require('../config/supabaseAdmin');

const MESSAGES = {
  HOME_NOT_FOUND: 'Home not found.',
  HOME_SECRET_NOT_FOUND: 'Access code not found.',
  HOME_SECRET_ACCESS_DENIED: 'You do not have permission to view these access codes.',
  HOME_SECRET_WRITE_DENIED: 'You do not have permission to change this access code.',
  HOME_SECRET_INVALID: 'Check the access code details and try again.',
  HOME_SECRET_DUPLICATE: 'An access code with this type and label already exists.',
};

function failure(code = 'HOME_SECRET_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not complete the access code request. Please retry.'), {
    code, status, statusCode: status,
  });
}

async function rpc(name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch (_) { throw failure(); }
  if (!response || response.error || !response.data) {
    if (response?.error?.code?.startsWith('22')) throw failure('HOME_SECRET_INVALID', 400);
    if (response?.error?.code === '23505') throw failure('HOME_SECRET_DUPLICATE', 409);
    throw failure();
  }
  const result = response.data;
  if (result.ok !== true) {
    if (result.ok !== false || !Object.hasOwn(MESSAGES, result.code)) throw failure();
    throw failure(result.code, [400, 403, 404, 409].includes(result.status) ? result.status : 503);
  }
  return result;
}

async function list(homeId, actorId) {
  const result = await rpc('get_home_access_secrets', { p_home_id: homeId, p_actor_id: actorId });
  if (!Array.isArray(result.secrets)) throw failure();
  return result.secrets;
}

async function mutate({ homeId, actorId, secretId = null, action, payload = {} }) {
  const result = await rpc('mutate_home_access_secret', {
    p_home_id: homeId, p_actor_id: actorId, p_secret_id: secretId, p_action: action, p_payload: payload,
  });
  if (action === 'delete') {
    if (result.deleted !== true) throw failure();
  } else if (!result.secret || typeof result.secret.id !== 'string'
    || typeof result.secret.secret_value !== 'string') throw failure();
  return result.secret;
}

module.exports = { list, mutate };
