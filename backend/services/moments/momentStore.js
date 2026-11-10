// Moments (build brief and CONTRACT in ~/pantopus-moments/coord, approved 2026-11-08): a photo, a video of up to 30 s
// or a text card, pinned where it was posted, for 1, 6, 24 or 48 hours. Each one is a Post row with is_story = true and
// story_expires_at, and its own details in post_metadata.moment:
//   { v: 1, kind, hours, background, show_area, at_home, location_source,
//     state: 'uploading' | 'checking' | 'live', media: {...} | null, check: {...} | null, purged_at }
// Its place label is location_name (what everyone reads), its audience Post.audience ('nearby' | 'connections').
// The row is private (visibility 'private', no distribution targets, off profiles), and every other post path leaves
// it out (feedService.onlyShownPosts, readAccess.canReadPost, profiles): this module is its only reader. Every read here
// checks the end time itself, so a Moment ends on time even with the scheduled jobs off.

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const feedService = require('../feedService');
const { loadChatPeople } = require('../chatPeople');
const { verifiedResidentUserIds } = require('../../utils/identityProfiles');
const { applyLocationPrecision, MAX_DISPLAY_OFFSET_DEGREES, snapToNeighborhoodCells } = require('../../utils/locationPrivacy');
const { shownReaction, reactionSummary } = require('../../utils/postReaction');
const media = require('./momentMedia');

const KINDS = ['photo', 'video', 'text'];
const HOURS = [1, 6, 24, 48];
const BACKGROUNDS = ['teal', 'sky', 'green', 'amber', 'rose', 'slate'];
const AUDIENCES = ['nearby', 'connections'];
const DAILY_LIMIT = 20;
const HOUR_MS = 60 * 60 * 1000;
const FIX_MAX_AGE_MS = 5 * 60 * 1000;
const CAPTURE_MAX_AGE_MS = 24 * HOUR_MS;
// A phone's clock may run a little ahead of the server's.
const CLOCK_SKEW_MS = 2 * 60 * 1000;
const MAX_RINGS = 300;
const MAX_MAP_ROWS = 2000;
// A box wider than this (the whole state and beyond) shows no rings; the map asks again closer in.
const MAX_MAP_SPAN_DEGREES = 5;
const REPORTS_TO_HOLD = 2;

const MOMENT_SELECT = [
  'id', 'user_id', 'content', 'latitude', 'longitude', 'location_name', 'location_precision', 'audience',
  'created_at', 'story_expires_at', 'is_story', 'moderation_state', 'moderation_rule', 'moderation_note',
  'archived_at', 'archive_reason', 'post_metadata', 'view_count', 'origin',
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

/** Ended: its time ran out, its author deleted it (archived) or a moderator removed it. */
function hasEnded(row, now = Date.now()) {
  return Boolean(row.archived_at) || row.moderation_state === 'removed'
    || !row.story_expires_at || Date.parse(row.story_expires_at) <= now;
}

/** What the author reads as the Moment's state (CONTRACT "Shapes"); others only ever see 'live' ones. */
function momentState(row, now = Date.now()) {
  if (hasEnded(row, now)) return 'ended';
  if (row.moderation_state === 'held') return 'held';
  const { state } = meta(row);
  return ['uploading', 'checking', 'live'].includes(state) ? state : 'live';
}

// The point everyone sees, the author included: the exact pin, or the approximate grid point (docs/location-privacy-
// matrix.md, approx_area) for a Moment shown as an area.
function displayedPoint(row) {
  const point = { latitude: row.latitude, longitude: row.longitude };
  if (meta(row).show_area) applyLocationPrecision(point, 'approx_area', false, { setUnlockedFlag: false, stripAddress: false });
  return point;
}

// One ring per person per spot (CONTRACT Ring.id): an exact pin's 0.005° cell, an area pin's displayed point.
function ringKey(row, point) {
  if (meta(row).show_area) {
    return `u_${row.user_id}_a_${Math.round(point.latitude * 1000)}_${Math.round(point.longitude * 1000)}`;
  }
  return `u_${row.user_id}_c_${Math.floor(point.latitude * 200)}_${Math.floor(point.longitude * 200)}`;
}

// ─── Who sees what ──────────────────────────────────────────────────────────

/**
 * What decides which Moments `viewerId` sees: the people across a block from them, the people and businesses they
 * muted (everywhere, or in Moments only) and, for connections-only Moments, who they're connected to. Throws when the
 * blocks or mutes can't be read, so nothing shows unfiltered.
 */
async function viewerContext(viewerId, authorIds = []) {
  const filters = await feedService.getMuteAndHideFilters(viewerId);
  const others = [...new Set(authorIds.filter((id) => id && id !== viewerId))];
  const links = await readInBatches(others, (batch) => supabaseAdmin
    .from('Relationship')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`and(requester_id.eq.${viewerId},addressee_id.in.(${batch.join(',')})),and(addressee_id.eq.${viewerId},requester_id.in.(${batch.join(',')}))`),
  'connections');
  const connected = new Set(links.map((r) => (r.requester_id === viewerId ? r.addressee_id : r.requester_id)));
  return {
    viewerId,
    blocked: filters.blockedUserIds,
    muted: new Set([...filters.mutedUserIds, ...filters.mutedBusinessIds, ...filters.momentMutedIds]),
    connected,
  };
}

/** Whether the viewer may see this Moment at all (blocks, mutes, audience), whatever its state. */
function canSee(row, ctx) {
  if (row.user_id === ctx.viewerId) return true;
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
  // A business's check is its verification; if that can't be read, it shows none.
  const businesses = await readInBatches(businessIds, (batch) => supabaseAdmin.from('BusinessProfile')
    .select('business_user_id, verification_status').in('business_user_id', batch), 'businesses').catch(() => []);
  const verifiedBusinesses = new Set(businesses.filter((b) => b.verification_status === 'verified')
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

// ─── Reading ────────────────────────────────────────────────────────────────

async function loadMoment(id) {
  const { data, error } = await supabaseAdmin.from('Post').select(MOMENT_SELECT).eq('id', id).eq('is_story', true).maybeSingle();
  if (error && error.code !== '22P02') throw new Error(`Failed to load the Moment: ${error.message}`);
  return data || null;
}

/** The viewer's views and reactions on these Moments: { seen: Set, reactions: Map(id → emoji) }. */
async function viewerMarks(viewerId, ids) {
  if (!ids.length) return { seen: new Set(), reactions: new Map() };
  const [views, likes] = await Promise.all([
    readInBatches(ids, (batch) => supabaseAdmin.from('PostView').select('post_id').eq('user_id', viewerId).in('post_id', batch), 'views'),
    readInBatches(ids, (batch) => supabaseAdmin.from('PostLike').select('post_id, reaction').eq('user_id', viewerId).in('post_id', batch), 'reactions'),
  ]);
  return {
    seen: new Set(views.map((v) => v.post_id)),
    reactions: new Map(likes.map((l) => [l.post_id, shownReaction(l.reaction)])),
  };
}

function briefOf(row, seen) {
  return { id: row.id, kind: meta(row).kind, created_at: row.created_at, expires_at: row.story_expires_at, seen };
}

/**
 * A Moment as CONTRACT "Moment" for `viewerId`. `links` holds signed links by storage key; `own` adds the author's
 * counts (`reactionCounts` from reactionCountsFor).
 */
function serializeMoment(row, { author, viewerId, seen = false, myReaction = null, links = new Map(), reactionCounts = null }) {
  const m = meta(row);
  const own = row.user_id === viewerId;
  const state = momentState(row);
  const point = displayedPoint(row);
  const showMedia = state === 'live' || (own && state !== 'ended');
  const stored = m.media || null;
  return {
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
    place_label: row.location_name,
    latitude: point.latitude,
    longitude: point.longitude,
    show_area: Boolean(m.show_area),
    audience: row.audience === 'connections' ? 'connections' : 'nearby',
    created_at: row.created_at,
    expires_at: row.story_expires_at,
    hours: m.hours,
    seen: own ? true : Boolean(seen),
    my_reaction: own ? null : myReaction,
    viewer_count: own ? Number(row.view_count) || 0 : null,
    reaction_counts: own ? reactionCounts || [] : null,
  };
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
    return stored ? [stored.key, stored.poster_key].filter(Boolean) : [];
  });
}

/** Full Moments for `viewerId` (each row already checked visible), in the given order. */
async function serializeMoments(rows, viewerId) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const ownIds = rows.filter((r) => r.user_id === viewerId).map((r) => r.id);
  const [authors, marks, links, counts] = await Promise.all([
    loadAuthors(rows.map((r) => r.user_id)),
    viewerMarks(viewerId, ids),
    media.signedLinks(undefined, linkKeys(rows.filter((r) => momentState(r) !== 'ended'))),
    reactionCountsFor(ownIds),
  ]);
  return rows.map((row) => serializeMoment(row, {
    author: authors.get(String(row.user_id)),
    viewerId,
    seen: marks.seen.has(row.id),
    myReaction: marks.reactions.get(row.id) || null,
    links,
    reactionCounts: counts.get(row.id) || null,
  }));
}

/**
 * A Moment `viewerId` may open: { row } when they can see it and it's live (or it's theirs and hasn't ended).
 * Throws 404 when they can't see it (or it doesn't exist) and 410 MOMENT_ENDED when it has ended.
 */
async function openMoment(id, viewerId, { liveOnly = true } = {}) {
  const row = await loadMoment(id);
  if (!row) throw fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
  const own = row.user_id === viewerId;
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
 * The live Moments shown in the box that `viewerId` may see (blocks, mutes, audience), newest first, each with the
 * point everyone sees: [{ row, point }]. The map and the tab's dot both read this.
 */
async function shownInBox(viewerId, { south, west, north, east }) {
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
  const ctx = await viewerContext(viewerId, rows.map((r) => r.user_id));
  const shown = [];
  for (const row of rows) {
    if (!canSee(row, ctx)) continue;
    const point = displayedPoint(row);
    if (point.latitude < south || point.latitude > north || point.longitude < west || point.longitude > east) continue;
    shown.push({ row, point });
  }
  return shown;
}

/** Live Moments in view as rings (CONTRACT GET /api/moments/map), newest first. */
async function mapRings(viewerId, box) {
  const groups = new Map();
  for (const { row, point } of await shownInBox(viewerId, box)) {
    const key = ringKey(row, point);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, point });
  }
  // The newest MAX_RINGS rings; only theirs are named and marked.
  const kept = [...groups.entries()].map(([key, members]) => {
    members.sort((a, b) => Date.parse(a.row.created_at) - Date.parse(b.row.created_at));
    return { key, members, newest: members[members.length - 1] };
  }).sort((a, b) => Date.parse(b.newest.row.created_at) - Date.parse(a.newest.row.created_at)).slice(0, MAX_RINGS);
  const [authors, marks] = await Promise.all([
    loadAuthors(kept.map(({ newest }) => newest.row.user_id)),
    viewerMarks(viewerId, kept.flatMap(({ members }) => members.map(({ row }) => row.id))),
  ]);
  return kept.map(({ key, members, newest }) => {
    const mine = newest.row.user_id === viewerId;
    const moments = members.map(({ row }) => briefOf(row, mine || marks.seen.has(row.id)));
    return {
      id: key,
      author: authors.get(String(newest.row.user_id)),
      latitude: newest.point.latitude,
      longitude: newest.point.longitude,
      place_label: newest.row.location_name,
      moments,
      unseen_count: moments.filter((m) => !m.seen).length,
      newest_at: newest.row.created_at,
      mine,
    };
  });
}

/** When a Moment went live: its end time less its hours (a photo's or video's time starts when its upload finishes). */
function wentLiveAt(row) {
  const hours = HOURS.includes(meta(row).hours) ? meta(row).hours : 24;
  return Date.parse(row.story_expires_at) - hours * HOUR_MS;
}

/**
 * How many people have something new for `viewerId` in the box (CONTRACT GET /api/moments/unseen): a live Moment the
 * viewer may see and hasn't watched, that went live after `since` (a time in ms; none: any). Never the viewer's own.
 */
async function unseenPeople(viewerId, box, since = null) {
  const fresh = (await shownInBox(viewerId, box)).map(({ row }) => row)
    .filter((row) => row.user_id !== viewerId && (since == null || wentLiveAt(row) > since));
  if (!fresh.length) return 0;
  const watched = new Set((await readInBatches(fresh.map((row) => row.id), (batch) => supabaseAdmin.from('PostView')
    .select('post_id').eq('user_id', viewerId).in('post_id', batch), 'views')).map((view) => view.post_id));
  return new Set(fresh.filter((row) => !watched.has(row.id)).map((row) => row.user_id)).size;
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
  return serializeMoments((data || []).filter((row) => momentState(row) !== 'ended'), userId);
}

/** Who watched the author's Moment, newest first (CONTRACT GET /:id/viewers). Blocked people aren't listed. */
async function viewersOf(row) {
  const [views, likes, blocked] = await Promise.all([
    supabaseAdmin.from('PostView').select('user_id, created_at').eq('post_id', row.id)
      .order('created_at', { ascending: false }).limit(1000),
    supabaseAdmin.from('PostLike').select('user_id, reaction').eq('post_id', row.id),
    require('../blockService').blockedUserIds(row.user_id),
  ]);
  if (views.error || likes.error) throw new Error(`Failed to load viewers: ${(views.error || likes.error).message}`);
  const rows = (views.data || []).filter((v) => v.user_id !== row.user_id && !blocked.has(v.user_id));
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
  const authors = await loadAuthors(viewerIds);
  return {
    count: rows.length,
    viewers: rows.map((v) => ({
      user: authors.get(String(v.user_id)),
      viewed_at: v.created_at,
      reaction: reactions.get(v.user_id) || null,
      replied: replied.has(v.user_id),
    })).filter((v) => v.user),
  };
}

// ─── Writing ────────────────────────────────────────────────────────────────

/** The Post row a new Moment is stored as. */
function newMomentRow({ userId, accountType, kind, hours, audience, showArea, atHome, caption, text, background,
  location, labels, createdAt }) {
  const now = createdAt ? new Date(createdAt) : new Date();
  const live = kind === 'text';
  return {
    user_id: userId,
    author_user_id: userId,
    content: kind === 'text' ? text : (caption || ''),
    media_urls: [],
    media_types: [],
    post_type: 'general',
    post_format: 'standard',
    visibility: 'private',
    location_precision: showArea ? 'approx_area' : 'exact_place',
    latitude: location.latitude,
    longitude: location.longitude,
    effective_latitude: location.latitude,
    effective_longitude: location.longitude,
    location_name: showArea || atHome ? labels.area_label : labels.place_label,
    location_address: null,
    post_as: 'personal',
    audience,
    distribution_targets: [],
    is_story: true,
    created_at: now.toISOString(),
    story_expires_at: new Date(now.getTime() + hours * HOUR_MS).toISOString(),
    show_on_profile: false,
    profile_visibility_scope: 'hidden',
    state: 'open',
    origin: accountType === 'curator' ? 'curator' : accountType === 'system' ? 'system' : 'user',
    moderation_state: 'live',
    gps_timestamp: location.source === 'gps' ? location.fix_at : null,
    post_metadata: {
      moment: {
        v: 1,
        kind,
        hours,
        background: kind === 'text' ? background : null,
        show_area: Boolean(showArea),
        at_home: Boolean(atHome),
        location_source: location.source,
        state: live ? 'live' : 'uploading',
        media: null,
        check: null,
      },
    },
  };
}

/**
 * Checks the posting rules for `user` (CONTRACT POST /api/moments): the one-time 18+ confirmation, a fresh GPS fix or
 * a library item from the last 24 hours, and 20 Moments a day. Throws the error the apps handle.
 */
async function checkPostingRules(user, { kind, location }) {
  const now = Date.now();
  if (location.source === 'gps') {
    const fixAt = Date.parse(location.fix_at);
    if (!Number.isFinite(fixAt) || fixAt > now + CLOCK_SKEW_MS || now - fixAt > FIX_MAX_AGE_MS) {
      throw fail(422, 'LOCATION_TOO_OLD', 'Your location is out of date. Wait a moment for a new fix and try again.');
    }
  } else {
    if (kind === 'text') throw fail(400, 'MOMENT_INVALID', 'A text card pins where you are.');
    const takenAt = Date.parse(location.taken_at);
    if (!Number.isFinite(takenAt) || takenAt > now + CLOCK_SKEW_MS || now - takenAt > CAPTURE_MAX_AGE_MS) {
      throw fail(422, 'CAPTURE_TOO_OLD', 'Only photos and videos from the last 24 hours can be Moments.');
    }
  }
  const { adultStatus } = require('../adultAttestation');
  const adult = await adultStatus(user.id);
  if (adult.ineligible) throw fail(403, 'AGE_NOT_ELIGIBLE', 'Moments are for people 18 and older.');
  if (!adult.attestedAt) throw fail(403, 'ADULT_CONFIRM_REQUIRED', 'Confirm you are 18 or older to post Moments.');
  const { count, error } = await supabaseAdmin.from('Post').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('is_story', true).gte('created_at', new Date(now - 24 * HOUR_MS).toISOString());
  if (error) throw new Error(`Failed to count Moments: ${error.message}`);
  if (count >= DAILY_LIMIT) {
    throw fail(429, 'MOMENTS_DAILY_LIMIT', `You can post up to ${DAILY_LIMIT} Moments a day. Try again later.`);
  }
}

/** Inserts a new Moment and returns its row. `id` (a retry key turned into the row's id) makes a retry return it. */
async function insertMoment(row, id = null) {
  const write = id
    ? supabaseAdmin.from('Post').upsert({ ...row, id }, { onConflict: 'id', ignoreDuplicates: true })
    : supabaseAdmin.from('Post').insert(row);
  const { data, error } = await write.select(MOMENT_SELECT).maybeSingle();
  if (error) throw new Error(`Failed to save the Moment: ${error.message}`);
  if (data) return { row: data, created: true };
  // The retry key's row already exists: the earlier attempt went through.
  const existing = id ? await loadMoment(id) : null;
  if (!existing || existing.user_id !== row.user_id) throw fail(409, 'MOMENT_RETRY_CONFLICT', 'This Moment was already posted.');
  return { row: existing, created: false };
}

/** Writes `changes` (post_metadata.moment fields under `moment`) when the row still matches `expect`. */
async function updateMoment(row, { moment, ...columns }, expect = {}) {
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

/** The Moment goes live: its time starts now (CONTRACT: expires_at counts from going live). */
function goLive(row, check) {
  const hours = HOURS.includes(meta(row).hours) ? meta(row).hours : 24;
  return updateMoment(row, {
    story_expires_at: new Date(Date.now() + hours * HOUR_MS).toISOString(),
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
    .eq('post_id', row.id).in('status', ['pending', 'reviewed']);
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
    .eq('post_id', postId).neq('status', 'dismissed');
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
    .eq('post_id', row.id).in('status', ['pending', 'reviewed']);
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
  const keys = [...new Set([...media.mediaKeys(m.media), ...await media.folderKeys(bucket, row.user_id, row.id)])];
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
  KINDS, HOURS, BACKGROUNDS, AUDIENCES, DAILY_LIMIT, HOUR_MS, MOMENT_SELECT,
  fail, meta, hasEnded, momentState, displayedPoint, viewerContext, canSee, loadAuthors, loadMoment,
  serializeMoments, openMoment, mapRings, unseenPeople, wentLiveAt, ownMoments, viewersOf,
  newMomentRow, checkPostingRules, insertMoment, updateMoment, goLive, hold, holdIfReported, releaseIfReviewed,
  filesHeld, purgeFiles, deleteMoment,
};
