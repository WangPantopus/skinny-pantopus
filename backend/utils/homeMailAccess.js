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
const { localDisplayNames } = require('./identityProfiles');
const { currentOccupancy, resolveHomeRole, NON_RESIDENT_ROLES, UNPROVEN_SOURCES } = require('./homeAccessPolicy');

// The member who deleted or dismissed a Home letter, by the name they show their household (their Local Profile's),
// or null when they have none or it can't be read.
async function householdName(userId) {
  if (!userId) return null;
  const names = await localDisplayNames([userId]).catch(() => new Map());
  return names.get(String(userId)) || null;
}

/**
 * Occupancy verification states that count as belonging to the household
 * (householdHomeIds), for the features that need membership but not proof:
 * the posts visitor check, the map's own-homes layer, Support Train delivery
 * homes and trust state. Mail needs more (MAIL_PROVEN_SOURCES below).
 *
 * `is_active` alone is not enough: applyOccupancyTemplate writes
 * `is_active: true` for `pending_approval` and `pending_postcard` rows, and
 * POST /api/homes/:id/claim creates one of those for any authenticated caller
 * on any home id (which POST /api/homes/check-address hands out). Filtering
 * only on is_active therefore let an unapproved stranger in the moment they
 * filed a claim.
 *
 * `provisional_bootstrap` is what the person who created the home is given
 * (routes/home.js). The excluded states are the ones a stranger can reach
 * unilaterally — pending_postcard, pending_doc, pending_approval, unverified —
 * plus any that mean the residency has ended. Enum values: migration 065.
 */
const MAIL_TRUSTED_VERIFICATION_STATUSES = ['verified', 'provisional', 'provisional_bootstrap'];

/**
 * Home mail opens only once the address is proven (founder decision D1,
 * 2026-10-27: "they cannot get until proven"). A reader's occupancy is
 * 'verified', and its trust rests on proof of the address (a postcard code, an
 * approved document, a landlord, an ID check, legacy verification) or on the
 * household's consent ('household': an invitation or an approval from someone
 * whose own access isn't a claim; act_on_home_invitation passes a claimer's
 * invitation on as 'claim'). Never a claim (an instant claim, or anyone a
 * claimer let in), never probation, never a provisional state. Mail that comes
 * meanwhile waits in the Home box and is there once they prove the address.
 */
const MAIL_PROVEN_SOURCES = ['address', 'legacy', 'household'];

/**
 * Home ids whose household mail this user may read: an ACTIVE, proven, unexpired
 * occupancy held by a resident (not a guest or service provider) inside their
 * access window. Fails closed: on a lookup error the user is scoped to nothing
 * rather than to everything.
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
 * The hardened query itself: the Homes whose mail this user may read now.
 * THROWS on a read failure so callers can choose their own failure semantics
 * — `getAccessibleHomeIds` fails closed to [], while Mail Day's service
 * returns null to keep "no homes" distinct from "the read broke" (the
 * invisible-failure bug that once killed Mail Day).
 */
async function trustedHomeIdsOrThrow(userId) {
  if (!userId) return [];
  const rows = await mailReaderOccupancies('user_id', userId);
  return [...new Set(rows.map((r) => r.home_id).filter(Boolean))];
}

/**
 * The people who may read this Home's mail now: the same rule as
 * getAccessibleHomeIds, from the Home's side. Throws on a read failure.
 */
async function mailReaderIdsOrThrow(homeId) {
  if (!homeId) return [];
  const rows = await mailReaderOccupancies('home_id', homeId);
  return [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
}

/**
 * Home ids of the households this user belongs to, proven or not (the trusted
 * states above): for the features that need membership, never for mail. Fails
 * closed to [].
 */
async function householdHomeIds(userId) {
  if (!userId) return [];
  try {
    const rows = await householdOccupancies('user_id', userId);
    return [...new Set(rows.map((r) => r.home_id).filter(Boolean))];
  } catch (error) {
    logger.error('householdHomeIds: failing closed', { userId, error: error.message });
    return [];
  }
}

const OCCUPANCY_SELECT = 'home_id, user_id, role, role_base, is_active, start_at, end_at, access_start_at, access_end_at, '
  + 'verification_status, verification_source, verified_at';

// A resident (not a guest or service provider) whose access is current and, when verified, not stale.
function currentResident(r) {
  // Expiry (behind address.enforce_verification_expiry): a 'verified' row past
  // its validity window loses this surface until re-verified — mail is the
  // continuous, high-sensitivity read that a years-old verification should not
  // keep open. Only 'verified' rows are age-checked: the provisional states
  // are pre-verification and have no verification to age, and rows with no
  // verified_at predate the column and are never demoted.
  // eslint-disable-next-line global-require
  const verificationAge = require('./verificationAge');
  // Guests and service providers aren't residents (homeAccessPolicy): they never read the household's letters.
  return !NON_RESIDENT_ROLES.has(resolveHomeRole(r))
    // Access that has ended, or hasn't started yet, reads nothing (a guest pass's checkout, a move-out date).
    && currentOccupancy(r)
    && (r.verification_status !== 'verified' || !verificationAge.staleAffectsTrust(r.verified_at));
}

// One person's or one Home's household occupancies (the trusted states). Throws on a read failure.
async function householdOccupancies(column, id) {
  const { data, error } = await supabaseAdmin
    .from('HomeOccupancy')
    .select(OCCUPANCY_SELECT)
    .eq(column, id)
    .eq('is_active', true)
    .in('verification_status', MAIL_TRUSTED_VERIFICATION_STATUSES)
    // Probation (a request nobody answered, home claims PR 4) is provisional without proof.
    .neq('verification_source', 'probation');
  if (error) throw new Error(error.message);
  return (data || []).filter(currentResident);
}

// One person's or one Home's occupancies that may read household mail now (proven, D1). Throws on a read failure.
async function mailReaderOccupancies(column, id) {
  const { data, error } = await supabaseAdmin
    .from('HomeOccupancy')
    .select(`${OCCUPANCY_SELECT}, home:home_id(home_status, security_state)`)
    .eq(column, id)
    .eq('is_active', true)
    .eq('verification_status', 'verified')
    .in('verification_source', MAIL_PROVEN_SOURCES);
  if (error) throw new Error(error.message);
  return (data || []).filter((row) => availableMailHome(row.home) && currentResident(row));
}

// A proven occupancy cannot override a Home freeze, dispute, archive or merge.
function availableMailHome(home) {
  return Boolean(home) && !['archived', 'merged'].includes(home.home_status)
    && !['frozen', 'frozen_silent', 'disputed'].includes(home.security_state);
}

// States in which someone lives at a Home but hasn't proven it yet: their Home drawer stays closed with
// "Verify your home" (pending_approval waits for the household's answer, so it isn't membership yet).
const MAIL_UNPROVEN_RESIDENT_STATUSES = ['verified', 'provisional', 'provisional_bootstrap', 'pending_postcard', 'pending_doc'];

/**
 * The Homes this person lives at, each with whether its mail is open to them:
 * 'open' (proven) or 'needs_proof' (they live there but haven't proven the
 * address, or their verification went stale). Guests and service providers
 * aren't residents, so their Homes aren't listed. Throws on a read failure.
 *
 * @returns {Promise<Array<{home_id: string, address_line: string|null, name: string|null, mail_access: 'open'|'needs_proof'}>>}
 */
async function mailHomesOrThrow(userId) {
  if (!userId) return [];
  const { data, error } = await supabaseAdmin
    .from('HomeOccupancy')
    .select(`${OCCUPANCY_SELECT}, home:home_id(id, address, address2, name, home_status, security_state)`)
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('verification_status', MAIL_UNPROVEN_RESIDENT_STATUSES);
  if (error) throw new Error(error.message);
  const open = new Set(await trustedHomeIdsOrThrow(userId));
  const seen = new Set();
  const homes = [];
  for (const r of data || []) {
    if (!availableMailHome(r.home) || seen.has(r.home_id)) continue;
    // A stale verification still lives there; it needs proof again, so it is listed as needs_proof.
    if (NON_RESIDENT_ROLES.has(resolveHomeRole(r)) || !currentOccupancy(r)) continue;
    seen.add(r.home_id);
    homes.push({
      home_id: r.home_id,
      address_line: [r.home.address, r.home.address2].filter(Boolean).join(', ') || null,
      name: r.home.name || null,
      mail_access: open.has(r.home_id) ? 'open' : 'needs_proof',
    });
  }
  return homes;
}

/**
 * Whether this Home letter is closed to this person only because they haven't
 * proven the address: they live at its Home (mailHomesOrThrow says
 * needs_proof) and the Home mail rule would show it to them once they do.
 * Routes answer 403 MAIL_HOME_NEEDS_PROOF then, and their usual not-found
 * otherwise. Fails closed to false.
 */
async function homeMailNeedsProof(mail, userId) {
  if (!mail?.recipient_home_id || !userId) return false;
  try {
    const homes = await mailHomesOrThrow(userId);
    if (!homes.some((h) => h.home_id === mail.recipient_home_id && h.mail_access === 'needs_proof')) return false;
    return await homeMailVisible(mail.id, mail.recipient_home_id, userId);
  } catch (error) {
    logger.error('homeMailNeedsProof: failing closed', { mailId: mail.id, error: error.message });
    return false;
  }
}

/** The 403 a person who hasn't proven the address gets for a Home letter (D1). */
const MAIL_HOME_NEEDS_PROOF = Object.freeze({
  error: "Prove your address to open your home's mail.",
  code: 'MAIL_HOME_NEEDS_PROOF',
});

/** The 404 for a piece this person can't have: never existed, removed for good, not delivered yet, or not theirs. */
const MAIL_NOT_FOUND = Object.freeze({
  error: "This mail isn't in your mailbox. It may have been removed.",
  code: 'MAIL_NOT_FOUND',
});

/**
 * Answer a piece this person can't open: 403 MAIL_HOME_NEEDS_PROOF for a Home
 * letter they'll see once they prove the address, otherwise 404 MAIL_NOT_FOUND.
 * `mail` may be null (no such piece).
 */
async function sendMailUnavailable(res, mail, userId) {
  if (mail && await homeMailNeedsProof(mail, userId)) return res.status(403).json(MAIL_HOME_NEEDS_PROOF);
  return res.status(404).json(MAIL_NOT_FOUND);
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
 * Only pieces that are in the box by `now`: one waiting for its morning round
 * isn't there yet (SRV-1, services/mailDelivery). Every read a recipient sees
 * applies it: lists, counts, search, the Hub, Today and the assistant.
 */
function onlyDelivered(query, now = new Date()) {
  return query.lte('delivered_at', now.toISOString());
}

/**
 * Of these mail ids, the ones the user may see: their own, or letters on
 * their accessible Homes that the Home rule shows them, delivered by now.
 * Throws on a read failure so each caller keeps its own failure semantics.
 */
async function visibleMailIds(mailIds, userId, homeIds = null) {
  const ids = [...new Set((mailIds || []).filter(Boolean))];
  if (!ids.length || !userId) return new Set();
  const homes = homeIds || await getAccessibleHomeIds(userId);
  const { data, error } = await onlyDelivered(supabaseAdmin
    .from('Mail')
    .select('id')
    .in('id', ids)
    .is('deleted_at', null)
    .or(visibleMailFilter(userId, homes)));
  if (error) throw new Error(error.message);
  return new Set((data || []).map((row) => row.id));
}

/**
 * Whether the Home rule shows this Home letter to the member. Fails closed.
 * A deleted letter is hidden unless includeDeleted (restore and its notice).
 */
async function homeMailVisible(mailId, homeId, userId, { includeDeleted = false } = {}) {
  if (!mailId || !homeId || !userId) return false;
  let query = onlyDelivered(supabaseAdmin
    .from('Mail')
    .select('id')
    .eq('id', mailId)
    .eq('recipient_home_id', homeId)
    .or(homeMailFilter(homeId, userId)));
  if (!includeDeleted) query = query.is('deleted_at', null);
  const { data, error } = await query.maybeSingle();
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
const canAccessMail = async (mail, userId, { includeDeleted = false } = {}) => {
  // A deleted letter (recoverable for 30 days) is hidden from every route
  // except restore, which passes includeDeleted.
  if (!includeDeleted && await isDeletedMail(mail)) return false;
  // A piece waiting for its morning round isn't in the box yet (SRV-1).
  if (!(await isDeliveredMail(mail))) return false;
  if (mail.recipient_user_id === userId) return true;
  if (!mail.recipient_home_id) return false;

  const accessibleHomeIds = await getAccessibleHomeIds(userId);
  if (!accessibleHomeIds.includes(mail.recipient_home_id)) return false;
  return homeMailVisible(mail.id, mail.recipient_home_id, userId, { includeDeleted });
};

/**
 * Whether the letter is deleted. Callers that selected deleted_at are
 * answered from the row; otherwise it is read. Fails closed.
 */
async function isDeletedMail(mail) {
  if (mail.deleted_at !== undefined) return Boolean(mail.deleted_at);
  const { data, error } = await supabaseAdmin
    .from('Mail')
    .select('deleted_at')
    .eq('id', mail.id)
    .maybeSingle();
  if (error) {
    logger.error('isDeletedMail: failing closed', { mailId: mail.id, error: error.message });
    return true;
  }
  return !data || Boolean(data.deleted_at);
}

/**
 * Whether the piece has gone into the box (delivered_at has come). Callers that
 * selected delivered_at are answered from the row; otherwise it is read. Fails
 * closed.
 */
async function isDeliveredMail(mail, now = new Date()) {
  let deliveredAt = mail.delivered_at;
  if (deliveredAt === undefined) {
    const { data, error } = await supabaseAdmin
      .from('Mail')
      .select('delivered_at')
      .eq('id', mail.id)
      .maybeSingle();
    if (error) {
      logger.error('isDeliveredMail: failing closed', { mailId: mail.id, error: error.message });
      return false;
    }
    deliveredAt = data ? data.delivered_at : null;
  }
  return Boolean(deliveredAt) && new Date(deliveredAt).getTime() <= now.getTime();
}

/**
 * Load one mail's access fields and apply canAccessMail. Returns the row
 * (id, recipient_user_id, recipient_home_id, deleted_at, delivered_at,
 * lifecycle) when the caller may read it, otherwise null — callers answer
 * their existing not-found.
 */
async function readableMail(mailId, userId) {
  if (!mailId || !userId) return null;
  const { data: mail, error } = await supabaseAdmin
    .from('Mail')
    .select('id, recipient_user_id, recipient_home_id, deleted_at, delivered_at, lifecycle, object_id, mail_extracted')
    .eq('id', mailId)
    .maybeSingle();
  if (error || !mail) return null;
  return (await canAccessMail(mail, userId)) ? mail : null;
}

/**
 * A letter the caller may restore: one they could see before it was deleted
 * or dismissed (the same visibility rule, ignoring deletion). Returns the row
 * or null.
 */
async function restorableMail(mailId, userId) {
  if (!mailId || !userId) return null;
  const { data: mail, error } = await supabaseAdmin
    .from('Mail')
    .select('id, recipient_user_id, recipient_home_id, deleted_at, deleted_by, delivered_at, lifecycle, opened_at, viewed_at, display_title, subject')
    .eq('id', mailId)
    .maybeSingle();
  if (error || !mail) return null;
  return (await canAccessMail(mail, userId, { includeDeleted: true })) ? mail : null;
}

/**
 * The members, other than excludeUserId, who could see this Home letter before
 * it was deleted or dismissed: active, trusted occupants the Home mail rule
 * shows it to. A personal letter has no audience. Fails closed to [].
 */
async function homeMailAudience(mail, excludeUserId) {
  if (!mail || !mail.recipient_home_id) return [];
  const { data, error } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('user_id')
    .eq('home_id', mail.recipient_home_id)
    .eq('is_active', true);
  if (error) {
    logger.error('homeMailAudience: failing closed', { mailId: mail.id, error: error.message });
    return [];
  }
  const members = [...new Set((data || []).map((row) => row.user_id))]
    .filter((userId) => userId && userId !== excludeUserId);
  const audience = [];
  for (const userId of members) {
    if (await canAccessMail(mail, userId, { includeDeleted: true })) audience.push(userId);
  }
  return audience;
}

/** How long a deleted letter can be restored before the nightly purge removes it. */
const MAIL_RESTORE_DAYS = 30;

/**
 * Whether a deleted letter's days to restore it are over. The nightly purge then erases it, except a card a person sent,
 * which stays stored for its sender's Sent (jobs/mailDeletedPurge); for everyone it reached, it's gone either way.
 */
function restoreWindowOver(mail, now = new Date()) {
  return Boolean(mail?.deleted_at) && now.getTime() - Date.parse(mail.deleted_at) > MAIL_RESTORE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * What the Restore banner and notice need about a deleted or dismissed letter,
 * or null when it is neither: action, when, who (name) and until when.
 */
async function removedMailInfo(mail) {
  if (mail.deleted_at) {
    const byName = await householdName(mail.deleted_by);
    const until = new Date(new Date(mail.deleted_at).getTime() + MAIL_RESTORE_DAYS * 24 * 60 * 60 * 1000);
    return { action: 'deleted', at: mail.deleted_at, by_name: byName, restorable_until: until.toISOString() };
  }
  if (mail.lifecycle === 'shredded') {
    return { action: 'dismissed', at: null, by_name: null, restorable_until: null };
  }
  return null;
}

/**
 * Tell the other members who could see a Home letter that it was deleted or
 * dismissed ('deleted' | 'dismissed'), and that they can restore it. Push
 * follows their Home-updates setting. Non-blocking: a failed notice never
 * fails the delete or dismiss.
 */
async function sendHomeMailRemovedNotice(mail, actorId, action) {
  try {
    const userIds = await homeMailAudience(mail, actorId);
    if (!userIds.length) return;
    const [{ data: letter }, actorName] = await Promise.all([
      supabaseAdmin.from('Mail').select('display_title, subject').eq('id', mail.id).maybeSingle(),
      householdName(actorId),
    ]);
    // Loaded here rather than at the top so this access module stays free of
    // service dependencies.
    const notificationService = require('../services/notificationService');
    await notificationService.notifyHomeMailRemoved({
      userIds,
      mailId: mail.id,
      homeId: mail.recipient_home_id,
      letterTitle: letter ? (letter.display_title || letter.subject) : null,
      actorName,
      action,
      restoreDays: MAIL_RESTORE_DAYS,
    });
  } catch (err) {
    logger.warn('Home mail removal notice failed (non-blocking)', { mailId: mail.id, action, error: err.message });
  }
}

// Sending requires current address proof, not a guest pass, household invitation or ended occupancy.
const hasVerifiedSenderHome = async (userId) => {
  const [occupancyRes, ownerRes] = await Promise.allSettled([
    supabaseAdmin
      .from('HomeOccupancy')
      .select(`${OCCUPANCY_SELECT}, home:home_id(home_status, security_state)`)
      .eq('user_id', userId),
    supabaseAdmin
      .from('HomeOwner')
      .select('home_id, home:home_id(home_status, security_state)')
      .eq('subject_id', userId)
      .eq('owner_status', 'verified'),
  ]);

  // A consented co-owner can have household-only provenance too. Check that
  // same Home before using the legacy owner fallback; another address-proven
  // Home still qualifies. Failed provenance reads must not become "no row".
  if (occupancyRes.status !== 'fulfilled' || occupancyRes.value?.error
    || !Array.isArray(occupancyRes.value?.data)
    || occupancyRes.value.data.some(row => !row || typeof row.home_id !== 'string')) return false;
  const occupancies = occupancyRes.value.data;
  const householdHomes = new Set(occupancies
    .filter(row => UNPROVEN_SOURCES.has(row.verification_source)).map(row => row.home_id));
  const verifiedOwnerRows = ownerRes.status === 'fulfilled' && !ownerRes.value?.error
    && Array.isArray(ownerRes.value?.data) ? ownerRes.value.data : [];
  const proven = (row) => row.verification_status === 'verified' && currentResident(row)
    && availableMailHome(row.home) && MAIL_PROVEN_SOURCES.includes(row.verification_source)
    && !UNPROVEN_SOURCES.has(row.verification_source);
  if (occupancies.some(proven)) return true;
  for (const row of verifiedOwnerRows) {
    if (!row || typeof row.home_id !== 'string' || !availableMailHome(row.home) || householdHomes.has(row.home_id)) continue;
    // The collection can be truncated by PostgREST's max_rows. Only an exact
    // Home/user lookup can distinguish no occupancy from an omitted row.
    try {
      const result = await supabaseAdmin.from('HomeOccupancy').select(`${OCCUPANCY_SELECT}, home:home_id(home_status, security_state)`)
        .eq('user_id', userId).eq('home_id', row.home_id).maybeSingle();
      if (!result || result.error || (result.data !== null
        && (!result.data || Array.isArray(result.data) || result.data.home_id !== row.home_id))) return false;
      if (result.data === null || proven(result.data)) return true;
    } catch (_) { return false; }
  }
  return false;
};


// A connection can address a letter to a proven resident's Home without learning its street or membership.
async function canSendToMailHome(homeId, userId) {
  const readers = await mailReaderIdsOrThrow(homeId);
  if (readers.includes(userId)) return true;
  if (!readers.length) return false;
  const { data, error } = await supabaseAdmin.from('Relationship').select('requester_id, addressee_id')
    .eq('status', 'accepted').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;
  const connected = new Set((data || []).map((r) => r.requester_id === userId ? r.addressee_id : r.requester_id));
  if (!readers.some((id) => connected.has(id))) return false;
  const { isBlocked } = require('../services/blockService');
  for (const reader of readers) if (await isBlocked(userId, reader)) return false;
  return true;
}

module.exports = { hasVerifiedSenderHome, canSendToMailHome, MAIL_TRUSTED_VERIFICATION_STATUSES, MAIL_PROVEN_SOURCES, getAccessibleHomeIds, trustedHomeIdsOrThrow,
  mailReaderIdsOrThrow, householdHomeIds, mailHomesOrThrow, homeMailNeedsProof, sendMailUnavailable, onlyDelivered,
  isDeliveredMail,
  MAIL_HOME_NEEDS_PROOF, MAIL_NOT_FOUND, canAccessMail, readableMail, restorableMail,
  isDeletedMail, removedMailInfo, homeMailAudience, sendHomeMailRemovedNotice, MAIL_RESTORE_DAYS, restoreWindowOver,
  homeMailVisibilityClauses, homeMailFilter, homesMailFilter, visibleMailFilter, visibleMailIds,
};
