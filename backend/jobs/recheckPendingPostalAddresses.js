/**
 * Re-checks addresses a home is waiting on, after Google was down or USPS gave no answer.
 * Does nothing unless Google is the postal source.
 */

const logger = require('../utils/logger');
const { recheckPendingAddresses } = require('../services/addressValidation/postalRecheckService');

async function recheckPendingPostalAddresses(options = {}) {
  const summary = await recheckPendingAddresses(options);
  if (summary.due > 0) logger.info('[recheckPendingPostalAddresses] done', summary);
  return summary;
}

module.exports = recheckPendingPostalAddresses;
