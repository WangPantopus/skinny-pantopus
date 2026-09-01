/**
 * Runtime resolution for address-verification rollout flags.
 *
 * CRIT-06: Pantopus ships an admin-flippable, cache-invalidating, audit-logged
 * feature-flag service (services/featureFlagService.js, exposed through
 * POST /admin/feature-flags/:flagName). The address-verification enforcement
 * flags — the ones deciding whether businesses are rejected, whether step-up is
 * required, whether the shadow providers enforce — were invisible to it. They
 * were read from process.env once at module load and frozen into a plain object,
 * so the only way to change enforcement posture was an environment change plus a
 * full redeploy, with no gradual ramp, no instant rollback, and no record of who
 * changed it (audit 2026-08-22).
 *
 * This bridges the two. Reads stay SYNCHRONOUS, because the call sites are on the
 * per-request validation path: a background refresh keeps a snapshot of the
 * database values, and the env value remains the boot default and the fallback.
 *
 * Precedence: FeatureFlag row (if one exists) > environment variable > false.
 */

const addressConfig = require('../config/addressVerification');
const featureFlagService = require('../services/featureFlagService');
const logger = require('./logger');

/** camelCase rollout key -> FeatureFlag.flag_name */
const FLAG_NAMES = {
  enablePlaceProvider: 'address.enable_place_provider',
  enforcePlaceProviderBusiness: 'address.enforce_place_provider_business',
  enableSecondaryProvider: 'address.enable_secondary_provider',
  enableParcelProvider: 'address.enable_parcel_provider',
  enforceParcelProviderClassification: 'address.enforce_parcel_provider_classification',
  requireAddressIdForHomeCreate: 'address.require_address_id_for_home_create',
  enforceMixedUseStepUp: 'address.enforce_mixed_use_step_up',
  enforceLowConfidenceStepUp: 'address.enforce_low_confidence_step_up',
  enforceVerificationExpiry: 'address.enforce_verification_expiry',
};

const REFRESH_INTERVAL_MS = Number(process.env.ADDRESS_ROLLOUT_REFRESH_MS || 60_000);

/** Database overrides, keyed by rollout key. Absent key = no override. */
let overrides = Object.create(null);
let refreshTimer = null;

/**
 * Current value of a rollout flag.
 *
 * @param {keyof FLAG_NAMES} key
 * @returns {boolean}
 */
function getRolloutFlag(key) {
  if (!(key in FLAG_NAMES)) {
    // Fail closed on a typo rather than silently reporting "disabled" for a
    // flag nobody will notice is missing.
    throw new Error(`Unknown address rollout flag: ${key}`);
  }

  if (key in overrides) return overrides[key];
  return !!addressConfig.rollout[key];
}

/** Every flag's current value, for logging and the admin surface. */
function getAllRolloutFlags() {
  const out = {};
  for (const key of Object.keys(FLAG_NAMES)) out[key] = getRolloutFlag(key);
  return out;
}

/**
 * Pull the current database values into the local snapshot.
 * A flag with no row leaves the environment value in charge.
 */
async function refreshRolloutFlags() {
  const next = Object.create(null);

  for (const [key, flagName] of Object.entries(FLAG_NAMES)) {
    try {
      const flag = await featureFlagService.getFlag(flagName);
      if (flag) next[key] = !!flag.enabled_globally;
    } catch (err) {
      // Leave this flag to its environment default rather than flipping
      // enforcement because a lookup failed.
      logger.warn('addressRolloutFlags: refresh failed for flag', {
        flagName, error: err.message,
      });
    }
  }

  overrides = next;
  return getAllRolloutFlags();
}

/** Begin periodic refresh. Safe to call more than once. */
function startRolloutFlagRefresh(intervalMs = REFRESH_INTERVAL_MS) {
  if (refreshTimer) return refreshTimer;

  refreshRolloutFlags().catch((err) => {
    logger.warn('addressRolloutFlags: initial refresh failed', { error: err.message });
  });

  refreshTimer = setInterval(() => {
    refreshRolloutFlags().catch((err) => {
      logger.warn('addressRolloutFlags: refresh failed', { error: err.message });
    });
  }, intervalMs);

  // Never hold the process open for this.
  if (typeof refreshTimer.unref === 'function') refreshTimer.unref();

  return refreshTimer;
}

function stopRolloutFlagRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

module.exports = {
  getRolloutFlag,
  getAllRolloutFlags,
  refreshRolloutFlags,
  startRolloutFlagRefresh,
  stopRolloutFlagRefresh,
  FLAG_NAMES,
  // Test seam.
  __setOverrides: (next) => { overrides = next || Object.create(null); },
};
