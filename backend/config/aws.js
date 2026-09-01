// ============================================================
// AWS S3 CONFIGURATION
// ============================================================

const { S3Client } = require('@aws-sdk/client-s3');

const S3_REGION = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-west-2';
const S3_ENDPOINT = process.env.AWS_S3_ENDPOINT || undefined;
const S3_FORCE_PATH_STYLE =
  String(process.env.AWS_S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true';

const s3Client = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: S3_FORCE_PATH_STYLE,
  // Automatically retry against the bucket's home region on 301/PermanentRedirect.
  followRegionRedirects: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const S3_BUCKET =
  process.env.AWS_S3_BUCKET_NAME ||
  process.env.AWS_S3_BUCKET ||
  process.env.AWS_BUCKET_NAME ||
  'pantopus-uploads';
const rawCloudfront = (process.env.AWS_CLOUDFRONT_URL || '').trim();
const normalizedCloudfront = rawCloudfront
  ? rawCloudfront.replace(/\/+$/, '')
  : '';
const CLOUDFRONT_URL =
  normalizedCloudfront &&
  !normalizedCloudfront.startsWith('<') &&
  !/^optional$/i.test(normalizedCloudfront)
    ? /^https?:\/\//i.test(normalizedCloudfront)
      ? normalizedCloudfront
      : `https://${normalizedCloudfront}`
    : '';

module.exports = { s3Client, S3_BUCKET, CLOUDFRONT_URL, S3_REGION };
