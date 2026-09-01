const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const homeClaimRoutingService = require('../services/homeClaimRoutingService');

async function expireInitiatedHomeClaims(options = {}) {
  const {
    dryRun = false,
    now = new Date().toISOString(),
    limit = 200,
  } = options;

  const { data: candidateClaims, error } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id, home_id, claim_phase_v2, terminal_reason, expires_at')
    .eq('claim_phase_v2', 'initiated')
    .not('expires_at', 'is', null)
    .lt('expires_at', now)
    .limit(limit);

  if (error) {
    logger.error('[expireInitiatedHomeClaims] Failed to query candidate claims', { error: error.message });
    throw error;
  }

  const claims = candidateClaims || [];
  if (claims.length === 0) {
    logger.info('[expireInitiatedHomeClaims] No initiated claims to expire', { dry_run: dryRun });
    return { scanned: 0, expired: 0, reconciled_homes: 0, dry_run: dryRun };
  }

  let expired = 0;
  const affectedHomeIds = new Set();

  for (const claim of claims) {
    if (dryRun) {
      affectedHomeIds.add(claim.home_id);
      expired++;
      continue;
    }

    const { error: updateError } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .update({
        state: 'revoked',
        claim_phase_v2: 'expired',
        terminal_reason: 'expired_no_evidence',
        updated_at: now,
      })
      .eq('id', claim.id)
      .eq('claim_phase_v2', 'initiated');

    if (updateError) {
      logger.error('[expireInitiatedHomeClaims] Failed to expire claim', {
        error: updateError.message,
        claimId: claim.id,
      });
      continue;
    }

    affectedHomeIds.add(claim.home_id);
    expired++;
  }

  let reconciledHomes = 0;
  for (const homeId of affectedHomeIds) {
    if (dryRun) {
      reconciledHomes++;
      continue;
    }

    await homeClaimRoutingService.recalculateHomeResolutionState(homeId);
    reconciledHomes++;
  }

  const summary = {
    scanned: claims.length,
    expired,
    reconciled_homes: reconciledHomes,
    dry_run: dryRun,
  };

  logger.info('[expireInitiatedHomeClaims] Completed', summary);
  return summary;
}

module.exports = expireInitiatedHomeClaims;
