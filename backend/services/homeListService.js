const db = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { getUserAccess } = require('../utils/homePermissions');
const { currentOccupancy, resolveHomeRole } = require('../utils/homeAccessPolicy');
const { deleteEligibility } = require('./homeAuthorityService');
const claimsConfig = require('../config/householdClaims');
const claimsPolicy = require('./homeClaimRoutingService');
const parsePoint = require('../utils/parsePostGISPoint');
const { OPEN_STATUSES } = require('./addressValidation/addressReviewService');

// List entries never include access instructions, provider payloads, account
// identity, household rosters or another person's ownership records.
const CARD_COLUMNS = 'id, name, address, address2, city, state, zipcode, location, home_type, primary_photo_url, cover_photo_url, visibility, home_status, created_at, updated_at';
const OWN_OCCUPANCY_COLUMNS = ['id', 'role', 'role_base', 'is_active', 'verification_status', 'verification_source',
  'start_at', 'end_at', 'access_start_at', 'access_end_at'];
const OWNER_STATUSES = ['pending', 'verified', 'disputed', 'revoked'];
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const permissionsKey = value => JSON.stringify([...value].sort());
function failure(changed = false, cause = null) {
  return Object.assign(new Error(changed ? 'Home access changed while loading. Please retry.' : 'Could not load your Homes. Please retry.'), {
    code: changed ? 'HOME_LIST_ACCESS_CHANGED' : 'HOME_LIST_UNAVAILABLE', statusCode: 503, cause,
  });
}
// What went wrong, for the log line only (never sent to clients). The logger
// redacts keys named "code", so the error's own code travels as errorCode.
const causeOf = error => ({
  errorName: error?.name || null, errorCode: error?.code || null,
  errorMessage: typeof error?.message === 'string' ? error.message.slice(0, 160) : null,
});
async function checked(query) {
  let result;
  try { result = await query; } catch (err) { throw failure(false, causeOf(err)); }
  if (!result || result.error) throw failure(false, result ? causeOf(result.error) : { errorName: 'NoResult' });
  return result.data;
}
async function rows(query) {
  const data = await checked(query);
  if (!Array.isArray(data) || data.some(row => !object(row))) throw failure();
  return data;
}

async function candidates(actorId) {
  const [created, occupancies, owners] = await Promise.all([
    rows(db.from('Home').select('id').or(`owner_id.eq.${actorId},created_by_user_id.eq.${actorId}`).order('id')),
    rows(db.from('HomeOccupancy').select('id, home_id').eq('user_id', actorId).order('id')),
    rows(db.from('HomeOwner').select('id, home_id').eq('subject_id', actorId).eq('subject_type', 'user').order('id')),
  ]);
  if (created.some(row => !uuid(row.id)) || [...occupancies, ...owners].some(row => !uuid(row.id) || !uuid(row.home_id))) throw failure();
  return [...new Set([...created.map(row => row.id), ...occupancies.map(row => row.home_id), ...owners.map(row => row.home_id)])].sort();
}

const STATE_COLUMNS = ['id', 'owner_id', 'created_by_user_id', 'home_status', 'security_state'];
const OWNER_COLUMNS = ['id', 'owner_status', 'verification_tier', 'is_primary_owner'];
const CLAIM_COLUMNS = ['id', 'home_id', 'claim_type', 'state', 'claim_phase_v2', 'merged_into_claim_id'];
const listOfRows = value => Array.isArray(value) && value.every(object);
// Embedded rows come back with their keys in jsonb order; each is put back in the order a read of its own gives.
const inOrder = (row, columns) => Object.fromEntries(columns.map(key => [key, row[key]]));

// The Home's state columns with this person's ownership rows embedded, one read (PostgREST resource embedding).
// With `claims`, their claims on it come in the same read, and with `card`, the columns of its list card.
function homeRead(homeId, actorId, { claims = false, card = false } = {}) {
  const columns = card ? [...new Set([...STATE_COLUMNS, ...CARD_COLUMNS.split(', ')])] : STATE_COLUMNS;
  let query = db.from('Home')
    .select([...columns, `owners:HomeOwner(${OWNER_COLUMNS.join(', ')})`,
      ...(claims ? [`claims:HomeOwnershipClaim(${CLAIM_COLUMNS.join(', ')})`] : [])].join(', '))
    .eq('id', homeId)
    .eq('owners.subject_id', actorId).eq('owners.subject_type', 'user').order('id', { referencedTable: 'owners' });
  if (claims) {
    query = query.eq('claims.claimant_user_id', actorId)
      .order('created_at', { referencedTable: 'claims', ascending: false }).order('id', { referencedTable: 'claims' });
  }
  return checked(query.maybeSingle());
}

async function state(homeId, actorId) {
  return (await readState(homeId, actorId)).state;
}

// state(), with the person's claims on the Home (`claims`) and its card row (`card`) from the same read. They are
// kept apart from the state, which callers compare as a whole.
async function readState(homeId, actorId, options = {}) {
  const [access, row, context] = await Promise.all([
    getUserAccess(homeId, actorId),
    homeRead(homeId, actorId, options),
    checked(db.rpc('home_record_context', { p_home_id: homeId, p_user_id: actorId })),
  ]);
  const home = object(row) ? inOrder(row, STATE_COLUMNS) : null;
  if (home && (!listOfRows(row.owners) || (options.claims && !listOfRows(row.claims)))) throw failure();
  const owners = home ? row.owners.map(owner => inOrder(owner, OWNER_COLUMNS)) : [];
  const claims = home && options.claims ? row.claims.map(claim => inOrder(claim, CLAIM_COLUMNS)) : [];
  if (claims.some(claim => !uuid(claim.id) || claim.home_id !== homeId || typeof claim.state !== 'string')) throw failure();
  if (!home || home.id !== homeId || typeof home.home_status !== 'string' || typeof home.security_state !== 'string'
    || owners.some(owner => !uuid(owner.id) || !OWNER_STATUSES.includes(owner.owner_status) || typeof owner.is_primary_owner !== 'boolean')
    || !object(context) || typeof context.allowed !== 'boolean' || typeof context.private !== 'boolean'
    || !Array.isArray(context.permissions) || context.permissions.some(p => typeof p !== 'string')) throw failure();
  if (access.occupancy && (!uuid(access.occupancy.id) || access.occupancy.home_id !== homeId || access.occupancy.user_id !== actorId)) throw failure();
  if (context.allowed && context.user_id !== actorId) throw failure();
  if (context.allowed && !context.private && (context.role !== access.effective_role_base
    || permissionsKey(context.permissions) !== permissionsKey(access.permissions) || access.hasAccess !== true)) throw failure(true);
  const blocked = ['frozen', 'frozen_silent', 'disputed'].includes(home.security_state)
    || ['archived', 'merged'].includes(home.home_status)
    || owners.some(owner => owner.owner_status === 'disputed')
    || (owners.some(owner => owner.owner_status === 'revoked') && !owners.some(owner => owner.owner_status === 'verified'));
  let mode = 'denied';
  if (!blocked) {
    if (access.hasAccess && access.permissions.includes('home.view') && context.allowed && !context.private && context.permissions.includes('home.view')) {
      if (permissionsKey(context.permissions) !== permissionsKey(access.permissions) || context.role !== access.effective_role_base) throw failure(true);
      mode = 'shared';
    } else if (context.allowed && context.private && home.created_by_user_id === actorId) {
      mode = 'private_setup';
    } else if (access.verificationRequired && currentOccupancy(access.occupancy) && resolveHomeRole(access.occupancy)) {
      mode = 'verification';
    }
  }
  // Include the actual occupancy, own ownership and both authority decisions:
  // a held list must not preserve obsolete metadata even if access still exists.
  // `blocked` (a frozen, disputed, archived or merged Home) also keeps an open
  // claim from showing the Home's public view (placeIntelligenceService.readAccess).
  return { state: { home, access, owners, context, mode, blocked }, claims, row };
}

// The Home's card, projected from its row (read with its opening state, see read()) once the mode is known.
function card(homeId, mode, row) {
  if (mode === 'verification') {
    // Personal progress is not shared Home access. The caller's submitted
    // evidence/address remains on its own authorized verification endpoint.
    return { id: homeId, name: 'Home verification', address: null, address2: null, city: null, state: null, zipcode: null, location: null };
  }
  if (!object(row) || row.id !== homeId || typeof row.address !== 'string'
    || (row.address2 != null && typeof row.address2 !== 'string')) throw failure();
  const projected = Object.fromEntries(CARD_COLUMNS.split(', ').map(key => [key, row[key]]));
  projected.location = projected.location ? parsePoint(projected.location) : null;
  return projected;
}

function materialize(opening, claims, homeCard) {
  const { access, owners, mode } = opening;
  const owner = owners.find(row => row.owner_status === 'verified') || owners.find(row => row.owner_status === 'pending') || null;
  const pending = claims.find(claim => claimsConfig.flags.v2ReadPaths
    ? claimsPolicy.isClaimActiveRecord(claim) : claimsPolicy.isLegacyStateActive(claim.state));
  const occupancy = access.occupancy ? Object.fromEntries(OWN_OCCUPANCY_COLUMNS.map(key => [key, access.occupancy[key] ?? null])) : null;
  return {
    ...homeCard, occupancy, access_kind: mode, has_home_access: mode === 'shared',
    role_base: mode === 'shared' ? access.effective_role_base : null,
    ownership_status: owner?.owner_status || null, verification_tier: owner?.verification_tier || null,
    is_primary_owner: owner?.is_primary_owner === true, pending_claim_id: pending?.id || null,
    // 'resident' is a renter's residency document, 'owner' an ownership claim: the apps name the review by it.
    pending_claim_type: pending?.claim_type || null,
    can_delete_home: null, // read() sets it from the final recheck
    claim_held: false, // read() sets it for private setups
  };
}

// Private setups whose instant claim the address watch held (home claims PR 3): a high watch opens an address-watch
// case in the admin queue, about this person at the Home or, when the reasons are the address's (a mail drop, a PO
// box), about the Home itself, and the claim stays held until the address is proven, so the apps offer mail
// verification instead of "Claim it now". A failed read never fails the list; the offer stays.
async function heldClaims(actorId, homeIds) {
  if (!homeIds.length) return new Set();
  try {
    const { data, error } = await db.from('AddressReviewCase').select('home_id').eq('trigger', 'address_watch')
      .in('status', OPEN_STATUSES).in('home_id', homeIds).or(`user_id.eq.${actorId},user_id.is.null`);
    if (error) throw error;
    return new Set((data || []).map(row => row.home_id));
  } catch (err) {
    logger.warn('Held home claims unavailable', causeOf(err));
    return new Set();
  }
}

// Runs `work` over `items` with at most `limit` in flight, keeping their order;
// after a failure no further item starts.
async function bounded(items, work, limit = 4) {
  const results = new Array(items.length);
  let next = 0;
  let failed = false;
  const lane = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try { results[index] = await work(items[index]); } catch (err) { failed = true; throw err; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}

// The order Homes are picked in when nothing names one: shared Homes first (current occupancy, then
// verified owner, then the rest, oldest first), then private setups, oldest first.
function landingOrder(a, b) {
  const rank = entry => (entry.opening.mode !== 'shared' ? 3 : entry.opening.access.occupancy ? 0
    : entry.opening.owners.some(owner => owner.owner_status === 'verified') ? 1 : 2);
  const since = entry => String(entry.opening.access.occupancy?.created_at || entry.card.created_at || '');
  return rank(a) - rank(b) || since(a).localeCompare(since(b)) || a.homeId.localeCompare(b.homeId);
}

const openable = entry => entry.opening.mode === 'shared' || entry.opening.mode === 'private_setup';

// The Home the person chose as their default (PUT /api/homes/default), or null. A failed read never fails
// the list: the automatic pick applies instead.
async function storedDefault(actorId) {
  try {
    const { data, error } = await db.from('UserNotificationPreferences').select('default_home_id')
      .eq('user_id', actorId).maybeSingle();
    if (error) throw error;
    return uuid(data?.default_home_id) ? data.default_home_id : null;
  } catch (err) {
    logger.warn('Default home unavailable', causeOf(err));
    return null;
  }
}

async function read(actorId, { primary = false, legacy = false } = {}) {
  if (!uuid(actorId)) throw failure();
  const [ids, chosen] = await Promise.all([candidates(actorId), primary || legacy ? null : storedDefault(actorId)]);
  // Bound fanout: candidate discovery contains IDs only, and every projected
  // card has its own opening authority. Homes load a few at a time (each is a
  // chain of database round trips), and all entries are rechecked at the end.
  const opened = await bounded(ids, async (homeId) => {
    // The person's own claims and the Home's card columns come in the same read as its opening state. Each is used
    // only when that state lists the Home, and the recheck below still follows both.
    const { state: opening, claims, row } = await readState(homeId, actorId, { claims: true, card: true });
    if (opening.mode === 'denied' || (primary && opening.mode !== 'shared')) return null;
    return { homeId, opening, claims, card: materialize(opening, claims, card(homeId, opening.mode, row)) };
  });
  const entries = opened.filter(Boolean);
  const privateSetups = entries.filter(entry => entry.opening.mode === 'private_setup');
  // Whether a private setup's claim is held doesn't depend on the recheck, so it's read alongside it.
  const heldRead = heldClaims(actorId, privateSetups.map(entry => entry.homeId));
  await bounded(entries, async (entry) => {
    // Eligibility can change through records/history without a role change.
    const [eligibility, current] = await Promise.all([deleteEligibility(entry.homeId, actorId),
      readState(entry.homeId, actorId, { claims: true })]);
    entry.card.can_delete_home = eligibility.allowed;
    if (JSON.stringify(current.claims) !== JSON.stringify(entry.claims)
      || JSON.stringify(current.state) !== JSON.stringify(entry.opening)) throw failure(true);
  });
  const held = await heldRead;
  for (const entry of privateSetups) entry.card.claim_held = held.has(entry.homeId);
  if (primary) {
    // Preserve the oldest-current-occupancy preference, then verified owners
    // and legacy pointers. Expired candidates cannot hide a later current Home.
    entries.sort(landingOrder);
    return { home: entries[0]?.card || null };
  }
  entries.sort((a, b) => String(b.card.created_at || '').localeCompare(String(a.card.created_at || '')) || a.homeId.localeCompare(b.homeId));
  if (legacy) return {
    ownedHomes: entries.filter(entry => entry.opening.access.isOwner || entry.opening.mode === 'private_setup').map(entry => entry.card),
    occupiedHomes: entries.filter(entry => entry.opening.access.occupancy).map(entry => ({ ...entry.card, occupiedSince: entry.opening.access.occupancy.created_at })),
  };
  // Exactly one Home the person can open is the default: the one they chose while they can still open it,
  // else the automatic pick. Verification entries never are.
  const choices = entries.filter(openable);
  const pick = choices.find(entry => entry.homeId === chosen) || [...choices].sort(landingOrder)[0] || null;
  for (const entry of entries) entry.card.is_default = entry === pick;
  // Place and the shell need both this list and the automatic primary Home
  // on startup. Return the same fully rechecked card /primary would choose,
  // so clients needn't repeat the whole authority pipeline. A chosen default
  // or a private setup is not necessarily a primary residence.
  const primaryHome = entries.filter(entry => entry.opening.mode === 'shared').sort(landingOrder)[0];
  return { homes: entries.map(entry => entry.card), primary_home: primaryHome?.card || null };
}
// Every failed list request leaves one log line with its cause; an unexpected
// exception (a bug) is logged as itself rather than hidden behind the 503.
function sendError(res, error) {
  const known = ['HOME_LIST_UNAVAILABLE', 'HOME_LIST_ACCESS_CHANGED'].includes(error?.code);
  const safe = known ? error : failure();
  logger[safe.code === 'HOME_LIST_ACCESS_CHANGED' ? 'warn' : 'error']('Home list request failed', {
    listFailure: safe.code, cause: known ? error.cause || null : { unexpected: true, ...causeOf(error) },
  });
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}
// state() fails as unavailable when the Home row is gone. A per-Home route
// denies a deleted Home with its usual 403, as it did before reading this
// state, rather than a 503 asking for a retry that can never succeed.
async function homeDeleted(error, homeId) {
  if (error?.code !== 'HOME_LIST_UNAVAILABLE') return false;
  try { return await checked(db.from('Home').select('id').eq('id', homeId).maybeSingle()) === null; } catch { return false; }
}
module.exports = { read, readAccessState: state, sendError, homeDeleted };
