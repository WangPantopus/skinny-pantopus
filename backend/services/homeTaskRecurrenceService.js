const db = require('../config/supabaseAdmin');

const messages = {
  HOME_NOT_FOUND: 'Home not found.',
  HOME_RECORD_NOT_FOUND: 'Task not found or unavailable.',
  HOME_RECORD_DENIED: 'This task is no longer available.',
  HOME_RECORD_WRITE_DENIED: 'You cannot change this task schedule.',
  HOME_RECORD_INVALID: 'Check the task due date and repeat settings.',
  HOME_TASK_RECURRENCE_STALE: 'The task or schedule changed. Reload before making another change.',
  HOME_TASK_RECURRENCE_CONFLICT: 'Retry the original schedule request without changing its details.',
};
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
function failure(code = 'HOME_TASK_RECURRENCE_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(messages[code] || 'The schedule could not be confirmed. Retry the same request.'), { code, statusCode: status });
}
async function rpc(name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch (_) { throw failure(); }
  if (!response || response.error || !response.data) {
    if (response?.error?.code?.startsWith('22')) throw failure('HOME_RECORD_INVALID', 400);
    throw failure();
  }
  const result = response.data;
  if (result.ok === false && Object.hasOwn(messages, result.code)) {
    throw failure(result.code, [400, 403, 404, 409].includes(result.status) ? result.status : 503);
  }
  return result;
}
function projection(result, { homeId, taskId }) {
  if (result.ok !== true || result.home_id !== homeId || result.task_id !== taskId
    || typeof result.can_manage !== 'boolean' || !Number.isSafeInteger(result.revision) || result.revision < 0
    || typeof result.task_updated_at !== 'string' || !Number.isFinite(Date.parse(result.task_updated_at))) throw failure();
  const config = result.configuration;
  if (config !== null && (!config || !uuid(config.id) || config.revision !== result.revision
    || !['active', 'paused', 'needs_review'].includes(config.state)
    || !['DAILY', 'WEEKLY', 'MONTHLY'].includes(config.frequency)
    || !Number.isInteger(config.interval) || config.interval < 1 || config.interval > 365
    || typeof config.timezone !== 'string' || (config.state === 'active'
      && (typeof config.next_due_at !== 'string' || !Number.isFinite(Date.parse(config.next_due_at)))))) throw failure();
  if (config === null && result.revision !== 0) throw failure();
  return result;
}
async function read(args) {
  return projection(await rpc('get_home_task_recurrence', { p_home_id: args.homeId,
    p_actor_id: args.actorId, p_task_id: args.taskId }), args);
}
async function change(args) {
  if (!uuid(args.requestId) || !args.command || typeof args.command !== 'object' || Array.isArray(args.command)) {
    throw failure('HOME_RECORD_INVALID', 400);
  }
  const result = projection(await rpc('set_home_task_recurrence', { p_home_id: args.homeId,
    p_actor_id: args.actorId, p_task_id: args.taskId, p_request_id: args.requestId, p_command: args.command }), args);
  const receipt = result.receipt;
  if (typeof result.replayed !== 'boolean' || !receipt || receipt.home_id !== args.homeId
    || receipt.actor_id !== args.actorId || receipt.task_id !== args.taskId || receipt.request_id !== args.requestId
    || receipt.action !== args.command.action || !Number.isSafeInteger(receipt.revision) || receipt.revision < 0
    || typeof receipt.request_hash !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.request_hash)
    || typeof receipt.created_at !== 'string' || !Number.isFinite(Date.parse(receipt.created_at))) throw failure();
  return result;
}
async function generateDue(limit = 25) {
  const bound = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 25;
  const due = await rpc('due_home_task_recurrences', { p_limit: bound });
  if (!Array.isArray(due) || due.length > bound || due.some(s => !uuid(s?.id) || !Number.isSafeInteger(s.revision) || s.revision < 1)) throw failure();
  const stats = { selected: due.length, generated: 0, paused: 0, unchanged: 0, failed: 0 };
  for (const schedule of due) {
    try {
      const result = await rpc('generate_home_task_recurrence', { p_id: schedule.id, p_revision: schedule.revision });
      if (!['generated', 'paused', 'unchanged'].includes(result.outcome)
        || (result.outcome === 'generated' && !uuid(result.task_id))) throw failure();
      stats[result.outcome] += 1;
    } catch (_) { stats.failed += 1; }
  }
  return stats;
}
function sendError(res, error) {
  const safe = error?.code && (Object.hasOwn(messages, error.code) || error.code === 'HOME_TASK_RECURRENCE_UNAVAILABLE') ? error : failure();
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}
module.exports = { read, change, generateDue, sendError };
