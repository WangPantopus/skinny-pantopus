// Fair bounded discovery is independent from durable notification retries.
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const gigExpiry = require('../services/gigAuthorizationExpiry');
async function reconcileGigAuthorizationExpiry() {
  let checked = 0;
  for (let batch = 0; batch < 10; batch += 1) {
    const { data, error } = await supabaseAdmin.rpc('claim_gig_expiry_scan', { p_limit: 100 });
    if (error || !Array.isArray(data)) throw new Error('Expiry candidate discovery unavailable');
    if (data.length === 0) break;
    for (const paymentId of data) {
      try { await gigExpiry.recover(paymentId); }
      catch (error) { logger.warn('Gig authorization expiry requires reconciliation', { paymentId, code: error.code || 'EXPIRY_UNKNOWN' }); }
      checked += 1;
    }
    if (data.length < 100) break;
  }
  // Bounded fair discovery rotates failed and unknown reads on subsequent runs.
  if (checked === 1000) logger.warn('Gig authorization expiry scan reached its capacity limit', { checked });
  return { checked };
}
module.exports = reconcileGigAuthorizationExpiry;
