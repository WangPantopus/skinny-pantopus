const db = require('../config/supabaseAdmin');
const messages = {
  HOME_NOT_FOUND: 'Home not found.',
  HOME_RECORD_NOT_FOUND: 'Task not found or unavailable.',
  HOME_RECORD_DENIED: 'This task is no longer available.',
  HOME_RECORD_WRITE_DENIED: 'You cannot publish this household task.',
  HOME_RECORD_INVALID: 'Review the public task details and try again.',
  HOME_TASK_GIG_STALE: 'The household task changed. Reload and review it before posting.',
  HOME_TASK_GIG_CONFLICT: 'Retry the original publication without changing its details.',
  HOME_TASK_GIG_LINKED: 'This household task already has a Gig. Open the linked Gig.',
  HOME_TASK_GIG_NOT_READY: 'Use an open, unassigned task and pause automatic recurrence before posting.',
  HOME_TASK_GIG_RETIRED: 'The original publication is no longer available. No new Gig was created.',
};
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
function failure(code = 'HOME_TASK_GIG_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(messages[code] || 'Publication could not be confirmed. Retry the original request.'), { code, statusCode: status });
}
async function rpc(name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch (_) { throw failure(); }
  if (!response || response.error || !response.data) {
    if (response?.error?.code?.startsWith('22')) throw failure('HOME_RECORD_INVALID', 400);
    throw failure();
  }
  const result = response.data;
  if (result.ok === false && Object.hasOwn(messages, result.code)) throw failure(result.code,
    [400, 403, 404, 409].includes(result.status) ? result.status : 503);
  if (result.ok !== true) throw failure();
  return result;
}
async function read({ homeId, actorId, taskId }) {
  const r = await rpc('get_home_task_gig_publication', { p_home_id: homeId, p_actor_id: actorId, p_task_id: taskId });
  if (r.home_id !== homeId || r.task_id !== taskId || typeof r.can_publish !== 'boolean'
    || typeof r.task_updated_at !== 'string' || !Number.isFinite(Date.parse(r.task_updated_at))
    || (r.gig_id !== null && !uuid(r.gig_id))) throw failure();
  return r;
}
async function publish({ actorId, source, command, gigData }) {
  const r = await rpc('publish_home_task_gig', { p_home_id: source.home_id, p_actor_id: actorId,
    p_task_id: source.task_id, p_request_id: source.request_id, p_expected_updated_at: source.expected_updated_at,
    p_command: command, p_gig: gigData });
  const receipt = r.receipt;
  if (typeof r.replayed !== 'boolean' || !receipt || receipt.home_id !== source.home_id
    || receipt.task_id !== source.task_id || receipt.actor_id !== actorId || receipt.request_id !== source.request_id
    || !uuid(receipt.gig_id) || !/^[a-f0-9]{64}$/.test(receipt.request_hash)
    || typeof receipt.created_at !== 'string' || !Number.isFinite(Date.parse(receipt.created_at))
    || !r.gig || r.gig.id !== receipt.gig_id || r.gig.user_id !== actorId || r.gig.created_by !== actorId) throw failure();
  return r;
}
function sendError(res, error) {
  const safe = error?.code && (Object.hasOwn(messages, error.code) || error.code === 'HOME_TASK_GIG_UNAVAILABLE') ? error : failure();
  res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}
module.exports = { read, publish, sendError };
