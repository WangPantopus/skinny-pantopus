/**
 * Home Privacy Service
 *
 * Single source of truth for the per-home privacy toggle set (the 9
 * consumer toggles backing the "Security" screen, migration 153):
 * key list and defaults shared by GET/PATCH /api/homes/:id/privacy,
 * plus a checked read for GET and features that must honor the toggles
 * when composing a response (placeIntelligenceService
 * consumes `address_precision` today; the documents/identity surfaces
 * consume `doc_lock` as they land).
 *
 * A successfully read missing row resolves to the defaults. Read failures
 * propagate so consumers cannot replace saved restrictive preferences with
 * a more permissive "balanced setup" baseline when privacy is unknown.
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

/** Project a HomePrivacy row (or null) into the toggle set, defaults applied. */
function resolveToggles(row) {
  const toggles = {};
  for (const key of TOGGLE_KEYS) {
    toggles[key] = row && typeof row[key] === 'boolean' ? row[key] : DEFAULTS[key];
  }
  return toggles;
}

/**
 * Read the effective privacy toggle set for a home. Throws on read failure.
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

    if (error) throw error;
    return resolveToggles(row);
  } catch (err) {
    logger.warn('homePrivacy: current settings unavailable', { homeId, error: err.message });
    throw err;
  }
}

module.exports = {
  TOGGLE_KEYS,
  DEFAULTS,
  resolveToggles,
  getHomePrivacy,
};
