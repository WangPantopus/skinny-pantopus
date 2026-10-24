'use strict';

// Pulse-mode creation and edits in POST/PATCH /api/posts (S8, contract §2.5). A request with
// `readScope` is a Pulse post: the server decides where it is, who may start it, when it ends
// and whether it is held. Device coordinates and audience fields from the client are ignored.
const db = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const parsePoint = require('../../utils/parsePostGISPoint');
const { homeAreaContext, myAreas, labelFor, openAreas, AREA_SELECT } = require('./areas');
const { windowDays, DAY_MS } = require('./lifecycle');
const limits = require('./limits');
const { UUID } = require('./feedCursor');

const PULSE_TYPES = ['ask_local', 'share', 'offer', 'alert', 'event', 'lost_found'];
const READ_SCOPES = ['public', 'verified_town', 'verified_area'];
// Fields an edit of a Pulse post can't change: type, point, precision and audience.
const LOCKED_EDIT_FIELDS = {
  postType: 'post_type', latitude: 'latitude', longitude: 'longitude',
  locationPrecision: 'location_precision', visibility: 'visibility',
  visibilityScope: 'visibility_scope', radiusMiles: 'radius_miles',
};
const ERRORS = {
  INVALID_PULSE_POST: [400, 'Choose who can read this and what kind of post it is.'],
  AREA_REQUIRED: [400, 'Choose the town this is about.'],
  AREA_NOT_FOUND: [404, 'This area is not available.'],
  AUDIENCE_NOT_ALLOWED: [403, "That audience isn't available for this post."],
  NEEDS_VERIFIED_ADDRESS: [403, 'A verified address in this area is needed.'],
  ADULT_ATTESTATION_REQUIRED: [403, 'Confirm you are 18 or older to post in Pulse.'],
  BUSINESS_CANNOT_POST: [403, 'Businesses reply in Pulse; they don’t start posts.'],
  VISITOR_ASK_ONLY: [403, 'Visitors can ask a question here. Other posts are for people who live nearby.'],
  SHARE_NEEDS_PLACE: [400, 'Add the place this is about.'],
  INVALID_EXPIRES_AT: [400, 'Choose when this ends, within the next 14 days.'],
  TOO_MANY_PHOTOS: [400, 'Add up to 9 photos.'],
  PULSE_FIELD_LOCKED: [400, "A Pulse post's type, place and audience can't be changed. To narrow who can read it, use Who can read."],
  COMPOSER_BLOCKED: [422, "This can't be posted as written."],
};
const LIMIT_MESSAGES = {
  visitor_ask: 'Visitors can ask one question a day here.',
  new_here: 'Until your address is verified you can start two posts a day.',
  share: 'You can share twice a week.',
};

function refusal(code, extra = {}) {
  const [status, error] = ERRORS[code];
  return { status, body: { error, code, ...extra } };
}
function limitRefusal(scope, details) {
  const code = scope === 'share' ? 'SHARE_WEEKLY_CAP' : 'DAILY_LIMIT_REACHED';
  const resets = new Date(details.resets_at);
  return { status: 429, body: { error: `${LIMIT_MESSAGES[scope]} You can post again after ${resets.toUTCString()}.`,
    code, limit: details.limit, resets_at: details.resets_at, ...(code === 'DAILY_LIMIT_REACHED' ? { scope } : {}) } };
}
async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// PS's composer checks (backend/services/pulse/safety/composerChecks.js). Fail open: while
// the module is absent or when it throws, nothing blocks or holds (contract §2.5).
let missingLogged = false;
async function composerChecks(text, media, context) {
  let checks;
  try {
    checks = require('./safety/composerChecks');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND' || !String(error.message).includes('safety/composerChecks')) throw error;
    if (!missingLogged) logger.warn('pulse.compose.checks_unavailable', { reason: 'module not present' });
    missingLogged = true;
    return { blocks: [], holds: [] };
  }
  if (typeof checks.evaluateComposerChecks !== 'function') return { blocks: [], holds: [] };
  try {
    const result = await checks.evaluateComposerChecks(text, media, context);
    return { blocks: Array.isArray(result?.blocks) ? result.blocks : [],
      holds: Array.isArray(result?.holds) ? result.holds.filter(hold => typeof hold?.rule === 'string') : [] };
  } catch (error) {
    logger.warn('pulse.compose.checks_failed', { error: error.message });
    return { blocks: [], holds: [] };
  }
}

function mediaOf(body) {
  return (body.mediaUrls || []).map((url, i) => ({ url, type: body.mediaTypes?.[i] || 'image' }));
}

async function endsAtFor(body, now) {
  if (body.postType === 'alert') {
    if (body.expiresAt == null) return new Date(now + limits.ALERT_DEFAULT_MS).toISOString();
    return new Date(body.expiresAt).toISOString();
  }
  if (body.postType === 'event' && (body.eventEndDate || body.eventDate)) {
    return new Date(Date.parse(body.eventEndDate || body.eventDate) + DAY_MS).toISOString();
  }
  return new Date(now + (await windowDays(body.postType)) * DAY_MS).toISOString();
}

/**
 * Everything the create path needs for a Pulse post, or `{ refusal }`.
 * `retry` is true when this clientRequestId already created a post: limits don't apply then,
 * so the existing post is returned instead of a refusal.
 */
async function prepareCreate({ userId, accountType, body, retry = false }) {
  const { readScope, postType } = body;
  if (!READ_SCOPES.includes(readScope) || !PULSE_TYPES.includes(postType)
    || (body.areaId != null && !UUID.test(body.areaId))
    || (body.claimMode != null && postType !== 'offer')
    || (body.expiresAt != null && postType !== 'alert')
    // Asking a Known entry again is a public Ask (contract §2.14).
    || (body.knownEntryId != null && (postType !== 'ask_local' || readScope !== 'public'))) {
    return { refusal: refusal('INVALID_PULSE_POST') };
  }
  if (body.postAs && body.postAs !== 'personal') {
    return { refusal: refusal(body.postAs === 'business' ? 'BUSINESS_CANNOT_POST' : 'AUDIENCE_NOT_ALLOWED') };
  }
  if ((body.mediaUrls || []).length > limits.MAX_PHOTOS) return { refusal: refusal('TOO_MANY_PHOTOS') };
  const now = Date.now();
  if (postType === 'alert' && body.expiresAt != null) {
    const ends = Date.parse(body.expiresAt);
    if (!(ends > now) || ends > now + limits.ALERT_MAX_MS) return { refusal: refusal('INVALID_EXPIRES_AT') };
  }

  const user = await checked(db.from('User').select('adult_attested_at, account_type').eq('id', userId).maybeSingle());
  if (user?.account_type === 'business') return { refusal: refusal('BUSINESS_CANNOT_POST') };

  const homes = await homeAreaContext(userId);
  const defaults = await myAreas(userId, homes);
  const entry = body.knownEntryId != null ? await require('./known').forAsk(body.knownEntryId) : null;
  if (body.knownEntryId != null && !entry) return { refusal: refusal('INVALID_PULSE_POST') };
  const areaId = body.areaId || entry?.area_id || defaults.town?.id;
  if (!areaId) return { refusal: refusal('AREA_REQUIRED') };
  const area = await checked(openAreas(db.from('PulseArea').select(`${AREA_SELECT}, centroid`)).eq('id', areaId).maybeSingle());
  if (!area) return { refusal: refusal('AREA_NOT_FOUND') };
  if (entry && entry.area_id !== area.id) return { refusal: refusal('INVALID_PULSE_POST') };
  if (area.kind === 'town') {
    if (!['public', 'verified_town'].includes(readScope)) return { refusal: refusal('AUDIENCE_NOT_ALLOWED') };
  } else if (['street', 'neighborhood'].includes(area.kind)) {
    if (readScope !== 'verified_area') return { refusal: refusal('AUDIENCE_NOT_ALLOWED') };
    const inside = homes.primary?.verified === true && homes.matches.some(match => match.home_id === homes.primary.id
      && match.area_id === area.id && match.inside === true);
    if (!inside) return { refusal: refusal('NEEDS_VERIFIED_ADDRESS') };
  } else {
    return { refusal: refusal('AUDIENCE_NOT_ALLOWED') };
  }

  if (!user?.adult_attested_at) return { refusal: refusal('ADULT_ATTESTATION_REQUIRED') };

  // The label the post wears in its area; the primary home decides (contract §5).
  const label = await labelFor({ userId, accountType, origin: accountType === 'curator' ? 'curator' : null,
    identityType: 'local' }, area.id, homes);
  if (label === 'visitor' && postType !== 'ask_local') return { refusal: refusal('VISITOR_ASK_ONLY') };
  if (postType === 'share' && !(typeof body.locationName === 'string' && body.locationName.trim())
    && !['street', 'neighborhood'].includes(area.kind)) return { refusal: refusal('SHARE_NEEDS_PLACE') };

  const scopes = [...(label === 'visitor' ? ['visitor_ask'] : []), ...(label === 'new_here' ? ['new_here'] : []),
    ...(postType === 'share' ? ['share'] : [])];
  if (!retry) {
    for (const scope of scopes) {
      const over = await limits.check(userId, scope, now);
      if (over) return { refusal: limitRefusal(scope, over) };
    }
  }

  const checks = await composerChecks(body.content, mediaOf(body), {
    userId, postType, topic: body.topic || null, areaId: area.id, readScope, mode: 'create',
  });
  if (checks.blocks.length) return { refusal: refusal('COMPOSER_BLOCKED', { blocks: checks.blocks }) };

  // Where the post is: the primary home, snapped like every place post; without a home,
  // the area's center with no displayed point (so no distance).
  let point = null;
  if (homes.primary) {
    const home = await checked(db.from('Home').select('location').eq('id', homes.primary.id).maybeSingle());
    point = parsePoint(home?.location);
  }
  const precision = point ? 'approx_area' : 'none';
  point = point || parsePoint(area.centroid);
  const hold = checks.holds[0];
  const named = typeof body.locationName === 'string' && body.locationName.trim() ? body.locationName.trim() : null;
  return {
    plan: { area, label, scopes, held: !!hold, knownEntryId: entry?.id || null },
    // The place the author named, shown as the card's "About" (contract §2.1), and the Known
    // entry an Ask asks again (§2.14).
    metadata: { ...(named ? { pulse_about: named } : {}), ...(entry ? { known_entry_id: entry.id } : {}) },
    fields: {
      read_scope: readScope, area_id: area.id,
      audience: 'nearby', visibility: readScope === 'public' ? 'public' : 'neighborhood',
      visibility_scope: 'neighborhood', distribution_targets: ['place'],
      allow_external_share: readScope === 'public',
      latitude: point?.latitude ?? null, longitude: point?.longitude ?? null,
      effective_latitude: point?.latitude ?? null, effective_longitude: point?.longitude ?? null,
      location_precision: precision,
      location_name: named || area.name,
      location_address: null, home_id: null, radius_miles: null, gps_timestamp: null,
      target_place_id: null, is_visitor_post: label === 'visitor',
      ...(postType === 'share' ? { purpose: 'story' } : postType === 'offer' ? { purpose: 'offer' } : {}),
      geocode_provider: null, geocode_mode: null, geocode_accuracy: null, geocode_place_id: null,
      geocode_source_flow: null, geocode_created_at: null,
      claim_mode: postType === 'offer' ? (body.claimMode || 'choose') : 'choose',
      expires_at: await endsAtFor(body, now),
      ...(entry && !body.topic && entry.topic ? { topic: entry.topic } : {}),
      ...(hold ? { moderation_state: 'held', moderation_rule: hold.rule, moderated_at: new Date(now).toISOString() } : {}),
    },
  };
}

/** After the insert: undo a post that raced past a limit. Returns a refusal or null. */
async function recheckLimits(userId, plan, postId) {
  for (const scope of plan.scopes) {
    if (await limits.exceededBy(userId, scope, postId)) {
      const { error } = await db.from('Post').delete().eq('id', postId).eq('user_id', userId);
      if (error) throw error;
      return limitRefusal(scope, await limits.check(userId, scope));
    }
  }
  return null;
}

/**
 * An edit of a Pulse post (contract §2.5): refuses a changed type, point or audience, drops
 * the same values sent back, caps photos and runs the composer checks on new text.
 * Returns `{ refusal }` or `{ updates }` (the filtered updates).
 */
async function prepareEdit({ userId, existing, body, updates }) {
  for (const [camel, column] of Object.entries(LOCKED_EDIT_FIELDS)) {
    if (body[camel] === undefined) continue;
    const before = existing[column];
    const same = typeof before === 'number' || typeof body[camel] === 'number'
      ? Number(before) === Number(body[camel]) : (before ?? null) === (body[camel] ?? null);
    if (!same) return { refusal: refusal('PULSE_FIELD_LOCKED') };
    delete updates[column];
  }
  if ((body.mediaUrls || []).length > limits.MAX_PHOTOS) return { refusal: refusal('TOO_MANY_PHOTOS') };
  if (body.content !== undefined && body.content !== existing.content) {
    const checks = await composerChecks(body.content, mediaOf(body), {
      userId, postType: existing.post_type, topic: existing.topic || null, areaId: existing.area_id,
      readScope: existing.read_scope, mode: 'edit',
    });
    if (checks.blocks.length) return { refusal: refusal('COMPOSER_BLOCKED', { blocks: checks.blocks }) };
  }
  return { updates };
}

module.exports = { PULSE_TYPES, READ_SCOPES, LOCKED_EDIT_FIELDS, prepareCreate, recheckLimits, prepareEdit };
