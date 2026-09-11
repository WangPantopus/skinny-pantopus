const db = require('../config/supabaseAdmin');
const { SAFE_CREATOR_SELECT, serializeUserAsLocalIdentity } = require('../serializers/identitySerializers');
const { getUserAccess } = require('../utils/homePermissions');
const { ROLE_RANK, currentOccupancy, resolveHomeRole } = require('../utils/homeAccessPolicy');
const { staleAffectsTrust } = require('../utils/verificationAge');
const { HOME_LIST, HOME_BILL_LIST, HOME_ISSUE_LIST, HOME_PACKAGE_LIST } = require('../utils/columns');
const parsePostGISPoint = require('../utils/parsePostGISPoint');
const records = require('./homeRecordService');
const authority = require('./homeAuthorityService');
const { getHealthScore, canReadHealthScore } = require('./homeHealthService');

const MESSAGES = {
  HOME_DASHBOARD_UNAVAILABLE: 'Could not load the Home summary. Please retry.',
  HOME_DASHBOARD_ACCESS_CHANGED: 'Home access changed while loading. Please retry.',
  HOME_DASHBOARD_DENIED: 'No access to this home.',
  HOME_RESOURCE_INVALID: 'Check the record filters and try again.',
  HOME_RESOURCE_DENIED: 'You do not have permission to view these records.',
  HOME_NOT_FOUND: 'Home not found.',
};
function failure(code = 'HOME_DASHBOARD_UNAVAILABLE', statusCode = 503) {
  return Object.assign(new Error(MESSAGES[code]), { code, statusCode });
}
async function checked(query) {
  let result;
  try { result = await query; } catch (_) { throw failure(); }
  if (!result || result.error) throw failure();
  return result;
}
async function rows(query) {
  const { data } = await checked(query);
  if (!Array.isArray(data)) throw failure();
  return data;
}
async function count(query) {
  const { count: total } = await checked(query);
  if (!Number.isSafeInteger(total) || total < 0) throw failure();
  return total;
}
const permissionKey = permissions => JSON.stringify([...permissions].sort());
async function readAccess(homeId, actorId, permission = 'home.view') {
  const denied = permission === 'home.view' ? 'HOME_DASHBOARD_DENIED' : 'HOME_RESOURCE_DENIED';
  const access = await getUserAccess(homeId, actorId);
  if (!access.hasAccess || !access.permissions.includes(permission)) throw failure(denied, 403);
  // Use the established SQL context as well: it fences frozen/archived Homes,
  // disputed ownership pointers and private setup. Private task first-use stays
  // on its own exact collection capability; it is not shared dashboard access.
  const { data: context } = await checked(db.rpc('home_record_context', { p_home_id: homeId, p_user_id: actorId }));
  if (!context || typeof context.allowed !== 'boolean' || typeof context.private !== 'boolean'
    || !Array.isArray(context.permissions)) throw failure();
  if (!context.allowed || context.private || !context.permissions.includes(permission)) throw failure(denied, 403);
  if (permissionKey(context.permissions) !== permissionKey(access.permissions)
    || context.role !== access.effective_role_base || context.user_id !== actorId) throw failure('HOME_DASHBOARD_ACCESS_CHANGED');
  return access;
}
function fingerprint(access) {
  const o = access.occupancy;
  return JSON.stringify([permissionKey(access.permissions), access.role_base, access.effective_role_base, access.isOwner,
    o && ['id', 'is_active', 'role', 'role_base', 'age_band', 'verification_status', 'verified_at',
      'start_at', 'end_at', 'access_start_at', 'access_end_at'].map(key => o[key] ?? null)]);
}
function visibleScopes(access) {
  const visibility = ['public', 'members'];
  if ((ROLE_RANK[access.effective_role_base] || 0) >= ROLE_RANK.manager) visibility.push('managers');
  if (access.permissions.includes('sensitive.view')) visibility.push('sensitive');
  return visibility;
}
// Lists used by the dashboard must share its current resource/visibility gate.
// The legacy generic-membership lists bypassed these record boundaries.
async function readResource({ homeId, actorId, kind, status, severity }) {
  const spec = { issues: ['HomeIssue', 'maintenance.view', HOME_ISSUE_LIST],
    packages: ['HomePackage', 'packages.view', HOME_PACKAGE_LIST] }[kind];
  if (!spec) throw failure();
  const statuses = kind === 'issues' ? ['open', 'scheduled', 'in_progress', 'resolved', 'canceled']
    : ['expected', 'out_for_delivery', 'delivered', 'picked_up', 'lost', 'returned'];
  if ((status !== undefined && !statuses.includes(status))
    || (severity !== undefined && (kind !== 'issues' || !['low', 'medium', 'high', 'urgent'].includes(severity)))) throw failure('HOME_RESOURCE_INVALID', 400);
  const access = await readAccess(homeId, actorId, spec[1]);
  if (!access.permissions.includes(spec[1])) throw failure('HOME_RESOURCE_DENIED', 403);
  let query = db.from(spec[0]).select(spec[2]).eq('home_id', homeId)
    .in('visibility', visibleScopes(access)).order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (severity && kind === 'issues') query = query.eq('severity', severity);
  const result = await rows(query);
  if (result.some(row => !row || row.home_id !== homeId || typeof row.id !== 'string')) throw failure();
  const current = await readAccess(homeId, actorId, spec[1]);
  if (fingerprint(current) !== fingerprint(access)) throw failure('HOME_DASHBOARD_ACCESS_CHANGED');
  return result;
}

// A Home badge must not reveal someone else's personal/attention-only mail.
// These predicates follow the existing Home task source-mail boundary, without
// fetching content, opening mail, or consuming a limited-access envelope.
function unreadMailQuery(homeId, actorId, now) {
  let query = db.from('Mail').select('id', { count: 'exact', head: true })
    .eq('recipient_home_id', homeId).eq('viewed', false).eq('archived', false)
    .is('access_count_max', null).in('privacy', ['private_to_person', 'shared_household']);
  for (const key of ['expires_at', 'time_limited_expires_at']) query = query.or(`${key}.is.null,${key}.gt.${now}`);
  for (const key of ['address_home_id', 'address_id']) query = query.or(`${key}.is.null,${key}.eq.${homeId}`);
  for (const key of ['recipient_user_id', 'attn_user_id']) query = query.or(`${key}.is.null,${key}.eq.${actorId}`);
  for (const [type, id] of [['delivery_target_type', 'delivery_target_id'], ['recipient_type', 'recipient_id']]) {
    query = query.or(`${type}.is.null,and(${type}.eq.home,${id}.eq.${homeId}),and(${type}.eq.user,${id}.eq.${actorId})`);
  }
  return query.or('lifecycle.is.null,lifecycle.neq.shredded')
    .or(`delivery_visibility.is.null,delivery_visibility.eq.home_members,and(delivery_visibility.in.(attn_only,attn_plus_admins),attn_user_id.eq.${actorId})`)
    .or(`privacy.eq.shared_household,recipient_user_id.eq.${actorId},attn_user_id.eq.${actorId}`);
}

async function read({ homeId, actorId, includeHealthScore = false }) {
  const access = await readAccess(homeId, actorId);
  const permissions = new Set(access.permissions);
  const has = permission => permissions.has(permission);
  const visibility = visibleScopes(access);
  const now = new Date();
  const nowISO = now.toISOString();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const resourceCount = (table, permission) => has(permission)
    ? db.from(table).select('id', { count: 'exact', head: true }).eq('home_id', homeId).in('visibility', visibility)
    : null;
  const issues = resourceCount('HomeIssue', 'maintenance.view');
  const packages = resourceCount('HomePackage', 'packages.view');
  const arriving = resourceCount('HomePackage', 'packages.view');
  const documents = resourceCount('HomeDocument', 'docs.view');
  const [homeResult, rawMembers, tasks, events, bills, unread, guestPasses, expectedPackages, arrivingPackages, openIssues, dueBills, documentCount, petCount, activity] = await Promise.all([
    checked(db.from('Home').select(HOME_LIST).eq('id', homeId).maybeSingle()),
    has('members.view') ? rows(db.from('HomeOccupancy')
      .select(`user_id, role, role_base, is_active, verification_status, start_at, end_at, access_start_at, access_end_at, user:user_id ( ${SAFE_CREATOR_SELECT} )`)
      .eq('home_id', homeId).eq('is_active', true).eq('verification_status', 'verified')) : [],
    has('tasks.view') ? records.list({ homeId, actorId, kind: 'task' }).then(result => result.records) : [],
    has('calendar.view') ? records.list({ homeId, actorId, kind: 'event' }).then(result => result.records) : [],
    has('finance.view') ? rows(db.from('HomeBill').select(HOME_BILL_LIST).eq('home_id', homeId)
      .in('status', ['due', 'overdue']).order('due_date', { ascending: true }).limit(1)) : [],
    has('mailbox.view') && access.occupancy?.verification_status === 'verified'
      && !staleAffectsTrust(access.occupancy.verified_at) ? count(unreadMailQuery(homeId, actorId, nowISO)) : 0,
    has('members.manage') ? count(db.from('HomeGuestPass').select('id', { count: 'exact', head: true }).eq('home_id', homeId)
      .is('revoked_at', null).lte('start_at', nowISO).or(`end_at.is.null,end_at.gt.${nowISO}`)) : 0,
    packages ? count(packages.in('status', ['expected', 'out_for_delivery'])) : 0,
    arriving ? count(arriving.or(`status.eq.out_for_delivery,and(status.eq.expected,expected_at.gte.${startOfToday.toISOString()},expected_at.lte.${endOfToday.toISOString()})`)) : 0,
    issues ? count(issues.in('status', ['open', 'scheduled', 'in_progress'])) : 0,
    has('finance.view') ? count(db.from('HomeBill').select('id', { count: 'exact', head: true }).eq('home_id', homeId).in('status', ['due', 'overdue'])) : 0,
    documents ? count(documents) : 0,
    count(db.from('HomePet').select('id', { count: 'exact', head: true }).eq('home_id', homeId)),
    has('security.manage') ? rows(db.from('HomeAuditLog').select('*').eq('home_id', homeId).order('created_at', { ascending: false }).limit(5)) : [],
  ]);
  const home = homeResult.data;
  if (!home) throw failure('HOME_NOT_FOUND', 404);
  if (home.id !== homeId) throw failure();
  if (home.location) home.location = parsePostGISPoint(home.location) || home.location;
  home.can_delete_home = (await authority.deleteEligibility(homeId, actorId)).allowed;

  // Pending, future, ended and unknown-role rows are not active household members.
  const members = rawMembers.filter(member => currentOccupancy(member) && resolveHomeRole(member));
  const ownerRows = members.length ? await rows(db.from('HomeOwner').select('subject_id, owner_status, verification_tier')
    .eq('home_id', homeId).eq('subject_type', 'user').in('subject_id', members.map(member => member.user_id)).neq('owner_status', 'revoked')) : [];
  const owners = new Map(ownerRows.map(owner => [owner.subject_id, owner]));
  const enrichedMembers = members.map(member => {
    const owner = owners.get(member.user_id);
    return { user_id: member.user_id, role: member.role, role_base: member.role_base, is_active: member.is_active, user: serializeUserAsLocalIdentity(member.user),
      display_role: ({ verified: 'owner', pending: 'pending_owner', disputed: 'disputed_owner' })[owner?.owner_status] || member.role,
      ownership_status: owner?.owner_status || null, verification_tier: owner?.verification_tier || null };
  });
  // Requested-but-failed health data must not become an absent/all-clear card.
  const healthScore = includeHealthScore && canReadHealthScore(access.permissions) ? await getHealthScore(homeId) : undefined;
  const current = await readAccess(homeId, actorId);
  if (fingerprint(current) !== fingerprint(access)
    || (current.occupancy && !currentOccupancy(current.occupancy))) throw failure('HOME_DASHBOARD_ACCESS_CHANGED');
  const upcomingEvents = events.filter(event => Date.parse(event.start_at) >= now.getTime())
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  return {
    home, myAccess: { permissions: current.permissions, role_base: current.role_base, isOwner: current.isOwner },
    today: {
      next_events: upcomingEvents.filter(event => Date.parse(event.start_at) <= endOfToday.getTime()).slice(0, 3),
      tasks_due: tasks.filter(task => !['done', 'canceled'].includes(task.status) && task.due_at && Date.parse(task.due_at) <= endOfToday.getTime())
        .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at)).slice(0, 3),
      next_bill: bills[0] || null, unread_mail_count: unread, active_guest_passes: guestPasses, deliveries_arriving: arrivingPackages,
    },
    counts: { tasks_open: tasks.filter(task => ['open', 'in_progress'].includes(task.status)).length,
      issues_open: openIssues, bills_due: dueBills, packages_expected: expectedPackages, documents: documentCount,
      events_upcoming: upcomingEvents.length, members_active: members.length, pets: petCount },
    members: enrichedMembers, recent_activity: activity,
    ...(healthScore !== undefined && { health_score: healthScore }),
  };
}
function sendError(res, error) {
  const safe = error && Object.hasOwn(MESSAGES, error.code) ? error : failure();
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}
module.exports = { read, readResource, sendError };
