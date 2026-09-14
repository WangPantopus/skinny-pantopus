const db = require('../config/supabaseAdmin');
const storage = require('./homeTaskMediaStorage');

const MESSAGES = {
  HOME_NOT_FOUND: 'Home not found.', HOME_RECORD_NOT_FOUND: 'Task not found or unavailable.',
  HOME_RECORD_INVALID: 'Check the attachment details and try again.',
  HOME_RECORD_DENIED: 'You do not have permission to view this task.',
  HOME_RECORD_WRITE_DENIED: 'You do not have permission to change this task.',
  HOME_TASK_MEDIA_NOT_FOUND: 'Attachment not found or unavailable.',
  HOME_TASK_UPLOAD_CONFLICT: 'This upload ID belongs to different file details. Choose the file again.',
  HOME_TASK_UPLOAD_RETIRED: 'This attachment was removed. Choose the file again to start a new upload.',
  FILE_QUOTA_EXCEEDED: 'Your file storage limit has been reached.',
  HOME_TASK_MEDIA_CLEANUP_REQUIRED: 'An attachment changed while deleting this task. Retry deletion.',
  HOME_TASK_MEDIA_LEGACY_CLEANUP_REQUIRED: 'This task has older public attachments that require verified storage cleanup.',
};
function unavailable() { return storage.failure('HOME_TASK_MEDIA_UNAVAILABLE', 'Could not complete the attachment request. Please retry.'); }
async function rpc(name, args, nullable = false) {
  let result;
  try { result = await db.rpc(name, args); } catch (_) { throw unavailable(); }
  if (result?.error?.code === 'P0001' && result.error.message === 'FILE_QUOTA_EXCEEDED') throw storage.failure('FILE_QUOTA_EXCEEDED', MESSAGES.FILE_QUOTA_EXCEEDED, 413);
  if (!result || result.error || (!nullable && !result.data)) throw unavailable();
  if (result.data?.ok === false) {
    const { code, status } = result.data;
    if (!MESSAGES[code] || ![400, 403, 404, 409].includes(status)) throw unavailable();
    throw storage.failure(code, MESSAGES[code], status);
  }
  return result.data;
}
function scope(args) {
  for (const id of [args.homeId, args.taskId, args.actorId]) if (!storage.UUID.test(id || '')) throw storage.failure('HOME_RECORD_INVALID', MESSAGES.HOME_RECORD_INVALID, 400);
  return { p_home_id: args.homeId, p_task_id: args.taskId, p_actor_id: args.actorId };
}
function validateRecord(record, args, uploadId) {
  if (!record || !storage.UUID.test(record.id || '') || record.home_id !== args.homeId || record.task_id !== args.taskId
    || (uploadId && record.id !== uploadId) || !['reserved', 'ready', 'retired', 'legacy'].includes(record.state)
    || typeof record.file_name !== 'string' || !Number.isSafeInteger(record.file_size) || record.file_size < 0) throw unavailable();
  // Whitelist the client DTO; a changed RPC must never expose a provider path.
  return Object.fromEntries(['id', 'home_id', 'task_id', 'uploaded_by', 'file_name', 'mime_type', 'file_size',
    'file_type', 'created_at', 'state', 'available', 'availability_code', 'cleanup_pending'].map(key => [key, record[key]]));
}
function validateStorage(ref, args, uploadId) {
  if (!ref || ref.home_id !== args.homeId || ref.task_id !== args.taskId || ref.upload_id !== uploadId
    || !Number.isSafeInteger(ref.size) || ref.size <= 0 || ref.size > storage.MAX_BYTES || !storage.MIME_TYPES.has(ref.mime_type)
    || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(ref.bucket || '')) throw unavailable();
  try { storage.key(ref); } catch (_) { throw unavailable(); }
  return ref;
}
async function authorize(args, write = false) {
  const result = await rpc('authorize_home_task_media', { ...scope(args), p_write: write });
  if (result.ok !== true || result.home_id !== args.homeId || result.task_id !== args.taskId
    || typeof result.can_upload !== 'boolean' || (write && !result.can_upload)) throw unavailable();
  return result;
}
async function mutate(args, action, payload = {}) {
  if (!storage.UUID.test(args.uploadId || '')) throw storage.failure('HOME_RECORD_INVALID', MESSAGES.HOME_RECORD_INVALID, 400);
  const result = await rpc('mutate_home_task_media', { ...scope(args), p_action: action, p_upload_id: args.uploadId, p_payload: payload });
  if (result.ok !== true) throw unavailable();
  return { record: validateRecord(result.record, args, args.uploadId), storage: validateStorage(result.storage, args, args.uploadId) };
}
async function list(args) {
  const result = await rpc('get_home_task_media', { ...scope(args), p_upload_id: null });
  if (result.ok !== true || result.home_id !== args.homeId || result.task_id !== args.taskId
    || !Array.isArray(result.records) || typeof result.can_upload !== 'boolean') throw unavailable();
  return { media: result.records.map(record => validateRecord(record, args)), can_upload: result.can_upload };
}
async function upload(args, file) {
  await authorize(args, true);
  const details = storage.inspect(file);
  const prepared = await storage.prepare({ home_id: args.homeId, task_id: args.taskId, upload_id: args.uploadId, sha256: details.sha256 });
  const reserved = await mutate(args, 'reserve', { ...details, bucket: prepared.bucket });
  if (reserved.record.state === 'ready') return reserved.record;
  if (reserved.record.state !== 'reserved') throw unavailable();
  const started = await mutate(args, 'begin_upload');
  if (started.record.state === 'ready') return started.record;
  if (started.record.state !== 'reserved' || !storage.UUID.test(started.storage.upload_attempt || '')) throw unavailable();
  try {
    await storage.upload(started.storage, file.buffer);
    const finished = await mutate(args, 'finalize');
    if (finished.record.state !== 'ready') throw unavailable();
    return finished.record;
  } finally {
    // A provider completion after retirement invalidates an older cleanup ack.
    // If this process dies, the retained tombstone is swept again daily.
    try { await rpc('note_home_task_media_upload_finished', { p_upload_id: args.uploadId, p_attempt: started.storage.upload_attempt }, true); } catch (_) { /* Durable recovery owns retry. */ }
  }
}
async function authorizedDownload(args) {
  if (!storage.UUID.test(args.uploadId || '')) throw storage.failure('HOME_RECORD_INVALID', MESSAGES.HOME_RECORD_INVALID, 400);
  const result = await rpc('get_home_task_media', { ...scope(args), p_upload_id: args.uploadId });
  if (result.ok !== true || !Array.isArray(result.records) || result.records.length !== 1) throw unavailable();
  const record = validateRecord(result.records[0], args, args.uploadId);
  if (record.state !== 'ready' || record.available !== true) throw unavailable();
  return { record, ref: validateStorage(result.storage, args, args.uploadId) };
}
async function download(args) {
  const before = await authorizedDownload(args);
  const bytes = await storage.download(before.ref);
  const after = await authorizedDownload(args);
  if (['bucket', 'sha256', 'size', 'mime_type'].some(field => before.ref[field] !== after.ref[field])) throw unavailable();
  return { record: after.record, bytes };
}
async function cleanup(ref) {
  if (!storage.UUID.test(ref.cleanup_claim || '')) throw unavailable();
  let succeeded = false;
  try { await storage.remove(ref); succeeded = true; } finally {
    const acknowledged = await rpc('finish_home_task_media_cleanup', { p_upload_id: ref.upload_id,
      p_claim: ref.cleanup_claim, p_succeeded: succeeded }, true);
    if (succeeded && acknowledged !== true) throw unavailable();
  }
}
async function remove(args) {
  const retired = await mutate(args, 'retire');
  if (retired.record.state !== 'retired') throw unavailable();
  await cleanup(retired.storage);
  return { ...retired.record, cleanup_pending: false };
}
async function deleteTask(args) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const retiring = await rpc('retire_home_task_media_for_delete', scope(args));
    if (retiring.ok !== true || retiring.home_id !== args.homeId || retiring.task_id !== args.taskId
      || !Array.isArray(retiring.cleanup)) throw unavailable();
    for (const ref of retiring.cleanup) {
      validateStorage(ref, args, ref?.upload_id);
      await cleanup(ref);
    }
    try {
      const result = await rpc('delete_home_task_after_media', scope(args));
      if (result.ok !== true || result.record?.id !== args.taskId || result.record.home_id !== args.homeId) throw unavailable();
      return result;
    } catch (error) {
      if (attempt === 1 || error.code !== 'HOME_TASK_MEDIA_CLEANUP_REQUIRED') throw error;
    }
  }
  throw unavailable();
}
async function cleanupForHomeDelete(homeId, refs) {
  if (!storage.UUID.test(homeId || '') || !Array.isArray(refs)) throw unavailable();
  for (const ref of refs) {
    validateStorage(ref, { homeId, taskId: ref?.task_id }, ref?.upload_id);
    await cleanup(ref);
  }
}
async function recover(limit = 100) {
  const bucket = (process.env.HOME_DOCUMENTS_BUCKET || '').trim();
  const candidates = await rpc('home_task_media_cleanup_candidates', { p_bucket: bucket, p_limit: limit });
  if (!Array.isArray(candidates) || candidates.some(id => !storage.UUID.test(id || ''))) throw unavailable();
  const stats = { selected: candidates.length, removed: 0, failed: 0, skipped: 0 };
  for (const id of candidates) {
    try {
      const ref = await rpc('claim_home_task_media_cleanup', { p_upload_id: id, p_bucket: bucket }, true);
      if (!ref) { stats.skipped++; continue; }
      validateStorage(ref, { homeId: ref.home_id, taskId: ref.task_id }, id);
      if (ref.bucket !== bucket) throw unavailable();
      await cleanup(ref); stats.removed++;
    } catch (_) { stats.failed++; }
  }
  return stats;
}
function sendError(res, error) {
  const safe = error?.code && (Object.hasOwn(MESSAGES, error.code) || error.code.startsWith('HOME_TASK_MEDIA_'))
    && [400, 403, 404, 409, 413, 415, 503].includes(error.statusCode) ? error : unavailable();
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}
module.exports = { authorize, list, upload, download, remove, deleteTask, cleanupForHomeDelete, recover, sendError };
