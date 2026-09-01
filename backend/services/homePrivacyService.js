/**
 * Home Privacy Service
 *
 * Single source of truth for the per-home privacy toggle set (the 9
 * consumer toggles backing the "Security" screen, migration 153):
 * key list, defaults, and a resilient read used by BOTH the
 * GET/PATCH /api/homes/:id/privacy routes and any feature that must
 * honor the toggles when composing a response (placeIntelligenceService
 * consumes `address_precision` today; the documents/identity surfaces
 * consume `doc_lock` as they land).
 *
 * Reads NEVER throw: a missing row — or a database that does not have
 * the HomePrivacy table yet (migration not applied) — resolves to the
 * defaults, so consumers degrade to the design's "balanced setup"
 * baseline instead of failing.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// The 9 toggles, in design order. Each column is the snake_case of the
// camelCase row id the clients send — kept in lockstep with the iOS
// `HomeSecurityViewModel.Toggles` and Android `HomeSecurityToggles`.
const TOGGLE_KEYS = [
  // Access control
  'guest_approval',
  'member_name_visibility',
  'address_precision',
  // Privacy
  'activity_visibility',
  'map_opt_out',
  'notification_previews',
  // Documents
  'doc_lock',
  'photo_blur',
  'vault_auto_lock',
];

// Defaults mirror the design's "balanced setup" baseline (5/9 on) and the
// column DEFAULTs in migration 153, so a home with no row yet reads the
// same calm state the Security screen ships with.
const DEFAULTS = {
  guest_approval: true,
  member_name_visibility: true,
  address_precision: false,
  activity_visibility: true,
  map_opt_out: false,
  notification_previews: true,
  doc_lock: true,
  photo_blur: false,
  vault_auto_lock: false,
};

// Log the missing-table condition once per process, not once per request.
let warnedMissingTable = false;

/** Project a HomePrivacy row (or null) into the toggle set, defaults applied. */
function resolveToggles(row) {
  const toggles = {};
  for (const key of TOGGLE_KEYS) {
    toggles[key] = row && typeof row[key] === 'boolean' ? row[key] : DEFAULTS[key];
  }
  return toggles;
}

/**
 * Read the effective privacy toggle set for a home. Never throws.
 *
 * @param {string} homeId
 * @returns {Promise<object>} `{ [toggle]: boolean }` for all 9 keys.
 */
async function getHomePrivacy(homeId) {
  try {
    const { data: row, error } = await supabaseAdmin
      .from('HomePrivacy')
      .select('*')
      .eq('home_id', homeId)
      .maybeSingle();

    if (error) {
      if (!warnedMissingTable) {
        warnedMissingTable = true;
        logger.warn('homePrivacy: read failed — serving defaults (is migration 153 applied?)', {
          homeId,
          error: error.message,
        });
      }
      return { ...DEFAULTS };
    }
    return resolveToggles(row);
  } catch (err) {
    logger.warn('homePrivacy: read threw — serving defaults', { homeId, error: err.message });
    return { ...DEFAULTS };
  }
}

module.exports = {
  TOGGLE_KEYS,
  DEFAULTS,
  resolveToggles,
  getHomePrivacy,
};
