// ============================================================
// CARD MEDIA CLEANUP (memories contract section 11)
// A card's own photo or voice that no card took within seven days of being added, or whose card is gone or was
// withdrawn (taken back, or by a block), is removed: its private S3 object, then its File row. So is a stored object
// no row names any more. Never a file on a card someone can still read. Server-only; nothing waits on it.
// Runs daily at 4:50 AM UTC (after the mail purge).
// ============================================================

const logger = require('../utils/logger');
const cardMedia = require('../services/holidayCardMedia');

async function cardMediaCleanup() {
  const { removed, orphans } = await cardMedia.cleanup();
  if (removed || orphans) logger.info('[cardMediaCleanup] done', { removed, orphans });
}

module.exports = cardMediaCleanup;
