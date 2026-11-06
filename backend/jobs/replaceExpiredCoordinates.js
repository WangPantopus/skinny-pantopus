/**
 * Replaces Google coordinates older than 30 days with Pantopus's own registry points (decision D12).
 * Off until ADDRESS_REGISTRY_COORDINATES says otherwise; finds nothing until then.
 */

const logger = require('../utils/logger');
const { replaceExpiredCoordinates } = require('../services/propertyRecords/registryCoordinates');

async function replaceExpiredCoordinatesJob(options = {}) {
  const summary = await replaceExpiredCoordinates(options);
  if (summary.mode !== 'off') logger.info('[replaceExpiredCoordinates] done', summary);
  return summary;
}

module.exports = replaceExpiredCoordinatesJob;
