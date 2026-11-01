/**
 * "You and <name>" on someone's profile (GET /api/users/:id/in-common): what the signed-in viewer and that person
 * share, limited to what the viewer may already see. Connections they both have, upcoming plans they're both in,
 * Support Trains they both signed up to help, and skills on both profiles.
 *
 * A block either way, or a profile the viewer can't open, gives nothing; the route checks those before calling
 * inCommon. Any failed read throws, so the route answers 503 and the apps leave the section out rather than show a
 * part of it that skipped a check.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const { loadUserSearchAccess } = require('../utils/visibilityPolicy');
const blockService = require('./blockService');
const planService = require('./plans/planService');
const { loadViewer } = require('./plans/planViewer');
const { isFeatureEnabled } = require('./featureFlagService');
const { loadChatPeople } = require('./chatPeople');
const { chosenUsernameOrNull } = require('../utils/personalUsername');

const MAX_PEOPLE = 2;
const MAX_PLANS = 2;
const MAX_TRAINS = 2;
const MAX_SKILLS = 3;
// A sign-up that wasn't canceled, as GET /api/activities/support-trains/:id counts a helper.
const HELPER_RESERVATION_STATUSES = ['reserved', 'delivered', 'confirmed'];

function emptyInCommon() {
  return { connections: { count: 0, people: [] }, plans: [], support_trains: [], skills: [] };
}

function unavailable(cause) {
  return Object.assign(new Error('What you have in common can\'t be loaded right now.'), {
    code: 'IN_COMMON_UNAVAILABLE', status: 503, cause,
  });
}

function rowsOrThrow(result) {
  if (result.error || !Array.isArray(result.data)) throw unavailable(result.error);
  return result.data;
}

/**
 * The people connected to both. Pantopus has no "who sees my connections" setting, so the person's "Who can find you"
 * setting decides whether the viewer sees their connections at all. Each shared person must be findable by the viewer
 * and by the person, with no block either way with either of them.
 */
async function sharedConnections(viewerId, targetId) {
  let graph;
  try {
    graph = await planService.connectionIdsByUser([viewerId, targetId]);
  } catch (err) {
    throw unavailable(err);
  }
  const mine = graph.get(String(viewerId)) || new Set();
  const shared = [...(graph.get(String(targetId)) || [])]
    .filter((id) => id !== String(viewerId) && id !== String(targetId) && mine.has(id));
  if (shared.length === 0) return { count: 0, people: [] };

  let viewerAccess, targetAccess, viewerBlocks, targetBlocks;
  try {
    [viewerAccess, targetAccess, viewerBlocks, targetBlocks] = await Promise.all([
      loadUserSearchAccess(viewerId, [targetId, ...shared]),
      loadUserSearchAccess(targetId, shared),
      blockService.blockedUserIds(viewerId),
      blockService.blockedUserIds(targetId),
    ]);
  } catch (err) {
    throw unavailable(err);
  }
  if (!viewerAccess.get(String(targetId))?.searchable) return { count: 0, people: [] };
  const visible = shared.filter((id) => viewerAccess.get(id)?.searchable && targetAccess.get(id)?.searchable
    && !viewerBlocks.has(id) && !targetBlocks.has(id));
  if (visible.length === 0) return { count: 0, people: [] };

  // loadChatPeople answers an empty map when its read fails; never fall back to account names.
  const people = await loadChatPeople(visible);
  if (people.size === 0) throw unavailable();
  const named = visible
    .map((id) => {
      const person = people.get(id);
      return person ? {
        id,
        name: person.displayName,
        username: chosenUsernameOrNull(person.handle),
        avatar_url: person.avatarUrl || null,
      } : null;
    })
    .filter(Boolean)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
  return { count: named.length, people: named.slice(0, MAX_PEOPLE) };
}

/** Upcoming plans each of them hosts or was accepted into, that the viewer may see (Plans' own rules). */
async function plansInCommon(viewerUser, targetId) {
  const viewerId = String(viewerUser.id);
  if (!(await isFeatureEnabled('plans', viewerUser))) return [];
  const ids = [viewerId, String(targetId)];
  const [hosted, accepted] = await Promise.all([
    supabaseAdmin.from('Plan').select('post_id, host_user_id').in('host_user_id', ids).eq('status', 'open'),
    supabaseAdmin.from('PlanRequest').select('post_id, user_id').in('user_id', ids).eq('status', 'accepted'),
  ]);
  const inPlan = new Map(ids.map((id) => [id, new Set()]));
  for (const row of rowsOrThrow(hosted)) inPlan.get(String(row.host_user_id))?.add(row.post_id);
  for (const row of rowsOrThrow(accepted)) inPlan.get(String(row.user_id))?.add(row.post_id);
  const both = [...inPlan.get(viewerId)].filter((postId) => inPlan.get(String(targetId)).has(postId));
  if (both.length === 0) return [];

  let rows, viewer;
  try {
    [rows, viewer] = await Promise.all([planService.loadPlanRows(both), loadViewer(viewerUser)]);
  } catch (err) {
    throw unavailable(err);
  }
  const now = Date.now();
  return rows
    .filter((plan) => plan.status === 'open'
      && new Date(planService.endsAt(plan) || 0).getTime() > now
      && planService.isVisibleTo(plan, viewer))
    .sort((a, b) => new Date(planService.startsAt(a)) - new Date(planService.startsAt(b)))
    .slice(0, MAX_PLANS)
    .map((plan) => ({
      id: plan.post_id,
      title: plan.post?.title || null,
      kind: plan.kind,
      starts_at: planService.startsAt(plan),
      ends_at: planService.endsAt(plan),
      host_id: String(plan.host_user_id),
    }));
}

/**
 * Support Trains both signed up to help, not drafts. A helper may always open their train, so these are trains the
 * viewer may see. The soonest upcoming sign-up of either first; trains with only past sign-ups after, newest first.
 */
async function trainsInCommon(viewerId, targetId) {
  const result = await supabaseAdmin
    .from('SupportTrainReservation')
    .select('support_train_id, user_id, slot:slot_id ( slot_date )')
    .in('user_id', [viewerId, targetId])
    .in('status', HELPER_RESERVATION_STATUSES);
  const byTrain = new Map();
  for (const row of rowsOrThrow(result)) {
    const entry = byTrain.get(row.support_train_id) || { users: new Set(), dates: [] };
    entry.users.add(String(row.user_id));
    if (row.slot?.slot_date) entry.dates.push(row.slot.slot_date);
    byTrain.set(row.support_train_id, entry);
  }
  const both = [...byTrain].filter(([, entry]) => entry.users.size === 2).map(([id]) => id);
  if (both.length === 0) return [];

  const trains = rowsOrThrow(await supabaseAdmin
    .from('SupportTrain')
    .select('id, status, Activity!inner ( title )')
    .in('id', both)
    .neq('status', 'draft'));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
  const rank = (id) => {
    const dates = byTrain.get(id).dates.slice().sort();
    const next = dates.find((d) => d >= today);
    return next ? { upcoming: true, date: next } : { upcoming: false, date: dates[dates.length - 1] || '' };
  };
  return trains
    .map((train) => ({ train, rank: rank(train.id) }))
    .sort((a, b) => {
      if (a.rank.upcoming !== b.rank.upcoming) return a.rank.upcoming ? -1 : 1;
      return a.rank.upcoming ? a.rank.date.localeCompare(b.rank.date) : b.rank.date.localeCompare(a.rank.date);
    })
    .slice(0, MAX_TRAINS)
    .map(({ train }) => ({ id: train.id, title: train.Activity?.title || null }));
}

/** Skills on both profiles (as the profile reads list them), in the person's order and spelling. */
async function skillsInCommon(viewerId, targetId) {
  const rows = rowsOrThrow(await supabaseAdmin
    .from('UserSkill')
    .select('user_id, skill_name, display_order')
    .in('user_id', [viewerId, targetId])
    .order('display_order', { ascending: true }));
  const key = (name) => String(name || '').trim().toLowerCase();
  const mine = new Set(rows.filter((r) => String(r.user_id) === String(viewerId)).map((r) => key(r.skill_name)));
  const shared = [];
  for (const row of rows) {
    if (String(row.user_id) !== String(targetId) || !mine.has(key(row.skill_name))) continue;
    if (!shared.some((name) => key(name) === key(row.skill_name))) shared.push(String(row.skill_name).trim());
  }
  return shared.slice(0, MAX_SKILLS);
}

/**
 * @param {{ id: string, role?: string }} viewerUser req.user
 * @param {string} targetId the profile's account id (not the viewer's)
 */
async function inCommon(viewerUser, targetId) {
  const viewerId = String(viewerUser.id);
  const [connections, plans, supportTrains, skills] = await Promise.all([
    sharedConnections(viewerId, targetId),
    plansInCommon(viewerUser, targetId),
    trainsInCommon(viewerId, targetId),
    skillsInCommon(viewerId, targetId),
  ]);
  return { connections, plans, support_trains: supportTrains, skills };
}

module.exports = { inCommon, emptyInCommon };
