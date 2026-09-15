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

/** Verify an existing completion upload without fetching a caller-supplied URL. */
async function verifyGigCompletionFile(url, userId, gigId) {
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

  let file;
  if (nativeUpload) {
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
  verifyGigCompletionFile,
  uploadHomeTaskMedia, uploadReviewMedia, uploadListingMedia, uploadGeneral,
  deleteFromS3, getPresignedDownloadUrl, getObjectAsString, getPresignedUploadUrl,
  ALL_ALLOWED_TYPES, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, ALLOWED_DOC_TYPES, MAX_FILE_SIZES,
};
