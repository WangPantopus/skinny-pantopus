// Moments (build brief and CONTRACT in ~/pantopus-moments/coord, approved 2026-11-08): a photo, a video of up to 30 s
// or a text card, pinned where it was posted, for 1, 6, 24 or 48 hours. Each one is a Post row with is_story = true and
// story_expires_at, and its own details in post_metadata.moment. A Moment the seed-the-map tool posts
// (scripts/seedmap.js, founder 2026-11-24) may last longer, up to LONG_MAX_HOURS; the apps' route never offers that
// (HOURS), and every read answers a long Moment's time as at most MAX_HOURS ahead (answeredEnd), so today's apps read
// "48h left" for it, never "1440h left".
//   { v: 1, kind, hours, background, show_area, at_home, location_source,
//     state: 'uploading' | 'checking' | 'live', media: {...} | null, check: {...} | null, purged_at,
//     label_kind, notify: { sent_at } | { skipped } (services/moments/momentNotify.js),
//     taken_at (a photo or video from the album taken more than a day before it was posted: everyone reads when),
//     venue_id (the venue the author picked in the place picker, its `osm:` id),
//     altitude_ft, flying (the height above sea level the author chose to show, rounded to 10 ft, and whether they
//       were in the air; behind the `moment_heights` flag; never kept for a Moment at home, shown as an area or
//       with no location: shownAltitude; a floating Moment's is rounded to 100 ft),
//     taken_here (the Live mark, API v4.1: the app's own camera made it just now, kept only for a photo or video at
//       an exact pin away from home: markKept), weather ({ temp_f, kind, label }, read by the server when the
//       author kept "Show the weather" on; only with taken_here: services/moments/momentWeather.js) }
// The Sky, phase A (behind the `sky_places` flag, read for the author when they post): a Moment floats over an area of
// at least 100 homes (utils/areaCells.js) unless its author pinned it at a public place by name, and one made at home
// always floats. A floating Moment stores only its area's point (latitude, longitude and the effective pair),
// location_precision 'approx_area', show_area true (so apps from before draw it as an area), and
// post_metadata.area = { v: 1, step, radius_m }. Where the phone was is never written.
// "Share later" (same flag; services/moments/momentSchedule.js): post_metadata.moment.share_at holds a Moment until
// then. Its stored state follows the upload as usual, and every read works out from share_at that it is 'scheduled'
// (only its author sees it) until the time comes; its hours count from then, and everyone reads that time as when it
// was posted (`created_at`) with `earlier: true`.
// A Moment with no location (location_source 'none', founder 2026-11-11) has no point and no place: it goes to the
// author's connections only, never on the map; they find it in the map's row of faces (GET /map `unplaced`).
// Its place label is location_name (what everyone reads), its audience Post.audience ('nearby' | 'connections').
// The row is private (visibility 'private', no distribution targets, off profiles), and every other post path leaves
// it out (feedService.onlyShownPosts, readAccess.canReadPost, profiles): this module is its only reader. Every read here
// checks the end time itself, so a Moment ends on time even with the scheduled jobs off.

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const feedService = require('../feedService');
const { getFlag, isFeatureEnabled } = require('../featureFlagService');
const { loadChatPeople } = require('../chatPeople');
const { verifiedResidentUserIds } = require('../../utils/identityProfiles');
const { PANTOPUS_VERIFIED_STATUSES } = require('../../utils/businessConstants');
const { applyLocationPrecision, MAX_DISPLAY_OFFSET_DEGREES, snapToNeighborhoodCells } = require('../../utils/locationPrivacy');
const { shownReaction, reactionSummary, shownSignal, signalSummary } = require('../../utils/postReaction');
const { areaMetadata } = require('../../utils/areaCells');
const media = require('./momentMedia');
const momentWeather = require('./momentWeather');
const momentStamps = require('./momentStamps');
const momentGuess = require('./momentGuess');
const playItems = require('../pulse/play');
const soundMedia = require('../pulse/sound');
const motionMedia = require('../pulse/motion');
const stepDeck = require('../pulse/deck');
const shownReplies = require('../pulse/replies');
const penName = require('../penName');

const KINDS = ['photo', 'video', 'text'];
const HOURS = [1, 6, 24, 48];
// The longest an app's Moment lasts, and the longest one the seed-the-map tool may post (60 days). Only that tool asks
// for more than MAX_HOURS: POST /api/moments takes HOURS alone.
const MAX_HOURS = Math.max(...HOURS);
const LONG_MAX_HOURS = 60 * 24;
const BACKGROUNDS = ['teal', 'sky', 'green', 'amber', 'rose', 'slate'];
const AUDIENCES = ['nearby', 'connections'];
const DAILY_LIMIT = 20;
// A video longer than one Moment's 60 seconds is posted as up to this many Moments, in order: its parts.
const MAX_PARTS = 5;
// How long after a video's first part its later parts may still be made.
const PARTS_WINDOW_MS = 30 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const FIX_MAX_AGE_MS = 5 * 60 * 1000;
// Any photo or video in the album may be a Moment (founder, 2026-11-11). One taken more than this before it's posted
// says when it was taken ("Taken Oct 3"), so an old photo is never read as something happening now.
const TAKEN_SHOWN_AFTER_MS = 24 * HOUR_MS;
// A camera whose clock was never set says 1970 or so: that time isn't shown.
const EARLIEST_TAKEN_MS = Date.UTC(2000, 0, 1);
// A phone's clock may run a little ahead of the server's.
const CLOCK_SKEW_MS = 2 * 60 * 1000;
// "Show height" (behind the `moment_heights` flag): a Moment may say how high above sea level it was posted. The phone
// sends metres; everyone reads feet rounded to HEIGHT_STEP_FT, so the number never tells one floor from the next.
const HEIGHTS_FLAG = 'moment_heights';
// The Sky, phase A: approximate places (above).
const SKY_FLAG = 'sky_places';
// A floating Moment's height is rounded this much more, so it never points at one spot (the design's decision 13).
const FLOATING_HEIGHT_STEP_FT = 100;
// Part D "float by day": Moments with an elevation float on the map, shadows where the sun is. Needs HEIGHTS_FLAG.
const FLOAT_FLAG = 'moment_float';
// Pulse, reinvented (founder 2026-11-26): the one switch for the new direction (the Studio's stamps, and more later).
// Off for a person, every answer here is today's.
const REINVENTED_FLAG = 'pulse_reinvented';
// How long after a Moment goes out its author may still change its caption, stamps and who sees it (PATCH /:id).
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const FEET_PER_M = 3.28084;
const HEIGHT_STEP_FT = 10;
// Below the Dead Sea's shore or above where airliners fly, the reading is wrong: it isn't shown.
const MIN_ALTITUDE_M = -500;
const MAX_ALTITUDE_M = 15000;
// A reading the phone itself says may be off by more than this isn't shown (a seat by a plane's window gets more room).
const MAX_ALTITUDE_ERROR_M = 60;
const MAX_ALTITUDE_ERROR_FLYING_M = 150;
// Nothing on the ground goes this fast (60 m/s is about 134 mph): the Moment was posted from the air.
const FLYING_SPEED_MPS = 60;
// The Live mark (API v4.1): a Moment taken here reads "Live from here" this long after everyone reads it was posted
// (`created_at`), then "Taken here". Here and nowhere else, so changing it needs no app build.
const LIVE_FOR_MS = 15 * 60 * 1000;
const MAX_RINGS = 300;
const MAX_MAP_ROWS = 2000;
// A box wider than this (the whole state and beyond) shows no rings; the map asks again closer in.
const MAX_MAP_SPAN_DEGREES = 5;
const REPORTS_TO_HOLD = 2;
// How far back a viewer's reports hide Moments from them: the longest a Moment lasts, and a day more.
const REPORTS_LOOKBACK_MS = (LONG_MAX_HOURS + 24) * HOUR_MS;

const MOMENT_SELECT = [
  'id', 'user_id', 'content', 'latitude', 'longitude', 'location_name', 'location_precision', 'audience',
  'created_at', 'story_expires_at', 'is_story', 'moderation_state', 'moderation_rule', 'moderation_note',
  'archived_at', 'archive_reason', 'post_metadata', 'view_count', 'origin',
  // A Moment under a made-up name (services/penName): stored under the system account, with the made-up name's id.
  'identity_context_type', 'identity_context_id',
].join(', ');

function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

// Ids per read: they go in the request URL.
const IDS_PER_READ = 100;
function chunks(list) {
  const out = [];
  for (let at = 0; at < list.length; at += IDS_PER_READ) out.push(list.slice(at, at + IDS_PER_READ));
  return out;
}

/** The rows of one select run over `ids` in batches (`read(batch)` answers a query); throws on a failed read. */
async function readInBatches(ids, read, what) {
  const pages = await Promise.all(chunks(ids).map(async (batch) => {
    const { data, error } = await read(batch);
    if (error) throw new Error(`Failed to load ${what}: ${error.message}`);
    return data || [];
  }));
  return pages.flat();
}

const meta = (row) => row?.post_metadata?.moment || {};

/** Whether `hours` is a length a stored Moment may have: one of HOURS, or a whole number up to LONG_MAX_HOURS. */
function validHours(hours) {
  return Number.isInteger(hours) && hours >= 1 && hours <= LONG_MAX_HOURS;
}

/** How many hours the Moment lasts, as stored (24 for a row that says nothing sound). */
function storedHours(row) {
  const { hours } = meta(row);
  return validHours(hours) ? hours : 24;
}

/**
 * The end time the apps read (`expires_at`): the stored one, except that a long Moment (more than MAX_HOURS, from the
 * seed-the-map tool) answers at most MAX_HOURS from now, so every app's "22h left" stays in the range it was made
 * for. Its stored end still decides when it ends.
 */
function answeredEnd(row, now = Date.now()) {
  if (storedHours(row) <= MAX_HOURS || !row.story_expires_at) return row.story_expires_at;
  const ends = Date.parse(row.story_expires_at);
  return Number.isFinite(ends) && ends > now + MAX_HOURS * HOUR_MS
    ? new Date(now + MAX_HOURS * HOUR_MS).toISOString() : row.story_expires_at;
}

/** Ended: its time ran out, its author deleted it (archived) or a moderator removed it. */
function hasEnded(row, now = Date.now()) {
  return Boolean(row.archived_at) || row.moderation_state === 'removed'
    || !row.story_expires_at || Date.parse(row.story_expires_at) <= now;
}

/**
 * What the author reads as the Moment's state (CONTRACT "Shapes"); others only ever see 'live' ones. A Moment shared
 * later is 'scheduled' once its file is in and checked, until its time.
 */
function momentState(row, now = Date.now()) {
  if (hasEnded(row, now)) return 'ended';
  if (row.moderation_state === 'held') return 'held';
  const { state } = meta(row);
  const stage = ['uploading', 'checking', 'live'].includes(state) ? state : 'live';
  return stage === 'live' && isScheduled(row, now) ? 'scheduled' : stage;
}

/** Held by "Share later" until a time still to come. */
function isScheduled(row, now = Date.now()) {
  const at = Date.parse(meta(row).share_at || '');
  return Number.isFinite(at) && at > now;
}

/**
 * When everyone reads that the Moment was posted: when it went live for one shared later (so apps say "Earlier today"
 * from `earlier`, and older apps the time it went live), else when it was made.
 */
function shownAt(row) {
  return meta(row).share_at ? new Date(wentLiveAt(row)).toISOString() : row.created_at;
}

// The point everyone sees, the author included: the exact pin, the stored area point of a floating Moment (it holds
// nothing finer), or the approximate grid point (docs/location-privacy-matrix.md, approx_area) for a Moment shown as
// an area before the Sky.
function displayedPoint(row) {
  if (!hasPlace(row)) return { latitude: null, longitude: null };
  const point = { latitude: row.latitude, longitude: row.longitude };
  if (meta(row).show_area && !isFloating(row)) {
    applyLocationPrecision(point, 'approx_area', false, { setUnlockedFlag: false, stripAddress: false });
  }
  return point;
}

/** A floating Moment (the Sky): it stores its area's point and post_metadata.area. */
function isFloating(row) {
  return Boolean(row?.post_metadata?.area) && hasPlace(row);
}

/** Whether the Moment has a point (one posted with no location has none). */
function hasPlace(row) {
  return row.latitude != null && row.longitude != null;
}

// ─── Under a made-up name ──────────────────────────────────────────────────
// A Moment under a made-up name (services/penName) is stored under the one system account, so `row.user_id` is the
// same on all of them and is never its writer's. Two things stand in for it wherever a Moment is read:
//   authorKey(row)  who it is by, as everyone sees it: the made-up name's id (the account's id on every other Moment);
//   isOwn(row, id)  whether this viewer wrote it: marked on the row by markOwn, which asks services/penName.
// `row.user_id` itself is left as stored: the files' keys, the row's updates and the writer's notices depend on it.

const OWN = Symbol('ownUnderPenName');

function authorKey(row) {
  return penName.isPenNameRow(row) ? String(row.identity_context_id) : row.user_id;
}

function isOwn(row, viewerId) {
  return Boolean(row) && (row.user_id === viewerId || row[OWN] === String(viewerId));
}

/** Marks the made-up-name Moments among `rows` that `viewerId` wrote. One read, and none without such a row. */
async function markOwn(rows, viewerId) {
  const pending = (rows || []).filter((row) => penName.isPenNameRow(row) && row[OWN] === undefined);
  if (!pending.length || !viewerId) return rows;
  const mine = await penName.owner.mine(viewerId, 'post', pending.map((row) => row.id));
  for (const row of pending) row[OWN] = mine.has(String(row.id)) ? String(viewerId) : null;
  return rows;
}

// One ring per person per spot (CONTRACT Ring.id): an exact pin's 0.005° cell, an area pin's displayed point; one
// ring per person for the Moments with no location.
function ringKey(row, point) {
  const who = authorKey(row);
  if (!hasPlace(row)) return `u_${who}_none`;
  if (meta(row).show_area) {
    return `u_${who}_a_${Math.round(point.latitude * 1000)}_${Math.round(point.longitude * 1000)}`;
  }
  return `u_${who}_c_${Math.floor(point.latitude * 200)}_${Math.floor(point.longitude * 200)}`;
}

// ─── Who sees what ──────────────────────────────────────────────────────────

/**
 * What decides which Moments `viewerId` sees: the people across a block from them, the people and businesses they
 * muted (everywhere, or in Moments only) and, for connections-only Moments, who they're connected to. Throws when the
 * blocks or mutes can't be read, so nothing shows unfiltered.
 */
async function viewerContext(viewerId, authorIds = [], shared = null, rows = null) {
  // `shared` (sharedViewerReads): the viewer's filters already being read for this request, used instead of reading
  // them again; a failed read throws here, as its own would have. `rows`: the Moments being decided, so the viewer's
  // own made-up-name ones are marked in the same step.
  const [filters, , reinvented] = await Promise.all([
    shared ? used(shared.filters) : feedService.getMuteAndHideFilters(viewerId),
    rows ? markOwn(rows, viewerId) : null,
    // Pulse, reinvented: only a reader with the switch on may open a live guess-the-spot Moment (canSee).
    reinventedOn(viewerId),
  ]);
  const others = [...new Set(authorIds.filter((id) => id && id !== viewerId))];
  let connected;
  if (shared?.connections) {
    // These authors all come from the viewer's connections (shared.connections, read in full for this request), so
    // each one is connected: the same answer the read below gives for them.
    const all = new Set(shared.connections.map(String));
    connected = new Set(others.filter((id) => all.has(String(id))));
  } else {
    const links = await readInBatches(others, (batch) => supabaseAdmin
      .from('Relationship')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`and(requester_id.eq.${viewerId},addressee_id.in.(${batch.join(',')})),and(addressee_id.eq.${viewerId},requester_id.in.(${batch.join(',')}))`),
    'connections');
    connected = new Set(links.map((r) => (r.requester_id === viewerId ? r.addressee_id : r.requester_id)));
  }
  return {
    viewerId,
    blocked: filters.blockedUserIds,
    muted: new Set([...filters.mutedUserIds, ...filters.mutedBusinessIds, ...filters.momentMutedIds]),
    connected,
    // Made-up names this viewer muted or blocked, and the brake that hides every made-up-name Moment.
    hiddenPenNames: filters.hiddenPenNameIds || new Set(),
    penNamesHidden: filters.penNamesHidden === true,
    reinvented,
  };
}

/**
 * Whether the Moment may be listed for `viewerId` (a ring on the map or a profile, the tab's dot): never a live
 * guess-the-spot Moment but to its author, since its pin and place are the answer. It is opened by id instead.
 */
function listedFor(row, viewerId) {
  return !(momentGuess.isGuess(row) && !hasEnded(row) && !isOwn(row, viewerId))
    // A sealed Moment (Pulse, reinvented; CONTRACT 8g) is listed nowhere until it opens, but to its author.
    && !(sealedNow(row) && !isOwn(row, viewerId));
}

// Required when used: seal.js requires this file.
// eslint-disable-next-line global-require
const sealedNow = (row) => Boolean(row?.post_metadata?.moment?.seal) && require('../pulse/seal').isSealed(row);

/** Whether the viewer may see this Moment at all (blocks, mutes, audience), whatever its state. */
function canSee(row, ctx) {
  if (isOwn(row, ctx.viewerId)) return true;
  // A live guess-the-spot Moment (Pulse, reinvented) is for readers with the switch on only, until it ends; a context
  // built without that read (a profile's count) leaves it out too.
  if (momentGuess.isGuess(row) && !hasEnded(row) && !ctx.reinvented) return false;
  // A sealed Moment (CONTRACT 8g) is for readers with the switch on only, until it opens.
  if (sealedNow(row) && !ctx.reinvented) return false;
  // Under a made-up name: hidden by that name (or the brake), never by a block or a mute of a person, which would
  // say who is behind it. It goes to people nearby, so there is no audience to check.
  if (penName.isPenNameRow(row)) return !ctx.penNamesHidden && !ctx.hiddenPenNames.has(String(row.identity_context_id));
  if (ctx.blocked.has(row.user_id) || ctx.muted.has(row.user_id)) return false;
  if (row.audience === 'connections') return ctx.connected.has(row.user_id);
  return true;
}

// ─── People ─────────────────────────────────────────────────────────────────

function initialsOf(name) {
  const words = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();
}

/** The authors as the apps draw them (CONTRACT Author), by account id. Named the way chats and posts name them. */
async function loadAuthors(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const [people, accounts, residentSets] = await Promise.all([
    loadChatPeople(ids),
    readInBatches(ids, (batch) => supabaseAdmin.from('User').select('id, account_type').in('id', batch), 'authors'),
    Promise.all(chunks(ids).map((batch) => verifiedResidentUserIds(batch))),
  ]);
  const residents = new Set(residentSets.flatMap((set) => [...set]));
  const kinds = new Map(accounts.map((u) => [String(u.id),
    u.account_type === 'curator' ? 'pantopus' : u.account_type === 'business' ? 'business' : 'person']));
  const businessIds = ids.filter((id) => kinds.get(id) === 'business');
  // A business's check is Pantopus's verification (a reviewed document or a registry check), never the owner's own
  // word (self_attested); if that can't be read, it shows none.
  const businesses = await readInBatches(businessIds, (batch) => supabaseAdmin.from('BusinessProfile')
    .select('business_user_id, verification_status').in('business_user_id', batch), 'businesses').catch(() => []);
  const verifiedBusinesses = new Set(businesses.filter((b) => PANTOPUS_VERIFIED_STATUSES.has(b.verification_status))
    .map((b) => String(b.business_user_id)));
  const authors = new Map();
  for (const id of ids) {
    const person = people.get(id);
    const kind = kinds.get(id) || 'person';
    const name = person?.displayName || (kind === 'pantopus' ? 'Pantopus' : 'Pantopus member');
    authors.set(id, {
      id,
      name,
      first_name: kind === 'person' ? name.split(/\s+/)[0] : name,
      avatar_url: person?.avatarUrl || null,
      initials: initialsOf(name),
      verified: kind === 'person' ? residents.has(id) : kind === 'business' && verifiedBusinesses.has(id),
      kind,
    });
  }
  return authors;
}

/**
 * The authors of these Moments, by authorKey: the account's (loadAuthors), or the made-up name's. Everyone with a
 * made-up name has a verified home, so its check tells nothing apart.
 */
async function authorsFor(rows) {
  const penRows = rows.filter(penName.isPenNameRow);
  const [authors, pens] = await Promise.all([
    loadAuthors(rows.filter((row) => !penName.isPenNameRow(row)).map((row) => row.user_id)),
    penRows.length ? penName.names.rowsById(penRows.map((row) => row.identity_context_id)) : new Map(),
  ]);
  for (const row of penRows) {
    const id = String(row.identity_context_id);
    if (authors.has(id)) continue;
    const name = pens.get(id)?.display_name || penName.present.UNKNOWN_NAME;
    authors.set(id, {
      id, name, first_name: name, avatar_url: pens.get(id)?.avatar_url || null, initials: initialsOf(name),
      verified: true, kind: 'person', made_up_name: true,
    });
  }
  return authors;
}

// ─── Reading ────────────────────────────────────────────────────────────────

async function loadMoment(id) {
  const { data, error } = await supabaseAdmin.from('Post').select(MOMENT_SELECT).eq('id', id).eq('is_story', true).maybeSingle();
  if (error && error.code !== '22P02') throw new Error(`Failed to load the Moment: ${error.message}`);
  return data || null;
}

/**
 * The viewer's views and reactions on these Moments: { seen: Set, reactions: Map(id → emoji), signals: Map(id → signal) }
 * (the same reaction as the new screens name it, Pulse, reinvented).
 */
async function viewerMarks(viewerId, ids) {
  if (!ids.length) return { seen: new Set(), reactions: new Map(), signals: new Map() };
  const [views, likes] = await Promise.all([
    readInBatches(ids, (batch) => supabaseAdmin.from('PostView').select('post_id').eq('user_id', viewerId).in('post_id', batch), 'views'),
    readInBatches(ids, (batch) => supabaseAdmin.from('PostLike').select('post_id, reaction').eq('user_id', viewerId).in('post_id', batch), 'reactions'),
  ]);
  return {
    seen: new Set(views.map((v) => v.post_id)),
    reactions: new Map(likes.map((l) => [l.post_id, shownReaction(l.reaction)])),
    signals: new Map(likes.map((l) => [l.post_id, shownSignal(l.reaction)])),
  };
}

/**
 * The height a Moment shows, { altitude_ft, flying }, or null. What was kept at posting is checked again here, so a
 * Moment at home, shown as an area or with no location never says how high it was.
 */
function shownHeight(row) {
  const m = meta(row);
  // A floating Moment's height was rounded to 100 ft when it was kept; an area Moment from before the Sky kept none.
  if (!Number.isFinite(m.altitude_ft) || m.at_home || (m.show_area && !isFloating(row)) || !hasPlace(row)) return null;
  return { altitude_ft: m.altitude_ft, flying: Boolean(m.flying) };
}

/**
 * Whether the Moment is shown at its exact pin away from its author's home: it has a point, wasn't made at home, isn't
 * shown as an area and doesn't float. Only there may anything say its author is at that spot now.
 */
function exactAway(row) {
  const m = meta(row);
  return hasPlace(row) && row.location_precision === 'exact_place' && !m.at_home && !m.show_area
    && !row.post_metadata?.area;
}

/**
 * Whether the Moment carries the Live mark (API v4.1): its author's app said its camera made it just now, and what
 * was kept at posting (markKept) still holds: a photo or video from a fix where its author was, with no older taken
 * time, at its exact pin away from home.
 */
function takenHere(row) {
  const m = meta(row);
  return m.taken_here === true && (m.kind === 'photo' || m.kind === 'video') && m.location_source === 'gps'
    && !m.taken_at && exactAway(row);
}

/**
 * Until when a Moment taken here reads "Live from here": LIVE_FOR_MS after the time everyone reads it was posted.
 * Null for one shared later (it may read "Taken here", never "Live") and for any Moment without the mark.
 */
function liveUntil(row) {
  if (!takenHere(row) || meta(row).share_at) return null;
  const posted = Date.parse(shownAt(row));
  return Number.isFinite(posted) ? new Date(posted + LIVE_FOR_MS).toISOString() : null;
}

/**
 * A ring's `live_until`: the latest among its Moments, only when the Moment the ring is drawn at (its newest) is
 * itself an exact pin away from home, so the dot never sits on a pin at home or an area. Null otherwise.
 */
function ringLiveUntil(members, newest) {
  if (!exactAway(newest.row)) return null;
  const times = members.map(({ row }) => liveUntil(row)).filter(Boolean).sort();
  return times.length ? times[times.length - 1] : null;
}

/**
 * Whether `viewer` (an id, or { id, role }) has heights: off for everyone until the founder turns the flag on. Every
 * Moments read asks, so while the flag is off, or on only for named people, it costs no read of its own (the flag
 * row is kept for a minute); only the internal-team tier looks up the person's role.
 */
async function heightsOn(viewer) {
  return flagOnFor(HEIGHTS_FLAG, viewer);
}

/** Whether Moments float by day on `viewer`'s map: `moment_float` on for them, and heights too. Off for everyone. */
async function floatOn(viewer) {
  return (await heightsOn(viewer)) && flagOnFor(FLOAT_FLAG, viewer);
}

/** Whether the Sky's places rules apply to `viewer`'s posts and Post sheet (`sky_places`). Off for everyone. */
async function skyOn(viewer) {
  return flagOnFor(SKY_FLAG, viewer);
}

/**
 * The answer to a request only the new screens make (Studio stamps, the edit, a signal) from a person whose switch is
 * off (CONTRACT "the switch is off for you"): its own code, so an app still drawing the Studio re-reads the switch at
 * once and goes back to today's screens with what the person made. Today's apps never make such a request.
 */
const REINVENTED_OFF = { status: 403, code: 'PULSE_REINVENTED_OFF', message: "This isn't on for you right now." };
function reinventedOff() {
  return fail(REINVENTED_OFF.status, REINVENTED_OFF.code, REINVENTED_OFF.message);
}

/** Whether the new direction (`pulse_reinvented`) is on for `viewer`. Off for everyone until the founder turns it on. */
async function reinventedOn(viewer) {
  return flagOnFor(REINVENTED_FLAG, viewer);
}

/** One flag for one person, read from the cached flag row; any failure reads as off. */
async function flagOnFor(name, viewer) {
  try {
    const flag = await getFlag(name);
    if (!flag) return false;
    if (flag.enabled_globally) return true;
    const id = typeof viewer === 'string' ? viewer : viewer?.id;
    if (id && (flag.beta_user_ids || []).includes(id)) return true;
    return flag.enabled_for_internal_team ? await isFeatureEnabled(name, viewer) : false;
  } catch (error) {
    logger.warn('moments.flag_failed', { flag: name, error: error.message });
    return false;
  }
}

/**
 * Until when the author may still change the Moment (PATCH /:id): EDIT_WINDOW_MS after it went out, that is after the
 * later of when everyone reads it was posted and when it went live (a photo after its upload and check, one shared
 * later at its time). Null once that has passed, and for a Moment that ended or is held for review.
 */
function editableUntil(row, now = Date.now()) {
  const state = momentState(row, now);
  if (state === 'ended' || state === 'held') return null;
  const out = Math.max(Date.parse(shownAt(row)) || 0, wentLiveAt(row) || 0);
  const until = out + EDIT_WINDOW_MS;
  return Number.isFinite(until) && until > now ? new Date(until).toISOString() : null;
}

function briefOf(row, seen) {
  return { id: row.id, kind: meta(row).kind, created_at: shownAt(row), expires_at: answeredEnd(row), seen };
}

/**
 * A Moment as CONTRACT "Moment" for `viewerId`. `links` holds signed links by storage key; `own` adds the author's
 * counts (`reactionCounts` from reactionCountsFor).
 */
function serializeMoment(row, { author, viewerId, seen = false, myReaction = null, links = new Map(), reactionCounts = null,
  heights = false, reinvented = false, mySignal = null, signalCounts = null, guess = null, keptEnded = false,
  keptPosts = false, keepOffer = false, plan = null, play = null, decks = new Map(), replyCounts = new Map(), mentioned = null, retakes = null,
  unsealed = false, pinboards = null }) {
  const m = meta(row);
  const high = heights ? shownHeight(row) : null;
  const own = isOwn(row, viewerId);
  const state = momentState(row);
  const point = displayedPoint(row);
  // `keptEnded` (My Atlas only): the author's own kept Moment shows its picture to them after it ended too.
  const showMedia = state === 'live' || (own && state !== 'ended') || (keptEnded && own && keptFilesOf(row))
    // `keptPosts` (the new routes only): a Moment its author kept as a post ("Keep this?", CONTRACT 6d) shows its
    // picture to the people who may see it after it ended.
    || (keptPosts && Boolean(m.kept_post_at) && keptFilesOf(row));
  const stored = m.media || null;
  const answer = {
    id: row.id,
    author,
    kind: m.kind,
    state,
    caption: m.kind === 'text' ? null : (row.content || null),
    text: m.kind === 'text' ? row.content : null,
    background: m.kind === 'text' ? (m.background || 'teal') : null,
    media_url: showMedia && stored?.key ? links.get(stored.key) || null : null,
    poster_url: showMedia && stored?.poster_key ? links.get(stored.poster_key) || null : null,
    width: stored?.width ?? null,
    height: stored?.height ?? null,
    duration_ms: stored?.duration_ms ?? null,
    place_label: row.location_name || null,
    latitude: point.latitude,
    longitude: point.longitude,
    no_location: !hasPlace(row),
    show_area: Boolean(m.show_area),
    // The Sky: a floating Moment and its disc around the area point (null for any other).
    floating: isFloating(row),
    area: isFloating(row) && Number.isFinite(row.post_metadata.area.radius_m)
      ? { radius_m: row.post_metadata.area.radius_m } : null,
    audience: row.audience === 'connections' ? 'connections' : 'nearby',
    created_at: shownAt(row),
    expires_at: answeredEnd(row),
    // Shared later (the Sky): apps say "Earlier today"; its author also reads when it shares.
    earlier: Boolean(m.share_at),
    share_at: own ? (m.share_at || null) : null,
    // A long Moment (the seed-the-map tool) says MAX_HOURS, the longest the apps know, as its expires_at does.
    hours: Math.min(storedHours(row), MAX_HOURS),
    // A part of a longer video posted as several Moments: which one, of how many (null for any other Moment).
    series: m.series ? { id: m.series.id, index: m.series.index, count: m.series.count } : null,
    taken_at: m.kind === 'text' ? null : (m.taken_at || null),
    // The Live mark (API v4.1): taken here with the app's camera; "Live from here" until `live_until`, then "Taken
    // here" (null for one shared later). `weather`: the stamp its author kept, only on a Moment taken here.
    taken_here: takenHere(row),
    live_until: liveUntil(row),
    weather: takenHere(row) ? momentWeather.shownStamp(m.weather) : null,
    // Feet above sea level, when the author chose "Show height" (null otherwise); `flying`: posted from the air.
    altitude_ft: high ? high.altitude_ft : null,
    flying: Boolean(high?.flying),
    seen: own ? true : Boolean(seen),
    my_reaction: own ? null : myReaction,
    viewer_count: own ? Number(row.view_count) || 0 : null,
    reaction_counts: own ? reactionCounts || [] : null,
    // Pulse, reinvented (only for a reader with the switch on): the stamps its author placed, with the values the
    // server kept when it was posted (momentStamps.js).
    // `edited_at`: when its author last changed it (PATCH /:id); `editable_until`: the author's own, while they still may.
    ...(reinvented ? {
      stamps: momentStamps.shownStamps(m, { atHome: Boolean(m.at_home), penName: penName.isPenNameRow(row), placed: hasPlace(row) }),
      edited_at: m.edited_at || null,
      editable_until: own ? editableUntil(row) : null,
      // Explore (CONTRACT 6f): on the author's own, whether it is shown there.
      ...(own ? { explore: Boolean(m.explore) } : {}),
      // "Keep this?" (CONTRACT 6d): on the author's own, whether to ask now; on any Moment, whether it was kept.
      ...(own ? { keep_offer: Boolean(keepOffer) } : {}),
      kept: Boolean(m.kept_post_at),
      // The author's own, while they may still edit it: every kind's kept value, so an edit offers the whole tray.
      stamp_choices: own && editableUntil(row)
        ? momentStamps.choicesOf(m, { atHome: Boolean(m.at_home), penName: penName.isPenNameRow(row), placed: hasPlace(row) })
        : null,
      // The five signals: the viewer's own reaction as a signal, and the author's counts by signal.
      my_signal: own ? null : mySignal,
      signal_counts: own ? signalCounts || [] : null,
      // Guess the spot: how many guessed and this reader's own guess; null on any other Moment.
      guess: momentGuess.isGuess(row) ? (guess || { count: 0, mine: null }) : null,
      // "Want to come?" (CONTRACT 6g): the plan this Moment started, as Plans shows it to this reader, or null.
      plan,
      // Playable items (CONTRACT 7b), with what this reader may see of the answers; [] when none.
      play: play || [],
      // Dots on the picture (CONTRACT 7c), a thing's with its kept field card and a whisper's sound (7e); [] when none.
      dots: playItems.dotsFor(m.dots, m.cards, { whispers: m.whispers, links, show: Boolean(showMedia) }),
      // Voice Spark or place sound (CONTRACT 7e), its link given exactly when the picture's is.
      sound: soundMedia.soundOf(m, links, Boolean(showMedia)),
      // The step deck it belongs to (CONTRACT 7g), with the steps this reader may see; null for any other Moment.
      deck: stepDeck.deckOf(m, decks, row.user_id),
      // Replies people can see (CONTRACT 8a): shown or not, how many this reader may see, and whether they may reply.
      replies: shownReplies.repliesOf(row, replyCounts),
      // Retake (CONTRACT 8e): the Retake this Moment starts or joined, as this reader may see it; null for any other.
      retake: retakes?.get(row.id) || null,
      // Pinboards (CONTRACT 8i): the pinboard this Moment starts or is a piece of; null for any other.
      pinboard: pinboards?.get(row.id) || null,
      // Mentions in its caption (CONTRACT 7h), as authors, without people hidden from this reader; [] when none.
      mentions: mentioned?.get(row.id) || [],
      // A sealed Moment (CONTRACT 8g): how and when it opens, and whether it has; null for any other.
      seal: m.seal ? require('../pulse/seal').sealAnswer(row) : null,
      // A Convergence it joined (CONTRACT 8h): which one and whether it is open; null for any other.
      convergence: m.convergence ? require('../pulse/convergence').answerOf(m) : null,
      // A loop (CONTRACT 7j): the span the new viewers repeat, fitted to the stored video; null for any other.
      loop: m.loop ? require('../pulse/loop').answerOf(m) : null,
      // A Live Photo's motion (CONTRACT 10b), its link given exactly when the photo's is, to others only once the
      // clip's own picture check has passed; null for any other.
      motion: motionMedia.motionOf(m, links, Boolean(showMedia), own),
      // Shown as its author composed it (CONTRACT 10c): fit on its backdrop, and a video's place on the canvas.
      ...require('../pulse/composed').answerOf(m),
    } : {}),
  };
  // Until this reader has guessed, a live guess-the-spot Moment answers without its spot (never its author's own).
  const hideSpot = reinvented && momentGuess.isGuess(row) && !own && !guess?.mine && state !== 'ended';
  const spotted = hideSpot ? { ...momentGuess.withoutSpot(answer), plan: null } : answer;
  // Sealed and not open yet (CONTRACT 8g): nothing of what it holds, but to its author, or to a reader standing there.
  return m.seal && !own && !unsealed && sealedNow(row) ? require('../pulse/seal').withoutContent(spotted) : spotted;
}

/** The author's counts by signal (Pulse, reinvented), by Moment id: [{ signal, count }]. */
async function signalCountsFor(ids) {
  const counts = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return counts;
  const { data, error } = await supabaseAdmin.rpc('post_reaction_counts', { p_post_ids: ids });
  if (error) throw new Error(`Failed to count reactions: ${error.message}`);
  const byPost = new Map();
  for (const row of data || []) {
    if (!byPost.has(row.post_id)) byPost.set(row.post_id, []);
    byPost.get(row.post_id).push(row);
  }
  for (const [id, rows] of byPost) counts.set(id, signalSummary(rows));
  return counts;
}

async function reactionCountsFor(ids) {
  const counts = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return counts;
  const { data, error } = await supabaseAdmin.rpc('post_reaction_counts', { p_post_ids: ids });
  if (error) throw new Error(`Failed to count reactions: ${error.message}`);
  const byPost = new Map();
  for (const row of data || []) {
    if (!byPost.has(row.post_id)) byPost.set(row.post_id, []);
    byPost.get(row.post_id).push(row);
  }
  for (const [id, rows] of byPost) counts.set(id, reactionSummary(rows));
  return counts;
}

function linkKeys(rows) {
  return rows.flatMap((row) => {
    const stored = meta(row).media;
    // A Moment's sound and whispers (Pulse, reinvented, CONTRACT 7e) are signed in the same call; only answers to a
    // reader with the switch on hand them out.
    return [...(stored ? [stored.key, stored.poster_key].filter(Boolean) : []), ...soundMedia.soundKeys(meta(row)),
      ...motionMedia.motionKeys(meta(row))];
  });
}

/** Whether a kept Moment (posted with the switch on, CONTRACT 6e) still has its files: not purged or deleted for good. */
function keptFilesOf(row) {
  const m = meta(row);
  return m.kept === true && !m.purged_at && Boolean(m.media);
}

/**
 * Full Moments for `viewerId` (each row already checked visible), in the given order. `keptEnded` (My Atlas only, the
 * author's own list): their kept Moments that ended keep their pictures for them.
 */
async function serializeMoments(rows, viewerId, { keptEnded = false, keptPosts = false, unsealed = false } = {}) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  // "Want to come?" (CONTRACT 6g): the plans these Moments started, read from the start beside everything else, and
  // only for a reader with the switch on.
  const wantToCome = require('../pulse/wantToCome');
  const planRead = wantToCome.anyStarted(rows)
    ? reinventedOn(viewerId).then((on) => (on ? wantToCome.plansFor(rows, viewerId) : new Map()))
    : Promise.resolve(new Map());
  // The switch is read beside markOwn (a cached flag), so the switch-on reads below run beside today's, not after them
  // (the opening time, LEAD-3 09:22). With the switch off for the reader, today's reads are exactly as before.
  const [, reinvented] = await Promise.all([markOwn(rows, viewerId), reinventedOn(viewerId)]);
  const ownIds = rows.filter((r) => isOwn(r, viewerId)).map((r) => r.id);
  const linked = rows.filter((r) => momentState(r) !== 'ended' || (keptEnded && isOwn(r, viewerId) && keptFilesOf(r))
    || (keptPosts && Boolean(meta(r).kept_post_at) && keptFilesOf(r)));
  const todayRead = Promise.all([
    authorsFor(rows),
    viewerMarks(viewerId, ids),
    media.signedLinks(undefined, linkKeys(linked)),
    reactionCountsFor(ownIds),
    heightsOn(viewerId),
  ]);
  todayRead.catch(() => {});
  const newRead = reinvented
    ? Promise.all([
      signalCountsFor(ownIds), momentGuess.guessesFor(rows, viewerId),
      keepOffers(rows.filter((r) => isOwn(r, viewerId))), planRead,
      // Playable items (CONTRACT 7b): one read of the answers for the Moments that carry any.
      playItems.playFor(rows.filter((r) => meta(r).play?.length).map((r) => ({
        id: r.id, items: meta(r).play, own: isOwn(r, viewerId), open: momentState(r) === 'live',
      })), viewerId),
      // Step decks (CONTRACT 7g): one read of their steps, only when a row is part of one.
      rows.some((r) => meta(r).deck) ? stepDeck.decksFor(rows, viewerId) : new Map(),
      // Replies people can see (CONTRACT 8a): one count for the page, only of the Moments that show them.
      shownReplies.countsFor(rows, viewerId).catch(() => new Map()),
      // Mentions (CONTRACT 7h): one read of the people, only when a row mentions anyone.
      require('../pulse/mentions').shownFor(rows, viewerId, (r) => meta(r).mentions).catch(() => new Map()),
      // Retake (CONTRACT 8e): one read of the starts and frames, only when a row is part of one.
      rows.some((r) => meta(r).retake) ? require('../pulse/retake').summariesFor(rows, viewerId).catch(() => new Map()) : new Map(),
      // Pinboards (CONTRACT 8i): one read of the starts and pieces, only when a row is part of one.
      rows.some((r) => meta(r).pinboard) ? require('../pulse/pinboard').summariesFor(rows, viewerId).catch(() => new Map()) : new Map(),
    ])
    : Promise.resolve([new Map(), new Map(), new Set(), new Map(), new Map(), new Map(), new Map(), new Map(), new Map(), new Map()]);
  newRead.catch(() => {});
  const [authors, marks, links, counts, heights] = await todayRead;
  const [signals, guesses, offers, plans, plays, decks, replyCounts, mentioned, retakes, pinboards] = await newRead;
  return rows.map((row) => serializeMoment(row, {
    author: authors.get(String(authorKey(row))),
    viewerId,
    seen: marks.seen.has(row.id),
    myReaction: marks.reactions.get(row.id) || null,
    links,
    reactionCounts: counts.get(row.id) || null,
    heights,
    reinvented,
    mySignal: marks.signals.get(row.id) || null,
    signalCounts: signals.get(row.id) || null,
    guess: guesses.get(row.id) || null,
    keptEnded,
    keptPosts,
    keepOffer: offers.has(row.id),
    plan: plans.get(row.id) || null,
    play: plays.get(row.id) || null,
    decks,
    replyCounts,
    mentioned,
    retakes,
    unsealed,
    pinboards,
  }));
}

// "Keep this?" (CONTRACT 6d): asked once, in a Moment's last two hours.
const KEEP_OFFER_MS = 2 * HOUR_MS;

/** Whether "Keep this?" may be asked about the author's own Moment now, before looking for replies. */
function keepOfferable(row, now = Date.now()) {
  const m = meta(row);
  return momentState(row, now) === 'live' && !penName.isPenNameRow(row) && !m.kept_post_at && !m.keep_answered_at
    && Date.parse(row.story_expires_at) - now <= KEEP_OFFER_MS;
}

/** The ids among the author's own `rows` that "Keep this?" asks about now: offerable, with at least one reply. */
async function keepOffers(rows) {
  const candidates = rows.filter((row) => keepOfferable(row));
  if (!candidates.length) return new Set();
  const replied = await repliedMoments(candidates);
  return new Set(candidates.filter((row) => replied.has(row.id)).map((row) => row.id));
}

/**
 * Which of these Moments someone other than their author replied to (a reply is a chat message naming it, in the
 * replier's direct chat with the author: momentChat.replyToMoment). Read narrowly: only the authors' own chats
 * (ChatParticipant by user), and only messages written since the earliest of these Moments went out, so the chat
 * table's (room_id, created_at) index serves it however many messages it holds.
 */
async function repliedMoments(rows) {
  if (!rows.length) return new Set();
  const authors = new Map(rows.map((row) => [row.id, String(row.user_id)]));
  const since = new Date(Math.min(...rows.map((row) => Date.parse(row.created_at)))).toISOString();
  const rooms = (await readInBatches([...new Set(authors.values())], (batch) => supabaseAdmin.from('ChatParticipant')
    .select('room_id').in('user_id', batch).limit(5000), 'chats')).map((row) => row.room_id);
  if (!rooms.length) return new Set();
  const ids = rows.map((row) => row.id);
  const found = new Set();
  for (const batch of chunks([...new Set(rooms)])) {
    const { data, error } = await supabaseAdmin.from('ChatMessage').select('user_id, moment_id:metadata->moment->>id')
      .in('room_id', batch).gte('created_at', since).eq('deleted', false)
      .in('metadata->moment->>id', ids).limit(1000);
    if (error) throw new Error(`Failed to load replies: ${error.message}`);
    for (const message of data || []) {
      if (String(message.user_id) !== authors.get(message.moment_id)) found.add(message.moment_id);
    }
  }
  return found;
}

/**
 * Moments their authors kept as posts ("Keep this?") that `viewerId` may see, live or ended, as [{ row, point }]: in
 * a box (their shown point inside it) or by these people. The same rules as the map and the rings decide.
 */
async function shownKept(viewerId, { box = null, people = null } = {}) {
  let query = supabaseAdmin.from('Post').select(MOMENT_SELECT)
    .eq('is_story', true)
    .is('archived_at', null)
    .eq('moderation_state', 'live')
    .not('post_metadata->moment->>kept_post_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(MAX_MAP_ROWS);
  if (box) {
    query = query.gte('latitude', box.south - MAX_DISPLAY_OFFSET_DEGREES).lte('latitude', box.north + MAX_DISPLAY_OFFSET_DEGREES)
      .gte('longitude', box.west - MAX_DISPLAY_OFFSET_DEGREES).lte('longitude', box.east + MAX_DISPLAY_OFFSET_DEGREES);
  }
  if (people) {
    if (!people.length) return [];
    query = query.in('user_id', people.slice(0, 1000));
  }
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load kept Moments: ${error.message}`);
  const rows = data || [];
  if (!rows.length) return [];
  const [ctx, reported] = await Promise.all([
    viewerContext(viewerId, rows.map((r) => r.user_id), null, rows), reportedIds(viewerId)]);
  return rows.filter((row) => canSee(row, ctx) && !reported.has(row.id) && listedFor(row, viewerId))
    .map((row) => ({ row, point: displayedPoint(row) }))
    .filter(({ point }) => !box || (point.latitude != null && point.latitude >= box.south && point.latitude <= box.north
      && point.longitude >= box.west && point.longitude <= box.east));
}

/**
 * A Moment `viewerId` may open: { row } when they can see it and it's live (or it's theirs and hasn't ended).
 * Throws 404 when they can't see it (or it doesn't exist) and 410 MOMENT_ENDED when it has ended.
 */
async function openMoment(id, viewerId, { liveOnly = true } = {}) {
  const row = await loadMoment(id);
  if (!row) throw fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
  await markOwn([row], viewerId);
  const own = isOwn(row, viewerId);
  if (!own) {
    const ctx = await viewerContext(viewerId, [row.user_id]);
    if (!canSee(row, ctx)) throw fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
  }
  const state = momentState(row);
  if (state === 'ended') throw fail(410, 'MOMENT_ENDED', 'This Moment has ended.');
  if (!own && liveOnly && state !== 'live') throw fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
  return row;
}

/**
 * The Moments among `ids` that `viewerId` may open right now (openMoment's rules), in the order asked: one read for a
 * person's whole ring, so the viewer never waits between Moments. One that ended, isn't live yet or can't be seen is
 * left out; the app's own read of it (GET /:id) says why.
 */
async function openMoments(ids, viewerId) {
  const wanted = [...new Set(ids)];
  if (!wanted.length) return [];
  const { data, error } = await supabaseAdmin.from('Post').select(MOMENT_SELECT).in('id', wanted).eq('is_story', true);
  if (error) throw new Error(`Failed to load the Moments: ${error.message}`);
  const rows = data || [];
  const ctx = await viewerContext(viewerId, rows.map((row) => row.user_id), null, rows);
  const open = new Map(rows.filter((row) => {
    const state = momentState(row);
    if (state === 'ended') return false;
    if (isOwn(row, viewerId)) return true;
    return state === 'live' && canSee(row, ctx);
  }).map((row) => [row.id, row]));
  return wanted.map((id) => open.get(id)).filter(Boolean);
}

/**
 * The posts `viewerId` reported as long back as a Moment can last (the seed-the-map tool's 60 days, and a day more): a
 * Moment someone reported leaves their map and their tab's dot for good, whatever becomes of the report. A failed read hides nothing: this is for
 * the reporter's comfort, not a rule about who may see what.
 */
async function reportedIds(viewerId) {
  const { data, error } = await supabaseAdmin.from('PostReport').select('post_id').eq('reported_by', viewerId)
    .gte('created_at', new Date(Date.now() - REPORTS_LOOKBACK_MS).toISOString())
    .order('created_at', { ascending: false }).limit(500);
  if (error) {
    logger.warn('moments.reported_read_failed', { error: error.message });
    return new Set();
  }
  return new Set((data || []).map((report) => report.post_id));
}

// A read's outcome held until it is used ({ value } or { error }), so a read nobody ends up needing never rejects.
const settled = (read) => read.then((value) => ({ value }), (error) => ({ error }));
async function used(read) {
  const { value, error } = await read;
  if (error) throw error;
  return value;
}

/**
 * The viewer's own reads that one request needs in more than one place (the Moments in view and the ones with no
 * location): their mute, hide and block filters and their recent reports, started at once and read once. reportedIds
 * never fails (an unreadable list is empty).
 */
function sharedViewerReads(viewerId) {
  return { filters: settled(feedService.getMuteAndHideFilters(viewerId)), reported: reportedIds(viewerId) };
}

/**
 * The live Moments shown in the box that `viewerId` may see (blocks, mutes, audience) and hasn't reported, newest
 * first, each with the point everyone sees: [{ row, point }]. The map and the tab's dot both read this.
 */
async function shownInBox(viewerId, { south, west, north, east }, shared = null) {
  if (north - south > MAX_MAP_SPAN_DEGREES || east - west > MAX_MAP_SPAN_DEGREES) return [];
  // An area pin's displayed point can be up to MAX_DISPLAY_OFFSET_DEGREES from its stored point: read the stored points
  // in a box that wide, on whole cells (so the rows read never depend on where an edge falls between stored points),
  // and keep the Moments whose displayed point is in view.
  const read = snapToNeighborhoodCells({
    south: south - MAX_DISPLAY_OFFSET_DEGREES, west: west - MAX_DISPLAY_OFFSET_DEGREES,
    north: north + MAX_DISPLAY_OFFSET_DEGREES, east: east + MAX_DISPLAY_OFFSET_DEGREES,
  });
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from('Post').select(MOMENT_SELECT)
    .eq('is_story', true)
    .gt('story_expires_at', nowIso)
    .is('archived_at', null)
    .eq('moderation_state', 'live')
    .eq('post_metadata->moment->>state', 'live')
    .gte('latitude', read.south).lte('latitude', read.north)
    .gte('longitude', read.west).lte('longitude', read.east)
    .order('created_at', { ascending: false })
    .limit(MAX_MAP_ROWS);
  if (error) throw new Error(`Failed to load Moments: ${error.message}`);
  const rows = (data || []).filter((row) => momentState(row) === 'live');
  const [ctx, reported] = await Promise.all([
    viewerContext(viewerId, rows.map((r) => r.user_id), shared, rows),
    rows.length ? (shared ? shared.reported : reportedIds(viewerId)) : new Set(),
  ]);
  const shown = [];
  for (const row of rows) {
    if (!canSee(row, ctx) || reported.has(row.id) || !listedFor(row, viewerId)) continue;
    const point = displayedPoint(row);
    if (point.latitude < south || point.latitude > north || point.longitude < west || point.longitude > east) continue;
    shown.push({ row, point });
  }
  return shown;
}

/** The people `viewerId` is connected to (accepted connections), as ids. */
async function connectionIds(viewerId) {
  const { data, error } = await supabaseAdmin.from('Relationship').select('requester_id, addressee_id')
    .eq('status', 'accepted').or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`).limit(5000);
  if (error) throw new Error(`Failed to load connections: ${error.message}`);
  return [...new Set((data || []).map((r) => String(r.requester_id === viewerId ? r.addressee_id : r.requester_id)))];
}

/**
 * The live Moments with no location that `viewerId` may see: their connections' and their own, whatever the map shows
 * (blocks, mutes and reports apply), newest first, as [{ row, point }] with an empty point.
 */
async function shownUnplaced(viewerId, shared = null) {
  const connections = await connectionIds(viewerId);
  const people = [String(viewerId), ...connections];
  const nowIso = new Date().toISOString();
  const rows = (await readInBatches(people, (batch) => supabaseAdmin.from('Post').select(MOMENT_SELECT)
    .eq('is_story', true)
    .in('user_id', batch)
    .is('latitude', null)
    .gt('story_expires_at', nowIso)
    .is('archived_at', null)
    .eq('moderation_state', 'live')
    .eq('post_metadata->moment->>state', 'live')
    .limit(MAX_MAP_ROWS), 'unplaced Moments')).filter((row) => momentState(row) === 'live');
  if (!rows.length) return [];
  const [ctx, reported] = await Promise.all([
    viewerContext(viewerId, rows.map((r) => r.user_id), shared && { ...shared, connections }),
    shared ? shared.reported : reportedIds(viewerId),
  ]);
  return rows.filter((row) => canSee(row, ctx) && !reported.has(row.id) && listedFor(row, viewerId))
    .sort((a, b) => Date.parse(shownAt(b)) - Date.parse(shownAt(a)))
    .map((row) => ({ row, point: { latitude: null, longitude: null } }));
}

/** Live Moments in view as rings (CONTRACT GET /api/moments/map), newest first. */
async function mapRings(viewerId, box) {
  return ringsOf(viewerId, await shownInBox(viewerId, box));
}

/**
 * shownUnplaced, or none when it can't be read: the Moments with no location never stop the map or the tab's dot
 * from working.
 */
async function unplacedOrNone(viewerId, shared = null) {
  try {
    return await shownUnplaced(viewerId, shared);
  } catch (error) {
    logger.warn('moments.unplaced_read_failed', { error: error.message });
    return [];
  }
}

/** The Moments with no location the viewer may see, one ring per person (CONTRACT GET /map `unplaced`). */
async function unplacedRings(viewerId) {
  return ringsOf(viewerId, await unplacedOrNone(viewerId));
}

// A ring on the map can show a small picture of its newest Moment in its pin (founder, 2026-11-11): the photo's or
// video's small thumbnail (the one made for the chat quote), or a text card's background. Rings with no location have
// none (they are never on the map), and a link that can't be signed only costs the picture, never the map.
const thumbKeyOf = ({ row, point }) => (point.latitude == null ? null : meta(row).media?.thumb_key || null);

async function previewLinks(newest) {
  const keys = newest.map(thumbKeyOf).filter(Boolean);
  if (!keys.length) return new Map();
  try {
    return await media.signedLinks(undefined, keys);
  } catch (error) {
    logger.warn('moments.map.preview_links_failed', { error: error.message });
    return new Map();
  }
}

function previewOf(newest, thumbs) {
  if (newest.point.latitude == null) return null;
  const m = meta(newest.row);
  if (m.kind === 'text') return { moment_id: newest.row.id, kind: 'text', thumb_url: null, background: m.background || 'teal' };
  const key = thumbKeyOf(newest);
  const link = key ? thumbs.get(key) || null : null;
  return link ? { moment_id: newest.row.id, kind: m.kind, thumb_url: link, background: null } : null;
}

/**
 * The rings of `shown` ([{ row, point }]) for `viewerId`. `keyOf` says which Moments share a ring (the map's: one per
 * person per spot); `previews: false` leaves the pin pictures out (rings that are never drawn as pins).
 */
async function ringsOf(viewerId, shown, { keyOf = ringKey, previews = true } = {}) {
  const groups = new Map();
  for (const { row, point } of shown) {
    const key = keyOf(row, point);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, point });
  }
  // The newest MAX_RINGS rings; only theirs are named and marked.
  const kept = [...groups.entries()].map(([key, members]) => {
    members.sort((a, b) => Date.parse(shownAt(a.row)) - Date.parse(shownAt(b.row)));
    return { key, members, newest: members[members.length - 1] };
  }).sort((a, b) => Date.parse(shownAt(b.newest.row)) - Date.parse(shownAt(a.newest.row))).slice(0, MAX_RINGS);
  const [authors, marks, thumbs, heights] = await Promise.all([
    authorsFor(kept.map(({ newest }) => newest.row)),
    viewerMarks(viewerId, kept.flatMap(({ members }) => members.map(({ row }) => row.id))),
    previews ? previewLinks(kept.map(({ newest }) => newest)) : new Map(),
    heightsOn(viewerId),
  ]);
  return kept.map(({ key, members, newest }) => {
    const mine = isOwn(newest.row, viewerId);
    const moments = members.map(({ row }) => briefOf(row, mine || marks.seen.has(row.id)));
    // The ring is as high as its newest Moment says it is (apps float the pin there); null when it doesn't say.
    const high = heights ? shownHeight(newest.row) : null;
    return {
      id: key,
      author: authors.get(String(authorKey(newest.row))),
      preview: previews ? previewOf(newest, thumbs) : null,
      // A ring of Moments with no location has no point at all (apps put it in the row of faces, never on the map).
      ...(newest.point.latitude == null
        ? { no_location: true }
        : { latitude: newest.point.latitude, longitude: newest.point.longitude }),
      place_label: newest.row.location_name || null,
      altitude_ft: high ? high.altitude_ft : null,
      flying: Boolean(high?.flying),
      // The Sky: the newest Moment shows only its area (made at home), so apps draw the pin floating over its spot
      // with no pointer, never as an exact pin.
      floating: isFloating(newest.row),
      // The Live mark (API v4.1): the latest time one of its Moments stops reading "Live from here" (apps draw the
      // dot and keep the ring under "Live now" until then); null when none is live or the ring isn't an exact pin
      // away from home.
      live_until: ringLiveUntil(members, newest),
      moments,
      unseen_count: moments.filter((m) => !m.seen).length,
      newest_at: shownAt(newest.row),
      mine,
    };
  });
}

// A screen of profile pictures asks about the people on it; more ids than this in one request are left out.
const MAX_PEOPLE = 100;

/**
 * Who among `userIds` has live Moments that `viewerId` may see, one ring per person holding all of them, oldest
 * first (CONTRACT GET /api/moments/people): the ring apps draw around a profile picture, and what plays when it's
 * tapped. The map's rules decide, nothing else: blocks, mutes and "my connections only" (canSee), and the Moments
 * the viewer reported. A person with nothing the viewer may see has no ring. The ring's point and place are its
 * newest Moment's (none when that one has no location).
 */
async function peopleRings(viewerId, userIds) {
  const people = [...new Set((userIds || []).filter(Boolean).map(String))].slice(0, MAX_PEOPLE);
  if (!people.length) return [];
  const nowIso = new Date().toISOString();
  // An id may be a made-up name's (a ring's author id is, on a made-up-name Moment): its Moments are found by the
  // name, and a person's own never include the ones they wrote under a made-up name. Both reads go out together; the
  // second is by the made-up names' own index and finds nothing for an account's id.
  const live = (query) => query.eq('is_story', true)
    .gt('story_expires_at', nowIso)
    .is('archived_at', null)
    .eq('moderation_state', 'live')
    .eq('post_metadata->moment->>state', 'live')
    .limit(MAX_MAP_ROWS);
  const [byPerson, byPenName] = await Promise.all([
    readInBatches(people, (batch) => live(supabaseAdmin.from('Post')
      .select(MOMENT_SELECT).in('user_id', batch)), "people's Moments"),
    readInBatches(people, (batch) => live(supabaseAdmin.from('Post').select(MOMENT_SELECT)
      .eq('identity_context_type', penName.KIND).in('identity_context_id', batch)), "made-up names' Moments"),
  ]);
  const rows = [...byPerson, ...byPenName].filter((row) => momentState(row) === 'live');
  if (!rows.length) return [];
  const [ctx, reported] = await Promise.all([
    viewerContext(viewerId, rows.map((r) => r.user_id), null, rows), reportedIds(viewerId)]);
  const shown = rows.filter((row) => canSee(row, ctx) && !reported.has(row.id) && listedFor(row, viewerId))
    .map((row) => ({ row, point: displayedPoint(row) }));
  return ringsOf(viewerId, shown, { keyOf: (row) => `u_${authorKey(row)}_all`, previews: false });
}

/**
 * The live Moments of these people (their own accounts, never under a made-up name) that `viewerId` may see, with a
 * place or without, as [{ row, point }]: the same rules as the map and the rings (blocks, mutes, audience, reports,
 * guess-the-spot hiding). Pulse, reinvented's Close circle (services/pulse/list.js).
 */
async function shownOfPeople(viewerId, userIds) {
  const people = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (!people.length) return [];
  const nowIso = new Date().toISOString();
  const rows = (await readInBatches(people, (batch) => supabaseAdmin.from('Post').select(MOMENT_SELECT)
    .eq('is_story', true)
    .in('user_id', batch)
    .gt('story_expires_at', nowIso)
    .is('archived_at', null)
    .eq('moderation_state', 'live')
    .eq('post_metadata->moment->>state', 'live')
    .limit(MAX_MAP_ROWS), "people's Moments")).filter((row) => momentState(row) === 'live');
  if (!rows.length) return [];
  const [ctx, reported] = await Promise.all([
    viewerContext(viewerId, rows.map((r) => r.user_id), null, rows), reportedIds(viewerId)]);
  return rows.filter((row) => canSee(row, ctx) && !reported.has(row.id) && listedFor(row, viewerId))
    .map((row) => ({ row, point: displayedPoint(row) }));
}

/** When a Moment went live: its end time less its hours (a photo's or video's time starts when its upload finishes). */
function wentLiveAt(row) {
  return Date.parse(row.story_expires_at) - storedHours(row) * HOUR_MS;
}

/**
 * How many people have something new for `viewerId` in the box (CONTRACT GET /api/moments/unseen): a live Moment the
 * viewer may see and hasn't watched, that went live after `since` (a time in ms; none: any). Never the viewer's own.
 * Moments with no location count only for an app that shows them (`includeUnplaced`, contract v3.4): an older app's
 * dot never lights for something it can't show.
 */
async function unseenPeople(viewerId, box, since = null, { includeUnplaced = false } = {}) {
  // The viewer's filters and recent reports are read once, alongside the Moments, for both halves below.
  const shared = sharedViewerReads(viewerId);
  const [inBox, unplaced] = await Promise.all([
    shownInBox(viewerId, box, shared),
    includeUnplaced ? unplacedOrNone(viewerId, shared) : [],
  ]);
  const fresh = [...inBox, ...unplaced].map(({ row }) => row)
    .filter((row) => !isOwn(row, viewerId) && (since == null || wentLiveAt(row) > since));
  if (!fresh.length) return 0;
  const watched = new Set((await readInBatches(fresh.map((row) => row.id), (batch) => supabaseAdmin.from('PostView')
    .select('post_id').eq('user_id', viewerId).in('post_id', batch), 'views')).map((view) => view.post_id));
  return new Set(fresh.filter((row) => !watched.has(row.id)).map((row) => String(authorKey(row)))).size;
}

/** The caller's own Moments that haven't ended, any state, newest first. */
async function ownMoments(userId) {
  const { data, error } = await supabaseAdmin.from('Post').select(MOMENT_SELECT)
    .eq('is_story', true)
    .eq('user_id', userId)
    .gt('story_expires_at', new Date().toISOString())
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`Failed to load your Moments: ${error.message}`);
  // And the ones written under a made-up name: only their writer's own list holds them.
  const underPenName = await ownUnderPenName(userId);
  const rows = [...(data || []), ...underPenName].filter((row) => momentState(row) !== 'ended')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return serializeMoments(rows, userId);
}

/** The caller's own made-up-name Moments that haven't ended. A failed read leaves them out: the list never fails for them. */
async function ownUnderPenName(userId) {
  try {
    const since = Date.now() - (LONG_MAX_HOURS + 24) * HOUR_MS;
    const ids = (await penName.owner.owned(userId, 'post', { limit: 100 }))
      .filter((row) => Date.parse(row.created_at) > since).map((row) => row.id);
    if (!ids.length) return [];
    const { data, error } = await supabaseAdmin.from('Post').select(MOMENT_SELECT)
      .in('id', ids).eq('is_story', true).eq('identity_context_type', penName.KIND)
      .gt('story_expires_at', new Date().toISOString()).is('archived_at', null);
    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.warn('moments.own_pen_name_read_failed', { error: error.message });
    return [];
  }
}

/** The Moment `id` when `viewerId` wrote it (under their own name or a made-up one), else null. */
async function ownMoment(id, viewerId) {
  const row = await loadMoment(id);
  if (!row) return null;
  await markOwn([row], viewerId);
  return isOwn(row, viewerId) ? row : null;
}

/**
 * Who watched the author's Moment, newest first (CONTRACT GET /:id/viewers). Blocked people aren't listed. `signals`
 * (Pulse, reinvented, for an author with the switch on) adds each one's reaction as a signal.
 */
async function viewersOf(row, writerId = row.user_id, { signals = false } = {}) {
  // `writerId`: the account that wrote it, when that isn't the account it is stored under (a made-up-name Moment).
  const [views, likes, blocked] = await Promise.all([
    supabaseAdmin.from('PostView').select('user_id, created_at').eq('post_id', row.id)
      .order('created_at', { ascending: false }).limit(1000),
    supabaseAdmin.from('PostLike').select('user_id, reaction').eq('post_id', row.id),
    require('../blockService').blockedUserIds(writerId),
  ]);
  if (views.error || likes.error) throw new Error(`Failed to load viewers: ${(views.error || likes.error).message}`);
  const rows = (views.data || []).filter((v) => v.user_id !== writerId && !blocked.has(v.user_id));
  const viewerIds = rows.map((v) => v.user_id);
  const replied = new Set();
  for (let at = 0; at < viewerIds.length; at += 100) {
    const { data, error } = await supabaseAdmin.from('ChatMessage').select('user_id')
      .in('user_id', viewerIds.slice(at, at + 100))
      .gte('created_at', row.created_at)
      .eq('deleted', false)
      .eq('metadata->moment->>id', row.id);
    if (error) throw new Error(`Failed to load replies: ${error.message}`);
    for (const message of data || []) replied.add(message.user_id);
  }
  const reactions = new Map((likes.data || []).map((l) => [l.user_id, shownReaction(l.reaction)]));
  const signalOf = new Map((likes.data || []).map((l) => [l.user_id, shownSignal(l.reaction)]));
  const authors = await loadAuthors(viewerIds);
  return {
    count: rows.length,
    viewers: rows.map((v) => ({
      user: authors.get(String(v.user_id)),
      viewed_at: v.created_at,
      reaction: reactions.get(v.user_id) || null,
      replied: replied.has(v.user_id),
      ...(signals ? { signal: signalOf.get(v.user_id) || null } : {}),
    })).filter((v) => v.user),
  };
}

// ─── Writing ────────────────────────────────────────────────────────────────

/** The Post row a new Moment is stored as. */
function newMomentRow({ userId, accountType, kind, hours, audience, showArea, atHome, caption, text, background,
  location, labels, labelKind = null, createdAt, takenAt = null, venueId = null, altitude = null, series = null,
  area = null, shareAt = null, takenHere: sentTakenHere = false, weather = null, pen = null }) {
  if (!validHours(hours)) throw fail(400, 'MOMENT_INVALID', 'A Moment lasts from 1 hour to 60 days.');
  const now = createdAt ? new Date(createdAt) : new Date();
  // A Moment shared later counts its hours from its time.
  const starts = shareAt ? new Date(shareAt) : now;
  const live = kind === 'text';
  // A floating Moment (the Sky) keeps its area's point and nothing finer.
  if (area) {
    location = { ...location, latitude: area.latitude, longitude: area.longitude };
    showArea = true;
  }
  // The Live mark, decided again on what is stored; its weather only with it.
  const marked = Boolean(sentTakenHere) && markKept({ kind, source: location.source, atHome, showArea, takenAt });
  return {
    user_id: userId,
    author_user_id: userId,
    // Under a made-up name (`pen`): stored under the system account with the name's id; the writer is recorded
    // behind services/penName before the row is saved (insertMoment).
    ...(pen ? penName.write.identityFields(pen, 'post') : {}),
    content: kind === 'text' ? text : (caption || ''),
    media_urls: [],
    media_types: [],
    post_type: 'general',
    post_format: 'standard',
    visibility: 'private',
    location_precision: location.source === 'none' ? 'none' : showArea ? 'approx_area' : 'exact_place',
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    effective_latitude: location.latitude ?? null,
    effective_longitude: location.longitude ?? null,
    location_name: location.source === 'none' ? null : showArea || atHome ? labels.area_label : labels.place_label,
    location_address: null,
    post_as: 'personal',
    audience,
    distribution_targets: [],
    is_story: true,
    created_at: now.toISOString(),
    story_expires_at: new Date(starts.getTime() + hours * HOUR_MS).toISOString(),
    show_on_profile: false,
    profile_visibility_scope: 'hidden',
    state: 'open',
    origin: accountType === 'curator' ? 'curator' : accountType === 'system' ? 'system' : 'user',
    moderation_state: 'live',
    gps_timestamp: location.source === 'gps' ? location.fix_at : null,
    post_metadata: {
      ...(area ? { area: areaMetadata(area) } : {}),
      moment: {
        v: 1,
        kind,
        hours,
        background: kind === 'text' ? background : null,
        show_area: Boolean(showArea),
        at_home: Boolean(atHome),
        // What the place label names ('place' | 'street' | 'town' | 'none'), for the push's "At", "On" or "In".
        ...(labelKind ? { label_kind: labelKind } : {}),
        ...(takenAt && kind !== 'text' ? { taken_at: takenAt } : {}),
        ...(venueId ? { venue_id: venueId } : {}),
        ...(series && kind === 'video' ? { series: { id: series.id, index: series.index, count: series.count } } : {}),
        ...(altitude ? { altitude_ft: altitude.altitude_ft, ...(altitude.flying ? { flying: true } : {}) } : {}),
        ...(shareAt ? { share_at: new Date(shareAt).toISOString() } : {}),
        ...(marked ? { taken_here: true, ...(weather ? { weather } : {}) } : {}),
        location_source: location.source,
        state: live ? 'live' : 'uploading',
        media: null,
        check: null,
      },
    },
  };
}

/**
 * When a photo or video was taken, as everyone reads it ("Taken Oct 3"), or null: only for one taken more than
 * TAKEN_SHOWN_AFTER_MS before `now`, and never for a time that can't be right (before 2000, or ahead of the clock).
 */
function takenAtShown(value, now = Date.now()) {
  const taken = Date.parse(value || '');
  if (!Number.isFinite(taken) || taken < EARLIEST_TAKEN_MS || taken > now + CLOCK_SKEW_MS) return null;
  return now - taken > TAKEN_SHOWN_AFTER_MS ? new Date(taken).toISOString() : null;
}

/**
 * The height a new Moment keeps, { altitude_ft, flying }, or null. `reading` is what the phone sent with "Show height"
 * on: { meters, accuracy_m, speed_mps } (metres above sea level; the last two optional). Nothing is kept for a
 * Moment at home, shown as an area before the Sky or with no location (a height would narrow down where it is), nor
 * for a reading that can't be right or that the phone says is too rough. A floating Moment (`floating`, the Sky)
 * keeps feet rounded to 100 instead of 10. A bad reading never fails the post: it is left out.
 */
function shownAltitude(reading, { atHome = false, showArea = false, unplaced = false, floating = false } = {}) {
  if (!reading || atHome || (showArea && !floating) || unplaced) return null;
  const meters = Number(reading.meters);
  if (!Number.isFinite(meters) || meters < MIN_ALTITUDE_M || meters > MAX_ALTITUDE_M) return null;
  const speed = Number(reading.speed_mps);
  const flying = Number.isFinite(speed) && speed >= FLYING_SPEED_MPS;
  const error = reading.accuracy_m == null ? null : Number(reading.accuracy_m);
  if (error != null && (!Number.isFinite(error) || error < 0
    || error > (flying ? MAX_ALTITUDE_ERROR_FLYING_M : MAX_ALTITUDE_ERROR_M))) return null;
  const step = floating ? FLOATING_HEIGHT_STEP_FT : HEIGHT_STEP_FT;
  // `|| 0`: a few feet below the sea rounds to 0, never to -0.
  return { altitude_ft: Math.round((meters * FEET_PER_M) / step) * step || 0, flying };
}

/**
 * Whether a new Moment keeps the Live mark its author's app sent (`taken_here`: its own camera made it just now). Only
 * a photo or video from a fresh fix of where its author is (`gps`; never an album item pinned where its file says,
 * `capture`), sent with no taken time (`takenAt`: the apps send one only for an album item), at its exact pin away
 * from home: never at home, shown as an area, floating or with no location, whatever the app sent. The same places a
 * height is never kept (shownAltitude). The route also drops it when the author's homes can't be read.
 */
function markKept({ kind, source, atHome = false, showArea = false, unplaced = false, floating = false, takenAt = null }) {
  return (kind === 'photo' || kind === 'video') && source === 'gps' && !atHome && !showArea && !unplaced && !floating
    && !takenAt;
}

/**
 * Checks the posting rules for `user` (CONTRACT POST /api/moments): the one-time 18+ confirmation, a fresh GPS fix
 * (an album item pins where it was taken, from any time; a Moment with no location needs a connection), and 20
 * Moments a day. Throws the error the apps handle.
 */
async function checkPostingRules(user, { kind, location, series = null }) {
  const now = Date.now();
  if (location.source === 'gps') {
    const fixAt = Date.parse(location.fix_at);
    if (!Number.isFinite(fixAt) || fixAt > now + CLOCK_SKEW_MS || now - fixAt > FIX_MAX_AGE_MS) {
      throw fail(422, 'LOCATION_TOO_OLD', 'Your location is out of date. Wait a moment for a new fix and try again.');
    }
  } else if (location.source === 'capture') {
    if (kind === 'text') throw fail(400, 'MOMENT_INVALID', 'A text card pins where you are.');
  } else if (!(await connectionIds(user.id)).length) {
    // No location: only connections see it, so it needs one.
    throw fail(422, 'NO_CONNECTIONS', 'A Moment with no location goes only to your connections. Add a connection first.');
  }
  const { adultStatus } = require('../adultAttestation');
  const adult = await adultStatus(user.id);
  if (adult.ineligible) throw fail(403, 'AGE_NOT_ELIGIBLE', 'Moments are for people 18 and older.');
  if (!adult.attestedAt) throw fail(403, 'ADULT_CONFIRM_REQUIRED', 'Confirm you are 18 or older to post Moments.');
  // A long video's parts count as the one post they are: the first part is checked against the day's limit, and a
  // later part needs that first part, made by the same account a little while ago.
  if (series && series.index > 1) {
    const { data: parts, error: partsError } = await supabaseAdmin.from('Post').select('id, series:post_metadata->moment->series')
      .eq('user_id', user.id).eq('is_story', true).eq('post_metadata->moment->series->>id', series.id)
      .gte('created_at', new Date(now - PARTS_WINDOW_MS).toISOString()).limit(MAX_PARTS * 2);
    if (partsError) throw new Error(`Failed to read the video's parts: ${partsError.message}`);
    const made = (parts || []).map((part) => Number(part.series?.index));
    if (!made.includes(1) || made.includes(series.index) || made.length >= MAX_PARTS) {
      throw fail(400, 'MOMENT_INVALID', 'This part does not belong to a video being posted.');
    }
    return;
  }
  const { data: today, error } = await supabaseAdmin.from('Post').select('id, series:post_metadata->moment->series')
    .eq('user_id', user.id).eq('is_story', true).gte('created_at', new Date(now - 24 * HOUR_MS).toISOString())
    .limit(DAILY_LIMIT * MAX_PARTS + 1);
  if (error) throw new Error(`Failed to count Moments: ${error.message}`);
  const count = (today || []).filter((post) => !(Number(post.series?.index) > 1)).length;
  if (count >= DAILY_LIMIT) {
    throw fail(429, 'MOMENTS_DAILY_LIMIT', `You can post up to ${DAILY_LIMIT} Moments a day. Try again later.`);
  }
}

/** Inserts a new Moment and returns its row. `id` (a retry key turned into the row's id) makes a retry return it. */
async function insertMoment(row, id = null, penWriter = null) {
  const write = (rowId) => (rowId
    ? supabaseAdmin.from('Post').upsert({ ...row, id: rowId }, { onConflict: 'id', ignoreDuplicates: true })
    : supabaseAdmin.from('Post').insert(row)).select(MOMENT_SELECT).maybeSingle();
  // `penWriter` ({ userId, pen }): a Moment under a made-up name. Its writer is recorded first; the database refuses
  // the row otherwise, and the record is taken back if the row isn't saved (services/penName/write.js).
  const { data, error } = !penWriter ? await write(id)
    : await penName.write.sealed({ kind: 'post', id, userId: penWriter.userId, pen: penWriter.pen }, async (rowId) => {
      const result = await write(rowId);
      return { ...result, saved: !result.error };
    });
  if (error) throw new Error(`Failed to save the Moment: ${error.message}`);
  if (data) return { row: data, created: true };
  // The retry key's row already exists: the earlier attempt went through.
  const existing = id ? await loadMoment(id) : null;
  if (!existing || existing.user_id !== row.user_id) throw fail(409, 'MOMENT_RETRY_CONFLICT', 'This Moment was already posted.');
  return { row: existing, created: false };
}

/** Writes `changes` (post_metadata.moment fields under `moment`) when the row still matches `expect`. */
// Writes sent at the same moment keep each other (coord, LEAD-3 2026-11-27): a write that changes the kept values
// (post_metadata.moment) of a Moment posted with the switch on runs as one statement that merges only its own keys into
// the row as it is then (moment_metadata_update, migration 20261127140000), instead of writing back the whole value it
// read; only while the switch is on for anyone (mergedWriteOn). Only these columns and filters go through it; any other
// write, and every write while the switch is off for everyone, is the plain update below, as before.
const MERGED_COLUMNS = ['content', 'audience', 'story_expires_at'];
const MOMENT_KEY_FILTER = /^post_metadata->moment->>([a-z_]+)$/;
const MERGE_RETRY_MS = 60 * 1000;
let mergeMissingSince = 0;

function mergeFilters(expect) {
  const filters = {};
  for (const [column, value] of Object.entries(expect)) {
    const key = MOMENT_KEY_FILTER.exec(column)?.[1];
    if (key && value === null) (filters.moment_null = filters.moment_null || []).push(key);
    else if (column === 'archived_at' && value === null) filters.unarchived = true;
    else if (column === 'moderation_state' && typeof value === 'string') filters.moderation_state = value;
    else return null;
  }
  return filters;
}

/**
 * Whether a write to this Moment may take the merged path (LEAD-3, 06:10): only a Moment posted with the switch on (the
 * Studio branch marks it `kept`), and only while `pulse_reinvented` is on for anyone at all (the cached flag row). Every
 * other Moment, and every Moment while the switch is off for everyone, is written exactly as today.
 */
async function mergedWriteOn(row) {
  if (!meta(row).kept) return false;
  try {
    const flag = await getFlag(REINVENTED_FLAG);
    return Boolean(flag && (flag.enabled_globally || flag.enabled_for_internal_team || (flag.beta_user_ids || []).length));
  } catch (error) {
    logger.warn('moments.flag_failed', { flag: REINVENTED_FLAG, error: error.message });
    return false;
  }
}

function missingFunction(error) {
  return error?.code === 'PGRST202' || error?.code === '42883' || /could not find the function/i.test(error?.message || '');
}

/**
 * Updates a Moment's columns and kept values (`moment`: the keys to set), only while `expect`'s filters hold. Answers
 * the updated row, or null when it isn't there or a filter doesn't hold. `same` (key -> the value the write was worked
 * out from): only if those keys still hold it (changeMoment).
 */
async function updateMoment(row, { moment, ...columns }, expect = {}, { same } = {}) {
  const filters = moment ? mergeFilters(expect) : null;
  if (filters && Object.keys(columns).every((column) => MERGED_COLUMNS.includes(column))
    && Date.now() - mergeMissingSince > MERGE_RETRY_MS && await mergedWriteOn(row)) {
    const { data, error } = await supabaseAdmin.rpc('moment_metadata_update', {
      p_id: row.id, p_moment: moment, p_columns: columns, p_expect: same ? { ...filters, moment_same: same } : filters,
    }).select(MOMENT_SELECT).maybeSingle();
    if (!error) return data || null;
    if (!missingFunction(error)) throw new Error(`Failed to update the Moment: ${error.message}`);
    // A database without the function yet: today's write, and the function is tried again in a minute.
    mergeMissingSince = Date.now();
    logger.warn('moments.merge_update_missing', { error: error.message });
  }
  const next = { ...columns };
  if (moment) next.post_metadata = { ...row.post_metadata, moment: { ...meta(row), ...moment } };
  let query = supabaseAdmin.from('Post').update(next).eq('id', row.id).eq('is_story', true);
  for (const [column, value] of Object.entries(expect)) {
    query = value === null ? query.is(column, null) : query.eq(column, value);
  }
  const { data, error } = await query.select(MOMENT_SELECT).maybeSingle();
  if (error) throw new Error(`Failed to update the Moment: ${error.message}`);
  return data || null;
}

function sameValue(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => sameValue(a[key], b[key]));
}

/**
 * Sets the kept values that `change(moment)` works out from the Moment's current ones (a map of field cards, a list of
 * dots), only if those keys still hold what it read; when another write changed them first, reads the Moment again and
 * works the change out again (a few tries). Answers the updated row, or null when the Moment isn't there or `expect`
 * doesn't hold.
 */
async function changeMoment(row, change, expect = {}) {
  let current = row;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const set = change(meta(current));
    if (!set || !Object.keys(set).length) return current;
    const same = Object.fromEntries(Object.keys(set).map((key) => [key, meta(current)[key] ?? null]));
    const updated = await updateMoment(current, { moment: set }, expect, { same });
    if (updated) return updated;
    const fresh = await loadMoment(current.id);
    // Nothing it read has changed: the Moment itself refused (it ended, or a filter doesn't hold).
    if (!fresh || Object.keys(same).every((key) => sameValue(meta(fresh)[key] ?? null, same[key]))) return null;
    current = fresh;
  }
  throw fail(409, 'MOMENT_BUSY', 'This Moment is changing right now. Try again in a moment.');
}

/**
 * The Moment goes live: its time starts now (CONTRACT: expires_at counts from going live), or at its time for one
 * shared later whose time hasn't come.
 */
function goLive(row, check) {
  const hours = storedHours(row);
  const starts = Math.max(Date.now(), Date.parse(meta(row).share_at || '') || 0);
  return updateMoment(row, {
    story_expires_at: new Date(starts + hours * HOUR_MS).toISOString(),
    moment: { state: 'live', check },
  }, { archived_at: null });
}

/**
 * Holds a Moment for review (moderation_state 'held'): the picture check flagged it, or REPORTS_TO_HOLD people
 * reported it. Only a live one changes. `note` is the plain reason its author reads.
 */
async function hold(row, rule, note) {
  const { data, error } = await supabaseAdmin.from('Post')
    .update({ moderation_state: 'held', moderation_rule: rule, moderation_note: note, moderated_at: new Date().toISOString() })
    .eq('id', row.id).eq('is_story', true).eq('moderation_state', 'live')
    .select('id');
  if (error) throw new Error(`Failed to hold the Moment: ${error.message}`);
  if (data?.length) logger.info('moments.held', { momentId: row.id, rule });
  return Boolean(data?.length);
}

/** Holds the Moment once REPORTS_TO_HOLD different people have open reports on it. */
async function holdIfReported(row) {
  const { count, error } = await supabaseAdmin.from('PostReport').select('id', { count: 'exact', head: true })
    .eq('post_id', row.id).is('comment_id', null).in('status', ['pending', 'reviewed']);
  if (error) throw new Error(`Failed to count reports: ${error.message}`);
  if (count >= REPORTS_TO_HOLD) return hold(row, 'moment_reports', 'Hidden while Pantopus reviews reports about it.');
  return false;
}

/**
 * After a moderator closes a report (routes/adminReports.js): a held Moment whose reports were all dismissed (no
 * violation), and that no moderator removed, is live again. One closed as resolved means the moderator agreed something
 * was wrong, so the Moment stays held even without a Remove. Anything else is left as it is.
 */
async function releaseIfReviewed(postId) {
  const { data: row, error } = await supabaseAdmin.from('Post').select(MOMENT_SELECT).eq('id', postId).maybeSingle();
  if (error || !row || !row.is_story || row.moderation_state !== 'held' || row.archive_reason === 'moderation') return false;
  const { count, error: countError } = await supabaseAdmin.from('PostReport').select('id', { count: 'exact', head: true })
    .eq('post_id', postId).is('comment_id', null).neq('status', 'dismissed');
  if (countError || count > 0) return false;
  const { data, error: updateError } = await supabaseAdmin.from('Post')
    .update({ moderation_state: 'live', moderation_rule: null, moderation_note: null, moderated_at: new Date().toISOString() })
    .eq('id', postId).eq('moderation_state', 'held').select('id');
  if (updateError) return false;
  if (data?.length) logger.info('moments.released', { momentId: postId });
  return Boolean(data?.length);
}

/**
 * Whether the Moment's files must stay: held for review, or a report about it still open. A Moment a moderator removed
 * (archived for moderation, its reports closed) follows the usual 7 days.
 */
async function filesHeld(row) {
  if (row.moderation_state === 'held' && row.archive_reason !== 'moderation') return true;
  const { count, error } = await supabaseAdmin.from('PostReport').select('id', { count: 'exact', head: true })
    .eq('post_id', row.id).is('comment_id', null).in('status', ['pending', 'reviewed']);
  if (error) throw new Error(`Failed to count reports: ${error.message}`);
  return count > 0;
}

/**
 * Deletes the Moment's files unless a review holds them: the ones it recorded and anything else in its folder (an
 * upload that stopped before recording its bytes). Records purged_at. Returns true when they're gone. A text card
 * has none.
 */
async function purgeFiles(row) {
  const m = meta(row);
  if (m.purged_at || m.kind === 'text') return true;
  if (await filesHeld(row)) return false;
  const bucket = m.media?.bucket;
  const keys = [...new Set([...media.mediaKeys(m.media), ...await media.folderKeys(bucket, media.folderOwner(row), row.id)])];
  if (!(await media.removeKeys(bucket, keys))) return false;
  await updateMoment(row, { moment: { purged_at: new Date().toISOString() } });
  return true;
}

/** The author deletes their Moment: it ends now, and its files go unless a review holds them. */
async function deleteMoment(row) {
  const now = new Date().toISOString();
  const ended = await updateMoment(row, {
    is_archived: true, archived_at: now, archive_reason: 'manual',
    story_expires_at: row.story_expires_at && row.story_expires_at < now ? row.story_expires_at : now,
  }, { archived_at: null });
  const current = ended || await loadMoment(row.id);
  if (current) {
    try {
      await purgeFiles(current);
    } catch (error) {
      // The cleanup job deletes them later; the Moment is already gone for everyone.
      logger.warn('moments.delete_files_failed', { momentId: row.id, error: error.message });
    }
  }
}

module.exports = {
  KINDS, HOURS, MAX_HOURS, LONG_MAX_HOURS, validHours, storedHours, answeredEnd, BACKGROUNDS, AUDIENCES, DAILY_LIMIT, MAX_PARTS, HOUR_MS, MOMENT_SELECT,
  fail, meta, hasEnded, momentState, isScheduled, shownAt, displayedPoint, viewerContext, canSee, loadAuthors, loadMoment,
  serializeMoments, reportedIds, openMoment, openMoments, mapRings, unplacedRings, peopleRings, MAX_PEOPLE, connectionIds, unseenPeople, wentLiveAt, ownMoments, viewersOf,
  EDIT_WINDOW_MS, editableUntil,
  newMomentRow, takenAtShown, shownAltitude, markKept, heightsOn, floatOn, skyOn, reinventedOn, REINVENTED_OFF, reinventedOff, isFloating, HEIGHTS_FLAG, FLOAT_FLAG, SKY_FLAG, REINVENTED_FLAG, checkPostingRules, insertMoment, updateMoment, changeMoment, goLive, hold, holdIfReported, releaseIfReviewed,
  filesHeld, purgeFiles, deleteMoment,
  authorKey, isOwn, markOwn, authorsFor, ownMoment, listedFor,
  // Pulse, reinvented's list (services/pulse/list.js).
  shownInBox, shownOfPeople, MAX_MAP_SPAN_DEGREES,
  // "Keep this?" (services/pulse/keep.js, list.js).
  shownKept, keepOfferable, repliedMoments,
  // The cabinet's highest point (services/pulse/cabinet.js): only a height the Moment shows.
  shownHeight,
};
