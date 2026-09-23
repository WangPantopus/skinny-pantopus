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

/**
 * M01: which of a Home's letters a member may see.
 *
 * Membership alone used to be enough: any member read every letter on the
 * Home, including one addressed to another member or marked for their
 * attention only. The rule below is the one the Home dashboard badge already
 * applied (homeDashboardService.unreadMailQuery). The badge, the mailbox lists,
 * the per-item gate and the Home drawers all build their filters from it, so a
 * letter a member can open is the letter their badge counts.
 *   - A letter addressed or targeted to a person is that person's.
 *   - delivery_visibility attn_only / attn_plus_admins: the attn user only.
 *   - A letter with no personal recipient follows its delivery_visibility:
 *     home_members or unset means the household. v1 letters sent to a Home keep
 *     the column default privacy 'private_to_person', so privacy alone cannot
 *     decide them.
 *   - Otherwise privacy 'shared_household' means the household.
 * The owner is a member like any other here. business_team mail (the Business
 * drawer) is exempt only from the privacy clause: who a letter is addressed to
 * and who it is for still apply, so an attn_only letter filed into Business
 * stays with its attention person. The badge does not count business_team mail.
 *
 * Each clause is the body of one PostgREST or(); the clauses are ANDed.
 * homeId and userId are UUIDs from the caller's own occupancy and session.
 */
function homeMailVisibilityClauses(homeId, userId) {
  const household = 'or(delivery_visibility.is.null,delivery_visibility.eq.home_members)';
  return [
    ...[['delivery_target_type', 'delivery_target_id'], ['recipient_type', 'recipient_id']].map(([type, id]) => (
      `${type}.is.null,and(${type}.eq.home,${id}.eq.${homeId}),and(${type}.eq.user,${id}.eq.${userId})`)),
    `recipient_user_id.is.null,recipient_user_id.eq.${userId}`,
    `attn_user_id.is.null,attn_user_id.eq.${userId},and(recipient_user_id.is.null,${household})`,
    `delivery_visibility.is.null,delivery_visibility.eq.home_members,and(delivery_visibility.in.(attn_only,attn_plus_admins),attn_user_id.eq.${userId})`,
    `privacy.eq.shared_household,recipient_user_id.eq.${userId},attn_user_id.eq.${userId},and(privacy.eq.private_to_person,recipient_user_id.is.null)`,
  ];
}

/** The rule for one Home's letters, as the body of a PostgREST or(). */
function homeMailFilter(homeId, userId) {
  const clauses = homeMailVisibilityClauses(homeId, userId);
  const privacy = clauses.pop();
  clauses.push(`privacy.eq.business_team,${privacy}`);
  return `and(${clauses.map((clause) => `or(${clause})`).join(',')})`;
}

/** Letters on these Homes the member may see, as the body of an or(). */
function homesMailFilter(homeIds, userId) {
  return homeIds.map((homeId) => `and(recipient_home_id.eq.${homeId},or(${homeMailFilter(homeId, userId)}))`).join(',');
}

/** The caller's own mail, or letters on these Homes they may see. */
function visibleMailFilter(userId, homeIds) {
  const own = `recipient_user_id.eq.${userId}`;
  return homeIds && homeIds.length ? `${own},${homesMailFilter(homeIds, userId)}` : own;
}

/**
 * Of these mail ids, the ones the user may see: their own, or letters on
 * their accessible Homes that the Home rule shows them. Throws on a read
 * failure so each caller keeps its own failure semantics.
 */
async function visibleMailIds(mailIds, userId, homeIds = null) {
  const ids = [...new Set((mailIds || []).filter(Boolean))];
  if (!ids.length || !userId) return new Set();
  const homes = homeIds || await getAccessibleHomeIds(userId);
  const { data, error } = await supabaseAdmin
    .from('Mail')
    .select('id')
    .in('id', ids)
    .or(visibleMailFilter(userId, homes));
  if (error) throw new Error(error.message);
  return new Set((data || []).map((row) => row.id));
}

/** Whether the Home rule shows this Home letter to the member. Fails closed. */
async function homeMailVisible(mailId, homeId, userId) {
  if (!mailId || !homeId || !userId) return false;
  const { data, error } = await supabaseAdmin
    .from('Mail')
    .select('id')
    .eq('id', mailId)
    .eq('recipient_home_id', homeId)
    .or(homeMailFilter(homeId, userId))
    .maybeSingle();
  if (error) {
    logger.error('homeMailVisible: failing closed', { mailId, error: error.message });
    return false;
  }
  return Boolean(data);
}

// CRIT-03, per-item half. The list-scoping helper on this file was consolidated
// into utils/homeMailAccess, but this gate — which guards the eight per-item
// routes (GET/PATCH/DELETE of an individual mail) — kept its own query, and that
// query matched ANY HomeOccupancy row for the home: no is_active filter and no
// verification_status filter. Both leave paths soft-deactivate rather than
// delete the row, so a roommate who properly moved out kept read, mutate and
// delete access to the household's individual mail on exactly the surface
// CRIT-03 named. One definition now, shared with the list path.
// (Moved from routes/mailbox.js so the v2 per-item routes share it.) A Home
// letter also has to pass the Home mail rule above (M01); callers pass the
// mail's id with its recipient fields.
const canAccessMail = async (mail, userId) => {
  if (mail.recipient_user_id === userId) return true;
  if (!mail.recipient_home_id) return false;

  const accessibleHomeIds = await getAccessibleHomeIds(userId);
  if (!accessibleHomeIds.includes(mail.recipient_home_id)) return false;
  return homeMailVisible(mail.id, mail.recipient_home_id, userId);
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
  homeMailVisibilityClauses, homeMailFilter, homesMailFilter, visibleMailFilter, visibleMailIds,
};
