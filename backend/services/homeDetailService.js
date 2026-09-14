const db = require('../config/supabaseAdmin');
const authority = require('./homeDashboardService');
const deletion = require('./homeAuthorityService');
const invitations = require('./homeInvitationService');
const claimConfig = require('../config/householdClaims');
const claimPolicy = require('./homeClaimRoutingService');
const property = require('./ai/propertyIntelligenceService');
const { SAFE_CREATOR_SELECT } = require('../serializers/identitySerializers');
const { currentOccupancy, resolveHomeRole, ROLE_RANK } = require('../utils/homeAccessPolicy');
const parsePoint = require('../utils/parsePostGISPoint');

// A shared Home is not a container for every sensitive column/file reference.
// Secret values and private files keep their exact-resource APIs. Legacy text
// access instructions require the same explicit grant as access codes.
const HOME_FIELDS = ('id,name,address,address2,city,state,zipcode,country,location,home_type,description,'
  + 'visibility,bedrooms,bathrooms,sq_ft,lot_sq_ft,year_built,move_in_date,primary_photo_url,cover_photo_url,'
  + 'is_owner,created_at,updated_at,home_status,security_state,claim_window_ends_at,tenure_mode').split(',');
const INSTRUCTION_FIELDS = ['entry_instructions', 'parking_instructions'];
const MEMBER_FIELDS = ['id', 'home_id', 'user_id', 'role', 'role_base', 'is_active', 'verification_status',
  'start_at', 'end_at', 'access_start_at', 'access_end_at', 'created_at'];
const OWNER_FIELDS = ['id', 'home_id', 'subject_type', 'subject_id', 'owner_status', 'is_primary_owner', 'verification_tier'];
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, row[key] ?? null]));
function failure(code = 'HOME_DETAIL_UNAVAILABLE', statusCode = 503) {
  return Object.assign(new Error(code === 'HOME_MEMBER_HISTORY_DENIED'
    ? 'You do not have permission to view household history.' : 'Could not load this Home information. Please retry.'), { code, statusCode });
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

// HomeUserRef is a private legacy response shape consumed by released native
// decoders (id + username required). Its name is intentionally null: a raw
// account/legal name, locality or email is never a household display fallback.
function userRef(user, expectedId) {
  if (!object(user) || !uuid(user.id) || user.id !== expectedId || typeof user.username !== 'string') throw failure();
  return { id: user.id, username: user.username, name: null,
    profile_picture_url: typeof user.profile_picture_url === 'string' ? user.profile_picture_url : null };
}

async function readHome(homeId, access, { provider = false } = {}) {
  const fields = [...HOME_FIELDS, ...(access.permissions.includes('access.view_codes') ? INSTRUCTION_FIELDS : [])];
  const raw = await checked(db.from('Home').select([...fields, ...(provider ? ['niche_data'] : [])].join(', ')).eq('id', homeId).maybeSingle());
  if (!object(raw) || raw.id !== homeId || fields.some(key => !Object.hasOwn(raw, key))
    || ['address', 'city', 'state', 'zipcode', 'home_status', 'security_state'].some(key => typeof raw[key] !== 'string')) throw failure();
  for (const key of fields.filter(key => !['is_owner', 'location', 'bedrooms', 'bathrooms', 'sq_ft', 'lot_sq_ft', 'year_built'].includes(key))) {
    if (raw[key] !== null && typeof raw[key] !== 'string') throw failure();
  }
  for (const key of ['bedrooms', 'bathrooms', 'sq_ft', 'lot_sq_ft', 'year_built']) {
    if (raw[key] != null && (typeof raw[key] !== 'number' || !Number.isFinite(raw[key]) || raw[key] < 0)) throw failure();
  }
  if (raw.is_owner !== null && typeof raw.is_owner !== 'boolean') throw failure();
  const home = pick(raw, fields);
  home.location = raw.location ? parsePoint(raw.location) : null;
  if (raw.location && !home.location) throw failure();
  return { home, raw };
}

async function readOwners(homeId, actorId, access) {
  let query = db.from('HomeOwner').select(OWNER_FIELDS.join(', ')).eq('home_id', homeId).order('id');
  // Personal status is readable without granting access to other owners.
  if (!access.permissions.includes('ownership.view')) query = query.eq('subject_id', actorId).eq('subject_type', 'user');
  const owners = await rows(query);
  if (owners.some(owner => !uuid(owner.id) || owner.home_id !== homeId || !uuid(owner.subject_id)
    || !['user', 'business', 'trust'].includes(owner.subject_type)
    || !['pending', 'verified', 'disputed', 'revoked'].includes(owner.owner_status)
    || !['weak', 'standard', 'strong', 'legal'].includes(owner.verification_tier)
    || typeof owner.is_primary_owner !== 'boolean')) throw failure();
  return owners;
}

async function readMembers(homeId, { history = false } = {}) {
  let query = db.from('HomeOccupancy').select(`${MEMBER_FIELDS.join(', ')}, user:user_id ( ${SAFE_CREATOR_SELECT} )`)
    .eq('home_id', homeId).order('created_at').order('id');
  if (!history) query = query.eq('is_active', true).eq('verification_status', 'verified');
  const members = await rows(query);
  if (members.some(member => !uuid(member.id) || member.home_id !== homeId || !uuid(member.user_id)
    || typeof member.is_active !== 'boolean' || typeof member.verification_status !== 'string'
    || typeof member.created_at !== 'string')) throw failure();
  const current = history ? members : members.filter(member => currentOccupancy(member) && resolveHomeRole(member));
  const projected = await Promise.all(current.map(async member => {
    let role = resolveHomeRole(member);
    if (!history) {
      // An active row can coexist with a revoked ownership pointer. Use the
      // same SQL admission fence and age ceiling as current Home reads.
      const context = await checked(db.rpc('home_record_context', { p_home_id: homeId, p_user_id: member.user_id }));
      if (!object(context) || typeof context.allowed !== 'boolean' || typeof context.private !== 'boolean') throw failure();
      if (!context.allowed || context.private) return null;
      if (context.user_id !== member.user_id || !Object.hasOwn(ROLE_RANK, context.role)) throw failure();
      role = context.role;
    }
    const user = userRef(member.user, member.user_id);
    return { ...pick(member, MEMBER_FIELDS), ...(!history && { role, role_base: role }), user, display_name: user.username, username: user.username,
      avatar_url: user.profile_picture_url, joined_at: member.created_at };
  }));
  return projected.filter(Boolean);
}

async function ownClaims(homeId, actorId) {
  const claims = await rows(db.from('HomeOwnershipClaim').select('id, home_id, state, claim_phase_v2, merged_into_claim_id')
    .eq('home_id', homeId).eq('claimant_user_id', actorId).order('created_at', { ascending: false }).order('id'));
  if (claims.some(claim => !uuid(claim.id) || claim.home_id !== homeId || typeof claim.state !== 'string')) throw failure();
  return claims;
}
const pendingClaim = claims => claims.find(claim => claimConfig.flags.v2ReadPaths
  ? claimPolicy.isClaimActiveRecord(claim) : claimPolicy.isLegacyStateActive(claim.state));

async function detail(homeId, actorId) {
  return authority.withCurrentAccess({ homeId, actorId }, async access => {
    const [{ home }, owners, occupants, claims] = await Promise.all([
      readHome(homeId, access), readOwners(homeId, actorId, access),
      access.permissions.includes('members.view') ? readMembers(homeId) : [], ownClaims(homeId, actorId),
    ]);
    const mine = owners.find(owner => owner.subject_type === 'user' && owner.subject_id === actorId && owner.owner_status === 'verified')
      || owners.find(owner => owner.subject_type === 'user' && owner.subject_id === actorId && owner.owner_status === 'pending');
    const visibleOwners = access.permissions.includes('ownership.view')
      ? owners.filter(owner => owner.owner_status === 'verified'
        || (access.permissions.includes('ownership.manage') && ['pending', 'disputed'].includes(owner.owner_status))) : [];
    const primary = visibleOwners.find(owner => owner.is_primary_owner && owner.owner_status === 'verified' && owner.subject_type === 'user');
    const owner = primary ? userRef(await checked(db.from('User').select(SAFE_CREATOR_SELECT).eq('id', primary.subject_id).maybeSingle()), primary.subject_id) : null;
    const canDelete = (await deletion.deleteEligibility(homeId, actorId)).allowed;
    // A member or owner can change while this caller's grants remain unchanged.
    // Retire those held projections as well as rechecking caller authority.
    if (JSON.stringify(await readOwners(homeId, actorId, access)) !== JSON.stringify(owners)
      || (access.permissions.includes('members.view') && JSON.stringify(await readMembers(homeId)) !== JSON.stringify(occupants))
      || JSON.stringify(await ownClaims(homeId, actorId)) !== JSON.stringify(claims)) throw failure();
    return { home: { ...home, owner, occupants, owners: visibleOwners.map(row => pick(row, OWNER_FIELDS)),
      isOwner: access.isOwner, isOccupant: !!access.occupancy, isPendingOwner: mine?.owner_status === 'pending',
      ownership_status: mine?.owner_status || null, residency_status: access.occupancy?.verification_status || null,
      role_base: access.effective_role_base, pendingClaimId: pendingClaim(claims)?.id || null, can_delete_home: canDelete } };
  });
}

async function propertyDetail(homeId, actorId) {
  return authority.withCurrentAccess({ homeId, actorId }, async access => {
    const { home, raw } = await readHome(homeId, access, { provider: true });
    const result = await property.getHomeAttomPropertyDetail(raw);
    if (!result || !['home', 'cache', 'attom', 'unavailable'].includes(result.source)
      || !(result.attomPayload === null || object(result.attomPayload))
      || (result.source === 'unavailable' && result.attomPayload !== null)) throw failure();
    // Only the property bundle is returned, never the rest of niche_data or
    // unrelated raw Home fields. Deeper vendor-content validation is separate.
    return { home, attom_property_detail: result.attomPayload, source: result.source,
      unavailable_reason: result.unavailableReason || null };
  });
}

async function members(homeId, actorId, { history = false } = {}) {
  return authority.withCurrentAccess({ homeId, actorId, permission: 'members.view' }, async access => {
    if (history && !access.permissions.includes('members.manage')) throw failure('HOME_MEMBER_HISTORY_DENIED', 403);
    const occupants = await readMembers(homeId, { history });
    const invites = access.permissions.includes('members.manage') ? await invitations.list(actorId, homeId) : [];
    const pendingInvites = invites.map(invite => {
      if (!uuid(invite.id) || invite.home_id !== homeId || typeof invite.proposed_role !== 'string') throw failure();
      return { id: invite.id, user_id: invite.invitee_user_id, role: invite.proposed_role, is_active: false,
        email: invite.invitee_email, name: invite.invitee_email || 'Invited user',
        invited_by: invite.inviter?.username || null, created_at: invite.created_at };
    });
    if (JSON.stringify(await readMembers(homeId, { history })) !== JSON.stringify(occupants)) throw failure();
    if (access.permissions.includes('members.manage')
      && JSON.stringify(await invitations.list(actorId, homeId)) !== JSON.stringify(invites)) throw failure();
    return { occupants, pendingInvites };
  });
}
function sendError(res, error) {
  if (['HOME_DASHBOARD_DENIED', 'HOME_DASHBOARD_ACCESS_CHANGED', 'HOME_RESOURCE_DENIED'].includes(error?.code)) return authority.sendError(res, error);
  const safe = ['HOME_DETAIL_UNAVAILABLE', 'HOME_MEMBER_HISTORY_DENIED'].includes(error?.code) ? error : failure();
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}
module.exports = { detail, propertyDetail, members, sendError };
