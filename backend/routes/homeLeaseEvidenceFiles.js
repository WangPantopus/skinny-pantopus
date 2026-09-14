const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const db = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const { homeDocumentUploadLimiter } = require('../middleware/rateLimiter');
const { resolveVerifiedAuthorityForActor } = require('../utils/authorityResolution');
const storage = require('../services/homeDocumentStorage');
// Reuse the existing private evidence byte/signature inspection only. Uploads
// remain File reservations; they never create a claim or household document.
const { inspect } = require('../services/homeClaimEvidenceStorage');
const logger = require('../utils/logger');
const router = express.Router();
const fail = storage.storageError;
const uuid = Joi.string().uuid().lowercase().required();
const contextSchema = Joi.object({
  home_id: uuid, actor_id: uuid,
  lease_id: Joi.string().uuid().lowercase().allow(null).default(null),
  lease_state: Joi.string().valid('pending', 'active', 'ended', 'canceled').allow(null).default(null),
}).required();
const formSchema = Joi.object({ upload_id: uuid, request_context: contextSchema });
const multipart = multer({ storage: multer.memoryStorage(),
  limits: { fileSize: storage.MAX_DOCUMENT_BYTES, files: 1, fields: 2, fieldSize: 2048 },
}).single('file');

function ids(req, _res, next) {
  const { value, error } = Joi.object({ homeId: uuid, uploadId: uuid.optional() }).validate(req.params);
  if (error) return next(fail('LEASE_FILE_INVALID', 'Invalid home or file identifier.', 400));
  Object.assign(req.params, value);
  next();
}

async function row(table, id, fields = '*') {
  const result = await db.from(table).select(fields).eq('id', id).maybeSingle();
  if (result.error) throw fail('LEASE_FILE_UNAVAILABLE', 'Could not check this lease file. Please retry.');
  return result.data;
}

function reference(file) {
  const ref = { homeId: file.home_id, documentId: file.id,
    sha256: file.metadata?.upload_sha256, bucketName: file.metadata?.storage_bucket };
  if (file.metadata?.storage_contract !== 'home_lease_evidence_v1'
    || file.file_path !== storage.documentKey(ref.homeId, ref.documentId, ref.sha256)) {
    throw fail('LEASE_FILE_UNAVAILABLE', 'This lease file is unavailable.', 404);
  }
  return ref;
}

function projection(file) {
  return { id: file.id, home_id: file.home_id, file_name: file.original_filename,
    file_size: file.file_size, mime_type: file.mime_type,
    available: !file.is_deleted && file.processing_status === 'completed',
    lease_id: file.metadata?.lease_id || null };
}

async function mutate(req, action, uploadId, payload = {}) {
  const result = await db.rpc('mutate_home_lease_evidence', {
    p_home_id: req.params.homeId, p_actor_id: req.user.id, p_upload_id: uploadId,
    p_action: action, p_payload: payload,
  });
  if (result.error) {
    if (result.error.code === 'P0001' && result.error.message?.includes('FILE_QUOTA_EXCEEDED')) {
      throw fail('LEASE_FILE_QUOTA_EXCEEDED', 'Your storage limit has been reached.', 413);
    }
    throw fail('LEASE_FILE_UNAVAILABLE', 'Could not save this lease file. Retry the same upload.');
  }
  if (result.data?.success === false) {
    throw fail('LEASE_FILE_UNAVAILABLE', result.data.error || 'Could not save this lease file.', result.data.status || 503);
  }
  const file = result.data?.file;
  if (result.data?.success !== true || !file || file.id !== uploadId
    || file.home_id !== req.params.homeId || file.user_id !== req.user.id) {
    throw fail('LEASE_FILE_UNAVAILABLE', 'Could not confirm this lease file. Please retry.');
  }
  reference(file);
  return file;
}

async function read(req) {
  const { homeId, uploadId } = req.params;
  const file = await row('File', uploadId);
  if (!file || file.home_id !== homeId || file.is_deleted || file.processing_status !== 'completed') {
    throw fail('LEASE_FILE_NOT_FOUND', 'Lease file not found.', 404);
  }
  const ref = reference(file);
  const home = await row('Home', homeId, 'id,security_state,home_status');
  if (!home || home.security_state === 'frozen' || home.security_state === 'frozen_silent'
    || ['merged', 'archived'].includes(home.home_status) || !(await row('User', req.user.id, 'id'))) {
    throw fail('LEASE_FILE_ACCESS_DENIED', 'This lease file is unavailable.', 403);
  }
  const lease = file.metadata.lease_id ? await row('HomeLease', file.metadata.lease_id, 'id,home_id,primary_resident_user_id,source,metadata') : null;
  if (file.metadata.lease_id && (!lease || lease.home_id !== homeId
    || lease.primary_resident_user_id !== file.user_id || lease.metadata?.lease_file_id !== file.id
    || lease.source !== 'tenant_request')) {
    throw fail('LEASE_FILE_NOT_FOUND', 'Lease file not found.', 404);
  }
  if (file.user_id !== req.user.id && (!lease
    || !(await resolveVerifiedAuthorityForActor({ homeId, userId: req.user.id })).found)) {
    throw fail('LEASE_FILE_ACCESS_DENIED', 'No access to this lease file.', 403);
  }
  return { file, ref, version: JSON.stringify([file.id, file.home_id, file.user_id, file.file_path,
    file.file_size, file.original_filename, file.mime_type, ref.sha256, ref.bucketName, lease?.id]) };
}

router.post('/tenant/home/:homeId/lease-files', verifyToken, homeDocumentUploadLimiter, ids, multipart, async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    let requestContext;
    try { requestContext = JSON.parse(req.body.request_context); }
    catch { throw fail('LEASE_FILE_INVALID', 'Refresh the request status before attaching a file.', 400); }
    const { value, error } = formSchema.validate({ ...req.body, request_context: requestContext });
    if (error || value.request_context.home_id !== req.params.homeId || value.request_context.actor_id !== req.user.id) {
      throw fail('LEASE_FILE_INVALID', 'Refresh the request status before attaching a file.', 400);
    }
    const details = inspect(req.file);
    const ref = await storage.prepare({ homeId: req.params.homeId, documentId: value.upload_id, sha256: details.sha256 });
    let file = await mutate(req, 'reserve', value.upload_id, {
      ...details, bucket: ref.bucket, request_context: value.request_context,
    });
    if (file.processing_status === 'completed' && !file.is_deleted) {
      return res.json({ file: projection(file), reused: true });
    }
    try {
      await storage.upload({ homeId: req.params.homeId, documentId: value.upload_id,
        buffer: req.file.buffer, mimeType: details.mime_type });
      file = await mutate(req, 'finalize', value.upload_id);
    } finally {
      // Parent deletion/explicit removal/expiry can win while storage is in
      // flight. The existing worker also revisits tombstones if this ack fails.
      try { await db.rpc('mark_home_document_cleanup_pending', { p_file_id: value.upload_id }); }
      catch { /* Durable reservation remains discoverable by recovery. */ }
    }
    if (file.is_deleted || file.processing_status !== 'completed') {
      throw fail('LEASE_FILE_UNAVAILABLE', 'The file upload is not complete. Please retry.');
    }
    res.status(201).json({ file: projection(file), reused: false });
  } catch (error) { next(error); }
});

router.get('/tenant/home/:homeId/lease-files/:uploadId', verifyToken, ids, async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.json({ file: projection((await read(req)).file) }); }
  catch (error) { next(error); }
});

router.get('/tenant/home/:homeId/lease-files/:uploadId/content', verifyToken, ids, async (req, res, next) => {
  try {
    const before = await read(req);
    const bytes = await storage.download(before.ref);
    // Reuse the accepted document delivery boundary: no bytes leave the server
    // until current actor/authority and the exact record are checked again.
    const after = await read(req);
    if (before.version !== after.version || bytes.length !== after.file.file_size) {
      throw fail('LEASE_FILE_CHANGED', 'This lease file changed while opening. Open it again.', 409);
    }
    res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff',
      'Content-Type': after.file.mime_type,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(after.file.original_filename)}` });
    res.send(bytes);
  } catch (error) { next(error); }
});

router.delete('/tenant/home/:homeId/lease-files/:uploadId', verifyToken, ids, async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const file = await mutate(req, 'retire', req.params.uploadId);
    if (!file.is_deleted) throw fail('LEASE_FILE_UNAVAILABLE', 'Could not confirm file removal. Please retry.');
    // Immediate access retirement; the existing durable worker owns byte
    // removal and conditional cleanup acknowledgement, including late writes.
    const pending = file.metadata.storage_cleanup_pending !== false;
    res.status(pending ? 202 : 200).json({ deleted: true, cleanup_pending: pending });
  } catch (error) { next(error); }
});

router.use((error, _req, res, _next) => {
  const status = error instanceof multer.MulterError ? (error.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : error.status || 503;
  const code = error instanceof multer.MulterError ? 'LEASE_FILE_INVALID' : 'LEASE_FILE_UNAVAILABLE';
  logger.warn('Lease file operation failed', { code, status });
  res.set('Cache-Control', 'private, no-store');
  res.status(status).json({ code, error: error.status ? error.message : 'Could not complete the lease file operation. Please retry.' });
});
module.exports = router;
