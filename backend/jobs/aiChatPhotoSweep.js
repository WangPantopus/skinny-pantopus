// ============================================================
// JOB: AI chat photo sweep
// A chat turn or a flyer reading deletes the photos it reads
// (services/ai/photos.js). This deletes the rest: photos uploaded for the
// assistant (POST /api/upload/ai-media) that no request read within an hour,
// because the app was closed or lost its connection before sending them.
// Runs every 15 minutes.
// ============================================================

const s3 = require('../services/s3Service');
const logger = require('../utils/logger');

const MAX_AGE_MS = 60 * 60 * 1000;

async function aiChatPhotoSweep({ maxAgeMs = MAX_AGE_MS } = {}) {
  const keys = await s3.listKeysWrittenBefore('ai-chat/', Date.now() - maxAgeMs);
  let removed = 0;
  for (const key of keys) {
    if (await s3.deleteFromS3(key)) removed += 1;
  }
  if (keys.length) logger.info('[aiChatPhotoSweep] Deleted unread AI chat photos', { removed, failed: keys.length - removed });
  return { removed, failed: keys.length - removed };
}

module.exports = aiChatPhotoSweep;
