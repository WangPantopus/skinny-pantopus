// ============================================================
// JOB: Expire Listing Offers
// Expires pending listing offers whose expires_at has passed.
// Runs every 15 minutes.
// ============================================================

const logger = require('../utils/logger');
const listingOfferService = require('../services/marketplace/listingOfferService');

async function expireOffers() {
  try {
    const { expiredCount } = await listingOfferService.expireStaleOffers();
    if (expiredCount > 0) {
      logger.info('[expireOffers] Expired stale listing offers', { count: expiredCount });
    }
  } catch (err) {
    logger.error('[expireOffers] Failed to expire stale offers', {
      error: err.message,
      stack: err.stack,
    });
  }
}

module.exports = expireOffers;
