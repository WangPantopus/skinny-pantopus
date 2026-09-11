const db = require('../config/supabaseAdmin');
const { getUserAccess } = require('../utils/homePermissions');
const { currentOccupancy, resolveHomeRole } = require('../utils/homeAccessPolicy');
const { deleteEligibility } = require('./homeAuthorityService');
const claimsConfig = require('../config/householdClaims');
const claimsPolicy = require('./homeClaimRoutingService');
const parsePoint = require('../utils/parsePostGISPoint');

// List entries never include access instructions, provider payloads, account
// identity, household rosters or another person's ownership records.
const CARD_COLUMNS = 'id, name, address, city, state, zipcode, location, home_type, primary_photo_url, cover_photo_url, visibility, home_status, created_at, updated_at';
const OWN_OCCUPANCY_COLUMNS = ['id', 'role', 'role_base', 'is_active', 'verification_status',
  'start_at', 'end_at', 'access_start_at', 'access_end_at'];
const OWNER_STATUSES = ['pending', 'verified', 'disputed', 'revoked'];
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const permissionsKey = value => JSON.stringify([...value].sort());
function failure(changed = false) {
  return Object.assign(new Error(changed ? 'Home access changed while loading. Please retry.' : 'Could not load your Homes. Please retry.'), {
    code: changed ? 'HOME_LIST_ACCESS_CHANGED' : 'HOME_LIST_UNAVAILABLE', statusCode: 503,
  });
}
async function checked(query) {
  let result;
  try { result = await query; } catch (_) { throw failure(); }
  if (!result || result.error) throw failure();
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

async function state(homeId, actorId) {
  const [access, home, owners, context] = await Promise.all([
    getUserAccess(homeId, actorId),
    checked(db.from('Home').select('id, owner_id, created_by_user_id, home_status, security_state')
      .eq('id', homeId).maybeSingle()),
    rows(db.from('HomeOwner').select('id, owner_status, verification_tier, is_primary_owner')
      .eq('home_id', homeId).eq('subject_id', actorId).eq('subject_type', 'user').order('id')),
    checked(db.rpc('home_record_context', { p_home_id: homeId, p_user_id: actorId })),
  ]);
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
  return { home, access, owners, context, mode };
}

async function readClaims(homeId, actorId) {
  const claims = await rows(db.from('HomeOwnershipClaim').select('id, home_id, state, claim_phase_v2, merged_into_claim_id')
    .eq('home_id', homeId).eq('claimant_user_id', actorId).order('created_at', { ascending: false }).order('id'));
  if (claims.some(claim => !uuid(claim.id) || claim.home_id !== homeId || typeof claim.state !== 'string')) throw failure();
  return claims;
}

async function materialize(homeId, actorId, opening, claims) {
  const { access, owners, mode } = opening;
  const owner = owners.find(row => row.owner_status === 'verified') || owners.find(row => row.owner_status === 'pending') || null;
  const pending = claims.find(claim => claimsConfig.flags.v2ReadPaths
    ? claimsPolicy.isClaimActiveRecord(claim) : claimsPolicy.isLegacyStateActive(claim.state));
  let card;
  if (mode === 'verification') {
    // Personal progress is not shared Home access. The caller's submitted
    // evidence/address remains on its own authorized verification endpoint.
    card = { id: homeId, name: 'Home verification', address: null, city: null, state: null, zipcode: null, location: null };
  } else {
    card = await checked(db.from('Home').select(CARD_COLUMNS).eq('id', homeId).maybeSingle());
    if (!object(card) || card.id !== homeId || typeof card.address !== 'string') throw failure();
    card = Object.fromEntries(CARD_COLUMNS.split(', ').map(key => [key, card[key]]));
    card.location = card.location ? parsePoint(card.location) : null;
  }
  const occupancy = access.occupancy ? Object.fromEntries(OWN_OCCUPANCY_COLUMNS.map(key => [key, access.occupancy[key] ?? null])) : null;
  return {
    ...card, occupancy, access_kind: mode, has_home_access: mode === 'shared',
    role_base: mode === 'shared' ? access.effective_role_base : null,
    ownership_status: owner?.owner_status || null, verification_tier: owner?.verification_tier || null,
    is_primary_owner: owner?.is_primary_owner === true, pending_claim_id: pending?.id || null,
    can_delete_home: (await deleteEligibility(homeId, actorId)).allowed,
  };
}

async function read(actorId, { primary = false, legacy = false } = {}) {
  if (!uuid(actorId)) throw failure();
  const ids = await candidates(actorId);
  const entries = [];
  // Bound fanout: candidate discovery contains IDs only, and every projected
  // card has its own opening authority. All entries are rechecked at the end.
  for (const homeId of ids) {
    const opening = await state(homeId, actorId);
    if (opening.mode === 'denied' || (primary && opening.mode !== 'shared')) continue;
    const claims = await readClaims(homeId, actorId);
    entries.push({ homeId, opening, claims, card: await materialize(homeId, actorId, opening, claims) });
  }
  for (const entry of entries) {
    // Eligibility can change through records/history without a role change.
    entry.card.can_delete_home = (await deleteEligibility(entry.homeId, actorId)).allowed;
    if (JSON.stringify(await readClaims(entry.homeId, actorId)) !== JSON.stringify(entry.claims)) throw failure(true);
  }
  for (const entry of entries) {
    const current = await state(entry.homeId, actorId);
    if (JSON.stringify(current) !== JSON.stringify(entry.opening)) throw failure(true);
  }
  if (primary) {
    // Preserve the oldest-current-occupancy preference, then verified owners
    // and legacy pointers. Expired candidates cannot hide a later current Home.
    const rank = entry => entry.opening.access.occupancy ? 0 : entry.opening.owners.some(owner => owner.owner_status === 'verified') ? 1 : 2;
    entries.sort((a, b) => rank(a) - rank(b)
      || String(a.opening.access.occupancy?.created_at || a.card.created_at).localeCompare(String(b.opening.access.occupancy?.created_at || b.card.created_at))
      || a.homeId.localeCompare(b.homeId));
    return { home: entries[0]?.card || null };
  }
  entries.sort((a, b) => String(b.card.created_at || '').localeCompare(String(a.card.created_at || '')) || a.homeId.localeCompare(b.homeId));
  if (legacy) return {
    ownedHomes: entries.filter(entry => entry.opening.access.isOwner || entry.opening.mode === 'private_setup').map(entry => entry.card),
    occupiedHomes: entries.filter(entry => entry.opening.access.occupancy).map(entry => ({ ...entry.card, occupiedSince: entry.opening.access.occupancy.created_at })),
  };
  return { homes: entries.map(entry => entry.card) };
}
function sendError(res, error) {
  const safe = ['HOME_LIST_UNAVAILABLE', 'HOME_LIST_ACCESS_CHANGED'].includes(error?.code) ? error : failure();
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}
module.exports = { read, sendError };
