const db = require('../config/supabaseAdmin');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ERRORS = {
  RESIDENCY_CLAIMS_INVALID: [400, 'Check the Home and reload pending residency claims.'],
  HOME_NOT_FOUND: [404, 'This Home is no longer available.'],
  MEMBERS_MANAGE_REQUIRED: [403, 'Current household review permission is required to read pending residency claims.'],
  RESIDENCY_CLAIMS_UNAVAILABLE: [503, 'Pending residency claims could not be loaded. Retry to check current requests.'],
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && UUID.test(value);
function failure(code = 'RESIDENCY_CLAIMS_UNAVAILABLE') {
  return Object.assign(new Error(ERRORS[code][1]), { code, statusCode: ERRORS[code][0] });
}
// The RPC emits canonical UTC microseconds. Check the actual calendar as well:
// Date.parse alone silently normalizes impossible dates such as February 30.
function date(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{6}Z$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const calendar = new Date(0); calendar.setUTCFullYear(year, month - 1, day);
  return year > 0 && month >= 1 && month <= 12 && day >= 1
    && calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day
    && hour < 24 && minute < 60 && second < 60 && Number.isFinite(Date.parse(value));
}
function identity(homeId, actorId) {
  if (typeof homeId !== 'string' || typeof actorId !== 'string'
    || !uuid(homeId.toLowerCase()) || !uuid(actorId.toLowerCase())) throw failure('RESIDENCY_CLAIMS_INVALID');
  return { homeId: homeId.toLowerCase(), actorId: actorId.toLowerCase() };
}
function claim(value, homeId) {
  const c = value?.claimant;
  if (!object(value) || !uuid(value.id) || value.home_id !== homeId || !uuid(value.user_id)
    || value.status !== 'pending' || !(value.created_at === null || date(value.created_at))
    || !(value.claimed_role === null || (typeof value.claimed_role === 'string' && ['renter', 'household'].includes(value.claimed_role)))
    || !(c === null || (object(c) && c.id === value.user_id && c.name === null
      && (c.username === null || (typeof c.username === 'string' && c.username.length <= 100))))) throw failure();
  // Explicit projection also strips accidental upstream fields. A missing/null/
  // malformed collection is not an authorized empty queue.
  return { id: value.id, home_id: homeId, user_id: value.user_id, status: 'pending',
    created_at: value.created_at, claimed_role: value.claimed_role,
    claimant: c === null ? null : { id: c.id, username: c.username, name: null } };
}
async function list(input) {
  const { homeId, actorId } = identity(input.homeId, input.actorId);
  let response;
  try { response = await db.rpc('list_home_current_residency_claims', { p_home_id: homeId, p_actor_id: actorId }); }
  catch (_) { throw failure(); }
  if (!response || response.error || !object(response.data)) throw failure();
  const result = response.data;
  if (result.ok === false && typeof result.code === 'string' && Object.hasOwn(ERRORS, result.code)
    && result.status === ERRORS[result.code][0]) throw failure(result.code);
  if (result.ok !== true || result.home_id !== homeId || result.actor_id !== actorId || !Array.isArray(result.claims)) throw failure();
  const claims = result.claims.map(value => claim(value, homeId));
  if (new Set(claims.map(value => value.id)).size !== claims.length
    || new Set(claims.map(value => value.user_id)).size !== claims.length) throw failure();
  for (let i = 1; i < claims.length; i++) {
    const previous = claims[i - 1], current = claims[i];
    const earlier = current.created_at === previous.created_at ? current.id < previous.id
      : current.created_at === null || (previous.created_at !== null && current.created_at < previous.created_at);
    if (!earlier) throw failure();
  }
  return { home_id: homeId, actor_id: actorId, claims };
}
function sendError(res, error) {
  const safe = typeof error?.code === 'string' && Object.hasOwn(ERRORS, error.code)
    && error.statusCode === ERRORS[error.code][0] ? error : failure();
  return res.status(safe.statusCode).json({ code: safe.code, error: ERRORS[safe.code][1] });
}
module.exports = { list, sendError };
