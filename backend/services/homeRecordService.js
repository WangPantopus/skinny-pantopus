const db = require('../config/supabaseAdmin');

const MESSAGES = {
  HOME_NOT_FOUND: 'Home not found.',
  HOME_RECORD_NOT_FOUND: 'Record not found or unavailable.',
  HOME_RECORD_INVALID: 'Check the record details and try again.',
  HOME_RECORD_DENIED: 'You do not have permission to view this record.',
  HOME_RECORD_WRITE_DENIED: 'You do not have permission to change this record.',
  HOME_RECORD_RECIPIENT_DENIED: 'An assignee or viewer cannot access this record.',
  HOME_TASK_SOURCE_DENIED: 'The original mail is unavailable to this recipient.',
  HOME_TASK_SOURCE_ALREADY_LINKED: 'This mail already has a linked task.',
  HOME_TASK_MEDIA_CLEANUP_REQUIRED: 'This task has attachments that need storage cleanup before deletion.',
  HOME_TASK_MEDIA_LEGACY_CLEANUP_REQUIRED: 'This task has older public attachments that require verified storage cleanup.',
  HOME_TASK_PRIVATE_STORAGE_REQUIRED: 'Private task attachments are not available yet. Your task is saved; no files were uploaded.',
  HOME_TASK_GIG_FLOW_REQUIRED: 'Use the gig creation flow to publish this task.',
};
function failure(code = 'HOME_RECORD_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not complete the record request. Please retry.'), {
    code, status, statusCode: status,
  });
}
async function rpc(name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch (_) { throw failure(); }
  if (!response || response.error || !response.data) {
    if (response?.error?.code?.startsWith('22')) throw failure('HOME_RECORD_INVALID', 400);
    throw failure();
  }
  const result = response.data;
  if (result.ok !== true) {
    if (result.ok !== false || !Object.hasOwn(MESSAGES, result.code)) throw failure();
    throw failure(result.code, [400, 403, 404, 409].includes(result.status) ? result.status : 503);
  }
  return result;
}
async function list({ homeId, actorId, kind, recordId = null, startAfter = null, startBefore = null, mailOnly = false }) {
  const result = await rpc('get_home_records', { p_home_id: homeId, p_actor_id: actorId, p_kind: kind,
    p_record_id: recordId, p_start_after: startAfter, p_start_before: startBefore, p_mail_only: mailOnly });
  if (!Array.isArray(result.records) || !Array.isArray(result.attendees)
    || result.records.some(record => !record || typeof record.id !== 'string' || record.home_id !== homeId)
    || (recordId !== null && (result.records.length !== 1 || result.records[0].id !== recordId))) throw failure();
  return result;
}
async function listCollection(args) {
  const result = await list(args);
  if (typeof result.can_create !== 'boolean') throw failure();
  return result;
}

async function mutate({ homeId, actorId, kind, action, recordId = null, payload = {}, sourceMailId = null }) {
  // Compatibility for the existing web general/recurring task form. This does
  // not create a permission or a new database task type.
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw failure('HOME_RECORD_INVALID', 400);
  if (kind === 'task' && action === 'delete') {
    if (Object.keys(payload).length || sourceMailId !== null) throw failure('HOME_RECORD_INVALID', 400);
    return require('./homeTaskMediaService').deleteTask({ homeId, actorId, taskId: recordId });
  }
  const normalized = { ...payload };
  if (kind === 'task' && normalized.task_type === 'general') normalized.task_type = 'chore';
  if (kind === 'task' && normalized.task_type === 'recurring') {
    normalized.task_type = 'reminder'; normalized.is_recurring = true;
  }
  const result = await rpc('mutate_home_record', { p_home_id: homeId, p_actor_id: actorId, p_kind: kind,
    p_action: action, p_record_id: recordId, p_payload: normalized, p_source_mail_id: sourceMailId });
  if (action === 'rsvp') {
    if (!result.attendee || result.attendee.user_id !== actorId) throw failure();
  } else if (!result.record || typeof result.record.id !== 'string' || result.record.home_id !== homeId
    || (recordId !== null && result.record.id !== recordId)) throw failure();
  return result;
}
async function mutateTaskById({ actorId, taskId, action, payload = {} }) {
  const result = await rpc('mutate_home_task_by_id', { p_actor_id: actorId, p_task_id: taskId,
    p_action: action, p_payload: payload });
  if (!result.record || result.record.id !== taskId || typeof result.record.home_id !== 'string') throw failure();
  return result;
}
async function visibleRecords(args) {
  try { return (await list(args)).records; } catch (error) {
    if (error.statusCode === 403 || error.statusCode === 404) return [];
    throw error;
  }
}
function sendError(res, error) {
  const safe = error?.code && (Object.hasOwn(MESSAGES, error.code) || error.code === 'HOME_RECORD_UNAVAILABLE')
    ? error : failure();
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}
module.exports = { list, listCollection, mutate, mutateTaskById, visibleRecords, sendError };
