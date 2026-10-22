/**
 * Business Entity Service
 *
 * Handles entity-type-specific logic: fee overrides, attributes,
 * and type-change side effects.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const {
  ENTITY_TYPE_CONFIG,
  REDUCED_FEE_BELOW_PCT,
  REDUCED_FEE_TYPES,
  FOUNDING_FEE_CAP_PCT,
  NONPROFIT_EVIDENCE_TYPES,
  PANTOPUS_VERIFIED_STATUSES,
} = require('../utils/businessConstants');
const { writeAuditLog } = require('../utils/businessPermissions');

const DEFAULT_PLATFORM_FEE_PCT = 15;

/** Whether a business still has its founding offer's 10% cap (it lasts 12 months from the claim). */
function hasFoundingCap(profile) {
  if (!profile?.founding_badge) return false;
  return !profile.founding_benefit_expires_at || new Date(profile.founding_benefit_expires_at) > new Date();
}

/**
 * Whether Pantopus has verified this business as the type that earns its reduced rate (under 10%): a reviewer
 * approved its documents, it is still a reduced-rate type, and a nonprofit's 501(c)(3) proof was approved. The owner
 * sets the type and the profile's attributes, so neither counts on its own.
 *
 * @param {string} businessUserId
 * @param {{ business_type: string, verification_status: string }} profile
 * @returns {Promise<boolean>}
 */
async function reducedFeeVerified(businessUserId, profile) {
  if (!REDUCED_FEE_TYPES.has(profile?.business_type)) return false;
  if (!PANTOPUS_VERIFIED_STATUSES.has(profile.verification_status)) return false;
  if (profile.business_type !== 'nonprofit_501c3') return true;
  const { data, error } = await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .select('id')
    .eq('business_user_id', businessUserId)
    .in('evidence_type', NONPROFIT_EVIDENCE_TYPES)
    .eq('status', 'approved')
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

/**
 * The reduced rate approving a document gives a business of this type, or null when it gives none: a nonprofit's
 * rate needs its 501(c)(3) proof, which takes it to 0%.
 */
function feeOnApproval(businessType, evidenceType) {
  if (!REDUCED_FEE_TYPES.has(businessType)) return null;
  if (businessType === 'nonprofit_501c3') return NONPROFIT_EVIDENCE_TYPES.includes(evidenceType) ? 0 : null;
  return ENTITY_TYPE_CONFIG[businessType].defaultFeePct;
}

/**
 * Pantopus approved one of this business's documents, as the type it has now: a type that earns a reduced rate gets
 * it. A later type change takes it away again (settleFeeOnTypeChange).
 *
 * @returns {Promise<number|null>} the rate set, or null when the approval gives none
 */
async function grantVerifiedTypeFee(businessUserId, evidenceType, actorUserId) {
  const { data: profile, error } = await supabaseAdmin
    .from('BusinessProfile')
    .select('business_type')
    .eq('business_user_id', businessUserId)
    .maybeSingle();
  if (error) throw error;
  const feePct = feeOnApproval(profile?.business_type, evidenceType);
  if (feePct === null) return null;
  const written = await setEntityFeeOverride(businessUserId, feePct, { actorUserId, force: true });
  if (!written) throw new Error('Could not set the verified type fee');
  return feePct;
}

/**
 * The owner changed the business's type. A reduced rate comes only from Pantopus verifying the business as a type
 * that earns one (grantVerifiedTypeFee), so a type change neither writes one nor keeps the one the business had: that
 * check was for the old type. The new type's own rate applies (the standard rate for a reduced-rate type, until
 * Pantopus verifies it), capped by a founding offer. A rate of 10% or more set by an admin or the founding offer stays.
 */
async function settleFeeOnTypeChange(businessUserId, config, actorUserId) {
  const { data: profile, error } = await supabaseAdmin
    .from('BusinessProfile')
    .select('fee_override_pct, founding_badge, founding_benefit_expires_at')
    .eq('business_user_id', businessUserId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return;
  const stored = profile.fee_override_pct;
  if (stored !== null && stored !== undefined && Number(stored) >= REDUCED_FEE_BELOW_PCT) return;
  let feePct = config.defaultFeePct < REDUCED_FEE_BELOW_PCT ? DEFAULT_PLATFORM_FEE_PCT : config.defaultFeePct;
  if (hasFoundingCap(profile)) feePct = Math.min(feePct, FOUNDING_FEE_CAP_PCT);
  await setEntityFeeOverride(businessUserId, feePct, { actorUserId, force: true });
}

/**
 * Set the fee_override_pct on BusinessProfile based on entity type config.
 * Only writes if the entity type's default fee differs from the platform default (15%).
 * Does NOT overwrite an existing admin-set override unless force=true.
 *
 * @param {string} businessUserId
 * @param {number} feePct - The fee percentage to set
 * @param {object} opts
 * @param {string} [opts.actorUserId] - Who triggered this (for audit)
 * @param {boolean} [opts.force] - If true, overwrite even if admin override exists
 */
async function setEntityFeeOverride(businessUserId, feePct, opts = {}) {
  const { actorUserId, force = false } = opts;

  try {
    if (!force) {
      // Check if an admin has manually set an override — don't overwrite it
      const { data: profile } = await supabaseAdmin
        .from('BusinessProfile')
        .select('fee_override_pct')
        .eq('business_user_id', businessUserId)
        .maybeSingle();

      if (profile && profile.fee_override_pct !== null) {
        logger.debug('setEntityFeeOverride: skipping — admin override exists', {
          businessUserId,
          existingOverride: profile.fee_override_pct,
          requestedFee: feePct,
        });
        return false;
      }
    }

    // If fee matches platform default, set to NULL (use default)
    const valueToSet = feePct === DEFAULT_PLATFORM_FEE_PCT ? null : feePct;

    const { error } = await supabaseAdmin
      .from('BusinessProfile')
      .update({
        fee_override_pct: valueToSet,
        updated_at: new Date().toISOString(),
      })
      .eq('business_user_id', businessUserId);

    if (error) {
      logger.error('setEntityFeeOverride: update failed', {
        businessUserId, feePct, error: error.message,
      });
      return false;
    }

    if (actorUserId) {
      await writeAuditLog(businessUserId, actorUserId, 'entity_fee_set', 'BusinessProfile', businessUserId, {
        fee_override_pct: valueToSet,
        entity_default_fee_pct: feePct,
      });
    }

    return true;
  } catch (err) {
    logger.error('setEntityFeeOverride: unexpected error', {
      businessUserId, error: err.message,
    });
    return false;
  }
}

/**
 * Apply entity-type-specific side effects after business creation or type change.
 *
 * - Sets fee_override_pct based on entity type config (a reduced rate applies only once Pantopus has verified the
 *   type; see reducedFeeVerified)
 * - For nonprofit_501c3: sets awaiting_nonprofit_verification attribute
 *
 * @param {string} businessUserId
 * @param {string} entityType - The entity type key
 * @param {object} opts
 * @param {string} [opts.actorUserId]
 * @param {boolean} [opts.isTypeChange] - True if changing from one type to another
 */
async function applyEntityTypeSideEffects(businessUserId, entityType, opts = {}) {
  const { actorUserId, isTypeChange = false } = opts;
  const config = ENTITY_TYPE_CONFIG[entityType];

  if (!config) {
    logger.warn('applyEntityTypeSideEffects: unknown entity type', { businessUserId, entityType });
    return;
  }

  if (isTypeChange) {
    await settleFeeOnTypeChange(businessUserId, config, actorUserId);
  } else {
    // On creation, always set
    await setEntityFeeOverride(businessUserId, config.defaultFeePct, { actorUserId, force: true });
  }

  // Nonprofit-specific: set pending verification flag
  if (entityType === 'nonprofit_501c3') {
    try {
      const { data: profile } = await supabaseAdmin
        .from('BusinessProfile')
        .select('attributes')
        .eq('business_user_id', businessUserId)
        .maybeSingle();

      const attrs = profile?.attributes || {};
      attrs.awaiting_nonprofit_verification = true;

      await supabaseAdmin
        .from('BusinessProfile')
        .update({ attributes: attrs, updated_at: new Date().toISOString() })
        .eq('business_user_id', businessUserId);
    } catch (err) {
      logger.error('applyEntityTypeSideEffects: failed to set nonprofit flag', {
        businessUserId, error: err.message,
      });
    }
  }
}

module.exports = {
  setEntityFeeOverride,
  applyEntityTypeSideEffects,
  hasFoundingCap,
  reducedFeeVerified,
  feeOnApproval,
  grantVerifiedTypeFee,
};
