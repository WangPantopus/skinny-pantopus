const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const crypto = require('crypto');
const path = require('path');
const db = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const { homeDocumentUploadLimiter } = require('../middleware/rateLimiter');
const { checkHomePermission } = require('../utils/homePermissions');
const { homeDocumentVisibilities, serializeHomeDocument } = require('../utils/homeDocumentAccess');
const storage = require('../services/homeDocumentStorage');
const router = express.Router();
const fail = storage.storageError;
const uuid = Joi.string().uuid().required();
const fields = Joi.object({ upload_id: uuid, expected_version: uuid });
const multipart = multer({ storage: multer.memoryStorage(),
  limits: { fileSize: storage.MAX_DOCUMENT_BYTES, files: 1, fields: 2, fieldSize: 100 },
}).single('file');

async function row(table, id) {
  const { data, error } = await db.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw fail('DOCUMENT_DATABASE_UNAVAILABLE', 'Could not load document state. Try again.');
  return data;
}

async function authorize(req) {
  const access = await checkHomePermission(req.params.homeId, req.user.id, 'docs.manage');
  if (access.readFailed) throw fail('DOCUMENT_ACCESS_UNAVAILABLE', 'Could not check document access. Try again.');
  if (!access.hasAccess) throw fail('DOCUMENT_ACCESS_DENIED', 'You do not have permission to replace this document.', 403);
  const scope = await homeDocumentVisibilities(req.params.homeId, req.user.id, access);
  if (scope.readFailed) throw fail('DOCUMENT_ACCESS_UNAVAILABLE', 'Could not check document access. Try again.');
  const document = await row('HomeDocument', req.params.documentId);
  if (!document || document.home_id !== req.params.homeId) throw fail('DOCUMENT_NOT_FOUND', 'Document not found.', 404);
  if (!scope.allowed.includes(document.visibility)) throw fail('DOCUMENT_ACCESS_DENIED', 'No access to this document.', 403);
  return document;
}

async function accessGate(req, _res, next) {
  try {
    if (uuid.validate(req.params.homeId).error || uuid.validate(req.params.documentId).error) {
      throw fail('INVALID_DOCUMENT_ID', 'Invalid home or document identifier.', 400);
    }
    req.params.homeId = req.params.homeId.toLowerCase();
    req.params.documentId = req.params.documentId.toLowerCase();
    req.replacementDocument = await authorize(req);
    next();
  } catch (error) { next(error); }
}

function version(document) { return document.details?.upload_version || document.id; }
function conflict() { return fail('DOCUMENT_UPLOAD_CONFLICT', 'The document changed or this upload was removed. Reload it and choose the file again.', 409); }
function applied(candidate, document, actorId, fingerprint) {
  if (candidate?.metadata?.replacement_applied !== true) return false;
  if (candidate.metadata.replacement_request_fingerprint !== fingerprint
    || candidate.metadata.replacement_actor !== actorId
    || candidate.metadata.replacement_target !== document.id
    || version(document) !== candidate.id) throw conflict();
  return true;
}

// Preserve the logical document and metadata; only replace its authorized bytes.
router.post('/:homeId/documents/:documentId/replace', verifyToken, homeDocumentUploadLimiter, accessGate, multipart, async (req, res, next) => {
  try {
    const { value, error } = fields.validate(req.body, { allowUnknown: false });
    if (error || !req.file) throw fail('INVALID_DOCUMENT_UPLOAD', 'Choose a file and reload the document before replacing it.', 400);
    if (!storage.MIME_TYPES.has(req.file.mimetype)) throw fail('INVALID_DOCUMENT_TYPE', 'This file type is not supported.', 415);
    if (!req.file.size) throw fail('INVALID_DOCUMENT_SIZE', 'Choose a nonempty file of 25 MB or less.', 413);
    const { homeId, documentId } = req.params;
    const actorId = req.user.id, uploadId = value.upload_id.toLowerCase(), expectedVersion = value.expected_version.toLowerCase();
    if (uploadId === documentId) throw conflict();
    const filename = req.file.originalname.replace(/[\\/\x00-\x1f\x7f]/g, '_').slice(0, 255);
    const sha = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify([
      homeId, documentId, actorId, expectedVersion, filename, req.file.mimetype, req.file.size, sha,
    ])).digest('hex');
    let document = req.replacementDocument;
    let candidate = await row('File', uploadId);
    if (applied(candidate, document, actorId, fingerprint)) return res.json({ document: serializeHomeDocument(document), reused: true });
    if (version(document) !== expectedVersion) {
      if (candidate?.user_id === actorId && candidate.home_id === homeId
        && candidate.metadata?.replacement_pending === true && candidate.metadata.upload_fingerprint === fingerprint) {
        await db.rpc('reject_home_document_replacement', { p_upload_id: uploadId, p_actor_id: actorId });
      }
      throw conflict();
    }
    const current = await row('File', documentId);
    if (!current || current.is_deleted || current.home_id !== homeId || current.user_id !== document.created_by
      || document.file_id !== documentId || current.metadata?.storage_contract !== 'home_document_v1'
      || document.details?.storage_contract !== 'home_document_v1') {
      throw fail('DOCUMENT_REPLACEMENT_UNAVAILABLE', 'This document does not support file replacement.', 409);
    }
    const validateCandidate = () => {
      if (candidate.is_deleted || candidate.user_id !== actorId || candidate.home_id !== homeId
        || candidate.metadata?.replacement_pending !== true || candidate.metadata.replacement_target !== documentId
        || candidate.metadata.upload_fingerprint !== fingerprint) throw conflict();
    };
    if (candidate) validateCandidate();
    const reference = await storage.prepare({ homeId, documentId: uploadId, sha256: sha });
    if (current.metadata.storage_bucket !== reference.bucket) {
      throw fail('DOCUMENT_STORAGE_MISMATCH', 'This document is not available from the configured storage.', 409);
    }
    if (!candidate) {
      const quota = await db.rpc('can_upload_file', { p_user_id: actorId, p_file_size: req.file.size });
      if (quota.error || !quota.data) throw fail('DOCUMENT_QUOTA_UNAVAILABLE', 'Could not check storage capacity. Try again.');
      if (!quota.data.canUpload) throw fail('DOCUMENT_QUOTA_EXCEEDED', 'There is not enough storage to prepare this replacement.', 413);
      const inserted = await db.from('File').insert({
        id: uploadId, user_id: actorId, home_id: homeId, filename, original_filename: filename,
        file_path: reference.key, file_url: `/api/homes/${homeId}/documents/${documentId}/content`,
        file_size: req.file.size, mime_type: req.file.mimetype, file_extension: path.extname(filename).toLowerCase().slice(0, 10),
        file_type: 'home_document', visibility: 'private', processing_status: 'uploading', is_deleted: false,
        metadata: { storage_contract: 'home_document_v1', storage_bucket: reference.bucket, storage_key_id: uploadId,
          upload_sha256: sha, upload_fingerprint: fingerprint, original_filename: filename, upload_visibility: document.visibility,
          replacement_pending: true, replacement_target: documentId, replacement_expected_version: expectedVersion },
      }).select().single();
      candidate = inserted.data;
      if (inserted.error || !candidate) {
        candidate = await row('File', uploadId);
        if (!candidate) {
          if (inserted.error?.code === 'P0001' && inserted.error.message?.includes('FILE_QUOTA_EXCEEDED')) {
            throw fail('DOCUMENT_QUOTA_EXCEEDED', 'There is not enough storage to prepare this replacement.', 413);
          }
          throw fail('DOCUMENT_SAVE_UNAVAILABLE', 'Could not prepare the replacement. Retry this upload.');
        }
        document = await authorize(req);
        if (applied(candidate, document, actorId, fingerprint)) return res.json({ document: serializeHomeDocument(document), reused: true });
        validateCandidate();
      }
    }
    if (candidate.file_path !== reference.key || candidate.metadata.storage_bucket !== reference.bucket) throw conflict();
    await storage.upload({ homeId, documentId: uploadId, buffer: req.file.buffer, mimeType: req.file.mimetype });
    try { document = await authorize(req); }
    catch (error) {
      if ([403, 404].includes(error.status)) await db.rpc('reject_home_document_replacement', { p_upload_id: uploadId, p_actor_id: actorId });
      throw error;
    }
    const result = await db.rpc('replace_home_document_file', {
      p_home_id: homeId, p_document_id: documentId, p_upload_id: uploadId, p_actor_id: actorId,
      p_expected_version: expectedVersion, p_expected_fingerprint: current.metadata.upload_fingerprint,
      p_expected_visibility: document.visibility, p_request_fingerprint: fingerprint,
    });
    if (result.error || !result.data) {
      candidate = await row('File', uploadId);
      document = await authorize(req);
      if (applied(candidate, document, actorId, fingerprint)) return res.json({ document: serializeHomeDocument(document), reused: true });
      throw fail('DOCUMENT_SAVE_UNAVAILABLE', 'Could not confirm replacement. Retry this upload.');
    }
    if (result.data.code) {
      await db.rpc('reject_home_document_replacement', { p_upload_id: uploadId, p_actor_id: actorId });
      throw conflict();
    }
    if (result.data.document?.id !== documentId || version(result.data.document) !== uploadId) {
      throw fail('DOCUMENT_SAVE_UNAVAILABLE', 'Could not confirm replacement. Reload this document.');
    }
    res.status(result.data.reused ? 200 : 201).json({ document: serializeHomeDocument(result.data.document), reused: Boolean(result.data.reused) });
  } catch (error) { next(error); }
});

module.exports = router;
