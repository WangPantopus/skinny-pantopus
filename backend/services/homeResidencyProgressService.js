const db = require('../config/supabaseAdmin');
const { readAccessState } = require('./homeListService');
const { currentOccupancy } = require('../utils/homeAccessPolicy');

// Personal application data, never the Home's current address, occupants,
// reviewer identity, provider receipts or admission capability.
const COLUMNS = 'id, home_id, user_id, claimed_address, claimed_role, status, reviewed_at, created_at, updated_at, cold_start_mode';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const uuid = value => typeof value === 'string' && UUID.test(value);
const date = value => value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
const messages = {
  RESIDENCY_PROGRESS_INVALID: 'Check the residency request and try again.',
  RESIDENCY_PROGRESS_NOT_FOUND: 'No personal residency progress was found for this Home.',
  RESIDENCY_PROGRESS_CHANGED: 'Your residency progress changed while loading. Please refresh.',
  RESIDENCY_PROGRESS_UNAVAILABLE: 'Could not check your residency progress. Please retry.',
};
function failure(code = 'RESIDENCY_PROGRESS_UNAVAILABLE', statusCode = 503) {
  return Object.assign(new Error(messages[code]), { code, statusCode });
}
async function checked(query) {
  let result;
  try { result = await query; } catch (_) { throw failure(); }
  if (!result || result.error) throw failure();
  return result.data;
}
function claim(row, actorId, homeId) {
  if (!row || !uuid(row.id) || row.user_id !== actorId || !(row.home_id === null || uuid(row.home_id))
    || (homeId && row.home_id !== homeId) || !['pending', 'verified', 'rejected'].includes(row.status)
    || !(row.claimed_address === null || typeof row.claimed_address === 'string')
    || !(row.claimed_role === null || typeof row.claimed_role === 'string')
    || ![row.reviewed_at, row.created_at, row.updated_at].every(date)
    || !(row.cold_start_mode === null || typeof row.cold_start_mode === 'string')) throw failure();
  return row;
}
function project(row) {
  return {
    id: row.id, home_id: row.home_id, submitted_address: row.claimed_address,
    claimed_role: row.claimed_role, status: row.status,
    reviewed_at: row.reviewed_at, created_at: row.created_at, updated_at: row.updated_at,
  };
}
function identity(actorId, homeId) {
  if (!uuid(actorId) || (homeId !== undefined && !uuid(homeId))) throw failure('RESIDENCY_PROGRESS_INVALID', 400);
}
async function list(actorId, after) {
  identity(actorId);
  if (after !== undefined && !uuid(after)) throw failure('RESIDENCY_PROGRESS_INVALID', 400);
  // Stable UUID ordering permits bounded pagination even when a request's
  // status/date changes. A page never silently truncates the personal history.
  async function page() {
    let query = db.from('HomeResidencyClaim').select(COLUMNS).eq('user_id', actorId).order('id').limit(51);
    if (after) query = query.gt('id', after.toLowerCase());
    const result = await checked(query);
    if (!Array.isArray(result)) throw failure();
    result.forEach(row => claim(row, actorId));
    if (new Set(result.map(row => row.id)).size !== result.length) throw failure();
    return result;
  }
  const opening = await page();
  if (JSON.stringify(await page()) !== JSON.stringify(opening)) throw failure('RESIDENCY_PROGRESS_CHANGED');
  return { requests: opening.slice(0, 50).map(project), next_cursor: opening.length > 50 ? opening[49].id : null };
}
async function references(homeId, actorId) {
  const [request, occupancy, owner, created] = await Promise.all([
    checked(db.from('HomeResidencyClaim').select(COLUMNS).eq('home_id', homeId).eq('user_id', actorId).maybeSingle()),
    checked(db.from('HomeOccupancy').select('id, home_id, user_id').eq('home_id', homeId).eq('user_id', actorId).maybeSingle()),
    checked(db.from('HomeOwner').select('id, home_id, subject_id, subject_type')
      .eq('home_id', homeId).eq('subject_id', actorId).eq('subject_type', 'user').maybeSingle()),
    checked(db.from('Home').select('id, created_by_user_id').eq('id', homeId).eq('created_by_user_id', actorId).maybeSingle()),
  ]);
  if (request !== null) claim(request, actorId, homeId);
  if (occupancy !== null && (!occupancy || !uuid(occupancy.id) || occupancy.home_id !== homeId || occupancy.user_id !== actorId)) throw failure();
  if (owner !== null && (!owner || !uuid(owner.id) || owner.home_id !== homeId || owner.subject_id !== actorId || owner.subject_type !== 'user')) throw failure();
  if (created !== null && (!created || created.id !== homeId || created.created_by_user_id !== actorId)) throw failure();
  return { request, occupancy, owner, created };
}
function nextStep(refs, state, actorId) {
  const { home, access, owners, mode } = state;
  const request = refs.request, occupancy = access.occupancy;
  if (mode === 'shared') return 'home';
  if (['frozen', 'frozen_silent', 'disputed'].includes(home.security_state)
    || ['archived', 'merged'].includes(home.home_status)) return 'unavailable';
  if (owners.length || home.owner_id === actorId
    || ['owner', 'admin', 'manager'].includes(access.role_base)) return 'ownership_verification';
  if (occupancy && !['member', 'lease_resident', 'restricted_member'].includes(access.role_base)) return 'access_review';
  if (occupancy && (!currentOccupancy(occupancy) || occupancy.end_at !== null
    || !['unverified', 'pending', 'pending_approval', 'pending_doc', 'pending_postcard', 'provisional_bootstrap'].includes(occupancy.verification_status)
    || occupancy.verified_at != null || occupancy.verification_expires_at != null)) return 'access_review';
  if (request?.status === 'verified') return 'access_review';
  if (request?.status === 'rejected' || (request && !occupancy)) return 'resubmit';
  if (request?.status === 'pending' && request.cold_start_mode === null) return 'household_review';
  if (request && !['self_bootstrap', 'external_postcard', 'stale_authority_postcard'].includes(request.cold_start_mode)) return 'access_review';
  return 'address_verification';
}
async function read(homeId, actorId) {
  identity(actorId, homeId); homeId = homeId.toLowerCase();
  const refs = await references(homeId, actorId);
  if (!Object.values(refs).some(Boolean)) throw failure('RESIDENCY_PROGRESS_NOT_FOUND', 404);
  const opening = await readAccessState(homeId, actorId);
  if (JSON.stringify(await references(homeId, actorId)) !== JSON.stringify(refs)) throw failure('RESIDENCY_PROGRESS_CHANGED');
  const current = await readAccessState(homeId, actorId);
  if (JSON.stringify(current) !== JSON.stringify(opening)) throw failure('RESIDENCY_PROGRESS_CHANGED');
  return {
    home_id: homeId, request: refs.request ? project(refs.request) : null,
    current_access: current.mode === 'shared' ? 'shared' : current.mode === 'private_setup' ? 'private_setup' : 'none',
    next_step: nextStep(refs, current, actorId),
  };
}
function sendError(res, error) {
  const safe = Object.hasOwn(messages, error?.code) ? error : failure();
  return res.status(safe.statusCode).json({ code: safe.code, error: safe.message });
}
async function legacyList(actorId, after) {
  const page = await list(actorId, after);
  return { claims: page.requests.map(row => ({
    id: row.id, home_id: row.home_id, user_id: actorId, claimed_address: row.submitted_address,
    claimed_role: row.claimed_role, status: row.status, created_at: row.created_at,
    updated_at: row.updated_at, reviewed_at: row.reviewed_at, home: null,
  })), next_cursor: page.next_cursor };
}
module.exports = { list, legacyList, read, sendError };
