/**
 * Google allows USPS data for 30 days (Maps service terms, Address Validation section 1.3).
 * Clears it from addresses Google checked longer ago than that; a screen that needs it checks again.
 * Only rows Google answered qualify, so this finds nothing until Google is the postal source.
 */

const logger = require('../utils/logger');
const { clearExpiredUspsData } = require('../services/addressValidation/postalRecheckService');

async function clearExpiredUspsDataJob(options = {}) {
  const summary = await clearExpiredUspsData(options);
  if (summary.found > 0) logger.info('[clearExpiredUspsData] done', summary);
  return summary;
}

module.exports = clearExpiredUspsDataJob;
