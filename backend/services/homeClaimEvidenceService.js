const db = require('../config/supabaseAdmin');
const crypto = require('crypto');
const storage = require('./homeClaimEvidenceStorage');

const MESSAGES = {
  HOME_NOT_FOUND: 'Home not found.', CLAIM_NOT_FOUND: 'Claim not found.',
  CLAIM_EVIDENCE_INVALID: 'Check the evidence file and try again.',
  CLAIM_EVIDENCE_DENIED: 'You cannot access this claim evidence in the current context.',
  CLAIM_EVIDENCE_NOT_FOUND: 'Evidence file not found or unavailable.',
  CLAIM_EVIDENCE_UNAVAILABLE: 'Could not confirm the evidence file. Please retry.',
  CLAIM_UPLOAD_CONFLICT: 'This upload ID belongs to different file details. Choose the file again.',
  CLAIM_UPLOAD_RETIRED: 'This upload was removed. Choose the file again.',
  CLAIM_EVIDENCE_RETENTION_REQUIRED: 'Verified evidence is retained with its review history.',
  CLAIM_EVIDENCE_INSPECTION_REQUIRED: 'Open the current document before verifying it.',
  CLAIM_REVIEW_CHANGED: 'The claim or its evidence changed. Reopen it before reviewing.',
  CLAIM_NOT_ELIGIBLE: 'This claim can no longer be changed through this action.',
  CLAIM_CHALLENGE_REVIEW_REQUIRED: 'This claim needs the dedicated dispute review flow.',
  FILE_QUOTA_EXCEEDED: 'Your file storage limit has been reached.',
};
function unavailable() { return storage.failure('HOME_CLAIM_EVIDENCE_UNAVAILABLE', 'Could not complete the evidence file request. Please retry.'); }
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
  for (const id of [args.homeId, args.claimId, args.actorId]) if (!storage.UUID.test(id || '')) throw storage.failure('CLAIM_EVIDENCE_INVALID', MESSAGES.CLAIM_EVIDENCE_INVALID, 400);
  return { p_home_id: args.homeId, p_claim_id: args.claimId, p_actor_id: args.actorId };
}
function validateRecord(record, args, uploadId) {
  if (!record || !storage.UUID.test(record.id || '') || record.home_id !== args.homeId || record.claim_id !== args.claimId
    || (uploadId && record.id !== uploadId) || !['reserved', 'ready', 'retired'].includes(record.state)
    || typeof record.file_name !== 'string' || !Number.isSafeInteger(record.file_size) || record.file_size < 0) throw unavailable();
  // Whitelist the client DTO; a changed RPC must never expose a provider path.
  return Object.fromEntries(['id', 'home_id', 'claim_id', 'uploaded_by', 'file_name', 'mime_type', 'file_size',
    'evidence_type', 'provider', 'status', 'created_at', 'state', 'available', 'eligible_for_review', 'cleanup_pending'].map(key => [key, record[key]]));
}
function validateStorage(ref, args, uploadId) {
  if (!ref || ref.home_id !== args.homeId || ref.claim_id !== args.claimId || ref.upload_id !== uploadId
    || !Number.isSafeInteger(ref.size) || ref.size <= 0 || ref.size > storage.MAX_BYTES || !storage.MIME_TYPES.has(ref.mime_type)
    || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(ref.bucket || '')) throw unavailable();
  try { storage.key(ref); } catch (_) { throw unavailable(); }
  return ref;
}
async function authorize(args, operation = 'upload') {
  const result = await rpc('authorize_home_claim_evidence', { ...scope(args), p_operation: operation,
    p_platform_admin: args.platformAdmin === true });
  if (result.ok !== true || result.home_id !== args.homeId || result.claim_id !== args.claimId
    || typeof result.can_verify !== 'boolean' || !/^[a-f0-9]{64}$/.test(result.review_token || '')) throw unavailable();
  return result;
}
async function mutate(args, action, payload = {}) {
  if (!storage.UUID.test(args.uploadId || '')) throw storage.failure('CLAIM_EVIDENCE_INVALID', MESSAGES.CLAIM_EVIDENCE_INVALID, 400);
  const result = await rpc('mutate_home_claim_evidence', { ...scope(args), p_action: action, p_upload_id: args.uploadId, p_payload: payload });
  if (result.ok !== true) throw unavailable();
  return { record: validateRecord(result.record, args, args.uploadId), storage: validateStorage(result.storage, args, args.uploadId) };
}
async function list(args) {
  const result = await rpc('get_home_claim_evidence', { ...scope(args), p_upload_id: null,
    p_platform_admin: args.platformAdmin === true });
  if (result.ok !== true || result.home_id !== args.homeId || result.claim_id !== args.claimId
    || !Array.isArray(result.records) || typeof result.can_verify !== 'boolean') throw unavailable();
  return { evidence: result.records.map(record => validateRecord(record, args)), can_verify: result.can_verify,
    review_token: result.review_token };
}
async function upload(args, file) {
  await authorize(args, 'upload');
  const details = storage.inspect(file);
  const prepared = await storage.prepare({ home_id: args.homeId, claim_id: args.claimId, upload_id: args.uploadId, sha256: details.sha256 });
  const reserved = await mutate(args, 'reserve', { ...details, evidence_type: args.evidenceType, bucket: prepared.bucket });
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
    try { await rpc('note_home_claim_evidence_upload_finished', { p_upload_id: args.uploadId, p_attempt: started.storage.upload_attempt }, true); } catch (_) { /* Durable recovery owns retry. */ }
  }
}
async function authorizedDownload(args) {
  if (!storage.UUID.test(args.uploadId || '')) throw storage.failure('CLAIM_EVIDENCE_INVALID', MESSAGES.CLAIM_EVIDENCE_INVALID, 400);
  const result = await rpc('get_home_claim_evidence', { ...scope(args), p_upload_id: args.uploadId, p_platform_admin: args.platformAdmin === true });
  if (result.ok !== true || !Array.isArray(result.records) || result.records.length !== 1) throw unavailable();
  const record = validateRecord(result.records[0], args, args.uploadId);
  if (record.state !== 'ready' || record.available !== true) throw unavailable();
  return { record, ref: validateStorage(result.storage, args, args.uploadId), reviewToken: result.review_token, canVerify: result.can_verify };
}
function reviewScope(args) {
  if (!/^[a-f0-9]{64}$/.test(args.reviewToken || '')) throw storage.failure('CLAIM_REVIEW_CHANGED', MESSAGES.CLAIM_REVIEW_CHANGED, 409);
}
async function download(args) {
  const before = await authorizedDownload(args);
  if (args.reviewToken !== undefined) {
    reviewScope(args);
    if (!before.canVerify || before.reviewToken !== args.reviewToken) throw storage.failure('CLAIM_REVIEW_CHANGED', MESSAGES.CLAIM_REVIEW_CHANGED, 409);
  }
  const bytes = await storage.download(before.ref);
  const after = await authorizedDownload(args);
  if (['bucket', 'sha256', 'size', 'mime_type'].some(field => before.ref[field] !== after.ref[field])) throw unavailable();
  let inspection;
  if (args.reviewToken !== undefined) {
    if (!after.canVerify || after.reviewToken !== args.reviewToken) throw storage.failure('CLAIM_REVIEW_CHANGED', MESSAGES.CLAIM_REVIEW_CHANGED, 409);
    inspection = crypto.randomBytes(32).toString('hex');
    const result = await rpc('record_home_claim_evidence_inspection', { ...scope(args), p_upload_id: args.uploadId,
      p_platform_admin: args.platformAdmin === true, p_review_token: args.reviewToken,
      p_receipt_hash: crypto.createHash('sha256').update(inspection).digest('hex') });
    if (result.ok !== true || result.upload_id !== args.uploadId || result.home_id !== args.homeId
      || result.claim_id !== args.claimId || result.review_token !== args.reviewToken || result.inspection_recorded !== true) throw unavailable();
  }
  return { record: after.record, bytes, inspection };
}
async function verify(args) {
  reviewScope(args);
  if (!storage.UUID.test(args.uploadId || '') || !/^[a-f0-9]{64}$/.test(args.inspection || '')) {
    throw storage.failure('CLAIM_EVIDENCE_INSPECTION_REQUIRED', MESSAGES.CLAIM_EVIDENCE_INSPECTION_REQUIRED, 409);
  }
  const result = await rpc('verify_home_claim_evidence', { ...scope(args), p_upload_id: args.uploadId,
    p_platform_admin: args.platformAdmin === true, p_review_token: args.reviewToken,
    p_receipt_hash: crypto.createHash('sha256').update(args.inspection).digest('hex') });
  if (result.ok !== true || result.home_id !== args.homeId || result.claim_id !== args.claimId || result.upload_id !== args.uploadId
    || result.action !== 'verify_evidence' || typeof result.replayed !== 'boolean'
    || !/^[a-f0-9]{64}$/.test(result.review_token || '')) throw unavailable();
  const record = validateRecord(result.record, args, args.uploadId);
  if (record.state !== 'ready' || record.status !== 'verified' || record.eligible_for_review !== true) throw unavailable();
  return { ...result, record };
}
async function cleanup(ref) {
  if (!storage.UUID.test(ref.cleanup_claim || '')) throw unavailable();
  let succeeded = false;
  try { await storage.remove(ref); succeeded = true; } finally {
    const acknowledged = await rpc('finish_home_claim_evidence_cleanup', { p_upload_id: ref.upload_id,
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
async function recover(limit = 100) {
  const bucket = (process.env.HOME_DOCUMENTS_BUCKET || '').trim();
  const candidates = await rpc('home_claim_evidence_cleanup_candidates', { p_bucket: bucket, p_limit: limit });
  if (!Array.isArray(candidates) || candidates.some(id => !storage.UUID.test(id || ''))) throw unavailable();
  const stats = { selected: candidates.length, removed: 0, failed: 0, skipped: 0 };
  for (const id of candidates) {
    try {
      const ref = await rpc('claim_home_claim_evidence_cleanup', { p_upload_id: id, p_bucket: bucket }, true);
      if (!ref) { stats.skipped++; continue; }
      validateStorage(ref, { homeId: ref.home_id, claimId: ref.claim_id }, id);
      if (ref.bucket !== bucket) throw unavailable();
      await cleanup(ref); stats.removed++;
    } catch (_) { stats.failed++; }
  }
  return stats;
}
function sendError(res, error) {
  const safe = error?.code && (Object.hasOwn(MESSAGES, error.code) || error.code.startsWith('HOME_CLAIM_EVIDENCE_'))
    && [400, 403, 404, 409, 413, 415, 503].includes(error.statusCode) ? error : unavailable();
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}
module.exports = { authorize, list, upload, download, verify, remove, recover, sendError };
