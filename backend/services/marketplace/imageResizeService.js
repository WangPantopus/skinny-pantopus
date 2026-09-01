/**
 * imageResizeService.js — Image resize pipeline for marketplace listings.
 *
 * Generates multiple size variants (thumb, card, detail, full) from an
 * original image buffer and uploads them to S3. Gracefully degrades if
 * sharp is not installed.
 */

const path = require('path');
const logger = require('../../utils/logger');
const s3Service = require('../s3Service');

// Try to load sharp for image processing
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  logger.warn('Sharp not installed — image resize pipeline disabled');
}

const VARIANTS = [
  { suffix: '_thumb',  width: 200,  height: 200,  fit: 'cover' },
  { suffix: '_card',   width: 400,  height: 400,  fit: 'cover' },
  { suffix: '_detail', width: 800,  height: 800,  fit: 'inside' },
  { suffix: '_full',   width: 1200, height: 1200, fit: 'inside' },
];

/**
 * Process an original image buffer into multiple resized variants.
 *
 * @param {Buffer} originalBuffer - The original image file buffer
 * @param {string} s3Key - The S3 key of the original image (e.g. uploads/listings/abc/photo1.png)
 * @returns {Promise<Object|null>} { thumb, card, detail, full } URLs, or null if sharp unavailable
 */
async function processListingImage(originalBuffer, s3Key) {
  if (!sharp) return null;

  const ext = path.extname(s3Key);
  const baseName = s3Key.slice(0, -ext.length);

  const results = {};

  await Promise.all(
    VARIANTS.map(async ({ suffix, width, height, fit }) => {
      try {
        const buffer = await sharp(originalBuffer)
          .resize(width, height, { fit, withoutEnlargement: true })
          .jpeg({ quality: 80, progressive: true })
          .toBuffer();

        const variantKey = `${baseName}${suffix}.jpg`;
        const { url } = await s3Service.uploadToS3(buffer, variantKey, 'image/jpeg');

        // Map suffix to clean key name (e.g. _thumb → thumb)
        results[suffix.slice(1)] = url;
      } catch (err) {
        logger.error('imageResize.variant_error', { suffix, s3Key, error: err.message });
      }
    })
  );

  return results;
}

module.exports = {
  processListingImage,
};
