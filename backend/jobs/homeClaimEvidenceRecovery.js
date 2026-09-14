const evidence = require('../services/homeClaimEvidenceService');
const logger = require('../utils/logger');

module.exports = async function homeClaimEvidenceRecovery() {
  if (!(process.env.HOME_DOCUMENTS_BUCKET || '').trim()) return { selected: 0, removed: 0, failed: 0, skipped: 0 };
  const stats = await evidence.recover();
  if (stats.selected) logger.info('Private claim evidence recovery complete', stats);
  return stats;
};
