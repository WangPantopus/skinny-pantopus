const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const crypto = require('crypto');
const path = require('path');
const db = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const { homeDocumentUploadLimiter } = require('../middleware/rateLimiter');
const { checkHomePermission } = require('../utils/homePermissions');
const { HOME_DOCUMENT_TYPES, HOME_DOCUMENT_VISIBILITIES, homeDocumentVisibilities, serializeHomeDocument } = require('../utils/homeDocumentAccess');
const storage = require('../services/homeDocumentStorage');
const logger = require('../utils/logger');
const router = express.Router();
const fail = storage.storageError;
const uuid = Joi.string().uuid().required();
const metadataSchema = Joi.object({
  upload_id: uuid,
  doc_type: Joi.string().valid(...HOME_DOCUMENT_TYPES).required(),
  title: Joi.string().trim().min(1).max(255).required(),
  visibility: Joi.string().valid(...HOME_DOCUMENT_VISIBILITIES).default('members'),
  details: Joi.object().pattern(Joi.string().max(100), Joi.string().max(2000)).max(20).default({}),
});
const multipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: storage.MAX_DOCUMENT_BYTES, files: 1, fields: 5, fieldSize: 32768 },
}).single('file');

async function row(table, id) {
  const { data, error } = await db.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw fail('DOCUMENT_DATABASE_UNAVAILABLE', 'Could not load document state. Try again.');
  return data;
}

function assertSameUpload(record, { homeId, userId, fingerprint }, kind) {
  const metadata = kind === 'File' ? record.metadata : record.details;
  const owner = kind === 'File' ? record.user_id : record.created_by;
  if (record.home_id !== homeId || owner !== userId || metadata?.upload_fingerprint !== fingerprint || record.is_deleted) {
    throw fail('DOCUMENT_UPLOAD_CONFLICT', 'This upload identifier is already in use. Choose the file again to start a new upload.', 409);
  }
}

function gate(permission) {
  return async (req, _res, next) => {
    try {
      if (uuid.validate(req.params.homeId).error || (req.params.documentId && uuid.validate(req.params.documentId).error)) {
        throw fail('INVALID_DOCUMENT_ID', 'Invalid home or document identifier.', 400);
      }
      req.params.homeId = req.params.homeId.toLowerCase();
      if (req.params.documentId) req.params.documentId = req.params.documentId.toLowerCase();
      const access = await checkHomePermission(req.params.homeId, req.user.id, permission);
      if (access.readFailed) throw fail('DOCUMENT_ACCESS_UNAVAILABLE', 'Could not check home access. Try again.');
      if (!access.hasAccess) throw fail('DOCUMENT_ACCESS_DENIED', 'No access to this home document operation.', 403);
      const visibility = await homeDocumentVisibilities(req.params.homeId, req.user.id, access);
      if (visibility.readFailed) throw fail('DOCUMENT_ACCESS_UNAVAILABLE', 'Could not check document access. Try again.');
      req.documentVisibilities = visibility.allowed;
      next();
    } catch (error) { next(error); }
  };
}

router.post('/:homeId/documents/upload', verifyToken, homeDocumentUploadLimiter, gate('docs.upload'), multipart, async (req, res, next) => {
  try {
    if (!req.file) throw fail('DOCUMENT_FILE_REQUIRED', 'Choose a file to upload.', 400);
    let details;
    try { details = req.body.details ? JSON.parse(req.body.details) : {}; }
    catch { throw fail('INVALID_DOCUMENT_METADATA', 'Invalid document details.', 400); }
    const { value, error } = metadataSchema.validate({ ...req.body, details }, { allowUnknown: false });
    if (error) throw fail('INVALID_DOCUMENT_METADATA', 'Check the document title, category and visibility.', 400);
    if (Object.keys(value.details).some(key => key.startsWith('upload_') || ['storage_contract', 'preview_url', 'original_filename'].includes(key))) {
      throw fail('INVALID_DOCUMENT_METADATA', 'Document details contain reserved fields.', 400);
    }
    if (!req.documentVisibilities.includes(value.visibility)) throw fail('DOCUMENT_ACCESS_DENIED', 'No access to that document visibility.', 403);
    if (!storage.MIME_TYPES.has(req.file.mimetype)) throw fail('INVALID_DOCUMENT_TYPE', 'This file type is not supported.', 415);
    if (!req.file.size) throw fail('INVALID_DOCUMENT_SIZE', 'Choose a nonempty file of 25 MB or less.', 413);

    const homeId = req.params.homeId;
    const userId = req.user.id;
    const documentId = value.upload_id.toLowerCase();
    const filename = req.file.originalname.replace(/[\\/\x00-\x1f\x7f]/g, '_').slice(0, 255);
    const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify([
      homeId, userId, value.doc_type, value.title, value.visibility,
      Object.entries(value.details).sort(([a], [b]) => a.localeCompare(b)),
      filename, req.file.mimetype, req.file.size, sha256,
    ])).digest('hex');
    const identity = { homeId, userId, fingerprint };
    const existing = await row('HomeDocument', documentId);
    if (existing) {
      if (!req.documentVisibilities.includes(existing.visibility)) throw fail('DOCUMENT_ACCESS_DENIED', 'No access to this document.', 403);
      assertSameUpload(existing, identity, 'HomeDocument');
      const file = await row('File', existing.file_id);
      if (!file) throw fail('DOCUMENT_UPLOAD_INCOMPLETE', 'This document upload is incomplete. Try again.');
      assertSameUpload(file, identity, 'File');
      return res.json({ document: serializeHomeDocument(existing), reused: true });
    }

    let file = await row('File', documentId);
    if (file) assertSameUpload(file, identity, 'File');
    else {
      const quota = await db.rpc('can_upload_file', { p_user_id: userId, p_file_size: req.file.size });
      if (quota.error || !quota.data) throw fail('DOCUMENT_QUOTA_UNAVAILABLE', 'Could not check storage capacity. Try again.');
      if (!quota.data.canUpload) throw fail('DOCUMENT_QUOTA_EXCEEDED', 'Your storage limit has been reached.', 413);
    }

    const reference = await storage.prepare({ homeId, documentId, sha256 });
    const internal = { storage_contract: 'home_document_v1', upload_fingerprint: fingerprint, upload_sha256: sha256, original_filename: filename };
    if (!file) {
      const inserted = await db.from('File').insert({
        id: documentId, user_id: userId, home_id: homeId,
        filename, original_filename: filename, file_path: reference.key,
        file_url: `/api/homes/${homeId}/documents/${documentId}/content`,
        file_size: req.file.size, mime_type: req.file.mimetype,
        file_extension: path.extname(filename).toLowerCase().slice(0, 10),
        file_type: 'home_document', visibility: 'private',
        processing_status: 'uploading', is_deleted: false,
        metadata: { ...internal, storage_bucket: reference.bucket, upload_visibility: value.visibility },
      }).select().single();
      file = inserted.data;
      if (inserted.error || !file) {
        // The insert may have succeeded with its response lost, or a concurrent
        // identical retry may have won. Reconcile before deciding to retry.
        file = await row('File', documentId);
        if (!file) {
          if (inserted.error?.code === 'P0001' && inserted.error.message?.includes('FILE_QUOTA_EXCEEDED')) {
            throw fail('DOCUMENT_QUOTA_EXCEEDED', 'Your storage limit has been reached.', 413);
          }
          throw fail('DOCUMENT_SAVE_UNAVAILABLE', 'The document could not be saved. Retry this upload.');
        }
        assertSameUpload(file, identity, 'File');
      }
    }
    if (file.file_path !== reference.key || file.metadata?.storage_bucket !== reference.bucket) {
      throw fail('DOCUMENT_UPLOAD_CONFLICT', 'This upload has a different storage reference. Choose the file again.', 409);
    }
    const stored = await storage.upload({ homeId, documentId, buffer: req.file.buffer, mimeType: req.file.mimetype });
    const inserted = await db.from('HomeDocument').insert({
      id: documentId, home_id: homeId, file_id: file.id, created_by: userId,
      doc_type: value.doc_type, title: value.title, visibility: value.visibility,
      storage_bucket: stored.bucket, storage_path: stored.key,
      mime_type: req.file.mimetype, size_bytes: stored.size,
      details: { ...value.details, ...internal },
    }).select().single();
    let document = inserted.data;
    if (inserted.error || !document) {
      document = await row('HomeDocument', documentId);
      if (!document) {
        const latest = await row('File', documentId);
        if (latest?.is_deleted) {
          // Deletion/expiry won while the provider write was in flight. Its
          // tombstone prevents publication; invalidate any cleanup acknowledgement.
          await db.rpc('mark_home_document_cleanup_pending', { p_file_id: documentId });
          throw fail('DOCUMENT_UPLOAD_CONFLICT', 'This upload has expired or was removed. Choose the file again.', 409);
        }
        throw fail('DOCUMENT_SAVE_UNAVAILABLE', 'The document could not be saved. Retry this upload.');
      }
      assertSameUpload(document, identity, 'HomeDocument');
    }
    // The authorized document row is the committed publication. A bookkeeping
    // write failure must not turn real delivered bytes into a false failure.
    const completed = await db.from('File').update({ processing_status: 'completed' }).eq('id', documentId).eq('is_deleted', false);
    if (completed.error) logger.warn('Home document completion bookkeeping pending', { code: 'DOCUMENT_DATABASE_UNAVAILABLE' });
    return res.status(201).json({ document: serializeHomeDocument(document) });
  } catch (error) { next(error); }
});

router.get('/:homeId/documents/:documentId/content', verifyToken, gate('docs.view'), async (req, res, next) => {
  try {
    const { homeId, documentId } = req.params;
    const document = await row('HomeDocument', documentId);
    if (!document || document.home_id !== homeId) throw fail('DOCUMENT_NOT_FOUND', 'Document not found.', 404);
    if (!req.documentVisibilities.includes(document.visibility)) throw fail('DOCUMENT_ACCESS_DENIED', 'No access to this document.', 403);
    const file = document.file_id && await row('File', document.file_id);
    if (!file || file.is_deleted || file.home_id !== homeId || file.id !== documentId || file.user_id !== document.created_by || file.metadata?.storage_contract !== 'home_document_v1') {
      throw fail('DOCUMENT_NOT_FOUND', 'The document file is unavailable.', 404);
    }
    const sha256 = file.metadata.upload_sha256;
    if (file.file_path !== storage.documentKey(homeId, documentId, sha256)) throw fail('DOCUMENT_NOT_FOUND', 'The document file is unavailable.', 404);
    const bytes = await storage.download({ homeId, documentId, sha256, bucketName: file.metadata.storage_bucket });
    res.set({
      'Cache-Control': 'private, no-store',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': storage.MIME_TYPES.has(file.mime_type) ? file.mime_type : 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.original_filename || 'document')}`,
    });
    res.send(bytes);
  } catch (error) { next(error); }
});

router.delete('/:homeId/documents/:documentId', verifyToken, gate('docs.manage'), async (req, res, next) => {
  try {
    const { homeId, documentId } = req.params;
    const document = await row('HomeDocument', documentId);
    const file = await row('File', documentId);
    if (!file || file.home_id !== homeId || file.metadata?.storage_contract !== 'home_document_v1') {
      throw fail('DOCUMENT_NOT_FOUND', 'Document not found.', 404);
    }
    const visibility = document?.visibility || (file.is_deleted && file.metadata.deleted_document_visibility);
    if (!visibility || (document && (document.home_id !== homeId || document.file_id !== file.id || document.created_by !== file.user_id))) {
      throw fail('DOCUMENT_NOT_FOUND', 'Document not found.', 404);
    }
    if (!req.documentVisibilities.includes(visibility)) throw fail('DOCUMENT_ACCESS_DENIED', 'No access to this document.', 403);
    if (file.file_path !== storage.documentKey(homeId, documentId, file.metadata.upload_sha256)) {
      throw fail('DOCUMENT_NOT_FOUND', 'The document file is unavailable.', 404);
    }
    const result = await db.rpc('delete_home_document_file', {
      p_home_id: homeId, p_document_id: documentId, p_actor_id: req.user.id,
      p_expected_fingerprint: file.metadata.upload_fingerprint,
      p_expected_visibility: visibility,
    });
    if (result.error || !result.data) throw fail('DOCUMENT_DELETE_UNAVAILABLE', 'Could not remove the document. Try again.');
    if (result.data.code) throw fail(result.data.code, 'The document changed. Reload it and try again.', result.data.code === 'DOCUMENT_NOT_FOUND' ? 404 : 409);
    const deleted = result.data.file;
    if (!deleted?.is_deleted || deleted.id !== documentId || deleted.home_id !== homeId) {
      throw fail('DOCUMENT_DELETE_UNAVAILABLE', 'Could not confirm document removal. Try again.');
    }
    let cleanupPending = deleted.metadata.storage_cleanup_pending !== false;
    if (cleanupPending) {
      try {
        await storage.remove({ homeId, documentId, sha256: deleted.metadata.upload_sha256, bucketName: deleted.metadata.storage_bucket });
        const saved = await db.from('File').update({ metadata: { ...deleted.metadata, storage_cleanup_pending: false } }).eq('id', documentId).eq('is_deleted', true);
        cleanupPending = Boolean(saved.error);
      } catch (error) {
        logger.warn('Home document storage cleanup pending', { code: error.code || 'DOCUMENT_DELETE_UNAVAILABLE' });
      }
    }
    res.status(cleanupPending ? 202 : 200).json({ deleted: true, cleanup_pending: cleanupPending });
  } catch (error) { next(error); }
});

router.use((error, _req, res, _next) => {
  const status = error instanceof multer.MulterError ? (error.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : error.status || 503;
  const code = error instanceof multer.MulterError ? 'INVALID_DOCUMENT_UPLOAD' : error.code || 'DOCUMENT_UNAVAILABLE';
  logger.warn('Home document operation failed', { code, status });
  res.status(status).json({ code, error: error.status ? error.message : 'Could not complete the document operation. Try again.' });
});

module.exports = router;
