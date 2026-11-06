const logger = require('../utils/logger');
const mailVendorService = require('../services/addressValidation/mailVendorService');
const postcardRequests = require('../services/homePostcardRequestService');
const blockFounders = require('../services/blockFoundersService');

// A send that got no answer stays pending until its printer says what happened. Only a
// printer's confirmed "no such piece" allows sending again or moving to another printer.
module.exports = async function reconcileMailPieces() {
  if (!mailVendorService.reconcileEnabled() || !mailVendorService.canSendPostcards()) return;
  const results = {
    address_verification: await mailVendorService.reconcileJobs(),
    home_postcard: await postcardRequests.reconcileCards(),
    block_founders: await blockFounders.reconcileInvites(),
  };
  logger.info('reconcileMailPieces: done', results);
};
