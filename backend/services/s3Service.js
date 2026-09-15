// ============================================================
// S3 SERVICE — Upload, delete, presigned URL generation
// ============================================================

const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');
const { s3Client, S3_BUCKET, CLOUDFRONT_URL, S3_REGION } = require('../config/aws');
const logger = require('../utils/logger');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
const ALLOWED_DOC_TYPES = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_DOC_TYPES];
const MAX_FILE_SIZES = { image: 10*1024*1024, video: 100*1024*1024, document: 25*1024*1024 };

function categorizeFile(mimeType) {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video';
  if (ALLOWED_DOC_TYPES.includes(mimeType)) return 'document';
  return null;
}

function generateS3Key(folder, originalFilename, userId) {
  const ext = path.extname(originalFilename).toLowerCase();
  const ts = Date.now();
  const rand = crypto.randomBytes(8).toString('hex');
  return `${folder}/${userId}/${ts}_${rand}${ext}`;
}

function getPublicUrl(key) {
  if (CLOUDFRONT_URL) return `${CLOUDFRONT_URL}/${key}`;
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

const S3_OBJECT_ACL = (process.env.AWS_S3_OBJECT_ACL || '').trim();

function buildPutObjectParams(baseParams) {
  // Buckets with Object Ownership = "Bucket owner enforced" reject any ACL header.
  if (S3_OBJECT_ACL) {
    return { ...baseParams, ACL: S3_OBJECT_ACL };
  }
  return baseParams;
}

async function uploadToS3(buffer, key, contentType) {
  const cmd = new PutObjectCommand(
    buildPutObjectParams({ Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: contentType })
  );
  await s3Client.send(cmd);
  logger.info('S3 upload success', { key, size: buffer.length });
  return { key, url: getPublicUrl(key) };
}

async function uploadProfilePicture(buffer, originalFilename, userId, mimeType) {
  const key = generateS3Key('profiles', originalFilename, userId);
  return uploadToS3(buffer, key, mimeType);
}

async function uploadGigMedia(buffer, originalFilename, userId, gigId, mimeType) {
  const key = generateS3Key(`gigs/${gigId}`, originalFilename, userId);
  return uploadToS3(buffer, key, mimeType);
}

// Completion proof uses the existing Supabase private-bucket mechanism. The
// public S3/CDN path remains appropriate for ordinary gig attachments, but a
// private File flag cannot protect bytes served by that CDN.
const COMPLETION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function completionStorageError(statusCode = 503) {
  return Object.assign(new Error(statusCode === 400 ? 'Invalid completion file reference.'
    : 'Private proof storage could not be verified. Please retry.'), { statusCode });
}
function privateGigCompletionReference(gigId, fileId) {
  if (![gigId, fileId].every(id => typeof id === 'string' && COMPLETION_UUID.test(id))) throw completionStorageError(400);
  return `/api/gigs/${gigId}/completion-files/${fileId}`;
}
function privateGigCompletionKey(file) {
  const metadata = file?.metadata;
  const gigId = metadata?.original_gig_id;
  const actorId = metadata?.original_user_id;
  if (!metadata || metadata.storage_contract !== 'gig_completion_v1'
    || ![gigId, actorId, file.id].every(id => typeof id === 'string' && COMPLETION_UUID.test(id))
    || !/^[a-f0-9]{64}$/.test(metadata.upload_sha256 || '')
    || (file.gig_id !== null && file.gig_id !== gigId)
    || (file.user_id !== null && file.user_id !== actorId)
    || file.file_type !== 'gig_attachment' || file.file_context !== 'gig_completion'
    || file.visibility !== 'private' || file.file_url !== privateGigCompletionReference(gigId, file.id)
    || !Number.isSafeInteger(Number(file.file_size)) || Number(file.file_size) <= 0
    || !categorizeFile(file.mime_type) || Number(file.file_size) > MAX_FILE_SIZES[categorizeFile(file.mime_type)]) {
    throw completionStorageError(400);
  }
  const key = `gig-completion/${gigId}/${actorId}/${file.id}/${metadata.upload_sha256}`;
  if (file.file_path !== key) throw completionStorageError(400);
  return key;
}
async function privateGigCompletionBucket(expected) {
  const name = (process.env.GIG_COMPLETION_BUCKET || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(name) || (expected !== undefined && expected !== name)) throw completionStorageError();
  const db = require('../config/supabaseAdmin');
  let result;
  try { result = await db.storage.getBucket(name); } catch (_) { throw completionStorageError(); }
  if (result?.error || result?.data?.public !== false) throw completionStorageError();
  return { name, bucket: db.storage.from(name) };
}
async function readPrivateGigCompletionBytes(bucket, file, key) {
  let result;
  try { result = await bucket.download(key); } catch (_) { throw completionStorageError(); }
  const blob = result?.data;
  if (result?.error || !blob || blob.size !== Number(file.file_size)) throw completionStorageError();
  let bytes;
  try { bytes = Buffer.from(await blob.arrayBuffer()); } catch (_) { throw completionStorageError(); }
  if (bytes.length !== Number(file.file_size)
    || crypto.createHash('sha256').update(bytes).digest('hex') !== file.metadata.upload_sha256) throw completionStorageError();
  return bytes;
}
async function preparePrivateGigCompletionFile() {
  return (await privateGigCompletionBucket()).name;
}
async function uploadPrivateGigCompletionFile(file, buffer) {
  const key = privateGigCompletionKey(file);
  if (file.is_deleted !== false || file.processing_status !== 'uploading'
    || !Buffer.isBuffer(buffer) || buffer.length !== Number(file.file_size)
    || crypto.createHash('sha256').update(buffer).digest('hex') !== file.metadata.upload_sha256) throw completionStorageError(400);
  const { bucket } = await privateGigCompletionBucket(file.metadata.storage_bucket);
  try {
    const result = await bucket.upload(key, buffer, { contentType: file.mime_type, cacheControl: '0', upsert: false });
    if (!result || result.error) throw completionStorageError();
  } catch (_) {
    // An unknown reply or concurrent matching upload must verify the exact bytes;
    // it must never overwrite an existing object or mint another public URL.
    await readPrivateGigCompletionBytes(bucket, file, key);
  }
}
async function downloadPrivateGigCompletionFile(file) {
  const key = privateGigCompletionKey(file);
  if (file.is_deleted !== false || file.processing_status !== 'completed') throw completionStorageError(400);
  const { bucket } = await privateGigCompletionBucket(file.metadata.storage_bucket);
  return readPrivateGigCompletionBytes(bucket, file, key);
}
async function removePrivateGigCompletionFile(file) {
  const key = privateGigCompletionKey(file);
  if (file.is_deleted !== true) throw completionStorageError(400);
  const { bucket } = await privateGigCompletionBucket(file.metadata.storage_bucket);
  let result;
  try { result = await bucket.remove([key]); } catch (_) { throw completionStorageError(); }
  if (!result || result.error) throw completionStorageError();
}

function privateGigCompletionId(url, gigId) {
  if (typeof url !== 'string' || !url.startsWith('/api/gigs/')) return null;
  const parts = url.split('/');
  if (parts.length !== 6 || parts[2] !== 'gigs' || parts[3] !== gigId || parts[4] !== 'completion-files'
    || !COMPLETION_UUID.test(parts[5])) throw completionStorageError(400);
  return parts[5];
}
async function completionFileCommand(name, args) {
  const result = await require('../config/supabaseAdmin').rpc(name, args);
  if (result?.error || !result?.data) throw completionStorageError();
  if (result.data.error) {
    const status = { NOT_FOUND: 404, FORBIDDEN: 403, COMPLETION_FILE_CHANGED: 409, INVALID_COMPLETION_FILE: 400 }[result.data.error] || 503;
    throw Object.assign(completionStorageError(status), { code: result.data.error });
  }
  return result.data;
}
async function createPrivateGigCompletionFile(gigId, userId, file) {
  if (![gigId, userId].every(id => typeof id === 'string' && COMPLETION_UUID.test(id))) throw completionStorageError(400);
  const buffer = file?.buffer, mime = file?.mimetype, category = categorizeFile(mime);
  if (!Buffer.isBuffer(buffer) || !buffer.length || !category || buffer.length > MAX_FILE_SIZES[category]) throw completionStorageError(400);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  // Retry discovery survives an unknown upload HTTP reply without another table
  // or client secret. The same task/actor/content/type selects the same File id;
  // the transaction compares its complete immutable identity before reuse.
  const digest = crypto.createHash('sha256').update(JSON.stringify(['gig_completion_v1', gigId, userId, sha256, mime])).digest('hex');
  const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  const bucket = await preparePrivateGigCompletionFile();
  const args = { p_gig_id: gigId, p_actor_id: userId, p_file_id: id };
  const reserved = await completionFileCommand('mutate_gig_completion_file', { ...args, p_action: 'reserve',
    p_payload: { bucket, sha256, mime_type: mime, file_size: buffer.length, file_name: 'proof' + path.extname(file.originalname || '').toLowerCase().slice(0, 10) } });
  const saved = reserved.file;
  const check = candidate => {
    if (!candidate || candidate.id !== id || candidate.user_id !== userId || candidate.gig_id !== gigId
      || candidate.metadata?.upload_sha256 !== sha256 || candidate.metadata?.storage_bucket !== bucket
      || candidate.file_size !== buffer.length || candidate.mime_type !== mime || candidate.is_deleted !== false) throw completionStorageError();
    privateGigCompletionKey(candidate);
  };
  check(saved);
  if (saved.processing_status === 'completed') return saved;
  await uploadPrivateGigCompletionFile(saved, buffer);
  const finished = await completionFileCommand('mutate_gig_completion_file', { ...args, p_action: 'finalize' });
  check(finished.file);
  if (finished.file.processing_status !== 'completed') throw completionStorageError();
  return finished.file;
}
async function getAuthorizedGigCompletionFile(gigId, actorId, fileId) {
  if (![gigId, actorId, fileId].every(id => typeof id === 'string' && COMPLETION_UUID.test(id))) throw completionStorageError(400);
  const result = await completionFileCommand('get_gig_completion_file', { p_gig_id: gigId, p_actor_id: actorId, p_file_id: fileId });
  const file = result.file;
  if (!file || file.id !== fileId || file.gig_id !== gigId || file.is_deleted !== false || file.processing_status !== 'completed') throw completionStorageError();
  privateGigCompletionKey(file);
  return file;
}
async function readAuthorizedGigCompletionFile(gigId, actorId, fileId) {
  const before = await getAuthorizedGigCompletionFile(gigId, actorId, fileId);
  const bytes = await downloadPrivateGigCompletionFile(before);
  // Apply the existing Home byte-delivery pattern: revocation, retirement or a
  // changed assignment during a provider read must prevent the late response.
  const after = await getAuthorizedGigCompletionFile(gigId, actorId, fileId);
  if (before.file_path !== after.file_path || before.metadata.storage_bucket !== after.metadata.storage_bucket
    || before.file_size !== after.file_size || before.mime_type !== after.mime_type) throw completionStorageError(409);
  return { file: after, bytes };
}

function gigCompletionKey(url, userId, gigId) {
  const invalid = () => Object.assign(new Error('Choose proof files uploaded by you for this task.'), { statusCode: 400 });
  let key;
  try {
    const base = new URL(getPublicUrl(''));
    const reference = new URL(url);
    if (reference.origin !== base.origin || reference.username || reference.password
      || !reference.pathname.startsWith(base.pathname)) throw invalid();
    key = decodeURIComponent(reference.pathname.slice(base.pathname.length));
  } catch { throw invalid(); }
  const parts = key.split('/');
  const same = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();
  const webUpload = parts.length === 4 && parts[0] === 'gigs' && same(parts[1], gigId) && same(parts[2], userId);
  const nativeUpload = parts.length === 3 && parts[0] === 'uploads' && same(parts[1], userId);
  // Keep older basenames usable without permitting another path segment or
  // URL escapes. Ownership comes from the task/uploader path and actual object.
  if ((!webUpload && !nativeUpload) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(parts.at(-1))) throw invalid();
  return key;
}

// A saved completion can be compared during recovery without depending on a
// new provider read. This only normalizes its owned path; it does not verify bytes.
function normalizeGigCompletionFile(url, userId, gigId) {
  const fileId = privateGigCompletionId(url, gigId);
  if (fileId) return privateGigCompletionReference(gigId, fileId);
  return getPublicUrl(gigCompletionKey(url, userId, gigId));
}

/** Verify an existing completion upload without fetching a caller-supplied URL. */
async function verifyGigCompletionFile(url, userId, gigId) {
  const fileId = privateGigCompletionId(url, gigId);
  if (fileId) {
    const { file } = await readAuthorizedGigCompletionFile(gigId, userId, fileId);
    if (file.user_id !== userId) throw completionStorageError(400);
    return privateGigCompletionReference(gigId, fileId);
  }
  const key = gigCompletionKey(url, userId, gigId);
  const invalid = () => Object.assign(new Error('Choose proof files uploaded by you for this task.'), { statusCode: 400 });
  const same = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();

  let file;
  if (key.startsWith('uploads/')) {
    const { data, error } = await require('../config/supabaseAdmin').from('File')
      .select('id, gig_id, file_size, mime_type').eq('user_id', userId).eq('file_path', key)
      .eq('file_type', 'gig_attachment').eq('file_context', 'gig_completion')
      .eq('processing_status', 'completed').eq('is_deleted', false).maybeSingle();
    if (error) throw Object.assign(new Error('Proof files could not be checked. Please retry.'), { statusCode: 503 });
    if (!data || (data.gig_id && !same(data.gig_id, gigId))) throw invalid();
    file = data;
  }

  let object;
  try {
    object = await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }),
      { abortSignal: AbortSignal.timeout(10000) });
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') throw invalid();
    throw Object.assign(new Error('Proof files could not be checked. Please retry.'), { statusCode: 503 });
  }
  const mimeType = String(object.ContentType || '').split(';')[0].trim().toLowerCase();
  const category = categorizeFile(mimeType);
  if (!category || !Number.isSafeInteger(object.ContentLength) || object.ContentLength <= 0
    || object.ContentLength > MAX_FILE_SIZES[category]
    || (file && (Number(file.file_size) !== object.ContentLength || file.mime_type !== mimeType))) throw invalid();
  return getPublicUrl(key);
}

async function uploadHomeTaskMedia(buffer, originalFilename, userId, taskId, mimeType) {
  const key = generateS3Key(`home-tasks/${taskId}`, originalFilename, userId);
  return uploadToS3(buffer, key, mimeType);
}

async function uploadReviewMedia(buffer, originalFilename, userId, mimeType) {
  const key = generateS3Key('reviews', originalFilename, userId);
  return uploadToS3(buffer, key, mimeType);
}

async function uploadListingMedia(buffer, originalFilename, userId, listingId, mimeType) {
  const key = generateS3Key(`listings/${listingId}`, originalFilename, userId);
  return uploadToS3(buffer, key, mimeType);
}

async function uploadGeneral(buffer, originalFilename, userId, folder, mimeType) {
  const key = generateS3Key(folder, originalFilename, userId);
  return uploadToS3(buffer, key, mimeType);
}

async function deleteFromS3(key) {
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    logger.info('S3 delete success', { key });
    return true;
  } catch (err) {
    logger.error('S3 delete error', { key, error: err.message });
    return false;
  }
}

async function getPresignedDownloadUrl(key, expiresIn = 3600) {
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn });
}

async function getObjectAsString(key, bucket = S3_BUCKET) {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) return '';

  if (typeof response.Body.transformToString === 'function') {
    return response.Body.transformToString();
  }

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function getPresignedUploadUrl(key, contentType, expiresIn = 300) {
  const cmd = new PutObjectCommand(
    buildPutObjectParams({ Bucket: S3_BUCKET, Key: key, ContentType: contentType })
  );
  const url = await getSignedUrl(s3Client, cmd, { expiresIn });
  return { uploadUrl: url, key, publicUrl: getPublicUrl(key) };
}

function isAllowedType(mimeType) {
  return ALL_ALLOWED_TYPES.includes(mimeType);
}

module.exports = {
  categorizeFile, generateS3Key, getPublicUrl, isAllowedType,
  uploadToS3, uploadProfilePicture, uploadGigMedia,
  verifyGigCompletionFile, normalizeGigCompletionFile,
  privateGigCompletionReference, privateGigCompletionKey, preparePrivateGigCompletionFile,
  uploadPrivateGigCompletionFile, downloadPrivateGigCompletionFile, removePrivateGigCompletionFile,
  createPrivateGigCompletionFile, readAuthorizedGigCompletionFile,
  uploadHomeTaskMedia, uploadReviewMedia, uploadListingMedia, uploadGeneral,
  deleteFromS3, getPresignedDownloadUrl, getObjectAsString, getPresignedUploadUrl,
  ALL_ALLOWED_TYPES, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, ALLOWED_DOC_TYPES, MAX_FILE_SIZES,
};
