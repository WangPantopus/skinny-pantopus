// ============================================================
// JOB: Auth registry housekeeping (persistent login)
// Deletes expired DPoP jti replay-cache rows and step-up / attestation
// challenges (AuthDpopJti / AuthChallenge). Both tables only matter until
// `expires_at`; the tables have an index on it. Runs hourly.
// ============================================================

const logger = require('../utils/logger');
const authSessionService = require('../services/authSessionService');

async function authRegistryPrune() {
  try {
    const { dpopJti, challenges } = await authSessionService.pruneExpiredAuthRows();
    if (dpopJti > 0 || challenges > 0) {
      logger.info('[authRegistryPrune] Pruned expired auth rows', { dpopJti, challenges });
    }
  } catch (err) {
    logger.error('[authRegistryPrune] Failed', { error: err.message, stack: err.stack });
  }
}

module.exports = authRegistryPrune;
