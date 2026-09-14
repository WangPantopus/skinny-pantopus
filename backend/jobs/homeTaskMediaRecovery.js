const media = require('../services/homeTaskMediaService');
const logger = require('../utils/logger');

module.exports = async function homeTaskMediaRecovery() {
  if (!(process.env.HOME_DOCUMENTS_BUCKET || '').trim()) return { selected: 0, removed: 0, failed: 0, skipped: 0 };
  const stats = await media.recover();
  if (stats.selected) logger.info('Home task attachment recovery complete', stats);
  return stats;
};
