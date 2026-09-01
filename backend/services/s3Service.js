// ============================================================
// S3 SERVICE — Upload, delete, presigned URL generation
// ============================================================

const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
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
  uploadHomeTaskMedia, uploadReviewMedia, uploadListingMedia, uploadGeneral,
  deleteFromS3, getPresignedDownloadUrl, getObjectAsString, getPresignedUploadUrl,
  ALL_ALLOWED_TYPES, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, ALLOWED_DOC_TYPES, MAX_FILE_SIZES,
};
