/**
 * Business Entity Service
 *
 * Handles entity-type-specific logic: fee overrides, attributes,
 * and type-change side effects.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { ENTITY_TYPE_CONFIG } = require('../utils/businessConstants');
const { writeAuditLog } = require('../utils/businessPermissions');

const DEFAULT_PLATFORM_FEE_PCT = 15;

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
 * - Sets fee_override_pct based on entity type config
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

  // Set fee override based on entity type default
  await setEntityFeeOverride(businessUserId, config.defaultFeePct, {
    actorUserId,
    force: !isTypeChange, // On creation, always set; on type change, respect admin overrides
  });

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
};
