const db = require('../config/supabaseAdmin');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ROLES = ['owner', 'admin', 'manager', 'member', 'restricted_member', 'guest', 'lease_resident', 'service_provider'];
const ERRORS = {
  RESIDENCY_HISTORY_INVALID: [400, 'Check the Home and saved decision, then try again.'],
  RESIDENCY_HISTORY_CURSOR_INVALID: [400, 'This history page is no longer available. Reload your recent decisions.'],
  HOME_NOT_FOUND: [404, 'This Home is no longer available.'],
  MEMBERS_MANAGE_REQUIRED: [403, 'Current household review permission is required to read your saved decisions.'],
  RESIDENCY_HISTORY_NOT_FOUND: [404, 'That saved decision was not found in your history for this Home.'],
  RESIDENCY_HISTORY_UNAVAILABLE: [503, 'Your saved decisions could not be loaded. Retry to check your history.'],
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && UUID.test(value);
const nullableUuid = value => value === null || uuid(value);
const oneOf = (value, values) => typeof value === 'string' && values.includes(value);
function failure(code = 'RESIDENCY_HISTORY_UNAVAILABLE') {
  return Object.assign(new Error(ERRORS[code][1]), { code, statusCode: ERRORS[code][0] });
}
// Preserve microseconds for pagination. Validate calendar components separately:
// Date.parse alone accepts impossible dates by normalizing into the next month.
function date(value, cursor = false) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || (cursor && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value))) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const calendar = new Date(0); calendar.setUTCFullYear(year, month - 1, day); calendar.setUTCHours(0, 0, 0, 0);
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && calendar.getUTCFullYear() === year
    && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day
    && hour < 24 && minute < 60 && second < 60 && Number.isFinite(Date.parse(value));
}
function identity(homeId, actorId) {
  if (typeof homeId !== 'string' || typeof actorId !== 'string'
    || !uuid(homeId.toLowerCase()) || !uuid(actorId.toLowerCase())) throw failure('RESIDENCY_HISTORY_INVALID');
  return { homeId: homeId.toLowerCase(), actorId: actorId.toLowerCase() };
}
function cursorValue(value, homeId, actorId) {
  return object(value) && Object.keys(value).sort().join(',') === 'actor_id,created_at,home_id,id,version'
    && value.version === 1 && value.home_id === homeId && value.actor_id === actorId
    && uuid(value.id) && date(value.created_at, true);
}
function cursorText(value) {
  return JSON.stringify({ version: 1, actor_id: value.actor_id, home_id: value.home_id, created_at: value.created_at, id: value.id });
}
function decodeCursor(value, homeId, actorId) {
  if (value === undefined) return null;
  try {
    if (typeof value !== 'string' || value.length > 600 || !/^[A-Za-z0-9_-]+$/.test(value)) throw failure();
    const json = Buffer.from(value, 'base64url').toString('utf8'), parsed = JSON.parse(json);
    if (!cursorValue(parsed, homeId, actorId) || cursorText(parsed) !== json
      || Buffer.from(json).toString('base64url') !== value) throw failure();
    return parsed;
  } catch (_) { throw failure('RESIDENCY_HISTORY_CURSOR_INVALID'); }
}
function item(value, homeId, actorId, receiptId) {
  const d = value?.decision, r = d?.result, c = value?.current, a = c?.applicant;
  if (!object(value) || !object(d) || !object(r) || !object(c)
    || !uuid(d.id) || (receiptId !== undefined && d.id !== receiptId) || !uuid(d.claim_id)
    || d.home_id !== homeId || d.actor_id !== actorId || !oneOf(d.action, ['approve', 'reject'])
    || !date(d.created_at, true) || typeof d.legacy_request !== 'boolean'
    || !oneOf(r.status, ['verified', 'rejected']) || r.status !== (d.action === 'approve' ? 'verified' : 'rejected')
    || !date(r.reviewed_at) || !nullableUuid(r.occupancy_id)
    || !(r.role_base === null || oneOf(r.role_base, ROLES))
    || (d.action === 'approve' ? !uuid(r.occupancy_id) : r.occupancy_id !== null || r.role_base !== null)
    || !oneOf(c.claim_status, ['pending', 'verified', 'rejected']) || c.applicant_lookup !== 'current_claim_reference'
    || c.household_access !== 'not_checked'
    || !(a === null || (object(a) && uuid(a.id) && a.name === null
      && (a.username === null || (typeof a.username === 'string' && a.username.length <= 100))))) throw failure();
  // Explicit projection strips accidental upstream secrets. Current references
  // remain descriptive, separate from the immutable decision and current access.
  return { decision: { id: d.id, home_id: d.home_id, claim_id: d.claim_id, actor_id: d.actor_id,
    action: d.action, created_at: d.created_at, legacy_request: d.legacy_request,
    result: { status: r.status, reviewed_at: r.reviewed_at, occupancy_id: r.occupancy_id, role_base: r.role_base } },
  current: { claim_status: c.claim_status, applicant_lookup: c.applicant_lookup,
    applicant: a === null ? null : { id: a.id, username: a.username, name: null }, household_access: 'not_checked' } };
}
async function rpc(name, parameters) {
  let response;
  try { response = await db.rpc(name, parameters); } catch (_) { throw failure(); }
  if (!response || response.error || !object(response.data)) throw failure();
  const result = response.data;
  if (result.ok === false && typeof result.code === 'string' && Object.hasOwn(ERRORS, result.code)
    && result.status === ERRORS[result.code][0]) throw failure(result.code);
  if (result.ok !== true || result.home_id !== parameters.p_home_id || result.actor_id !== parameters.p_actor_id) throw failure();
  return result;
}
function earlier(left, right) {
  return left.created_at < right.created_at || (left.created_at === right.created_at && left.id < right.id);
}
async function list(input) {
  const { homeId, actorId } = identity(input.homeId, input.actorId);
  const after = decodeCursor(input.after, homeId, actorId);
  const result = await rpc('list_home_residency_review_history', { p_home_id: homeId, p_actor_id: actorId,
    p_after_id: after?.id ?? null, p_after_created_at: after?.created_at ?? null });
  if (!Array.isArray(result.items) || result.items.length > 20) throw failure();
  const items = result.items.map(value => item(value, homeId, actorId));
  if (new Set(items.map(value => value.decision.id)).size !== items.length) throw failure();
  for (let i = 0; i < items.length; i++) {
    const previous = i === 0 ? after : items[i - 1].decision;
    if (previous && !earlier(items[i].decision, previous)) throw failure();
  }
  let nextCursor = null;
  if (result.next_cursor !== null) {
    const cursor = result.next_cursor, last = items.at(-1)?.decision;
    if (items.length !== 20 || !cursorValue(cursor, homeId, actorId)
      || cursor.id !== last?.id || cursor.created_at !== last?.created_at) throw failure();
    nextCursor = Buffer.from(cursorText(cursor)).toString('base64url');
  }
  return { home_id: homeId, actor_id: actorId, items, next_cursor: nextCursor };
}
async function read(input) {
  const { homeId, actorId } = identity(input.homeId, input.actorId);
  if (typeof input.receiptId !== 'string' || !uuid(input.receiptId.toLowerCase())) throw failure('RESIDENCY_HISTORY_INVALID');
  const receiptId = input.receiptId.toLowerCase();
  const result = await rpc('get_home_residency_review_history', { p_home_id: homeId, p_actor_id: actorId, p_receipt_id: receiptId });
  return { home_id: homeId, actor_id: actorId, item: item(result.item, homeId, actorId, receiptId) };
}
function sendError(res, error) {
  const safe = typeof error?.code === 'string' && Object.hasOwn(ERRORS, error.code)
    && error.statusCode === ERRORS[error.code][0] ? error : failure();
  return res.status(safe.statusCode).json({ code: safe.code, error: ERRORS[safe.code][1] });
}
module.exports = { list, read, sendError };
