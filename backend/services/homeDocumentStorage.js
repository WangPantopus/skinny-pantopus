const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MIME_TYPES = new Set([
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);

function storageError(code, message, status = 503) {
  return Object.assign(new Error(message), { code, status });
}

function documentKey(homeId, documentId, sha256) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(homeId) || !uuid.test(documentId) || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw storageError('INVALID_DOCUMENT_PATH', 'Invalid document storage reference.', 400);
  }
  // Always derive the path from the authorized record; never fetch a supplied
  // storage_path or preview_url. File extensions are presentation metadata.
  return `${homeId.toLowerCase()}/${documentId.toLowerCase()}/${sha256}`;
}

async function privateBucket() {
  const name = (process.env.HOME_DOCUMENTS_BUCKET || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(name)) {
    throw storageError('DOCUMENT_STORAGE_UNAVAILABLE', 'Document storage is unavailable. Try again later.');
  }
  const { data, error } = await supabaseAdmin.storage.getBucket(name);
  if (error || !data || data.public !== false) {
    // A public bucket would bypass every Home permission check on download.
    throw storageError('DOCUMENT_STORAGE_UNAVAILABLE', 'Private document storage is unavailable. Try again later.');
  }
  return { name, bucket: supabaseAdmin.storage.from(name) };
}

async function downloadBytes(bucket, key, expectedSha256) {
  const { data, error } = await bucket.download(key);
  if (error || !data) {
    throw storageError('DOCUMENT_DOWNLOAD_UNAVAILABLE', 'Could not load this document. Try again.');
  }
  if (data.size > MAX_DOCUMENT_BYTES) {
    throw storageError('DOCUMENT_INTEGRITY_ERROR', 'The stored document could not be verified.');
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== expectedSha256) {
    throw storageError('DOCUMENT_INTEGRITY_ERROR', 'The stored document could not be verified.');
  }
  return bytes;
}

async function upload({ homeId, documentId, buffer, mimeType }) {
  if (!buffer?.length || buffer.length > MAX_DOCUMENT_BYTES) {
    throw storageError('INVALID_DOCUMENT_SIZE', 'Choose a nonempty file of 25 MB or less.', 413);
  }
  if (!MIME_TYPES.has(mimeType)) {
    throw storageError('INVALID_DOCUMENT_TYPE', 'This file type is not supported.', 415);
  }
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const key = documentKey(homeId, documentId, sha256);
  const { name, bucket } = await privateBucket();
  const { error } = await bucket.upload(key, buffer, { contentType: mimeType, upsert: false });
  if (error) {
    // A retry of the same operation may find its exact object after a response
    // was lost. Verify its bytes instead of overwriting or silently accepting it.
    try {
      await downloadBytes(bucket, key, sha256);
    } catch {
      throw storageError('DOCUMENT_UPLOAD_UNAVAILABLE', 'Could not upload this document. Try again.');
    }
  }
  return { bucket: name, key, sha256, size: buffer.length };
}

async function download({ homeId, documentId, sha256, bucketName }) {
  const key = documentKey(homeId, documentId, sha256);
  const { name, bucket } = await privateBucket();
  if (bucketName !== name) throw storageError('DOCUMENT_STORAGE_MISMATCH', 'This document is not available from the configured storage.', 404);
  return downloadBytes(bucket, key, sha256);
}

async function remove({ homeId, documentId, sha256, bucketName }) {
  const key = documentKey(homeId, documentId, sha256);
  const { name, bucket } = await privateBucket();
  if (bucketName !== name) throw storageError('DOCUMENT_STORAGE_MISMATCH', 'Document storage could not be verified.');
  const { error } = await bucket.remove([key]);
  if (error) throw storageError('DOCUMENT_DELETE_UNAVAILABLE', 'Could not finish removing the stored file.');
}

module.exports = { upload, download, remove, documentKey, MAX_DOCUMENT_BYTES, MIME_TYPES, storageError };
