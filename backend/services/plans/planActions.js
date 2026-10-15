'use strict';

/**
 * Nearby Plans: everything that changes a plan or a request (build brief §5, §7).
 *
 * Seats are taken only by accepted requests. Every write that can fill the last
 * spot re-checks capacity afterwards (enforceCapacity), so two people saying yes
 * to the same last spot at once can't overfill a plan: the later one goes back
 * to the waitlist.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { canPostToPlace } = require('../../utils/trustState');
const { recordFunnelEvent } = require('../funnelEvents');
const { filePostReport } = require('../postReportService');
const rules = require('./planRules');
const planService = require('./planService');
const { loadViewer, verifiedUserIds } = require('./planViewer');
const planPlace = require('./planPlace');
const planChat = require('./planChat');
const planNotify = require('./planNotifications');

class PlanError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const fail = (status, code, message, extra) => { throw new PlanError(status, code, message, extra); };

const REASON_ERRORS = {
  ended: [409, 'Asking has closed for this plan.'],
  declined: [403, "The host couldn't fit you this time, so you can't ask again."],
  removed: [403, "You can't ask to join this plan again."],
  blocked: [404, "This plan isn't available."],
  too_many_requests: [429, "You've asked as many times as you can for now."],
  needs_verified_address: [403, 'Verify your address to ask to join this plan.'],
  needs_location: [403, 'Share your location or add your home to ask to join.'],
  too_far: [403, 'This plan is too far from where you are or live.'],
};

const nowIso = () => new Date().toISOString();

// ── Shared reads ─────────────────────────────────────────────

async function loadVisiblePlan(postId, viewer) {
  if (!planService.isUuid(postId)) fail(404, 'not_found', "This plan isn't available.");
  const plan = await planService.loadPlanRow(postId);
  if (!plan || !planService.isVisibleTo(plan, viewer)) fail(404, 'not_found', "This plan isn't available.");
  return plan;
}

async function loadHostedPlan(postId, viewer) {
  const plan = await loadVisiblePlan(postId, viewer);
  if (String(plan.host_user_id) !== viewer.id) fail(403, 'not_host', 'Only the host can do that.');
  return plan;
}

async function activeRequests(postId) {
  const { data, error } = await supabaseAdmin
    .from('PlanRequest')
    .select(planService.REQUEST_COLUMNS)
    .eq('post_id', postId)
    .in('status', planService.ACTIVE_REQUEST_STATUSES);
  if (error) throw new Error(`Failed to load requests: ${error.message}`);
  return data || [];
}

async function loadRequest(requestId, postId) {
  if (!planService.isUuid(requestId)) fail(404, 'not_found', "That request isn't here.");
  const { data, error } = await supabaseAdmin
    .from('PlanRequest')
    .select(planService.REQUEST_COLUMNS)
    .eq('id', requestId)
    .eq('post_id', postId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load the request: ${error.message}`);
  if (!data) fail(404, 'not_found', "That request isn't here.");
  return data;
}

async function userNames(userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  const users = new Map();
  if (ids.length === 0) return users;
  const { localDisplayNames } = require('../../utils/identityProfiles');
  const names = await localDisplayNames(ids);
  for (const id of ids) users.set(id, planService.displayName({ local_display_name: names.get(id) || null }));
  return users;
}

function firstOf(name) {
  return String(name || 'A neighbor').split(' ')[0];
}

function partyLabel(name, partySize) {
  const extra = (Number(partySize) || 1) - 1;
  return extra > 0 ? `${firstOf(name)} + ${extra}` : firstOf(name);
}

/** The response body after a write: PlanDetail or PlanCard for the person who wrote. */
async function planBodyFor(postId, viewer) {
  const fresh = await loadViewer({ id: viewer.id, role: viewer.role }, { gps: viewer.gps, point: viewer.origin });
  const { body } = await planService.getForViewer(postId, fresh);
  return body;
}

// ── Validation ───────────────────────────────────────────────

function validateTimes(startsAt, endsAt, { allowPastStart = false } = {}) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) fail(422, 'validation', 'Choose when the plan starts and ends.');
  const now = Date.now();
  if (!allowPastStart && start < now - rules.LIMITS.startGraceMinutes * 60 * 1000) fail(422, 'validation', "A plan can't start in the past.");
  if (start > now + rules.LIMITS.maxDaysAhead * 24 * 60 * 60 * 1000) fail(422, 'validation', 'Plans can start up to 14 days ahead.');
  const minutes = (end - start) / 60000;
  if (minutes < rules.LIMITS.minDurationMinutes) fail(422, 'validation', 'A plan lasts at least 15 minutes.');
  if (minutes > rules.LIMITS.maxDurationMinutes) fail(422, 'validation', 'A plan lasts at most 8 hours.');
  if (end <= now) fail(422, 'validation', 'This plan would already be over.');
}

/** Rules a plan can use: none for playdates, only "people I've hosted" at home, "anyone nearby" only for pickup games and walks. */
function normalizeAutoRules(kind, placeKind, requested) {
  const list = [...new Set(Array.isArray(requested) ? requested : [])];
  for (const rule of list) {
    if (!rules.AUTO_RULES.includes(rule)) fail(422, 'validation', `Unknown rule: ${rule}.`);
  }
  if (kind === 'playdate') return [];
  return list.filter((rule) => {
    if (placeKind === 'home') return rule === 'hosted_before';
    if (rule === 'anyone_nearby') return kind === 'pickup_game' || kind === 'walk_coffee';
    return true;
  });
}

function oneOf(value, allowed, label) {
  if (value === undefined || value === null) return undefined;
  if (!allowed.includes(value)) fail(422, 'validation', `Choose a ${label}.`);
  return value;
}

function bool(value, label) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') fail(422, 'validation', `${label} must be true or false.`);
  return value;
}

function normalizeDetails(kind, details) {
  const input = details && typeof details === 'object' ? details : {};
  const out = {};
  if (kind === 'watch_party') {
    if (input.game && typeof input.game === 'object') {
      const label = String(input.game.label || '').trim().slice(0, 60);
      if (label) out.game = { label };
      const at = input.game.starts_at ? new Date(input.game.starts_at) : null;
      if (out.game && at && !Number.isNaN(at.getTime())) out.game.starts_at = at.toISOString();
    }
  } else if (kind === 'pickup_game') {
    out.sport = oneOf(input.sport, rules.SPORTS, 'sport') || 'other';
    out.level = oneOf(input.level, rules.LEVELS, 'level') || 'any';
    const gear = bool(input.extra_gear, 'Extra gear');
    if (gear !== undefined) out.extra_gear = gear;
  } else if (kind === 'playdate') {
    const bands = Array.isArray(input.kids_age_bands) ? [...new Set(input.kids_age_bands)] : [];
    for (const band of bands) if (!rules.KIDS_AGE_BANDS.includes(band)) fail(422, 'validation', 'Choose the kids’ ages.');
    if (bands.length === 0) fail(422, 'validation', 'Choose the kids’ ages.');
    out.kids_age_bands = rules.KIDS_AGE_BANDS.filter((band) => bands.includes(band));
  } else if (kind === 'walk_coffee') {
    out.walk_kind = oneOf(input.walk_kind, rules.WALK_KINDS, 'kind of walk') || 'walk';
    out.pace = oneOf(input.pace, rules.PACES, 'pace') || 'easy';
    const dogs = bool(input.dogs_welcome, 'Dogs welcome');
    if (dogs !== undefined) out.dogs_welcome = dogs;
  }
  return out;
}

function cleanTitle(value) {
  const title = String(value || '').replace(/\s+/g, ' ').trim();
  if (!title) fail(422, 'validation', 'Give the plan a title.');
  if (title.length > 80) fail(422, 'validation', 'Keep the title under 80 characters.');
  return title;
}

function cleanText(value, max, label) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text.length > max) fail(422, 'validation', `${label} can be up to ${max} characters.`);
  return text || null;
}

// Watch parties and walks may be hosted at home (decision D6); pickup games and playdates meet in public.
const AT_HOME_MESSAGES = {
  watch_party: 'That’s at your home. To host there, choose “My place”: only people you accept see your address.',
  walk_coffee: 'That’s at your home. To host there, choose “My porch”: only people you accept see your address.',
  pickup_game: 'That’s at your home. Choose a public place nearby, like a park or a court.',
  playdate: 'That’s at your home. Playdates meet in public places: choose one nearby.',
  // H11 moves a public plan to another public place only.
  move: 'That’s at your home. Choose another public place nearby.',
};

/** The place, from the body: a public place, or the host's own home. */
function resolvePlace(viewer, kind, place, { moving = false } = {}) {
  if (!place || typeof place !== 'object') fail(422, 'validation', 'Choose where the plan happens.');
  if (place.kind === 'home') {
    if (kind === 'playdate') fail(422, 'validation', 'Playdates meet in public places.');
    const home = viewer.homes.find((h) => String(h.id) === String(place.home_id));
    if (!home || !home.trusted) fail(403, 'not_your_home', 'You can host at home only at a home you live in on Pantopus.');
    if (!home.point) fail(422, 'validation', "We couldn't find your home on the map.");
    return {
      kind: 'home',
      name: null,
      address: planPlace.homeAddressLine(home),
      latitude: home.point.latitude,
      longitude: home.point.longitude,
      home_id: home.id,
      home,
    };
  }
  if (place.kind !== 'public') fail(422, 'validation', 'Choose a public place or your home.');
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    fail(422, 'validation', 'Choose the place on the map.');
  }
  const name = cleanText(place.name, 120, 'The place name');
  if (!name) fail(422, 'validation', 'Name the place.');
  // A "public" place at the host's own home would hand its exact spot to everyone who gets in,
  // without the at-home rules (the host approves each person and confirms sharing the address).
  const point = { latitude, longitude };
  if (viewer.homes.some((h) => h.point && rules.distanceMeters(h.point, point) <= rules.HOME_GUARD_METERS)) {
    fail(422, 'place_at_home', moving ? AT_HOME_MESSAGES.move : AT_HOME_MESSAGES[kind] || AT_HOME_MESSAGES.pickup_game);
  }
  return {
    kind: 'public',
    name,
    address: cleanText(place.address, 300, 'The address'),
    latitude,
    longitude,
    home_id: null,
    home: null,
  };
}

/**
 * Hosting: within the existing 5 km canPostToPlace proximity (about 3 miles) of
 * where the host lives or where they are now. Playdates: a verified address,
 * with that home within 3 miles.
 */
function assertHostNear(viewer, kind, place) {
  const target = { latitude: place.latitude, longitude: place.longitude };
  const homeNear = (h) => h.point && rules.distanceMeters(h.point, target) <= rules.HOST_RADIUS_METERS;
  if (kind === 'playdate') {
    if (!viewer.verified) fail(403, 'needs_verified_address', 'Verify your address to host a playdate.');
    if (!viewer.homes.some((h) => h.verified && homeNear(h))) {
      fail(403, 'not_near', 'You can host within 3 miles of where you live or where you are now.');
    }
    return;
  }
  if (place.kind === 'home') return;
  if (viewer.homes.some(homeNear)) return;
  if (viewer.gps) {
    const gps = canPostToPlace({
      trustLevel: 'remote_viewer',
      gpsTimestamp: viewer.gps.timestamp,
      gpsLatitude: viewer.gps.latitude,
      gpsLongitude: viewer.gps.longitude,
      targetLatitude: target.latitude,
      targetLongitude: target.longitude,
    });
    if (gps.eligible) return;
  }
  fail(403, 'not_near', 'You can host within 3 miles of where you live or where you are now.');
}

async function assertHostLimits(userId) {
  const [upcoming, today] = await Promise.all([
    supabaseAdmin.from('Plan').select('post_id, post:Post!inner(event_end_date)', { count: 'exact', head: true })
      .eq('host_user_id', userId).eq('status', 'open').gt('post.event_end_date', nowIso()),
    supabaseAdmin.from('Plan').select('post_id', { count: 'exact', head: true })
      .eq('host_user_id', userId).gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);
  if (upcoming.error || today.error) throw new Error(`Failed to count plans: ${(upcoming.error || today.error).message}`);
  if ((upcoming.count || 0) >= rules.LIMITS.upcomingPlansPerHost) {
    fail(429, 'too_many_plans', 'You can host 3 upcoming plans at a time.');
  }
  if ((today.count || 0) >= rules.LIMITS.newPlansPerDay) {
    fail(429, 'too_many_plans', 'You can post 5 plans a day.');
  }
}

// ── Create ───────────────────────────────────────────────────

// `pulse` (S14, contract §2.18): the conversation a plan is suggested from and the audience it
// takes (the plan post's read scope and area); absent for plans made in Plans.
async function createPlan(user, input, pulse = null) {
  const viewer = await loadViewer(user, { gps: input.gps });
  const kind = input.kind;
  if (!rules.KINDS.includes(kind)) fail(422, 'validation', 'Choose what kind of plan this is.');
  if (kind === 'playdate' && !viewer.playdatesFlag) fail(404, 'not_found', "Playdates aren't available yet.");

  const title = cleanTitle(input.title);
  const about = cleanText(input.about, 500, 'About') || '';
  const guestNote = cleanText(input.guest_note, 500, 'The note');
  validateTimes(input.starts_at, input.ends_at);
  const spots = Number(input.spots);
  if (!Number.isInteger(spots) || spots < 1 || spots > 30) fail(422, 'validation', 'Spots can be 1 to 30.');
  const place = resolvePlace(viewer, kind, input.place);
  assertHostNear(viewer, kind, place);
  const autoRules = normalizeAutoRules(kind, place.kind, input.auto_rules);
  // An invited plan comes only from a conversation's "People I invite" (S14, contract §2.18).
  const joinRequirement = kind === 'playdate' ? 'verified' : pulse?.joinRequirement
    || (oneOf(input.join_requirement, ['located', 'verified'], 'who can ask') || 'located');
  const details = normalizeDetails(kind, input.details);
  await assertHostLimits(viewer.id);

  const area = planPlace.areaPointFor(kind, place.latitude, place.longitude);
  const fallbackCity = place.home?.city || viewer.homes.find((h) => h.city)?.city || null;
  const { label, city } = await planPlace.areaLabelFor(area, { fallbackCity });
  const timezone = planPlace.timezoneFor(place.latitude, place.longitude);
  const startsAt = new Date(input.starts_at).toISOString();
  const endsAt = new Date(input.ends_at).toISOString();

  const { data: post, error: postError } = await supabaseAdmin.from('Post').insert({
    user_id: viewer.id,
    author_user_id: viewer.id,
    title,
    content: about,
    post_type: 'event',
    post_format: 'standard',
    visibility: 'private',
    visibility_scope: 'neighborhood',
    location_precision: planPlace.locationPrecisionFor(kind),
    latitude: area.latitude,
    longitude: area.longitude,
    effective_latitude: area.latitude,
    effective_longitude: area.longitude,
    location_name: label,
    location_address: null,
    post_as: 'personal',
    audience: 'nearby',
    distribution_targets: ['plans'],
    event_date: startsAt,
    event_end_date: endsAt,
    profile_visibility_scope: 'hidden',
    show_on_profile: false,
    is_visitor_post: false,
    state: 'open',
    post_metadata: { plan: true },
    origin: 'user',
    allow_external_share: false,
    ...(pulse ? { read_scope: pulse.readScope, area_id: pulse.areaId } : {}),
  }).select('id').single();
  if (postError) throw new Error(`Failed to save the plan: ${postError.message}`);

  const { error: planError } = await supabaseAdmin.from('Plan').insert({
    post_id: post.id,
    host_user_id: viewer.id,
    kind,
    spots,
    auto_rules: autoRules,
    join_requirement: joinRequirement,
    place_kind: place.kind,
    area_label: label,
    city,
    details,
    guest_note: guestNote,
    place_name: place.name,
    place_address: place.address,
    place_latitude: place.latitude,
    place_longitude: place.longitude,
    place_home_id: place.home_id,
    timezone,
    status: 'open',
    ...(pulse ? { source_post_id: pulse.sourcePostId } : {}),
  });
  if (planError) {
    await supabaseAdmin.from('Post').delete().eq('id', post.id);
    throw new Error(`Failed to save the plan: ${planError.message}`);
  }

  recordFunnelEvent('plan_created', { userId: viewer.id, meta: { plan_id: post.id, kind } });
  if (planService.isUuid(input.hosted_again_from)) {
    const { data: earlier } = await supabaseAdmin.from('Plan').select('post_id')
      .eq('post_id', input.hosted_again_from).eq('host_user_id', viewer.id).maybeSingle();
    if (earlier) recordFunnelEvent('plan_hosted_again', { userId: viewer.id, meta: { plan_id: post.id, from_plan_id: earlier.post_id, kind } });
  }
  return planBodyFor(post.id, viewer);
}

// ── Edit ─────────────────────────────────────────────────────

async function editPlan(user, postId, patch, { io = null } = {}) {
  const viewer = await loadViewer(user, { gps: patch.gps });
  const plan = await loadHostedPlan(postId, viewer);
  const state = rules.planState(plan, plan.post.event_date, plan.post.event_end_date);
  if (state === 'ended' || state === 'cancelled') fail(409, 'ended', 'This plan is over, so it can’t change.');

  const postUpdate = {};
  const planUpdate = {};
  let timeMoved = false;
  let placeChanged = false;

  if (patch.title !== undefined) postUpdate.title = cleanTitle(patch.title);
  if (patch.about !== undefined) postUpdate.content = cleanText(patch.about, 500, 'About') || '';
  if (patch.guest_note !== undefined) planUpdate.guest_note = cleanText(patch.guest_note, 500, 'The note');

  if (patch.starts_at !== undefined || patch.ends_at !== undefined) {
    const startsAt = patch.starts_at !== undefined ? patch.starts_at : plan.post.event_date;
    const endsAt = patch.ends_at !== undefined ? patch.ends_at : plan.post.event_end_date;
    const startChanged = new Date(startsAt).getTime() !== new Date(plan.post.event_date).getTime();
    validateTimes(startsAt, endsAt, { allowPastStart: state === 'live' && !startChanged });
    postUpdate.event_date = new Date(startsAt).toISOString();
    postUpdate.event_end_date = new Date(endsAt).toISOString();
    const shift = Math.abs(new Date(startsAt).getTime() - new Date(plan.post.event_date).getTime()) / 60000;
    timeMoved = shift > rules.LIMITS.reconfirmShiftMinutes;
  }

  let placeKind = plan.place_kind;
  if (patch.place !== undefined) {
    const place = resolvePlace(viewer, plan.kind, patch.place, { moving: true });
    assertHostNear(viewer, plan.kind, place);
    placeKind = place.kind;
    placeChanged = place.kind !== plan.place_kind
      || String(place.home_id || '') !== String(plan.place_home_id || '')
      || rules.distanceMeters(place, { latitude: plan.place_latitude, longitude: plan.place_longitude }) > 25
      || (place.name || '') !== (plan.place_name || '');
    const area = planPlace.areaPointFor(plan.kind, place.latitude, place.longitude);
    const fallbackCity = place.home?.city || plan.city || null;
    const { label, city } = await planPlace.areaLabelFor(area, { fallbackCity });
    Object.assign(planUpdate, {
      place_kind: place.kind,
      place_name: place.name,
      place_address: place.address,
      place_latitude: place.latitude,
      place_longitude: place.longitude,
      place_home_id: place.home_id,
      area_label: label,
      city,
      timezone: planPlace.timezoneFor(place.latitude, place.longitude),
    });
    Object.assign(postUpdate, {
      latitude: area.latitude,
      longitude: area.longitude,
      effective_latitude: area.latitude,
      effective_longitude: area.longitude,
      location_name: label,
    });
  }

  const requests = await activeRequests(postId);
  const going = planService.seatsTaken(plan, requests);
  let spotsGrew = false;
  if (patch.spots !== undefined) {
    const spots = Number(patch.spots);
    if (!Number.isInteger(spots) || spots < 1 || spots > 30) fail(422, 'validation', 'Spots can be 1 to 30.');
    if (spots < going) fail(422, 'validation', `${going} ${going === 1 ? 'person is' : 'people are'} in, so spots can’t go below that.`);
    spotsGrew = spots > plan.spots;
    planUpdate.spots = spots;
  }
  if (patch.auto_rules !== undefined || patch.place !== undefined) {
    planUpdate.auto_rules = normalizeAutoRules(plan.kind, placeKind, patch.auto_rules !== undefined ? patch.auto_rules : plan.auto_rules);
  }
  // An invited plan stays invited: opening it would show it to people the host didn't choose.
  if (patch.join_requirement !== undefined && plan.kind !== 'playdate' && plan.join_requirement !== 'invited') {
    planUpdate.join_requirement = oneOf(patch.join_requirement, ['located', 'verified'], 'who can ask');
  }
  if (patch.details !== undefined) planUpdate.details = normalizeDetails(plan.kind, patch.details);

  // A plan moved to another time is reminded again (when its new reminder time is still
  // ahead) and, moved to a later day, gets that day's morning summary.
  const tz = planUpdate.timezone || plan.timezone || rules.DEFAULT_TIMEZONE;
  let remindAgain = false;
  if (timeMoved) {
    remindAgain = rules.reminderAt(postUpdate.event_date, tz).getTime() > Date.now();
    const newDay = rules.localParts(new Date(postUpdate.event_date), tz).date;
    const oldDay = rules.localParts(new Date(plan.post.event_date), tz).date;
    if (newDay !== oldDay && newDay > rules.localParts(new Date(), tz).date) planUpdate.host_summary_sent_at = null;
  }

  const stamp = nowIso();
  if (Object.keys(postUpdate).length > 0) {
    const { error } = await supabaseAdmin.from('Post').update({ ...postUpdate, updated_at: stamp, is_edited: true, edited_at: stamp }).eq('id', postId);
    if (error) throw new Error(`Failed to save the change: ${error.message}`);
  }
  if (Object.keys(planUpdate).length > 0) {
    const { error } = await supabaseAdmin.from('Plan').update({ ...planUpdate, updated_at: stamp }).eq('post_id', postId);
    if (error) throw new Error(`Failed to save the change: ${error.message}`);
  }
  if (postUpdate.title && postUpdate.title !== plan.post.title) await planChat.renameRoom(plan, postUpdate.title);

  const updated = await planService.loadPlanRow(postId);
  if (timeMoved || placeChanged) {
    const accepted = requests.filter((r) => r.status === 'accepted');
    if (accepted.length > 0) {
      const { error } = await supabaseAdmin.from('PlanRequest')
        .update({
          reconfirm_requested_at: stamp,
          reconfirmed: null,
          reconfirm_reason: timeMoved && placeChanged ? 'both' : timeMoved ? 'time' : 'place',
          updated_at: stamp,
          ...(remindAgain ? { reminded_at: null } : {}),
        })
        .eq('post_id', postId).eq('status', 'accepted');
      if (error) throw new Error(`Failed to ask "Still coming?": ${error.message}`);
      const hostFirst = firstOf((await userNames([viewer.id])).get(viewer.id));
      for (const request of accepted) {
        await planNotify.changed({ plan: updated, request, hostFirst, timeMoved, placeChanged });
      }
      if (updated.chat_room_id) {
        // "Sam moved the plan to Sunday at 2:00 PM", in the push's words.
        const when = planNotify.whenText(updated.post.event_date, updated.timezone, { long: true, at: true });
        await planChat.systemLine(updated.chat_room_id, viewer.id,
          timeMoved && placeChanged ? `${hostFirst} moved the plan to ${when}, at a new place`
            : timeMoved ? `${hostFirst} moved the plan to ${when}` : `${hostFirst} changed the place`);
      }
    }
  }
  if (spotsGrew) await offerOpenSpots(updated, { io });
  return planBodyFor(postId, viewer);
}

// ── Cancel ───────────────────────────────────────────────────

async function cancelPlan(user, postId, { note } = {}) {
  const viewer = await loadViewer(user);
  const plan = await loadHostedPlan(postId, viewer);
  if (plan.status === 'cancelled') return planBodyFor(postId, viewer);
  const state = rules.planState(plan, plan.post.event_date, plan.post.event_end_date);
  if (state === 'ended') fail(409, 'ended', 'This plan is already over.');
  const cancelNote = cleanText(note, 280, 'The note');
  const stamp = nowIso();

  const requests = await activeRequests(postId);
  const { data: cancelled, error } = await supabaseAdmin.from('Plan')
    .update({ status: 'cancelled', cancelled_at: stamp, cancel_note: cancelNote, updated_at: stamp })
    .eq('post_id', postId).eq('status', 'open').select('post_id');
  if (error) throw new Error(`Failed to cancel: ${error.message}`);
  if (!cancelled || cancelled.length === 0) return planBodyFor(postId, viewer);

  // People still waiting stop waiting; people who were in keep their place in the record.
  const { error: expireError } = await supabaseAdmin.from('PlanRequest')
    .update({ status: 'expired', updated_at: stamp })
    .eq('post_id', postId).in('status', ['pending', 'waitlisted']);
  if (expireError) logger.warn('plans.cancel.expire_failed', { postId, error: expireError.message });

  const hostFirst = firstOf((await userNames([viewer.id])).get(viewer.id));
  if (plan.chat_room_id) {
    await planChat.systemLine(plan.chat_room_id, viewer.id, `${hostFirst} cancelled the plan`);
  }
  await planChat.closeRoom(plan);
  const updated = await planService.loadPlanRow(postId);
  for (const request of requests) {
    await planNotify.cancelled({ plan: updated, request, hostFirst, note: cancelNote, wasIn: request.status === 'accepted' });
  }
  return planBodyFor(postId, viewer);
}

// ── Capacity, rules and the waitlist ─────────────────────────

/**
 * After a write that may have filled the plan: seats go to accepted requests in
 * the order they were decided; anyone past the capacity goes back to the
 * waitlist. Returns the ids sent back.
 */
async function enforceCapacity(plan) {
  const requests = await activeRequests(plan.post_id);
  const accepted = requests
    .filter((r) => r.status === 'accepted')
    .sort((a, b) => (new Date(a.decided_at || a.created_at) - new Date(b.decided_at || b.created_at)) || String(a.id).localeCompare(String(b.id)));
  let seats = 0;
  const overflow = [];
  for (const request of accepted) {
    seats += rules.seatsFor(plan.kind, request.party_size);
    if (seats > plan.spots) overflow.push(request.id);
  }
  if (overflow.length > 0) {
    await supabaseAdmin.from('PlanRequest')
      .update({ status: 'waitlisted', decided_by: null, decided_at: null, updated_at: nowIso() })
      .in('id', overflow).eq('status', 'accepted');
  }
  return new Set(overflow);
}

/** Whether a rule lets this person in now (for someone already in line). */
async function ruleFor(plan, userId) {
  const autoRules = Array.isArray(plan.auto_rules) ? plan.auto_rules : [];
  if (plan.kind === 'playdate' || autoRules.length === 0) return null;
  if (autoRules.includes('hosted_before')) {
    const stats = await planService.requesterStats(plan.host_user_id, [userId]);
    if (stats.get(String(userId))?.hosted_before) return 'hosted_before';
  }
  if (plan.place_kind === 'home') return null;
  if (autoRules.includes('verified') && (await verifiedUserIds([userId])).has(String(userId))) return 'verified';
  // They were nearby when they asked (asking checks the location).
  if (autoRules.includes('anyone_nearby') && ['pickup_game', 'walk_coffee'].includes(plan.kind)) return 'anyone_nearby';
  return null;
}

/** Let someone in: the chat, the grey line, the notice. */
async function admit(plan, request, { byRule, hostFirst, io, viaWaitlist = false }) {
  const roomId = await planChat.ensureRoom(plan, { io });
  await planChat.addMember(roomId, request.user_id, { io });
  const names = await userNames([request.user_id]);
  const who = partyLabel(names.get(String(request.user_id)), plan.kind === 'playdate' ? 1 : request.party_size);
  await planChat.systemLine(roomId, byRule ? request.user_id : plan.host_user_id,
    byRule ? `${who} ${who.includes(' + ') ? 'are' : 'is'} in` : `${hostFirst} let in ${who}`);
  if (viaWaitlist) {
    await planNotify.spotOpened({ plan, request, hostFirst, nowIn: true });
  } else {
    await planNotify.accepted({ plan, request, hostFirst, byRule });
  }
  recordFunnelEvent('plan_accepted', { userId: request.user_id, meta: { plan_id: plan.post_id, kind: plan.kind, by: byRule ? 'rule' : 'host' } });
}

/**
 * A spot opened: the first person waiting gets it if a rule lets them in,
 * otherwise the host is asked. Only while asking is open.
 */
async function offerOpenSpots(plan, { io = null } = {}) {
  if (!rules.isAskingOpen(plan, plan.post.event_date, plan.post.event_end_date)) return;
  const hostFirst = firstOf((await userNames([plan.host_user_id])).get(String(plan.host_user_id)));
  for (let round = 0; round < 30; round += 1) {
    const requests = await activeRequests(plan.post_id);
    const spotsLeft = plan.spots - planService.seatsTaken(plan, requests);
    if (spotsLeft <= 0) return;
    const next = planService.waitlistOrder(requests).find((r) => rules.seatsFor(plan.kind, r.party_size) <= spotsLeft);
    if (!next) return;
    const rule = await ruleFor(plan, next.user_id);
    const stamp = nowIso();
    if (rule) {
      const { data: moved } = await supabaseAdmin.from('PlanRequest')
        .update({ status: 'accepted', decided_by: 'rule', decided_at: stamp, updated_at: stamp })
        .eq('id', next.id).eq('status', 'waitlisted').select(planService.REQUEST_COLUMNS);
      if (!moved || moved.length === 0) continue;
      const overflow = await enforceCapacity(plan);
      if (overflow.has(next.id)) return;
      await admit(plan, moved[0], { byRule: true, hostFirst, io, viaWaitlist: true });
      continue;
    }
    const { data: moved } = await supabaseAdmin.from('PlanRequest')
      .update({ status: 'pending', updated_at: stamp })
      .eq('id', next.id).eq('status', 'waitlisted').select(planService.REQUEST_COLUMNS);
    if (!moved || moved.length === 0) continue;
    await planNotify.spotOpened({ plan, request: moved[0], hostFirst, nowIn: false });
    const names = await userNames([next.user_id]);
    await planNotify.requestReceived({ plan, request: moved[0], hostFirst, requesterFirst: firstOf(names.get(String(next.user_id))) });
    return;
  }
}

// ── Asking ───────────────────────────────────────────────────

function cleanAsk(plan, body) {
  const out = {};
  if (plan.kind === 'playdate') {
    out.party_size = 1;
    const kids = Number(body.kids_count);
    if (!Number.isInteger(kids) || kids < 1 || kids > 8) fail(422, 'validation', 'How many kids are coming?');
    const bands = Array.isArray(body.kids_age_bands) ? [...new Set(body.kids_age_bands)] : [];
    if (bands.length === 0 || bands.some((b) => !rules.KIDS_AGE_BANDS.includes(b))) fail(422, 'validation', 'Choose your kids’ ages.');
    if (body.stays_with_kids !== true) fail(422, 'validation', 'Parents stay with their kids at playdates.');
    out.kids_count = kids;
    out.kids_age_bands = rules.KIDS_AGE_BANDS.filter((b) => bands.includes(b));
    out.stays_with_kids = true;
  } else {
    const party = body.party_size === undefined ? 1 : Number(body.party_size);
    if (!Number.isInteger(party) || party < 1 || party > 4) fail(422, 'validation', 'You can bring up to 3 people.');
    out.party_size = party;
  }
  out.note = cleanText(body.note, 280, 'Your hello');
  return out;
}

/** Where the person lives (or is), as a band from the exact place: what the host sees. */
function requesterBand(plan, viewer) {
  const exact = { latitude: Number(plan.place_latitude), longitude: Number(plan.place_longitude) };
  const homes = viewer.homes.filter((h) => h.point).map((h) => h.point);
  const points = homes.length > 0 ? homes : viewer.locations;
  let best = null;
  for (const point of points) {
    const d = rules.distanceMeters(point, exact);
    if (d != null && (best == null || d < best)) best = d;
  }
  return rules.distanceBandFromMeters(best) || (best != null ? 'about_5_mi' : null);
}

async function requestResult(postId, viewer, requestId) {
  const plan = await planBodyFor(postId, viewer);
  const request = plan?.my_request && plan.my_request.id === requestId ? plan.my_request : null;
  return {
    request: request ? { id: request.id, status: request.status, waitlist_position: request.waitlist_position } : null,
    plan,
  };
}

async function askToJoin(user, postId, body, { io = null } = {}) {
  const viewer = await loadViewer(user, { gps: body.gps });
  const plan = await loadVisiblePlan(postId, viewer);
  if (String(plan.host_user_id) === viewer.id) fail(409, 'host', "You're hosting this plan.");
  const ctx = await planService.loadCardContext([plan], viewer);
  const mine = ctx.myRequestByPlan.get(postId) || null;
  const waiting = mine && (mine.status === 'pending' || mine.status === 'waitlisted');
  // A second ask while waiting changes only what it sends; the rest stays as asked.
  const keep = (key) => (body[key] !== undefined ? body[key] : mine[key]);
  const ask = cleanAsk(plan, waiting
    ? { party_size: keep('party_size'), note: keep('note'), kids_count: keep('kids_count'), kids_age_bands: keep('kids_age_bands'), stays_with_kids: keep('stays_with_kids') }
    : body);
  const stamp = nowIso();

  // Already in line: a second ask changes who's coming and the hello. It doesn't use an ask.
  if (waiting) {
    const { error } = await supabaseAdmin.from('PlanRequest').update({ ...ask, updated_at: stamp }).eq('id', mine.id);
    if (error) throw new Error(`Failed to update your request: ${error.message}`);
    return { status: 200, body: await requestResult(postId, viewer, mine.id) };
  }
  if (mine && mine.status === 'accepted') return { status: 200, body: await requestResult(postId, viewer, mine.id) };

  const requests = ctx.requestsByPlan.get(postId) || [];
  const spotsLeft = plan.spots - planService.seatsTaken(plan, requests);
  const state = rules.planState(plan, plan.post.event_date, plan.post.event_end_date);
  const eligibility = planService.askEligibility(plan, viewer, ctx, { myRequest: mine, spotsLeft, state });
  if (!eligibility.can_ask && eligibility.cannot_ask_reason !== 'full_use_waitlist') {
    const [status, message] = REASON_ERRORS[eligibility.cannot_ask_reason] || [403, "You can't ask to join this plan."];
    fail(status, eligibility.cannot_ask_reason || 'cannot_ask', message);
  }

  const seats = rules.seatsFor(plan.kind, ask.party_size);
  let status = 'waitlisted';
  let decidedBy = null;
  if (seats <= spotsLeft) {
    const rule = planService.matchingAutoRule(plan, viewer, ctx);
    if (plan.join_requirement === 'invited') {
      // The host invited this person, so Going needs no second approval.
      status = 'accepted';
      decidedBy = 'host';
    } else if (rule) {
      status = 'accepted';
      decidedBy = 'rule';
    } else {
      status = 'pending';
    }
  }
  const row = {
    ...ask,
    status,
    decided_by: decidedBy,
    decided_at: decidedBy ? stamp : null,
    distance_band: requesterBand(plan, viewer),
    queued_at: stamp,
    reconfirm_requested_at: null,
    reconfirmed: null,
    reconfirm_reason: null,
    on_my_way_at: null,
    updated_at: stamp,
  };

  let request;
  if (mine) {
    // Asking again after withdrawing, leaving or expiring.
    // Asking again, or saying Going to an invitation (which uses no ask).
    const { data, error } = await supabaseAdmin.from('PlanRequest')
      .update({ ...row, ask_count: mine.status === 'invited' ? mine.ask_count || 1 : (mine.ask_count || 1) + 1 })
      .eq('id', mine.id).in('status', ['withdrawn', 'left', 'expired', 'invited']).select(planService.REQUEST_COLUMNS);
    if (error) throw new Error(`Failed to send your request: ${error.message}`);
    if (!data || data.length === 0) return { status: 200, body: await requestResult(postId, viewer, mine.id) };
    request = data[0];
  } else {
    const { data, error } = await supabaseAdmin.from('PlanRequest')
      .insert({ ...row, post_id: postId, user_id: viewer.id, ask_count: 1, created_at: stamp })
      .select(planService.REQUEST_COLUMNS).single();
    if (error) {
      if (error.code === '23505') {
        const again = await loadViewer(user, { gps: body.gps });
        const { body: planBody } = await planService.getForViewer(postId, again);
        return { status: 200, body: { request: planBody?.my_request ? { id: planBody.my_request.id, status: planBody.my_request.status, waitlist_position: planBody.my_request.waitlist_position } : null, plan: planBody } };
      }
      throw new Error(`Failed to send your request: ${error.message}`);
    }
    request = data;
  }

  recordFunnelEvent('plan_requested', { userId: viewer.id, meta: { plan_id: postId, kind: plan.kind, status: request.status } });
  const names = await userNames([viewer.id, plan.host_user_id]);
  const hostFirst = firstOf(names.get(String(plan.host_user_id)));
  if (request.status === 'accepted') {
    const overflow = await enforceCapacity(plan);
    if (!overflow.has(request.id)) {
      await admit(plan, request, { byRule: true, hostFirst, io });
    }
  } else if (request.status === 'pending') {
    await planNotify.requestReceived({ plan, request, hostFirst, requesterFirst: firstOf(names.get(viewer.id)) });
  }
  return { status: mine ? 200 : 201, body: await requestResult(postId, viewer, request.id) };
}

/** Withdraw (pending or waitlisted) or leave (accepted). */
async function withdrawMine(user, postId, { io = null, reason = 'withdraw' } = {}) {
  const viewer = await loadViewer(user);
  const plan = await loadVisiblePlan(postId, viewer);
  const { data: mine, error } = await supabaseAdmin.from('PlanRequest')
    .select(planService.REQUEST_COLUMNS).eq('post_id', postId).eq('user_id', viewer.id).maybeSingle();
  if (error) throw new Error(`Failed to load your request: ${error.message}`);
  if (!mine) fail(404, 'not_found', "You haven't asked to join this plan.");
  // "Not this time" on an invitation (S14) withdraws it; the person can still say Going later.
  if (!['pending', 'waitlisted', 'accepted', 'invited'].includes(mine.status)) return requestResult(postId, viewer, mine.id);

  const stamp = nowIso();
  const leaving = mine.status === 'accepted';
  const patch = { status: leaving ? 'left' : 'withdrawn', updated_at: stamp };
  if (reason === 'not_coming') patch.reconfirmed = false;
  const { data: changed, error: updateError } = await supabaseAdmin.from('PlanRequest')
    .update(patch).eq('id', mine.id).eq('status', mine.status).select('id');
  if (updateError) throw new Error(`Failed to update your request: ${updateError.message}`);
  if (changed && changed.length > 0 && leaving) {
    const names = await userNames([viewer.id]);
    if (plan.chat_room_id) {
      await planChat.systemLine(plan.chat_room_id, viewer.id, `${partyLabel(names.get(viewer.id), mine.party_size)} can't make it`);
      await planChat.removeMember(plan.chat_room_id, viewer.id, { io });
    }
    await offerOpenSpots(plan, { io });
  }
  return requestResult(postId, viewer, mine.id);
}

// ── Host decisions ───────────────────────────────────────────

async function listRequests(user, postId) {
  const viewer = await loadViewer(user);
  const plan = await loadHostedPlan(postId, viewer);
  const requests = (await activeRequests(postId))
    .filter((r) => r.status === 'pending' || r.status === 'waitlisted')
    .filter((r) => !viewer.blockedUserIds.has(String(r.user_id)));
  const userIds = requests.map((r) => String(r.user_id));
  const [users, names, verified, stats, mutual] = await Promise.all([
    userIds.length ? supabaseAdmin.from('User').select('id, profile_picture_url, created_at').in('id', userIds) : { data: [] },
    userNames(userIds),
    verifiedUserIds(userIds),
    planService.requesterStats(viewer.id, userIds),
    planService.mutualConnectionCounts(viewer.id, userIds),
  ]);
  if (users.error) throw new Error(`Failed to load people: ${users.error.message}`);
  const userRows = new Map((users.data || []).map((u) => [String(u.id), u]));
  const view = (r) => {
    const id = String(r.user_id);
    const row = userRows.get(id);
    const stat = stats.get(id) || { plans_joined: 0, hosted_before: false };
    return {
      id: r.id,
      user: {
        user_id: id,
        display_name: names.get(id) || 'A neighbor',
        avatar_url: row?.profile_picture_url || null,
        verified_address: verified.has(id),
        distance_band: r.distance_band || null,
        plans_joined: stat.plans_joined,
        mutual_connections: mutual.get(id) || 0,
        hosted_before: stat.hosted_before,
        new_to_pantopus: Boolean(row?.created_at) && Date.now() - new Date(row.created_at).getTime() < 30 * 24 * 60 * 60 * 1000,
      },
      party_size: r.party_size,
      note: r.note || null,
      kids_count: plan.kind === 'playdate' ? r.kids_count ?? null : null,
      kids_age_bands: plan.kind === 'playdate' ? r.kids_age_bands || [] : null,
      created_at: planService.iso(r.queued_at || r.created_at),
    };
  };
  const byQueue = (a, b) => new Date(a.queued_at) - new Date(b.queued_at);
  return {
    pending: requests.filter((r) => r.status === 'pending').sort(byQueue).map(view),
    waitlisted: planService.waitlistOrder(requests).map(view),
  };
}

async function decide(user, postId, requestId, action, body = {}, { io = null } = {}) {
  const viewer = await loadViewer(user);
  const plan = await loadHostedPlan(postId, viewer);
  const request = await loadRequest(requestId, postId);
  const stamp = nowIso();
  const names = await userNames([viewer.id, request.user_id]);
  const hostFirst = firstOf(names.get(viewer.id));
  const state = rules.planState(plan, plan.post.event_date, plan.post.event_end_date);

  if (action === 'accept') {
    if (request.status === 'accepted') return requestResult(postId, viewer, null).then((r) => ({ ...r, request: { id: request.id, status: 'accepted' } }));
    if (!['pending', 'waitlisted'].includes(request.status)) fail(409, 'not_waiting', 'This person is no longer waiting.');
    if (state === 'ended' || state === 'cancelled') fail(409, 'ended', 'This plan is over.');
    if (plan.place_kind === 'home' && body.confirm_shares_address !== true) {
      const { count } = await supabaseAdmin.from('PlanRequest').select('id', { count: 'exact', head: true })
        .eq('post_id', postId).eq('decided_by', 'host').in('status', ['accepted', 'left', 'removed']);
      if (!count) fail(409, 'confirm_shares_address', 'Accepting shares your address with them.');
    }
    const requests = await activeRequests(postId);
    const spotsLeft = plan.spots - planService.seatsTaken(plan, requests);
    if (rules.seatsFor(plan.kind, request.party_size) > spotsLeft) fail(409, 'full', 'This plan is full. They can stay on the waitlist.');
    const { data: moved, error } = await supabaseAdmin.from('PlanRequest')
      .update({ status: 'accepted', decided_by: 'host', decided_at: stamp, updated_at: stamp })
      .eq('id', request.id).in('status', ['pending', 'waitlisted']).select(planService.REQUEST_COLUMNS);
    if (error) throw new Error(`Failed to accept: ${error.message}`);
    if (!moved || moved.length === 0) fail(409, 'not_waiting', 'This person is no longer waiting.');
    const overflow = await enforceCapacity(plan);
    if (overflow.has(request.id)) fail(409, 'full', 'This plan is full. They can stay on the waitlist.');
    await admit(plan, moved[0], { byRule: false, hostFirst, io });
  } else if (action === 'decline') {
    if (request.status !== 'declined') {
      if (!['pending', 'waitlisted'].includes(request.status)) fail(409, 'not_waiting', 'This person is no longer waiting.');
      const { data: moved, error } = await supabaseAdmin.from('PlanRequest')
        .update({ status: 'declined', decided_by: 'host', decided_at: stamp, updated_at: stamp })
        .eq('id', request.id).in('status', ['pending', 'waitlisted']).select('id');
      if (error) throw new Error(`Failed to decline: ${error.message}`);
      if (moved && moved.length > 0) await planNotify.declined({ plan, request, hostFirst });
    }
  } else if (action === 'remove') {
    if (request.status !== 'removed') {
      if (request.status !== 'accepted') fail(409, 'not_in', 'This person isn’t in the plan.');
      const { data: moved, error } = await supabaseAdmin.from('PlanRequest')
        .update({ status: 'removed', decided_by: 'host', decided_at: stamp, updated_at: stamp })
        .eq('id', request.id).eq('status', 'accepted').select('id');
      if (error) throw new Error(`Failed to remove: ${error.message}`);
      if (moved && moved.length > 0) {
        await planChat.removeMember(plan.chat_room_id, request.user_id, { io });
        await planNotify.declined({ plan, request, hostFirst });
        await offerOpenSpots(plan, { io });
      }
    }
  } else {
    fail(404, 'not_found', 'Unknown action.');
  }
  const { data: after } = await supabaseAdmin.from('PlanRequest').select('id, status').eq('id', request.id).maybeSingle();
  return { request: after || { id: request.id, status: request.status }, plan: await planBodyFor(postId, viewer) };
}

// ── Guests ───────────────────────────────────────────────────

async function myAcceptedRequest(viewer, postId) {
  const { data, error } = await supabaseAdmin.from('PlanRequest')
    .select(planService.REQUEST_COLUMNS).eq('post_id', postId).eq('user_id', viewer.id).maybeSingle();
  if (error) throw new Error(`Failed to load your request: ${error.message}`);
  if (!data || data.status !== 'accepted') fail(403, 'not_in', "You're not in this plan.");
  return data;
}

async function onMyWay(user, postId) {
  const viewer = await loadViewer(user);
  const plan = await loadVisiblePlan(postId, viewer);
  const mine = await myAcceptedRequest(viewer, postId);
  const state = rules.planState(plan, plan.post.event_date, plan.post.event_end_date);
  if (state === 'ended' || state === 'cancelled') fail(409, 'ended', 'This plan is over.');
  if (!mine.on_my_way_at) {
    const { data: changed } = await supabaseAdmin.from('PlanRequest')
      .update({ on_my_way_at: nowIso(), updated_at: nowIso() }).eq('id', mine.id).is('on_my_way_at', null).select('id');
    if (changed && changed.length > 0 && plan.chat_room_id) {
      const names = await userNames([viewer.id]);
      await planChat.systemLine(plan.chat_room_id, viewer.id, `${firstOf(names.get(viewer.id))} is on the way`);
    }
  }
  return planBodyFor(postId, viewer);
}

async function stillComing(user, postId, { coming }, { io = null } = {}) {
  if (typeof coming !== 'boolean') fail(422, 'validation', 'Say whether you’re still coming.');
  const viewer = await loadViewer(user);
  await loadVisiblePlan(postId, viewer);
  const mine = await myAcceptedRequest(viewer, postId);
  if (!coming) return withdrawMine(user, postId, { io, reason: 'not_coming' });
  await supabaseAdmin.from('PlanRequest').update({ reconfirmed: true, updated_at: nowIso() }).eq('id', mine.id);
  return requestResult(postId, viewer, mine.id);
}

async function giveFeedback(user, postId, { answer, note }) {
  if (!['great', 'ok', 'not_right'].includes(answer)) fail(422, 'validation', 'Choose how it went.');
  const viewer = await loadViewer(user);
  const plan = await loadVisiblePlan(postId, viewer);
  if (String(plan.host_user_id) === viewer.id) fail(403, 'host', 'Hosts don’t rate their own plans.');
  const mine = await myAcceptedRequest(viewer, postId);
  const state = rules.planState(plan, plan.post.event_date, plan.post.event_end_date);
  if (state === 'upcoming') fail(409, 'not_started', 'You can say how it went once it starts.');
  const cleanNote = cleanText(note, 500, 'Your note');
  const first = !mine.feedback;
  await supabaseAdmin.from('PlanRequest')
    .update({ feedback: answer, feedback_note: cleanNote, feedback_at: nowIso(), updated_at: nowIso() })
    .eq('id', mine.id);
  if (first && answer !== 'not_right') {
    recordFunnelEvent('plan_attended', { userId: viewer.id, meta: { plan_id: postId, kind: plan.kind, answer } });
  }
  if (answer === 'not_right') {
    await filePostReport({
      postId,
      userId: viewer.id,
      reason: 'safety',
      details: `Nearby Plans feedback: something wasn't right.${cleanNote ? ` ${cleanNote}` : ''}`,
    });
  }
  return { feedback: { answer, note: cleanNote }, plan: await planBodyFor(postId, viewer) };
}

async function reportPlan(user, postId, { reason, details }) {
  const viewer = await loadViewer(user);
  const plan = await loadVisiblePlan(postId, viewer);
  if (String(plan.host_user_id) === viewer.id) fail(403, 'host', "You can't report your own plan.");
  const { REPORT_REASONS } = require('../postReportService');
  if (!REPORT_REASONS.includes(reason)) fail(422, 'validation', 'Choose a reason.');
  await filePostReport({ postId, userId: viewer.id, reason, details: cleanText(details, 1000, 'Details') });
  return { reported: true, message: "Thanks. We'll look into it." };
}

module.exports = {
  PlanError,
  createPlan,
  editPlan,
  cancelPlan,
  askToJoin,
  withdrawMine,
  listRequests,
  decide,
  onMyWay,
  stillComing,
  giveFeedback,
  reportPlan,
  offerOpenSpots,
  enforceCapacity,
  // For the jobs.
  activeRequests,
  firstOf,
  userNames,
};
