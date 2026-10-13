'use strict';

/**
 * Nearby Plans: reading plans and shaping them for one viewer.
 *
 * Privacy (build brief §6) is enforced here and only here:
 *  - PlanCard carries the area only: the public area point stored on the Post,
 *    the area label, a distance band, never the exact point, venue, address,
 *    host's note or the people going.
 *  - PlanDetail adds those, only for the host and people who are in.
 *  - Playdates don't exist for viewers without a verified address or with
 *    plans_playdates off, and hide their time behind day_part until the viewer is in.
 *  - Blocks hide plans and requests both ways; mutes and hidden posts hide plans.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { verifiedUserIds } = require('./planViewer');
const { localDisplayNames } = require('../../utils/identityProfiles');
const rules = require('./planRules');

const POST_COLUMNS = 'id, title, content, event_date, event_end_date, latitude, longitude, location_precision, archived_at, archive_reason, created_at';
const PLAN_COLUMNS = [
  'post_id', 'host_user_id', 'kind', 'spots', 'auto_rules', 'join_requirement', 'place_kind',
  'area_label', 'city', 'details', 'guest_note', 'place_name', 'place_address', 'place_latitude',
  'place_longitude', 'place_home_id', 'timezone', 'status', 'cancel_note', 'chat_room_id',
  'chat_closed_at', 'host_summary_sent_at', 'created_at', 'updated_at', 'cancelled_at', 'ended_at',
].join(', ');
const PLAN_SELECT = `${PLAN_COLUMNS}, post:Post!inner(${POST_COLUMNS})`;
const REQUEST_COLUMNS = [
  'id', 'post_id', 'user_id', 'status', 'party_size', 'note', 'kids_count', 'kids_age_bands',
  'stays_with_kids', 'decided_by', 'reconfirm_requested_at', 'reconfirmed', 'on_my_way_at',
  'ask_count', 'distance_band', 'queued_at', 'reminded_at', 'feedback', 'feedback_note', 'feedback_at',
  'created_at', 'decided_at', 'updated_at',
].join(', ');
const USER_COLUMNS = 'id, name, first_name, last_name, profile_picture_url, created_at';

const ACTIVE_REQUEST_STATUSES = ['pending', 'waitlisted', 'accepted'];
const OPEN_REQUEST_STATUSES = ['pending', 'waitlisted'];
const NEW_ACCOUNT_DAYS = 30;
const PAGE_SIZE = 30;

function webBaseUrl() {
  return (process.env.PUBLIC_WEB_URL || process.env.APP_URL || 'https://pantopus.com').trim().replace(/\/+$/, '');
}

function shareUrl(postId) {
  return `${webBaseUrl()}/plans/${postId}`;
}

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * "Sam R.": the name someone already shows neighbors (identityProfiles.localDisplayNames),
 * shortened to a first name and a last initial, the way people meet on Plans.
 */
function displayName(user) {
  const full = cleanText(user?.local_display_name) || cleanText(user?.name)
    || [cleanText(user?.first_name), cleanText(user?.last_name)].filter(Boolean).join(' ');
  if (!full) return 'A neighbor';
  const words = full.split(' ');
  if (words.length === 1) return words[0];
  const last = words[words.length - 1].replace(/[^\p{L}\p{N}]/gu, '');
  return last ? `${words[0]} ${last[0].toUpperCase()}.` : words[0];
}

function firstName(user) {
  return displayName(user).split(' ')[0];
}

function avatarUrl(user) {
  return user?.profile_picture_url || null;
}

/** Every time in a Plans response: ISO 8601 in UTC with milliseconds, e.g. 2026-10-18T20:25:00.000Z. */
function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function startsAt(plan) {
  return iso(plan.post?.event_date);
}

function endsAt(plan) {
  return iso(plan.post?.event_end_date);
}

function areaPoint(plan) {
  const lat = Number(plan.post?.latitude);
  const lng = Number(plan.post?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

function exactPoint(plan) {
  return { latitude: Number(plan.place_latitude), longitude: Number(plan.place_longitude) };
}

// ── Visibility ───────────────────────────────────────────────

/**
 * May this viewer know the plan exists? (PlanCard at least.)
 * The host always may. Cancelled and ended plans stay visible by id so
 * people can see what happened; the lists and the map leave them out.
 */
function isVisibleTo(plan, viewer) {
  if (!plan || !plan.post) return false;
  const hostId = String(plan.host_user_id);
  if (hostId === viewer.id) return true;
  if (plan.post.archive_reason === 'moderation') return false;
  if (plan.kind === 'playdate' && !viewer.seesPlaydates) return false;
  if (viewer.blockedUserIds.has(hostId)) return false;
  if (viewer.mutedUserIds.has(hostId)) return false;
  if (viewer.hiddenPostIds.has(plan.post_id)) return false;
  return true;
}

// ── Loading ──────────────────────────────────────────────────

async function loadPlanRows(postIds) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin.from('Plan').select(PLAN_SELECT).in('post_id', ids);
  if (error) throw new Error(`Failed to load plans: ${error.message}`);
  return data || [];
}

async function loadPlanRow(postId) {
  const rows = await loadPlanRows([postId]);
  return rows[0] || null;
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Everything the cards need besides the plan rows, read in a few batched queries. */
async function loadCardContext(plans, viewer, { withPeople = false } = {}) {
  const planIds = plans.map((p) => p.post_id);
  const hostIds = [...new Set(plans.map((p) => String(p.host_user_id)))];
  const ctx = {
    requestsByPlan: new Map(),
    myRequestByPlan: new Map(),
    users: new Map(),
    verified: new Set(),
    hostedCount: new Map(),
    hostedKindCount: new Map(),
    hostedByHost: new Set(),
    mutualByHost: new Map(),
    answerMinutesByHost: new Map(),
    peopleStats: new Map(),
    viewerOpenRequestCount: 0,
  };
  if (planIds.length === 0) return ctx;

  const [activeRequests, myRequests, openCount, hostedRows, myHistory] = await Promise.all([
    supabaseAdmin.from('PlanRequest').select(REQUEST_COLUMNS).in('post_id', planIds).in('status', ACTIVE_REQUEST_STATUSES),
    supabaseAdmin.from('PlanRequest').select(REQUEST_COLUMNS).in('post_id', planIds).eq('user_id', viewer.id),
    supabaseAdmin.from('PlanRequest').select('id', { count: 'exact', head: true }).eq('user_id', viewer.id).in('status', OPEN_REQUEST_STATUSES),
    supabaseAdmin.from('Plan').select('host_user_id, kind').in('host_user_id', hostIds).eq('status', 'ended'),
    // People this viewer has been hosted by before (accepted at a plan that ended).
    supabaseAdmin.from('PlanRequest')
      .select('post_id, plan:Plan!inner(host_user_id, status)')
      .eq('user_id', viewer.id)
      .eq('status', 'accepted')
      .eq('plan.status', 'ended'),
  ]);
  for (const result of [activeRequests, myRequests, openCount, hostedRows, myHistory]) {
    if (result.error) throw new Error(`Failed to load plan details: ${result.error.message}`);
  }

  for (const request of activeRequests.data || []) {
    if (!ctx.requestsByPlan.has(request.post_id)) ctx.requestsByPlan.set(request.post_id, []);
    ctx.requestsByPlan.get(request.post_id).push(request);
  }
  for (const request of myRequests.data || []) ctx.myRequestByPlan.set(request.post_id, request);
  ctx.viewerOpenRequestCount = openCount.count || 0;
  for (const row of hostedRows.data || []) {
    const host = String(row.host_user_id);
    ctx.hostedCount.set(host, (ctx.hostedCount.get(host) || 0) + 1);
    const key = `${host}:${row.kind}`;
    ctx.hostedKindCount.set(key, (ctx.hostedKindCount.get(key) || 0) + 1);
  }
  for (const row of myHistory.data || []) {
    if (row.plan?.host_user_id) ctx.hostedByHost.add(String(row.plan.host_user_id));
  }

  // People: hosts always; guests only where the viewer will see the people list.
  const userIds = new Set(hostIds);
  if (withPeople) {
    for (const plan of plans) {
      for (const request of ctx.requestsByPlan.get(plan.post_id) || []) {
        if (request.status === 'accepted') userIds.add(String(request.user_id));
      }
    }
  }
  // The host sees, for each person in, whether they've hosted them before and how many plans they've joined.
  const hostedPeople = withPeople
    ? plans.filter((plan) => String(plan.host_user_id) === viewer.id)
      .flatMap((plan) => (ctx.requestsByPlan.get(plan.post_id) || []).filter((r) => r.status === 'accepted').map((r) => String(r.user_id)))
    : [];
  const [users, names, verified, mutual, answerMinutes, peopleStats] = await Promise.all([
    supabaseAdmin.from('User').select(USER_COLUMNS).in('id', [...userIds]),
    localDisplayNames([...userIds]),
    verifiedUserIds([...userIds]),
    mutualConnectionCounts(viewer.id, hostIds),
    typicalAnswerMinutes(hostIds),
    requesterStats(viewer.id, hostedPeople),
  ]);
  if (users.error) throw new Error(`Failed to load people: ${users.error.message}`);
  for (const user of users.data || []) {
    ctx.users.set(String(user.id), { ...user, local_display_name: names.get(String(user.id)) || null });
  }
  ctx.verified = verified;
  ctx.mutualByHost = mutual;
  ctx.answerMinutesByHost = answerMinutes;
  ctx.peopleStats = peopleStats;
  return ctx;
}

/**
 * How quickly each host usually answers asks: the median minutes from an ask to
 * the host's own yes or no, over their last 20 answers; null with fewer than 3.
 */
async function typicalAnswerMinutes(hostIds) {
  const result = new Map();
  if (hostIds.length === 0) return result;
  const { data, error } = await supabaseAdmin
    .from('PlanRequest')
    .select('created_at, queued_at, decided_at, plan:Plan!inner(host_user_id)')
    .in('plan.host_user_id', hostIds)
    .eq('decided_by', 'host')
    .not('decided_at', 'is', null)
    .order('decided_at', { ascending: false })
    .limit(400);
  if (error) {
    logger.warn('plans.answer_minutes.unavailable', { error: error.message });
    return result;
  }
  const byHost = new Map();
  for (const row of data || []) {
    const host = String(row.plan?.host_user_id);
    const asked = new Date(row.queued_at || row.created_at).getTime();
    const answered = new Date(row.decided_at).getTime();
    if (!Number.isFinite(asked) || !Number.isFinite(answered) || answered < asked) continue;
    const list = byHost.get(host) || [];
    if (list.length < 20) list.push((answered - asked) / 60000);
    byHost.set(host, list);
  }
  for (const [host, minutes] of byHost) {
    if (minutes.length < 3) continue;
    const sorted = [...minutes].sort((a, b) => a - b);
    result.set(host, Math.max(1, Math.round(sorted[Math.floor(sorted.length / 2)])));
  }
  return result;
}

/**
 * For the host's view of people (requests and the people going): how many plans
 * each person has joined (accepted at a plan that ended) and whether this host
 * hosted them before.
 */
async function requesterStats(hostId, userIds) {
  const ids = [...new Set((userIds || []).map(String))];
  const stats = new Map(ids.map((id) => [id, { plans_joined: 0, hosted_before: false }]));
  if (ids.length === 0) return stats;
  const { data, error } = await supabaseAdmin
    .from('PlanRequest')
    .select('user_id, plan:Plan!inner(host_user_id, status)')
    .in('user_id', ids)
    .eq('status', 'accepted')
    .eq('plan.status', 'ended');
  if (error) throw new Error(`Failed to load people's plans: ${error.message}`);
  for (const row of data || []) {
    const entry = stats.get(String(row.user_id));
    if (!entry) continue;
    entry.plans_joined += 1;
    if (String(row.plan?.host_user_id) === String(hostId)) entry.hosted_before = true;
  }
  return stats;
}

async function connectionIdsByUser(userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  const result = new Map(ids.map((id) => [id, new Set()]));
  if (ids.length === 0) return result;
  const list = ids.join(',');
  const { data, error } = await supabaseAdmin
    .from('Relationship')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.in.(${list}),addressee_id.in.(${list})`);
  if (error) throw new Error(`Failed to load connections: ${error.message}`);
  for (const row of data || []) {
    const a = String(row.requester_id);
    const b = String(row.addressee_id);
    if (result.has(a)) result.get(a).add(b);
    if (result.has(b)) result.get(b).add(a);
  }
  return result;
}

/** How many connections the viewer shares with each of the other people. */
async function mutualConnectionCounts(viewerId, otherIds) {
  const others = [...new Set(otherIds.map(String))].filter((id) => id !== String(viewerId));
  const counts = new Map();
  if (others.length === 0) return counts;
  const graph = await connectionIdsByUser([viewerId, ...others]);
  const mine = graph.get(String(viewerId)) || new Set();
  for (const other of others) {
    let shared = 0;
    for (const id of graph.get(other) || []) {
      if (id !== String(viewerId) && id !== other && mine.has(id)) shared += 1;
    }
    counts.set(other, shared);
  }
  return counts;
}

// ── Shaping ──────────────────────────────────────────────────

function seatsTaken(plan, requests) {
  return (requests || [])
    .filter((r) => r.status === 'accepted')
    .reduce((sum, r) => sum + rules.seatsFor(plan.kind, r.party_size), 0);
}

function waitlistOrder(requests) {
  return (requests || [])
    .filter((r) => r.status === 'waitlisted')
    .sort((a, b) => (new Date(a.queued_at) - new Date(b.queued_at)) || String(a.id).localeCompare(String(b.id)));
}

function viewerRole(plan, viewer, myRequest) {
  if (String(plan.host_user_id) === viewer.id) return 'host';
  if (myRequest?.status === 'accepted') return 'guest';
  return 'none';
}

/** The viewer's nearest location to the plan's public area point, in meters. */
function nearestLocationMeters(plan, viewer) {
  const area = areaPoint(plan);
  if (!area) return null;
  let best = null;
  for (const location of viewer.locations) {
    const d = rules.distanceMeters(location, area);
    if (d != null && (best == null || d < best)) best = d;
  }
  return best;
}

/** Which automatic rule would let this viewer in right now, if any. */
function matchingAutoRule(plan, viewer, ctx) {
  const autoRules = Array.isArray(plan.auto_rules) ? plan.auto_rules : [];
  if (autoRules.length === 0 || plan.kind === 'playdate') return null;
  if (autoRules.includes('hosted_before') && ctx.hostedByHost.has(String(plan.host_user_id))) return 'hosted_before';
  if (plan.place_kind === 'home') return null;
  if (autoRules.includes('verified') && viewer.verified) return 'verified';
  if (autoRules.includes('anyone_nearby') && ['pickup_game', 'walk_coffee'].includes(plan.kind)) return 'anyone_nearby';
  return null;
}

/**
 * Can this viewer send an ask now, and why not.
 * Reasons: needs_verified_address, too_far, needs_location, full_use_waitlist,
 * declined, removed, blocked, too_many_requests, ended.
 * When the plan is full, `can_ask` is false with full_use_waitlist, and
 * POST /requests still works: it puts the viewer on the waitlist.
 */
function askEligibility(plan, viewer, ctx, { myRequest, spotsLeft, state }) {
  const no = (reason) => ({ can_ask: false, cannot_ask_reason: reason });
  if (String(plan.host_user_id) === viewer.id) return no(null);
  if (myRequest && ACTIVE_REQUEST_STATUSES.includes(myRequest.status)) return no(null);
  if (state === 'cancelled' || state === 'ended') return no('ended');
  if (!rules.isAskingOpen(plan, startsAt(plan), endsAt(plan))) return no('ended');
  if (myRequest?.status === 'declined') return no('declined');
  if (myRequest?.status === 'removed') return no('removed');
  if (viewer.blockedUserIds.has(String(plan.host_user_id))) return no('blocked');
  if (myRequest && myRequest.ask_count >= rules.LIMITS.asksPerPlan) return no('too_many_requests');
  if (ctx.viewerOpenRequestCount >= rules.LIMITS.openRequestsPerPerson) return no('too_many_requests');
  const needsVerified = plan.kind === 'playdate' || plan.join_requirement === 'verified';
  if (needsVerified && !viewer.verified) return no('needs_verified_address');
  if (viewer.locations.length === 0) return no('needs_location');
  const radius = plan.kind === 'playdate' ? rules.PLAYDATE_ASK_RADIUS_METERS : rules.ASK_RADIUS_METERS;
  const nearest = nearestLocationMeters(plan, viewer);
  if (nearest == null || nearest > radius) return no('too_far');
  if (spotsLeft <= 0) return no('full_use_waitlist');
  return { can_ask: true, cannot_ask_reason: null };
}

function myRequestView(plan, request, { waitlistPosition = null } = {}) {
  if (!request) return null;
  return {
    id: request.id,
    status: request.status,
    party_size: request.party_size,
    note: request.note || null,
    kids_count: plan.kind === 'playdate' ? request.kids_count ?? null : null,
    kids_age_bands: plan.kind === 'playdate' ? request.kids_age_bands || [] : null,
    reconfirm_needed: Boolean(request.reconfirm_requested_at) && request.reconfirmed == null && request.status === 'accepted',
    on_my_way: Boolean(request.on_my_way_at),
    waitlist_position: waitlistPosition,
    decided_by: request.decided_by || null,
    decided_at: iso(request.decided_at),
    created_at: iso(request.created_at),
    asks_left: Math.max(0, rules.LIMITS.asksPerPlan - (request.ask_count || 1)),
    feedback: request.feedback || null,
  };
}

function publicDetails(plan) {
  const details = plan.details && typeof plan.details === 'object' ? plan.details : {};
  const out = {};
  for (const key of ['game', 'sport', 'level', 'extra_gear', 'kids_age_bands', 'walk_kind', 'pace', 'dogs_welcome']) {
    if (details[key] !== undefined && details[key] !== null) out[key] = details[key];
  }
  // A watch party's game time is the plan's time; it is public like the plan's.
  if (out.game && typeof out.game === 'object') {
    out.game = { label: out.game.label || null, starts_at: iso(out.game.starts_at) };
  }
  return out;
}

/** PlanCard: what anyone allowed to see the plan gets. */
function buildCard(plan, viewer, ctx) {
  const now = Date.now();
  const hostId = String(plan.host_user_id);
  const host = ctx.users.get(hostId);
  const requests = ctx.requestsByPlan.get(plan.post_id) || [];
  const myRequest = ctx.myRequestByPlan.get(plan.post_id) || null;
  const role = viewerRole(plan, viewer, myRequest);
  const isIn = role === 'host' || role === 'guest';
  const going = seatsTaken(plan, requests);
  const spotsLeft = Math.max(0, plan.spots - going);
  const waitlist = waitlistOrder(requests);
  const state = rules.planState(plan, startsAt(plan), endsAt(plan), now);
  const hideTime = plan.kind === 'playdate' && !isIn;
  const area = areaPoint(plan);
  const local = rules.localParts(startsAt(plan), plan.timezone);
  const myWaitIndex = myRequest?.status === 'waitlisted'
    ? waitlist.findIndex((r) => r.id === myRequest.id)
    : -1;
  const waitlistPosition = myWaitIndex >= 0 ? myWaitIndex + 1 : null;
  const autoRule = role === 'none' ? matchingAutoRule(plan, viewer, ctx) : null;
  const eligibility = askEligibility(plan, viewer, ctx, { myRequest, spotsLeft, state });
  const distanceFrom = viewer.origin;

  const card = {
    id: plan.post_id,
    kind: plan.kind,
    title: plan.post.title,
    about: plan.post.content || '',
    starts_at: hideTime ? null : startsAt(plan),
    ends_at: hideTime ? null : endsAt(plan),
    starts_on: local ? local.date : null,
    day_part: rules.dayPart(startsAt(plan), plan.timezone),
    timezone: plan.timezone,
    area: {
      label: plan.area_label,
      city: plan.city || null,
      latitude: area ? area.latitude : null,
      longitude: area ? area.longitude : null,
      precision: plan.kind === 'playdate' ? 'neighborhood' : 'area',
    },
    distance_band: distanceFrom && area ? rules.distanceBandFromMeters(rules.distanceMeters(distanceFrom, area)) : null,
    place_kind: plan.place_kind,
    host: {
      user_id: hostId,
      display_name: displayName(host),
      avatar_url: avatarUrl(host),
      verified_address: ctx.verified.has(hostId),
      plans_hosted: ctx.hostedCount.get(hostId) || 0,
      kind_hosted: ctx.hostedKindCount.get(`${hostId}:${plan.kind}`) || 0,
      mutual_connections: hostId === viewer.id ? 0 : ctx.mutualByHost.get(hostId) || 0,
      typical_answer_minutes: ctx.answerMinutesByHost.get(hostId) ?? null,
    },
    spots: plan.spots,
    going_count: going,
    spots_left: spotsLeft,
    is_full: spotsLeft <= 0,
    waitlist_count: waitlist.length,
    details: publicDetails(plan),
    how_people_get_in: autoRule ? 'automatic' : 'host_approves',
    join_requirement: plan.join_requirement,
    state,
    asking_closes_at: hideTime ? null : rules.askingClosesAt(plan.kind, startsAt(plan), endsAt(plan)).toISOString(),
    viewer: {
      role,
      request_status: myRequest ? myRequest.status : null,
      waitlist_position: waitlistPosition,
      can_ask: eligibility.can_ask,
      cannot_ask_reason: eligibility.cannot_ask_reason,
      auto_rule: autoRule,
      feedback_given: Boolean(myRequest?.feedback),
    },
    my_request: myRequestView(plan, myRequest, { waitlistPosition }),
    share_url: shareUrl(plan.post_id),
  };

  if (role === 'host') {
    card.requests_count = requests.filter((r) => r.status === 'pending').length;
    card.auto_rules = Array.isArray(plan.auto_rules) ? plan.auto_rules : [];
  }
  return card;
}

/** PlanDetail: the card plus the private parts, only for the host and people who are in. */
function buildDetail(plan, viewer, ctx) {
  const card = buildCard(plan, viewer, ctx);
  if (card.viewer.role !== 'host' && card.viewer.role !== 'guest') return card;

  const hostId = String(plan.host_user_id);
  const host = ctx.users.get(hostId);
  const exact = exactPoint(plan);
  const viewerIsHost = card.viewer.role === 'host';
  const requests = ctx.requestsByPlan.get(plan.post_id) || [];

  card.place = {
    name: plan.place_kind === 'home' ? `${firstName(host)}'s place` : (plan.place_name || plan.area_label),
    address: plan.place_address || null,
    latitude: exact.latitude,
    longitude: exact.longitude,
    note: plan.guest_note || null,
  };
  if (viewer.origin) {
    card.distance_band = rules.distanceBandFromMeters(rules.distanceMeters(viewer.origin, exact));
  }

  const people = [{
    user_id: hostId,
    display_name: displayName(host),
    avatar_url: avatarUrl(host),
    party_size: 1,
    verified_address: ctx.verified.has(hostId),
    is_host: true,
    on_my_way: false,
  }];
  const accepted = requests
    .filter((r) => r.status === 'accepted')
    .sort((a, b) => new Date(a.decided_at || a.created_at) - new Date(b.decided_at || b.created_at));
  for (const request of accepted) {
    const userId = String(request.user_id);
    if (userId !== viewer.id && viewer.blockedUserIds.has(userId)) continue;
    const person = ctx.users.get(userId);
    const entry = {
      user_id: userId,
      display_name: displayName(person),
      avatar_url: avatarUrl(person),
      party_size: request.party_size,
      verified_address: ctx.verified.has(userId),
      is_host: false,
      on_my_way: Boolean(request.on_my_way_at),
    };
    if (viewerIsHost) {
      entry.request_id = request.id;
      entry.distance_band = request.distance_band || null;
      entry.kids_count = plan.kind === 'playdate' ? request.kids_count ?? null : undefined;
      entry.kids_age_bands = plan.kind === 'playdate' ? request.kids_age_bands || [] : undefined;
      entry.reconfirm_needed = Boolean(request.reconfirm_requested_at) && request.reconfirmed == null;
      const stats = ctx.peopleStats.get(userId) || { plans_joined: 0, hosted_before: false };
      entry.hosted_before = stats.hosted_before;
      entry.plans_joined = stats.plans_joined;
      entry.new_to_pantopus = isNewAccount(person);
    }
    people.push(entry);
  }
  card.people = people;
  card.chat_room_id = plan.chat_room_id || null;
  card.chat_open = Boolean(plan.chat_room_id) && !plan.chat_closed_at && plan.status !== 'cancelled';
  if (plan.status === 'cancelled') card.cancel_note = plan.cancel_note || null;
  return card;
}

function isNewAccount(user) {
  if (!user?.created_at) return false;
  return Date.now() - new Date(user.created_at).getTime() < NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000;
}

// ── Queries ──────────────────────────────────────────────────

function windowMatches(plan, window, now = Date.now()) {
  const start = new Date(startsAt(plan)).getTime();
  const end = new Date(endsAt(plan)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= now) return false;
  const tz = plan.timezone || rules.DEFAULT_TIMEZONE;
  const live = start <= now;
  switch (window) {
    case 'now':
      return live || start - now <= 60 * 60 * 1000;
    case 'today': {
      const today = rules.localParts(new Date(now), tz).date;
      return live || rules.localParts(new Date(start), tz).date === today;
    }
    case 'weekend': {
      const todayParts = rules.localParts(new Date(now), tz);
      const startParts = rules.localParts(new Date(start), tz);
      const dayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const todayIdx = dayIndex[todayParts.weekday];
      // This weekend: the coming Saturday and Sunday (today included when it is one).
      const daysToSat = todayIdx === 0 ? -1 : 6 - todayIdx;
      const sat = new Date(now + daysToSat * 24 * 60 * 60 * 1000);
      const sun = new Date(sat.getTime() + 24 * 60 * 60 * 1000);
      const satDate = rules.localParts(sat, tz).date;
      const sunDate = rules.localParts(sun, tz).date;
      return startParts.date === satDate || startParts.date === sunDate || (live && [satDate, sunDate].includes(todayParts.date));
    }
    case 'week':
    default:
      return start - now <= 7 * 24 * 60 * 60 * 1000;
  }
}

function boundingBox(point, radiusMeters) {
  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.max(Math.cos((point.latitude * Math.PI) / 180), 0.01));
  return {
    south: point.latitude - latDelta,
    north: point.latitude + latDelta,
    west: point.longitude - lngDelta,
    east: point.longitude + lngDelta,
  };
}

/** Open plans whose public area point is inside the box. */
async function queryOpenPlansInBox(box, { kinds } = {}) {
  let query = supabaseAdmin
    .from('Plan')
    .select(PLAN_SELECT)
    .eq('status', 'open')
    .is('post.archived_at', null)
    .gt('post.event_end_date', new Date().toISOString())
    .gte('post.latitude', box.south)
    .lte('post.latitude', box.north)
    .gte('post.longitude', box.west)
    .lte('post.longitude', box.east)
    .limit(500);
  if (kinds && kinds.length > 0) query = query.in('kind', kinds);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load nearby plans: ${error.message}`);
  return data || [];
}

function encodeCursor(plan) {
  return Buffer.from(`${startsAt(plan)}|${plan.post_id}`).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    const time = new Date(at).getTime();
    if (!Number.isFinite(time) || !isUuid(id)) return null;
    return { time, id };
  } catch (_) {
    return null;
  }
}

function soonestFirst(a, b) {
  return (new Date(startsAt(a)) - new Date(startsAt(b))) || String(a.post_id).localeCompare(String(b.post_id));
}

/** GET /api/plans: the list under the map, soonest first, within 5 miles of the point. */
async function listNearby(viewer, { point, window = 'week', kinds = [], cursor = null }) {
  const box = boundingBox(point, rules.LIST_RADIUS_METERS);
  const rows = await queryOpenPlansInBox(box, { kinds });
  const after = decodeCursor(cursor);
  const matching = rows
    .filter((plan) => isVisibleTo(plan, viewer))
    .filter((plan) => {
      const area = areaPoint(plan);
      const d = area ? rules.distanceMeters(point, area) : null;
      return d != null && d <= rules.LIST_RADIUS_METERS;
    })
    .filter((plan) => windowMatches(plan, window))
    .sort(soonestFirst)
    .filter((plan) => {
      if (!after) return true;
      const t = new Date(startsAt(plan)).getTime();
      return t > after.time || (t === after.time && String(plan.post_id) > after.id);
    });

  const page = matching.slice(0, PAGE_SIZE);
  const ctx = await loadCardContext(page, viewer);
  const items = page.map((plan) => buildCard(plan, viewer, ctx));
  const nextCursor = matching.length > PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null;

  let nearestElsewhere = null;
  if (items.length === 0 && !after) {
    nearestElsewhere = await findNearestElsewhere(viewer, point, { window, kinds });
  }
  return { items, next_cursor: nextCursor, nearest_elsewhere: nearestElsewhere };
}

/** For the empty list (F4): the closest town with plans within 15 miles, as a count and a band. */
async function findNearestElsewhere(viewer, point, { window, kinds }) {
  try {
    const rows = await queryOpenPlansInBox(boundingBox(point, 15 * rules.MILE_METERS), { kinds });
    const byCity = new Map();
    for (const plan of rows) {
      if (!isVisibleTo(plan, viewer) || !windowMatches(plan, window)) continue;
      const area = areaPoint(plan);
      const d = area ? rules.distanceMeters(point, area) : null;
      if (d == null || d <= rules.LIST_RADIUS_METERS || d > 15 * rules.MILE_METERS) continue;
      const key = plan.city || plan.area_label;
      const entry = byCity.get(key) || { city: key, count: 0, meters: d };
      entry.count += 1;
      entry.meters = Math.min(entry.meters, d);
      byCity.set(key, entry);
    }
    const closest = [...byCity.values()].sort((a, b) => a.meters - b.meters)[0];
    if (!closest) return null;
    return {
      city: closest.city,
      count: closest.count,
      miles: Math.max(1, Math.round(closest.meters / rules.MILE_METERS)),
    };
  } catch (err) {
    logger.warn('plans.nearby_elsewhere.failed', { error: err.message });
    return null;
  }
}

/** GET /api/plans/mine: Your plans and Today. */
async function listMine(viewer) {
  const nowIso = new Date().toISOString();
  const recentIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const [hosting, requests] = await Promise.all([
    supabaseAdmin.from('Plan').select(PLAN_SELECT)
      .eq('host_user_id', viewer.id)
      .in('status', ['open', 'ended'])
      .gt('post.event_end_date', recentIso)
      .limit(50),
    supabaseAdmin.from('PlanRequest')
      .select('post_id, status')
      .eq('user_id', viewer.id)
      .in('status', ACTIVE_REQUEST_STATUSES)
      .limit(200),
  ]);
  if (hosting.error) throw new Error(`Failed to load your plans: ${hosting.error.message}`);
  if (requests.error) throw new Error(`Failed to load your requests: ${requests.error.message}`);

  const requestedRows = await loadPlanRows((requests.data || []).map((r) => r.post_id));
  const all = new Map();
  for (const plan of [...(hosting.data || []), ...requestedRows]) all.set(plan.post_id, plan);
  const visible = [...all.values()].filter((plan) => isVisibleTo(plan, viewer) && plan.status !== 'cancelled');
  const ctx = await loadCardContext(visible, viewer);

  const out = { hosting: [], going: [], asked: [], waitlisted: [], recent: [] };
  for (const plan of visible.sort(soonestFirst)) {
    const ended = new Date(endsAt(plan)).getTime() <= Date.now() || plan.status === 'ended';
    const card = buildCard(plan, viewer, ctx);
    const status = card.viewer.request_status;
    if (ended) {
      // A5: how was it (guests who were in) and host again (hosts), for two days.
      if (new Date(endsAt(plan)).toISOString() >= recentIso && (card.viewer.role === 'host' || status === 'accepted')) {
        out.recent.push(card);
      }
      continue;
    }
    if (endsAt(plan) <= nowIso) continue;
    if (card.viewer.role === 'host') out.hosting.push(card);
    else if (status === 'accepted') out.going.push(card);
    else if (status === 'pending') out.asked.push(card);
    else if (status === 'waitlisted') out.waitlisted.push(card);
  }
  return out;
}

/**
 * GET /api/plans/:id: PlanDetail for the host and people who are in, PlanCard
 * for everyone else who may see it, null (404) otherwise.
 */
async function getForViewer(postId, viewer) {
  if (!isUuid(postId)) return { plan: null, body: null };
  const plan = await loadPlanRow(postId);
  if (!plan) return { plan: null, body: null };
  if (!isVisibleTo(plan, viewer)) return { plan, body: null };
  const ctx = await loadCardContext([plan], viewer, { withPeople: true });
  return { plan, body: buildDetail(plan, viewer, ctx) };
}

module.exports = {
  PLAN_SELECT,
  REQUEST_COLUMNS,
  USER_COLUMNS,
  ACTIVE_REQUEST_STATUSES,
  OPEN_REQUEST_STATUSES,
  displayName,
  firstName,
  shareUrl,
  startsAt,
  endsAt,
  areaPoint,
  exactPoint,
  iso,
  isUuid,
  isVisibleTo,
  loadPlanRow,
  loadPlanRows,
  loadCardContext,
  buildCard,
  buildDetail,
  seatsTaken,
  waitlistOrder,
  matchingAutoRule,
  askEligibility,
  nearestLocationMeters,
  mutualConnectionCounts,
  connectionIdsByUser,
  requesterStats,
  typicalAnswerMinutes,
  listNearby,
  listMine,
  getForViewer,
  queryOpenPlansInBox,
  windowMatches,
  boundingBox,
};
