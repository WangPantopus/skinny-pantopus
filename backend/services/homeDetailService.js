const db = require('../config/supabaseAdmin');
const authority = require('./homeDashboardService');
const deletion = require('./homeAuthorityService');
const invitations = require('./homeInvitationService');
const claimConfig = require('../config/householdClaims');
const claimPolicy = require('./homeClaimRoutingService');
const property = require('./ai/propertyIntelligenceService');
const valueEstimate = require('./propertyRecords/valueEstimate');
const { serializeCountyRecord, serializePropertyRecord, serializeEstimate } = require('../serializers/countyRecordSerializer');
const homeRecords = require('./propertyRecords/homeRecord');
const estimates = require('./propertyRecords/estimates');
const householdFacts = require('./householdFacts');
const floorPlans = require('./propertyRecords/floorPlans');
const { changeNicheData } = require('./homeNicheData');
const addressReview = require('./addressValidation/addressReviewService');
const countyPages = require('./countyPages');
const countyLinks = require('../config/countyLinks');
const logger = require('../utils/logger');
const { SAFE_CREATOR_SELECT } = require('../serializers/identitySerializers');
const { currentOccupancy, resolveHomeRole, ROLE_RANK } = require('../utils/homeAccessPolicy');
const parsePoint = require('../utils/parsePostGISPoint');
const { loadChatPeopleAndNames } = require('./chatPeople');
const { chosenUsernameOrNull } = require('../utils/personalUsername');

// A shared Home is not a container for every sensitive column/file reference.
// Secret values and private files keep their exact-resource APIs. Legacy text
// access instructions require the same explicit grant as access codes.
const HOME_FIELDS = ('id,name,address,address2,city,state,zipcode,country,location,home_type,description,'
  + 'visibility,bedrooms,bathrooms,sq_ft,lot_sq_ft,year_built,move_in_date,primary_photo_url,cover_photo_url,'
  + 'is_owner,created_at,updated_at,home_status,security_state,claim_window_ends_at,tenure_mode').split(',');
const INSTRUCTION_FIELDS = ['entry_instructions', 'parking_instructions'];
// verification_source tells household members apart from address-verified ones (F3b),
// so member lists only badge people who proved the address.
const MEMBER_FIELDS = ['id', 'home_id', 'user_id', 'role', 'role_base', 'is_active', 'verification_status',
  'verification_source', 'start_at', 'end_at', 'access_start_at', 'access_end_at', 'created_at'];
const OWNER_FIELDS = ['id', 'home_id', 'subject_type', 'subject_id', 'owner_status', 'is_primary_owner', 'verification_tier'];
const CLAIM_FIELDS = ['id', 'home_id', 'state', 'claim_phase_v2', 'merged_into_claim_id'];
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, row[key] ?? null]));
// Embedded rows come back with their keys in jsonb order; each is put back in the order a read of its own gives.
const inOrder = (row, keys) => Object.fromEntries(keys.map(key => [key, row[key]]));
// A read run alongside others: its value, or its error at the point the old one-by-one code threw it.
const settledValue = result => {
  if (result.status === 'rejected') throw result.reason;
  return result.value;
};
const settle = read => read.then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }));
function failure(code = 'HOME_DETAIL_UNAVAILABLE', statusCode = 503) {
  return Object.assign(new Error({
    HOME_MEMBER_HISTORY_DENIED: 'You do not have permission to view household history.',
    HOME_RECORD_PROBLEM_DENIED: 'Only this home\'s verified owner can report a problem with its record.',
    HOME_RECORD_PROBLEM_INVALID: 'That detail isn\'t on this home\'s record.',
    HOME_FLOOR_PLAN_OFF: 'Not found.',
    HOME_FLOOR_PLAN_DENIED: 'Only someone who lives here can answer that.',
    HOME_FLOOR_PLAN_INVALID: 'This home isn\'t on its building\'s floor-plan sheet.',
  }[code] || 'Could not load this Home information. Please retry.'), { code, statusCode });
}
async function checked(query) {
  let result;
  try { result = await query; } catch (_) { throw failure(); }
  if (!result || result.error) throw failure();
  return result.data;
}
function rowList(data) {
  if (!Array.isArray(data) || data.some(row => !object(row))) throw failure();
  return data;
}
async function rows(query) {
  return rowList(await checked(query));
}

// HomeUserRef is a private legacy response shape consumed by released native
// decoders (id + username required). Its name is intentionally null: a raw
// account/legal name, locality or email is never a household display fallback.
function userRef(user, expectedId) {
  if (!object(user) || !uuid(user.id) || user.id !== expectedId || typeof user.username !== 'string') throw failure();
  return { id: user.id, username: user.username, name: null,
    profile_picture_url: typeof user.profile_picture_url === 'string' ? user.profile_picture_url : null };
}
// A HomeUserRef with the handle and photo the person shows neighbors (services/chatPeople.js): their Local Profile's,
// or the account's for anyone without one or whom loadChatPeople can't read. Its name stays null.
function localRef(ref, people) {
  const person = people.get(String(ref.id));
  return person ? { ...ref, username: person.handle || ref.username, profile_picture_url: person.avatarUrl || null } : ref;
}

const homeFields = access => [...HOME_FIELDS, ...(access.permissions.includes('access.view_codes') ? INSTRUCTION_FIELDS : [])];

// `early`: the Home already read or under way (beside the access check, or with the rows detail shows), with every
// column this might use. Only what this access allows stays.
async function readHome(homeId, access, { provider = false, early = null } = {}) {
  const fields = homeFields(access);
  const columns = [...fields, ...(provider ? ['niche_data', 'address_id'] : [])];
  const found = await (early || checked(db.from('Home').select(columns.join(', ')).eq('id', homeId).maybeSingle()));
  const raw = early && object(found) ? Object.fromEntries(columns.filter(key => Object.hasOwn(found, key)).map(key => [key, found[key]])) : found;
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

function checkedOwners(homeId, owners) {
  if (owners.some(owner => !uuid(owner.id) || owner.home_id !== homeId || !uuid(owner.subject_id)
    || !['user', 'business', 'trust'].includes(owner.subject_type)
    || !['pending', 'verified', 'disputed', 'revoked'].includes(owner.owner_status)
    || !['weak', 'standard', 'strong', 'legal'].includes(owner.verification_tier)
    || typeof owner.is_primary_owner !== 'boolean')) throw failure();
  return owners;
}

// Each active, verified occupant's SQL admission context (home_record_context), by user id, from one call. It goes out
// alongside the members' read; a member it doesn't cover (they joined between the two) is checked on their own.
function memberContexts(homeId) {
  return settle(checked(db.rpc('home_member_record_contexts', { p_home_id: homeId })).then((found) => {
    if (!Array.isArray(found) || found.some(row => !object(row) || !uuid(row.user_id))) throw failure();
    return new Map(found.map(row => [row.user_id, row.context]));
  }));
}

async function readMembers(homeId, { history = false } = {}) {
  let query = db.from('HomeOccupancy').select(`${MEMBER_FIELDS.join(', ')}, user:user_id ( ${SAFE_CREATOR_SELECT} )`)
    .eq('home_id', homeId).order('created_at').order('id');
  if (!history) query = query.eq('is_active', true).eq('verification_status', 'verified');
  const contexts = history ? null : memberContexts(homeId);
  return shownMembers(homeId, await rows(query), { history, contexts });
}

// Member rows, each with its account (`user`), as the household list shows them. `contexts`: memberContexts' read.
async function shownMembers(homeId, members, { history = false, contexts = null } = {}) {
  if (members.some(member => !uuid(member.id) || member.home_id !== homeId || !uuid(member.user_id)
    || typeof member.is_active !== 'boolean' || typeof member.verification_status !== 'string'
    || typeof member.created_at !== 'string')) throw failure();
  const current = history ? members : members.filter(member => currentOccupancy(member) && resolveHomeRole(member));
  const known = current.length && contexts ? settledValue(await contexts) : new Map();
  const projected = await Promise.all(current.map(async member => {
    let role = resolveHomeRole(member);
    if (!history) {
      // An active row can coexist with a revoked ownership pointer. Use the
      // same SQL admission fence and age ceiling as current Home reads.
      const context = known.has(member.user_id) ? known.get(member.user_id)
        : await checked(db.rpc('home_record_context', { p_home_id: homeId, p_user_id: member.user_id }));
      if (!object(context) || typeof context.allowed !== 'boolean' || typeof context.private !== 'boolean') throw failure();
      if (!context.allowed || context.private) return null;
      if (context.user_id !== member.user_id || !Object.hasOwn(ROLE_RANK, context.role)) throw failure();
      role = context.role;
    }
    const user = userRef(member.user, member.user_id);
    return { ...pick(member, MEMBER_FIELDS), ...(!history && { role, role_base: role }), user, display_name: user.username, username: user.username,
      // A membership restored by a new invitation starts again; its row keeps the original created_at.
      avatar_url: user.profile_picture_url, joined_at: member.start_at || member.created_at };
  }));
  return projected.filter(Boolean);
}

// Members show by the name they show neighbors on their posts. A username the server made up is never a display name
// (utils/personalUsername.js); a person with no name reads "Household member". Their handle and photo are the ones
// they show neighbors too (localRef). Used only once the consistency recheck passes, and only for display_name, the
// handle and the photo: the rest of each row keeps its shape.
async function withDisplayNames(occupants) {
  if (occupants.length === 0) return occupants;
  // Names, handles and photos come from one read of their accounts and Local Profiles.
  let read;
  try { read = await loadChatPeopleAndNames(occupants.map(member => member.user_id)); } catch (_) { throw failure(); }
  return named(occupants, read);
}
function named(occupants, { names, people }) {
  return occupants.map((member) => {
    const user = localRef(member.user, people);
    return { ...member, user, display_name: names.get(String(member.user_id)) || 'Household member',
      username: user.username, avatar_url: user.profile_picture_url };
  });
}
// The members' names (withDisplayNames) and the primary owner's handle and photo (localRef), from one read of their
// accounts and Local Profiles. Members aren't shown without their names; when that read fails and no member is shown,
// the owner goes by their account.
async function shownPeople(occupants, ownerId) {
  const none = { names: new Map(), people: new Map() };
  const ids = [...occupants.map(member => member.user_id), ...(ownerId ? [ownerId] : [])];
  if (ids.length === 0) return none;
  try { return await loadChatPeopleAndNames(ids); } catch (error) {
    if (occupants.length) throw failure();
    logger.warn('chat.people_lookup_error', { error: error.message });
    return none;
  }
}

function checkedClaims(homeId, claims) {
  if (claims.some(claim => !uuid(claim.id) || claim.home_id !== homeId || typeof claim.state !== 'string')) throw failure();
  return claims;
}
const pendingClaim = claims => claims.find(claim => claimConfig.flags.v2ReadPaths
  ? claimPolicy.isClaimActiveRecord(claim) : claimPolicy.isLegacyStateActive(claim.state));

// The Home with the rows its page shows embedded, one read (PostgREST resource embedding): its owners (only the
// person's own unless they may see ownership: personal status is readable without granting access to other owners),
// its current members with their accounts for someone who may see them, and the person's ownership claims. Each list
// is filtered and ordered as a read of its own was. `columns`: the Home's own.
function homeWithRows(homeId, actorId, access, columns) {
  const seesMembers = access.permissions.includes('members.view');
  let query = db.from('Home').select([...columns, `owners:HomeOwner(${OWNER_FIELDS.join(', ')})`,
    ...(seesMembers ? [`members:HomeOccupancy(${MEMBER_FIELDS.join(', ')}, user:user_id(${SAFE_CREATOR_SELECT}))`] : []),
    `claims:HomeOwnershipClaim(${CLAIM_FIELDS.join(', ')})`].join(', '))
    .eq('id', homeId)
    .order('id', { referencedTable: 'owners' })
    .eq('claims.claimant_user_id', actorId)
    .order('created_at', { referencedTable: 'claims', ascending: false }).order('id', { referencedTable: 'claims' });
  if (!access.permissions.includes('ownership.view')) query = query.eq('owners.subject_id', actorId).eq('owners.subject_type', 'user');
  if (seesMembers) {
    query = query.eq('members.is_active', true).eq('members.verification_status', 'verified')
      .order('created_at', { referencedTable: 'members' }).order('id', { referencedTable: 'members' });
  }
  return checked(query.maybeSingle());
}

// The owners, members and claims of a homeWithRows read, checked as their own reads were. A Home that's gone has none,
// as those reads found none. `contexts`: memberContexts' read, made alongside it for someone who may see members.
async function embeddedRows(homeId, access, home, contexts) {
  if (home === null) return { owners: [], occupants: [], claims: [] };
  if (!object(home)) throw failure();
  const owners = checkedOwners(homeId, rowList(home.owners).map(owner => inOrder(owner, OWNER_FIELDS)));
  const occupants = access.permissions.includes('members.view') ? await shownMembers(homeId, rowList(home.members), { contexts }) : [];
  const claims = checkedClaims(homeId, rowList(home.claims).map(claim => inOrder(claim, CLAIM_FIELDS)));
  return { owners, occupants, claims };
}

async function detail(homeId, actorId) {
  return authority.withCurrentAccess({ homeId, actorId }, async access => {
    // Delete eligibility depends on nothing read here, so it goes out with the Home's read, as do the members' SQL
    // contexts for someone who may see them.
    const seesMembers = access.permissions.includes('members.view');
    const deleteRead = settle(deletion.deleteEligibility(homeId, actorId));
    const contexts = seesMembers ? memberContexts(homeId) : null;
    const opening = homeWithRows(homeId, actorId, access, homeFields(access));
    const { home } = await readHome(homeId, access, { early: opening });
    const { owners, occupants, claims } = await embeddedRows(homeId, access, await opening, contexts);
    const mine = owners.find(owner => owner.subject_type === 'user' && owner.subject_id === actorId && owner.owner_status === 'verified')
      || owners.find(owner => owner.subject_type === 'user' && owner.subject_id === actorId && owner.owner_status === 'pending');
    const visibleOwners = access.permissions.includes('ownership.view')
      ? owners.filter(owner => owner.owner_status === 'verified'
        || (access.permissions.includes('ownership.manage') && ['pending', 'disputed'].includes(owner.owner_status))) : [];
    const primary = visibleOwners.find(owner => owner.is_primary_owner && owner.owner_status === 'verified' && owner.subject_type === 'user');
    // The primary owner's account came with the members when they're one of them; otherwise it's read on its own.
    const memberAccount = primary && occupants.find(member => member.user_id === primary.subject_id)?.user;
    // A member or owner can change while this caller's grants remain unchanged.
    // Retire those held projections as well as rechecking caller authority.
    // The rows are read again in one read and compared in their old order. The primary owner's account and the names
    // of the people shown are read alongside (they're used only once the comparison holds); a failure is reported in
    // the same order as before.
    const contextsAgain = seesMembers ? memberContexts(homeId) : null;
    const [ownerRead, rowsAgain, peopleRead] = await Promise.allSettled([
      primary && !memberAccount ? checked(db.from('User').select(SAFE_CREATOR_SELECT).eq('id', primary.subject_id).maybeSingle()) : null,
      homeWithRows(homeId, actorId, access, ['id']).then(again => embeddedRows(homeId, access, again, contextsAgain)),
      shownPeople(occupants, primary?.subject_id),
    ]);
    const ownerAccount = primary ? memberAccount || userRef(settledValue(ownerRead), primary.subject_id) : null;
    const canDelete = settledValue(await deleteRead).allowed;
    const again = settledValue(rowsAgain);
    if (JSON.stringify(again.owners) !== JSON.stringify(owners) || JSON.stringify(again.occupants) !== JSON.stringify(occupants)
      || JSON.stringify(again.claims) !== JSON.stringify(claims)) throw failure();
    const people = settledValue(peopleRead);
    const owner = ownerAccount ? localRef(ownerAccount, people.people) : null;
    return { home: { ...home, owner, occupants: named(occupants, people), owners: visibleOwners.map(row => pick(row, OWNER_FIELDS)),
      isOwner: access.isOwner, isOccupant: !!access.occupancy, isPendingOwner: mine?.owner_status === 'pending',
      ownership_status: mine?.owner_status || null, residency_status: access.occupancy?.verification_status || null,
      // F3b: 'household' when the verification came only from an invitation or a manager's approval.
      residency_source: access.occupancy?.verification_source || null,
      role_base: access.effective_role_base, pendingClaimId: pendingClaim(claims)?.id || null, can_delete_home: canDelete } };
  });
}

// Of these people who wrote facts while unverified, the ones verified at this Home now: their entries count again.
async function verifiedWritersAt(homeId, userIds) {
  if (!userIds.length) return new Set();
  const [occupants, owners] = await Promise.all([
    rows(db.from('HomeOccupancy').select('user_id').eq('home_id', homeId).in('user_id', userIds).eq('is_active', true).eq('verification_status', 'verified')),
    rows(db.from('HomeOwner').select('subject_id').eq('home_id', homeId).in('subject_id', userIds).eq('subject_type', 'user').eq('owner_status', 'verified')),
  ]);
  return new Set([...occupants.map(row => row.user_id), ...owners.map(row => row.subject_id)]);
}

// What the household has said, for someone it's meant for. A failed read leaves the page as it is without it.
async function householdPart({ homeId, home, raw, access, actorId, problems, copy = null, countyRecord = null, otherRecord = null, seesEntries = true }) {
  try {
    const canEdit = access.permissions.includes('home.edit');
    const [verifiedWriters, reports, countyPage, sheet] = await Promise.all([
      verifiedWritersAt(homeId, householdFacts.unverifiedWriters(raw.niche_data, actorId)),
      copy && canEdit ? problems : null,
      canEdit ? countyPages.forHome({ copy, home }) : null,
      householdFacts.isResident(access) ? floorPlans.forHome(raw) : null,
    ]);
    return householdFacts.project({ home, nicheData: raw.niche_data, copy, countyRecord, canEdit, viewerId: actorId, verifiedWriters, reports, countyPage,
      // The county's record goes first for everyone, including those who don't see it.
      floorPlan: householdFacts.usableFloorPlan(sheet, homeRecords.liveCopy(raw)), otherRecord, seesEntries, countyCheck: countyLinks.enabled() });
  } catch (error) {
    logger.warn('Home household facts unavailable', { homeId, error: error.message });
    return null;
  }
}

// No record anywhere: the labeled estimates, in the same place a record's sections go, so every build draws them. The
// household's questions still ask for what no record answers: an estimate never stands in for a fact.
async function estimateAnswer(home, raw, household) {
  const county = serializeEstimate(await estimates.forHome(raw), raw);
  if (!county) return null;
  return { home, attom_property_detail: null, source: 'cache', unavailable_reason: null, county_record: county,
    provenance: { publisher: county.footer, dataset: null, as_of: null, scope: 'area', method: 'estimate', label: county.footer, title: 'Estimate' },
    household: await householdPart(household) };
}

async function propertyDetail(homeId, actorId) {
  // Read beside the access check, a round trip a person waits through anyway, not after it. Nothing read here leaves
  // until that check has passed, and it runs once more after the last read.
  const early = checked(db.from('Home').select([...HOME_FIELDS, ...INSTRUCTION_FIELDS, 'niche_data', 'address_id'].join(', ')).eq('id', homeId).maybeSingle());
  early.catch(() => {});
  const problems = addressReview.openRecordProblems(homeId, actorId);
  return authority.withCurrentAccess({ homeId, actorId }, async access => {
    // The county record is the verified owner's, as the Home's value is on Place. Everyone else who can open
    // the Home sees its own facts and, in the household, what the household has entered; their visit never asks ATTOM.
    if (!access.isOwner) {
      const sees = householdFacts.seesHousehold(access);
      // A renter gets a household part only for the building's floor plan, which is theirs as much as anyone's.
      const planOnly = !sees && householdFacts.isResident(access) && floorPlans.enabled();
      // The household and its residents see the Home's facts as Place shows them to them: a bedrooms, baths or size
      // column Add Home only filled from ATTOM's copy reads as a live county's record (householdFacts.shownColumns).
      const facts = sees || householdFacts.isResident(access);
      const { home, raw } = await readHome(homeId, access, { provider: facts, early });
      return { home: facts ? { ...home, ...householdFacts.shownColumns(raw, homeRecords.liveCopy(raw)) } : home,
        attom_property_detail: null, source: 'unavailable', unavailable_reason: 'OWNER_ONLY', county_record: null,
        household: sees || planOnly ? await householdPart({ homeId, home, raw, access, actorId, problems, seesEntries: sees }) : null };
    }
    // ATTOM's value estimate comes from the cache only, read alongside the Home. A Home without its record gets it
    // looked up in the background (LOOKUP_PENDING): this answer never waits for ATTOM, and the record's arrival on
    // the Home tells the page to read again.
    const { home: columns, raw } = await readHome(homeId, access, { provider: true, early });
    // A Home with a county record answers from it; a live county never reads ATTOM's copies.
    const record = await homeRecords.forHome(raw);
    // Bedrooms, baths and size as Place shows them (householdFacts.shownColumns); the household part reads the columns.
    const home = { ...columns, ...householdFacts.shownColumns(raw, record?.copy) };
    if (record) {
      const county = record.copy ? serializePropertyRecord(record.copy, await valueEstimate.forCopy(record.copy, raw)) : null;
      // A county that stopped publishing says so; the estimate is for homes no record ever covered.
      if (!county && record.lookup !== 'pending' && record.reason !== 'withdrawn') {
        const floor = await estimateAnswer(home, raw, { homeId, home: columns, raw, access, actorId, problems });
        if (floor) return floor;
      }
      return { home, attom_property_detail: null, source: county ? 'cache' : 'unavailable',
        unavailable_reason: county ? null : (record.lookup === 'pending' ? 'LOOKUP_PENDING' : (record.reason === 'withdrawn' ? 'SOURCE_WITHDRAWN' : 'NO_PROPERTY_FOUND')), county_record: county,
        ...(county ? { provenance: homeRecords.provenanceOf(record.copy) } : {}),
        // While the record is still being read, nothing asks for what it may answer.
        household: record.lookup === 'pending' ? null : await householdPart({ homeId, home: columns, raw, access, actorId, problems, copy: county ? record.copy : null, countyRecord: county }) };
    }
    const avm = await property.getCachedAttomValue(homeId);
    const result = await property.getHomeAttomPropertyDetail(raw);
    if (!result || !['home', 'cache', 'attom', 'unavailable'].includes(result.source)
      || !(result.attomPayload === null || object(result.attomPayload))
      || (result.source === 'unavailable' && result.attomPayload !== null)) throw failure();
    // Only the property bundle is returned, never the rest of niche_data or
    // unrelated raw Home fields. Deeper vendor-content validation is separate.
    const stored = serializeCountyRecord(result.attomPayload, avm);
    if (!stored) {
      const floor = await estimateAnswer(home, raw, { homeId, home, raw, access, actorId, problems });
      if (floor) return floor;
    }
    return { home, attom_property_detail: result.attomPayload, source: result.source,
      unavailable_reason: result.unavailableReason || null, county_record: stored,
      household: await householdPart({ homeId, home, raw, access, actorId, problems, otherRecord: stored }) };
  });
}

// PATCH /api/homes/:id: a change to the household's facts, ready to write with the rest of the edit. Null when the
// edit touches none. `household_facts` is checked here (home.edit, current); a plain edit's check stays the settings
// transaction's, and only keeps who and when for the columns it changes.
async function factChange({ homeId, actorId, asked, fields }) {
  if (!asked && !householdFacts.COLUMN_FACTS.some(([, column]) => Object.hasOwn(fields, column))) return null;
  const access = asked ? await authority.withCurrentAccess({ homeId, actorId, permission: 'home.edit' }, async current => current) : null;
  try {
    const home = await checked(db.from('Home').select(`id, address, address2, city, state, zipcode, home_type, niche_data, ${householdFacts.COLUMN_FACTS.map(([, column]) => column).join(', ')}`)
      .eq('id', homeId).maybeSingle());
    if (!object(home)) throw failure();
    const copy = homeRecords.liveCopy(home);
    return householdFacts.plan({ home, copy, seesRecord: !access || access.isOwner, asked, fields, actorId, floorPlan: householdFacts.usableFloorPlan(floorPlans.storedCopy(home), copy),
      check: countyLinks.enabled() });
  } catch (error) {
    // A plain edit goes on without its who and when; asking for the facts themselves has to be answered.
    if (asked) throw error;
    logger.warn('Home facts unread for a plain edit', { homeId, error: error.message });
    return null;
  }
}

// "Report a problem": a person says a parcel or tax fact looks wrong. It goes to Pantopus review with what the
// record said, and nothing on the page changes.
async function reportRecordProblem(homeId, actorId, { section, field = null, note = null }) {
  return authority.withCurrentAccess({ homeId, actorId }, async access => {
    if (!access.isOwner) throw failure('HOME_RECORD_PROBLEM_DENIED', 403);
    const { raw } = await readHome(homeId, access, { provider: true });
    const copy = homeRecords.liveCopy(raw);
    const shown = copy ? serializePropertyRecord(copy)?.sections.find(candidate => candidate.id === section) : null;
    // A card can hold the building's floor plans beside the record's rows; "something here" is the most this can say about those.
    const named = /^floor_plan/.test(field || '') ? null : field;
    const row = named ? shown?.rows.find(candidate => candidate.id === named) : null;
    if (!shown || (named && !row)) throw failure('HOME_RECORD_PROBLEM_INVALID', 400);
    const caseId = await addressReview.flagRecordProblem({ homeId, userId: actorId, reason: {
      kind: 'record_problem', section, field: row?.id ?? null, label: row?.label ?? null, shown: row?.value ?? null, note: note || null,
      jurisdiction: copy.jurisdiction, release: copy.release, at: new Date().toISOString(),
    } });
    if (!caseId) throw failure();
    return { reported: true };
  });
}

// "Is this your layout?": a resident answers for a unit the building's sheet names. Yes fills what the Home is missing,
// for someone who can edit it. No reaches Pantopus review, and nothing shown changes for anyone. Undo goes back.
async function answerFloorPlan(homeId, actorId, answer) {
  if (!floorPlans.enabled()) throw failure('HOME_FLOOR_PLAN_OFF', 404);
  return authority.withCurrentAccess({ homeId, actorId }, async access => {
    if (!householdFacts.isResident(access)) throw failure('HOME_FLOOR_PLAN_DENIED', 403);
    const { raw } = await readHome(homeId, access, { provider: true });
    const sheet = householdFacts.usableFloorPlan(await floorPlans.forHome(raw), homeRecords.liveCopy(raw));
    if (sheet?.match !== 'exact') throw failure('HOME_FLOOR_PLAN_INVALID', 400);
    const canEdit = access.permissions.includes('home.edit');
    const previous = raw.niche_data?.floor_plan_answer || null;
    const review = kind => addressReview.flagRecordProblem({ homeId, userId: actorId, reason: {
      kind, sheet: sheet.sheet, release: sheet.release, plan: sheet.plan.id, at: new Date().toISOString() } });
    // The same transaction as an edit: the record of who changed what, and its own authority check. The answer stands either way.
    const writeColumns = async columns => {
      if (!canEdit || !Object.keys(columns).length) return [];
      const { data, error } = await db.rpc('update_home_settings', { p_home_id: homeId, p_actor_id: actorId, p_fields: columns, p_preferences: {} });
      if (error || !data?.ok) {
        logger.warn('Home floor plan facts not written', { homeId, code: data?.code || null });
        return [];
      }
      return Object.keys(columns);
    };
    if (answer === 'undo') {
      if (!previous) return { answered: false };
      if (previous.answer === 'no') await review('floor_plan_no_undone');
      await writeColumns(householdFacts.layoutColumnsToClear(previous, sheet, raw));
      await changeNicheData(homeId, stored => {
        const [latest, ...rest] = stored.floor_plan_answer?.history || [];
        if (latest) stored.floor_plan_answer = { ...latest, history: rest };
        else delete stored.floor_plan_answer;
        return stored;
      });
      return { answered: false };
    }
    if (answer === 'no' && !(await review('floor_plan_no'))) throw failure();
    const filled = answer === 'yes' ? await writeColumns(householdFacts.layoutColumns(sheet, raw)) : [];
    await changeNicheData(homeId, stored => ({ ...stored, floor_plan_answer: householdFacts.layoutAnswer({
      answer, floorPlan: sheet, actorId, via: 'details', verified: true, previous: stored.floor_plan_answer || null, filled }) }));
    return { answered: true };
  });
}

async function members(homeId, actorId, { history = false } = {}) {
  return authority.withCurrentAccess({ homeId, actorId, permission: 'members.view' }, async access => {
    if (history && !access.permissions.includes('members.manage')) throw failure('HOME_MEMBER_HISTORY_DENIED', 403);
    const manage = access.permissions.includes('members.manage');
    // Members and invitations are independent reads, so they run together;
    // a failure is reported in the same order as before.
    const [occupantsRead, invitesRead] = await Promise.allSettled([
      readMembers(homeId, { history }),
      manage ? invitations.list(actorId, homeId) : [],
    ]);
    const occupants = settledValue(occupantsRead);
    const invites = settledValue(invitesRead);
    const pendingInvites = invites.map(invite => {
      if (!uuid(invite.id) || invite.home_id !== homeId || typeof invite.proposed_role !== 'string') throw failure();
      return { id: invite.id, user_id: invite.invitee_user_id, role: invite.proposed_role, is_active: false,
        email: invite.invitee_email, name: invite.invitee_email || 'Invited user',
        invited_by: chosenUsernameOrNull(invite.inviter?.username), created_at: invite.created_at };
    });
    // Both rereads and the members' names run together; failures are reported in the old order.
    const [membersAgain, invitesAgain, namedOccupants] = await Promise.allSettled([
      readMembers(homeId, { history }),
      manage ? invitations.list(actorId, homeId) : null,
      withDisplayNames(occupants),
    ]);
    if (JSON.stringify(settledValue(membersAgain)) !== JSON.stringify(occupants)) throw failure();
    if (manage && JSON.stringify(settledValue(invitesAgain)) !== JSON.stringify(invites)) throw failure();
    const named = settledValue(namedOccupants);
    return { occupants: history ? named : await withClaimReview(homeId, actorId, named), pendingInvites };
  });
}
// Home claims PR 3: a proof always beats a claim. For a viewer who proved the address, the rows of people whose access
// is a claim say what the viewer may do about them: confirm them while their claim steps back for proof
// (home_claim_set_aside), and remove them up to lease_resident (home_member_rank_ceiling). Nobody else sees this.
async function withClaimReview(homeId, actorId, occupants) {
  const claims = occupants.filter(member => member.verification_source === 'claim' && member.user_id !== actorId);
  if (claims.length === 0) return occupants;
  const proof = await checked(db.rpc('home_proof_holder', { p_home_id: homeId, p_user_id: actorId }));
  if (typeof proof !== 'boolean') throw failure();
  if (!proof) return occupants;
  const review = new Map(await Promise.all(claims.map(async member => {
    const setAside = await checked(db.rpc('home_claim_set_aside', { p_home_id: homeId, p_user_id: member.user_id }));
    if (typeof setAside !== 'boolean') throw failure();
    return [member.user_id, { set_aside: setAside, can_confirm: setAside,
      can_remove: (ROLE_RANK[member.role] || ROLE_RANK.owner) <= ROLE_RANK.lease_resident }];
  })));
  return occupants.map(member => (review.has(member.user_id) ? { ...member, claim_review: review.get(member.user_id) } : member));
}
function sendError(res, error) {
  if (['HOME_DASHBOARD_DENIED', 'HOME_DASHBOARD_ACCESS_CHANGED', 'HOME_RESOURCE_DENIED'].includes(error?.code)) return authority.sendError(res, error);
  const safe = ['HOME_DETAIL_UNAVAILABLE', 'HOME_MEMBER_HISTORY_DENIED', 'HOME_RECORD_PROBLEM_DENIED', 'HOME_RECORD_PROBLEM_INVALID', 'HOME_FACTS_INVALID', 'HOME_FLOOR_PLAN_OFF', 'HOME_FLOOR_PLAN_DENIED', 'HOME_FLOOR_PLAN_INVALID'].includes(error?.code) ? error : failure();
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}
module.exports = { detail, propertyDetail, members, factChange, reportRecordProblem, answerFloorPlan, sendError };
