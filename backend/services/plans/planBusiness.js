'use strict';

/**
 * Plans with businesses: the business side of a plan (docs/product/plans-with-businesses, the build contract).
 *
 * A verified business hosts a plan at one of its own locations. The business itself is the plan's host
 * (Plan.host_user_id is the business's account, and Plan.business_user_id says so), so every card, notice and chat
 * line names the business through the code that names any host. The staff member who posted is kept in
 * Plan.posted_by_user_id and is sent only to the business's own team.
 *
 * Who is sent a business's plan (the contract's section 5.1). All three must hold:
 *   1. the viewer has `plans_business`;
 *   2. the plan's business is still one Pantopus has verified with a published page, and has `plans_business`
 *      (and `plans_business_kids`, for a plan for kids, which the viewer needs too);
 *   3. the request says the app can draw it (`biz=1`).
 * Anything else behaves as if the plan did not exist. The check is planService.isVisibleTo; this file supplies
 * what it reads: `viewer.biz` (planViewer) and `plan.business` (attachBusinessHosts below). A plan row that
 * nobody attached a business to is invisible, so a path that forgets to attach one hides the plan.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const parsePostGISPoint = require('../../utils/parsePostGISPoint');
const { isFeatureEnabled } = require('../featureFlagService');
const { actingForBusiness, isVerifiedAndPublished } = require('../businessActing');
const { getBusinessIdsWithPermissions, getTeamMembersWithPermissions } = require('../../utils/businessPermissions');
const { namedPlaceRef, isPublicLocation } = require('../placeRefs');
const rules = require('./planRules');

const FLAG = 'plans_business';
const KIDS_FLAG = 'plans_business_kids';
const LOCATION_COLUMNS = 'id, business_user_id, label, is_primary, is_active, sort_order, address, address2, city, state, '
  + 'zipcode, location, location_type, place_ref';

// planActions requires this module; its error class is read when one is thrown.
const fail = (status, code, message) => { throw new (require('./planActions').PlanError)(status, code, message); };

function webBaseUrl() {
  return (process.env.PUBLIC_WEB_URL || process.env.APP_URL || 'https://pantopus.com').trim().replace(/\/+$/, '');
}

/** A flag for a business's own account. A business is an ordinary account row, never internal staff. */
const flagFor = (flag, businessUserId) => isFeatureEnabled(flag, { id: String(businessUserId), role: 'user' });

// ── The business behind a plan ───────────────────────────────

/**
 * The businesses behind these ids as hosts: who they are, and whether their plans may be shown now.
 * @returns {Promise<Map<string, { id, name, username, avatar_url, verified, ok, kids_ok }>>}
 *   `ok`: verified with a published page, and has plans_business. `kids_ok`: also has plans_business_kids.
 *   An id that is not a business account (a retired business, say) is left out.
 */
async function loadBusinessHosts(businessUserIds) {
  const ids = [...new Set((businessUserIds || []).filter(Boolean).map(String))];
  const hosts = new Map();
  if (ids.length === 0) return hosts;
  const [accounts, profiles] = await Promise.all([
    supabaseAdmin.from('User').select('id, name, username, profile_picture_url, account_type').in('id', ids),
    supabaseAdmin.from('BusinessProfile').select('business_user_id, verification_status, is_published').in('business_user_id', ids),
  ]);
  if (accounts.error || profiles.error) {
    throw new Error(`Failed to load the businesses hosting plans: ${(accounts.error || profiles.error).message}`);
  }
  const profileOf = new Map((profiles.data || []).map((row) => [String(row.business_user_id), row]));
  await Promise.all((accounts.data || []).map(async (account) => {
    if (account.account_type !== 'business') return;
    const id = String(account.id);
    const verified = isVerifiedAndPublished(profileOf.get(id));
    const [on, kidsOn] = verified ? await Promise.all([flagFor(FLAG, id), flagFor(KIDS_FLAG, id)]) : [false, false];
    hosts.set(id, {
      id,
      name: String(account.name || '').replace(/\s+/g, ' ').trim() || 'A business',
      username: account.username || null,
      avatar_url: account.profile_picture_url || null,
      verified,
      ok: verified && on,
      kids_ok: verified && on && kidsOn,
    });
  }));
  return hosts;
}

/**
 * Puts `plan.business` on every plan a business hosts (null when the business is gone), and returns the plans.
 * A neighbor's plan is left as it is. Every read that may show a plan to someone goes through this.
 */
async function attachBusinessHosts(plans) {
  const hosted = (plans || []).filter((plan) => plan && plan.business_user_id);
  if (hosted.length === 0) return plans || [];
  const hosts = await loadBusinessHosts(hosted.map((plan) => plan.business_user_id));
  for (const plan of hosted) plan.business = hosts.get(String(plan.business_user_id)) || null;
  return plans;
}

/**
 * May this business's plan be shown to this viewer (the contract's section 5.1)?
 *
 * The viewer's own side always holds: the switch, an app that can draw it, and for a plan for kids the kids'
 * switch. The business's side (still verified and published, with its switches) decides who can find and join
 * the plan. `involved`: the viewer runs the plan, or is in or waiting. They keep reading it after the business
 * stops qualifying, so a guest can still leave and the team can still cancel; nobody new can find or join it.
 */
function shownTo(plan, viewer, { involved = false } = {}) {
  if (!viewer || !viewer.biz) return false;
  if (plan.kind === 'playdate' && !viewer.bizKids) return false;
  if (hostsNow(plan)) return true;
  return involved;
}

/** May the plan's business host right now: verified with a published page, and with its switches on? */
function hostsNow(plan) {
  const business = plan.business;
  if (!business || !business.ok) return false;
  return plan.kind !== 'playdate' || business.kids_ok;
}

/**
 * Of these people, the ones a business's plan exists for: their own switch, and the kids' one for a plan for
 * kids. For notices sent without a request (an invitation, a host's news for the team), so that nobody is told
 * about a plan their app would answer 404 for. A neighbor's plan: everyone.
 */
async function peopleShown(plan, userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (!plan.business_user_id) return new Set(ids);
  const shown = new Set();
  await Promise.all(ids.map(async (id) => {
    const person = { id, role: 'user' };
    if (!(await isFeatureEnabled(FLAG, person))) return;
    if (plan.kind === 'playdate' && !(await isFeatureEnabled(KIDS_FLAG, person))) return;
    shown.add(id);
  }));
  return shown;
}

/** The business as guests see it on a card. `proof` waits for check-in (paid spots): null until then. */
function publicBusiness(plan, { plansHosted = 0 } = {}) {
  const business = plan.business;
  if (!business) return null;
  return {
    user_id: business.id,
    name: business.name,
    avatar_url: business.avatar_url,
    verified: business.verified,
    page_url: business.username ? `${webBaseUrl()}/b/${business.username}` : null,
    plans_hosted: plansHosted,
    proof: null,
  };
}

/** The label a business chose, as its key and the words guests read; null for a label this server doesn't know. */
function labelView(plan) {
  const text = plan.label ? (rules.BUSINESS_LABELS[plan.kind] || {})[plan.label] : null;
  return text ? { key: plan.label, text } : null;
}

// ── Who on the team does what ────────────────────────────────

/**
 * The businesses a person acts for in Plans: `post` (may post a plan as it) and `manage` (runs its plans).
 * Empty sets without a read when the person's switch is off.
 */
async function teamRolesOf(userId, { enabled }) {
  const none = { post: new Set(), manage: new Set() };
  if (!enabled) return none;
  try {
    const [post, manage] = await Promise.all([
      getBusinessIdsWithPermissions(userId, ['plans.post']),
      getBusinessIdsWithPermissions(userId, ['plans.manage']),
    ]);
    return { post: new Set(post.map(String)), manage: new Set(manage.map(String)) };
  } catch (err) {
    // Without the team rows nobody is shown to act for a business: they see its plans as a guest would.
    logger.warn('plans.business.team_roles_unavailable', { userId, error: err.message });
    return none;
  }
}

/**
 * Does this viewer run this plan? A neighbor's plan: its host. A business's plan: anyone on the team who holds
 * plans.manage, and the staff member who posted it while they may still post for the business.
 */
function runsPlan(plan, viewer) {
  if (!plan || !viewer) return false;
  if (!plan.business_user_id) return String(plan.host_user_id) === viewer.id;
  const business = String(plan.business_user_id);
  if (viewer.businessManage && viewer.businessManage.has(business)) return true;
  return String(plan.posted_by_user_id || '') === viewer.id && Boolean(viewer.businessPost && viewer.businessPost.has(business));
}

/**
 * The staff who hear what a host hears about this plan: the business's team members who hold plans.manage and
 * whom the plan exists for (a notice must not open a plan their app answers 404 for).
 */
async function staffToNotify(plan) {
  try {
    const staff = (await getTeamMembersWithPermissions(plan.business_user_id, ['plans.manage'])).map(String);
    const shown = await peopleShown(plan, staff);
    return staff.filter((id) => shown.has(id));
  } catch (err) {
    logger.warn('plans.business.staff_unavailable', { businessUserId: plan.business_user_id, error: err.message });
    return [];
  }
}

// ── Posting as a business ────────────────────────────────────

function locationView(row) {
  const point = parsePostGISPoint(row.location);
  return {
    id: row.id,
    label: row.label,
    is_primary: row.is_primary === true,
    address: [row.address, row.city].filter(Boolean).join(', '),
    latitude: point ? point.latitude : null,
    longitude: point ? point.longitude : null,
  };
}

/**
 * A business's locations a plan can meet at: active, a place people walk into (a storefront, an office or a
 * warehouse: never a business working from a home, a service area, a mailbox or a location of unknown type), and
 * on the map.
 */
async function meetingLocations(businessUserIds) {
  const ids = [...new Set((businessUserIds || []).map(String))];
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin.from('BusinessLocation').select(LOCATION_COLUMNS)
    .in('business_user_id', ids).eq('is_active', true)
    .order('is_primary', { ascending: false }).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to load business locations: ${error.message}`);
  return (data || []).filter((row) => isPublicLocation(row) && parsePostGISPoint(row.location));
}

/** The kinds a business may post, with what each reads for a business and the labels it may carry. */
function kindsFor({ kids }) {
  return rules.KINDS.filter((kind) => kind !== 'playdate' || kids).map((kind) => ({
    kind,
    name: rules.BUSINESS_KIND_NAMES[kind],
    labels: Object.entries(rules.BUSINESS_LABELS[kind]).map(([key, text]) => ({ key, text })),
  }));
}

/**
 * GET /api/plans/host-as: the businesses this person may post a plan for, each with the locations it can meet
 * at. Empty for nearly everyone; the apps show "Host as" only when it isn't.
 */
async function hostAsChoices(viewer) {
  if (!viewer.biz || viewer.businessPost.size === 0) return { businesses: [] };
  const hosts = await loadBusinessHosts([...viewer.businessPost]);
  const allowed = [...hosts.values()].filter((host) => host.ok);
  const locations = await meetingLocations(allowed.map((host) => host.id));
  const businesses = allowed
    .map((host) => ({
      user_id: host.id,
      name: host.name,
      avatar_url: host.avatar_url,
      verified: host.verified,
      kinds: kindsFor({ kids: Boolean(viewer.bizKids && host.kids_ok) }),
      locations: locations.filter((row) => String(row.business_user_id) === host.id).map(locationView),
      limits: { spots_max: 30, days_ahead: rules.BUSINESS_LIMITS.maxDaysAhead },
    }))
    // A business with nowhere to meet has nothing to post yet.
    .filter((business) => business.locations.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { businesses };
}

/**
 * The checks for posting as a business (the contract's section 5.5, steps 1 to 3 and 5), or a PlanError.
 * @returns {Promise<{ business, place, label, autoRules, guestsCanInvite }>} what createPlan saves
 */
async function checkedHostAs(viewer, input) {
  const businessUserId = input.host_as && typeof input.host_as === 'object' ? input.host_as.business_user_id : null;
  // With the switch off, or from an app that can't draw a business's plan, hosting as a business doesn't exist.
  if (!viewer.biz) fail(404, 'not_found', "Hosting as a business isn't available yet.");
  const acting = await actingForBusiness({
    businessUserId, actorUserId: viewer.id, permission: 'plans.post', needsVerified: true,
  });
  if (!acting.ok) fail(acting.status, acting.code, acting.error);
  const host = (await loadBusinessHosts([acting.business.id])).get(acting.business.id);
  if (!host || !host.ok) fail(404, 'not_found', "Hosting as this business isn't available yet.");
  if (input.kind === 'playdate' && !(viewer.bizKids && host.kids_ok)) {
    fail(404, 'not_found', "Plans for kids aren't available for businesses yet.");
  }

  return {
    business: host,
    place: await placeAt(host, input.business_location_id),
    label: checkedLabel(input.kind, input.label),
    autoRules: checkedAutoRules(input.auto_rules),
    guestsCanInvite: checkedGuestsCanInvite(input.guests_can_invite) === true,
  };
}

/**
 * The place of a business's plan: one of the business's own locations a plan can meet at, with the plan's own
 * copy of its name, address and point. A business never hosts at a home, nor at a place that isn't its own.
 * @param {{ id: string, name: string }} business  the business hosting (plan.business)
 */
async function placeAt(business, locationId) {
  const location = business
    ? (await meetingLocations([business.id])).find((row) => String(row.id) === String(locationId || ''))
    : null;
  if (!location) fail(422, 'validation', "Choose one of your business's locations.");
  const point = parsePostGISPoint(location.location);
  return {
    kind: 'public',
    name: business.name.slice(0, 120),
    address: [location.address, location.city].filter(Boolean).join(', ').slice(0, 300) || null,
    // The location's own city: what the plan's area is called when the map can't name it. Never a staff member's.
    city: location.city || null,
    latitude: point.latitude,
    longitude: point.longitude,
    home_id: null,
    home: null,
    picked_id: null,
    business_location_id: location.id,
    // The named place the owner said this location is, when they have: never guessed here.
    ref: namedPlaceRef(location.place_ref),
  };
}

/** What guests see a business's plan called: a key from the kind's fixed list. */
function checkedLabel(kind, label) {
  const labels = rules.BUSINESS_LABELS[kind] || {};
  if (typeof label !== 'string' || !Object.hasOwn(labels, label)) fail(422, 'validation', 'Choose what guests see it called.');
  return label;
}

/** Who gets into a business's plan: "right away" (['open'], anyone) or "I approve each" ([]). Nothing else. */
function checkedAutoRules(requested) {
  const list = Array.isArray(requested) ? [...new Set(requested)] : [];
  if (list.some((rule) => rule !== 'open')) fail(422, 'validation', 'Choose who gets in: right away, or you approve each person.');
  return list;
}

function checkedGuestsCanInvite(value) {
  if (value !== undefined && typeof value !== 'boolean') fail(422, 'validation', 'Bring a friend must be on or off.');
  return value;
}

/** A business's own limits on how much it posts (the contract's section 4.5). */
async function assertBusinessLimits(businessUserId) {
  const [upcoming, today] = await Promise.all([
    supabaseAdmin.from('Plan').select('post_id, post:Post!inner(event_end_date)', { count: 'exact', head: true })
      .eq('host_user_id', businessUserId).eq('status', 'open').gt('post.event_end_date', new Date().toISOString()),
    supabaseAdmin.from('Plan').select('post_id', { count: 'exact', head: true })
      .eq('host_user_id', businessUserId).gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);
  if (upcoming.error || today.error) throw new Error(`Failed to count plans: ${(upcoming.error || today.error).message}`);
  if ((upcoming.count || 0) >= rules.BUSINESS_LIMITS.upcomingPlansPerHost) {
    fail(429, 'too_many_plans', `A business can host ${rules.BUSINESS_LIMITS.upcomingPlansPerHost} upcoming plans at a time.`);
  }
  if ((today.count || 0) >= rules.BUSINESS_LIMITS.newPlansPerDay) {
    fail(429, 'too_many_plans', `A business can post ${rules.BUSINESS_LIMITS.newPlansPerDay} plans a day.`);
  }
}

// ── How a guest arrived ──────────────────────────────────────

/**
 * How this guest arrived at a business's plan (the contract's section 6.2), saved on their request. The app
 * says what it knows in `via`; only what the server can check is believed, and anything else is "found on the
 * map or list". If any of the business's own ways holds, it wins (C3).
 *
 * This build checks the ways that exist: the business's invitation or link, and a follower. `business_page` is
 * the one way taken on the app's word: nothing depends on it while a business's plans are free, and it must be
 * checked here, or dropped, before a paid spot's fee follows the way in. The other Pantopus ways (the Today
 * card, "New here", a neighbor's invitation, the assistant) are saved as `map_list` until their screens are built.
 *
 * @param {{ invite?: { channel?: string }|null }} [known] the guest's invitation to this plan, when they have one
 */
async function wayInFor(plan, userId, via, { invite = null } = {}) {
  if (!plan.business_user_id) return null;
  if (invite) return invite.channel === 'link' ? 'own_link' : 'own_invite';
  try {
    const { data } = await supabaseAdmin.from('BusinessFollow').select('created_at')
      .eq('user_id', userId).eq('business_user_id', plan.business_user_id).maybeSingle();
    if (data && new Date(data.created_at).getTime() < new Date(plan.created_at).getTime()) return 'follower';
  } catch (err) {
    logger.warn('plans.business.way_in_follow_unavailable', { planId: plan.post_id, error: err.message });
  }
  if (via === 'business_page') return 'business_page';
  return 'map_list';
}

module.exports = {
  FLAG,
  KIDS_FLAG,
  loadBusinessHosts,
  attachBusinessHosts,
  shownTo,
  hostsNow,
  peopleShown,
  publicBusiness,
  labelView,
  teamRolesOf,
  runsPlan,
  staffToNotify,
  meetingLocations,
  locationView,
  hostAsChoices,
  checkedHostAs,
  placeAt,
  checkedLabel,
  checkedAutoRules,
  checkedGuestsCanInvite,
  assertBusinessLimits,
  wayInFor,
};
