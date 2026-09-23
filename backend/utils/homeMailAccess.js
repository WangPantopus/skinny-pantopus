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
  try {
    return await trustedHomeIdsOrThrow(userId);
  } catch (error) {
    logger.error('getAccessibleHomeIds: failing closed', { userId, error: error.message });
    return [];
  }
}

/**
 * The hardened query itself: active occupancies in a trusted, unexpired
 * verification state. THROWS on a read failure so callers can choose their
 * own failure semantics — `getAccessibleHomeIds` fails closed to [], while
 * Mail Day's service returns null to keep "no homes" distinct from "the read
 * broke" (the invisible-failure bug that once killed Mail Day).
 */
async function trustedHomeIdsOrThrow(userId) {
  if (!userId) return [];

  const { data, error } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id, verification_status, verified_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('verification_status', MAIL_TRUSTED_VERIFICATION_STATUSES);

  if (error) throw new Error(error.message);

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

// CRIT-03, per-item half. The list-scoping helper on this file was consolidated
// into utils/homeMailAccess, but this gate — which guards the eight per-item
// routes (GET/PATCH/DELETE of an individual mail) — kept its own query, and that
// query matched ANY HomeOccupancy row for the home: no is_active filter and no
// verification_status filter. Both leave paths soft-deactivate rather than
// delete the row, so a roommate who properly moved out kept read, mutate and
// delete access to the household's individual mail on exactly the surface
// CRIT-03 named. One definition now, shared with the list path.
// (Moved unchanged from routes/mailbox.js so the v2 per-item routes share it.)
const canAccessMail = async (mail, userId) => {
  if (mail.recipient_user_id === userId) return true;
  if (!mail.recipient_home_id) return false;

  const accessibleHomeIds = await getAccessibleHomeIds(userId);
  return accessibleHomeIds.includes(mail.recipient_home_id);
};

/**
 * Load one mail's access fields and apply canAccessMail. Returns the row
 * (id, recipient_user_id, recipient_home_id) when the caller may read it,
 * otherwise null — callers answer their existing not-found.
 */
async function readableMail(mailId, userId) {
  if (!mailId || !userId) return null;
  const { data: mail, error } = await supabaseAdmin
    .from('Mail')
    .select('id, recipient_user_id, recipient_home_id')
    .eq('id', mailId)
    .maybeSingle();
  if (error || !mail) return null;
  return (await canAccessMail(mail, userId)) ? mail : null;
}

module.exports = { getAccessibleHomeIds, trustedHomeIdsOrThrow, canAccessMail, readableMail,
};
