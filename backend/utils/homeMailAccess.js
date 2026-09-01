/**
 * Household mail access scoping.
 *
 * This is the sole authorization gate for the physical-mail routes — the one
 * surface where a verified address produces continuous, high-sensitivity
 * third-party data (who writes to this household: scanned envelopes, sender
 * identities, package notifications).
 *
 * It used to be duplicated verbatim in five route files. Four filtered
 * `is_active = true`; the copy in routes/mailbox.js did not, and additionally
 * admitted any `Home.owner_id` match, so a roommate who had properly moved out
 * kept reading the household's mail indefinitely on that surface while
 * correctly losing it on the other four (audit 2026-08-22, CRIT-03).
 *
 * One definition, one behaviour. Do not inline a copy of this.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('./logger');

/**
 * Occupancy verification states that may read the household's physical mail.
 *
 * `is_active` alone is not enough: applyOccupancyTemplate writes
 * `is_active: true` for `pending_approval` and `pending_postcard` rows, and
 * POST /api/homes/:id/claim creates one of those for any authenticated caller
 * on any home id (which POST /api/homes/check-address hands out). Filtering
 * only on is_active therefore let an unapproved stranger read a household's
 * scanned envelopes and sender identities the moment they filed a claim —
 * while the claim route's own contract says "mailbox and private home surfaces
 * remain locked until verified".
 *
 * `provisional_bootstrap` is included deliberately: it is what the person who
 * created the home is given (routes/home.js), and locking them out of their own
 * mailbox would break the ordinary path. The excluded states are the ones a
 * stranger can reach unilaterally — pending_postcard, pending_doc,
 * pending_approval, unverified — plus any that mean the residency has ended.
 * Enum values: migration 065.
 */
const MAIL_TRUSTED_VERIFICATION_STATUSES = ['verified', 'provisional', 'provisional_bootstrap'];

/**
 * Home ids whose household mail this user may read.
 *
 * Requires an ACTIVE occupancy in a trusted verification state. Fails closed:
 * on a lookup error the user is scoped to nothing rather than to everything.
 *
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function getAccessibleHomeIds(userId) {
  if (!userId) return [];

  const { data, error } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id, verification_status, verified_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('verification_status', MAIL_TRUSTED_VERIFICATION_STATUSES);

  if (error) {
    logger.error('getAccessibleHomeIds: failing closed', { userId, error: error.message });
    return [];
  }

  // Expiry (behind address.enforce_verification_expiry): a 'verified' row past
  // its validity window loses this surface until re-verified — mail is the
  // continuous, high-sensitivity read that a years-old verification should not
  // keep open. Only 'verified' rows are age-checked: the provisional states
  // are pre-verification and have no verification to age, and rows with no
  // verified_at predate the column and are never demoted.
  // eslint-disable-next-line global-require
  const verificationAge = require('./verificationAge');
  const trusted = (data || []).filter((r) => (
    r.verification_status !== 'verified' || !verificationAge.staleAffectsTrust(r.verified_at)
  ));

  return [...new Set(trusted.map((r) => r.home_id).filter(Boolean))];
}

module.exports = { getAccessibleHomeIds };
