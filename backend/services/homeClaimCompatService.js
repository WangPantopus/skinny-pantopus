const logger = require('../utils/logger');
const supabaseAdmin = require('../config/supabaseAdmin');
const householdClaimConfig = require('../config/householdClaims');
const homeClaimRoutingService = require('./homeClaimRoutingService');

const INITIATED_CLAIM_EXPIRY_DAYS = 7;

function deriveInitialClaimExpiresAt(legacyState, now = new Date()) {
  const claimPhaseV2 = homeClaimRoutingService.mapLegacyStateToPhaseV2(legacyState);
  if (claimPhaseV2 !== 'initiated') {
    return null;
  }

  return new Date(
    now.getTime() + INITIATED_CLAIM_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

async function buildInitialClaimCompatibilityFields({
  homeId,
  userId,
  claimType,
  method,
  legacyState,
  routingClassification = null,
}) {
  let classification = routingClassification;
  if (!classification) {
    try {
      classification = (await homeClaimRoutingService.classifySubmission({
        homeId,
        userId,
        claimType,
        method,
      })).routingClassification;
    } catch (error) {
      logger.warn('household_claim.initial_classification_failed', {
        home_id: homeId,
        claimant_user_id: userId,
        claim_type: claimType,
        method,
        error: error.message,
      });
      classification = 'standalone_claim';
    }
  }

  const claimPhaseV2 = homeClaimRoutingService.mapLegacyStateToPhaseV2(legacyState);

  return {
    claim_phase_v2: claimPhaseV2,
    routing_classification: classification,
    identity_status: homeClaimRoutingService.deriveInitialIdentityStatus({ method }),
    terminal_reason: 'none',
    challenge_state: legacyState === 'disputed' ? 'challenged' : 'none',
    expires_at: deriveInitialClaimExpiresAt(legacyState),
  };
}

async function updateClaimCompatibilityFields({
  claimId,
  legacyState,
  claimPhaseV2 = null,
  terminalReason = 'none',
  challengeState = 'none',
  syncClaimStrength = false,
}) {
  const updates = {
    claim_phase_v2: claimPhaseV2 || homeClaimRoutingService.mapLegacyStateToPhaseV2(legacyState),
    terminal_reason: terminalReason,
    challenge_state: challengeState,
    updated_at: new Date().toISOString(),
  };

  if (syncClaimStrength) {
    updates.claim_strength = await homeClaimRoutingService.deriveClaimStrength(claimId);
  }

  const { error } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .update(updates)
    .eq('id', claimId);

  if (error) throw error;

  return updates;
}

async function recalculateHouseholdResolutionState(homeId) {
  return homeClaimRoutingService.recalculateHomeResolutionState(homeId);
}

function logClaimSubmissionDecision({
  source,
  homeId,
  userId,
  claimType,
  method,
  allowed,
  blockCode = null,
  routingClassification = null,
  reasonCount = 0,
}) {
  logger.info('household_claim.submission_decision', {
    source,
    home_id: homeId,
    claimant_user_id: userId,
    claim_type: claimType,
    method,
    allowed,
    block_code: blockCode,
    routing_classification: routingClassification,
    reason_count: reasonCount,
    flags: householdClaimConfig.flags,
  });
}

module.exports = {
  buildInitialClaimCompatibilityFields,
  deriveInitialClaimExpiresAt,
  updateClaimCompatibilityFields,
  recalculateHouseholdResolutionState,
  logClaimSubmissionDecision,
};
