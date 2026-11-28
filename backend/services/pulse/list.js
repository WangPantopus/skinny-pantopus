'use strict';

// Pulse, reinvented, phase 1: the one list (coord CONTRACT section 6a, GET /api/reinvented/list). Moments that fade
// and posts that stay, mixed, for a reader whose `pulse_reinvented` switch is on (routes/reinvented.js checks it).
//
// Nothing here decides who may see what. Posts come from feedService.getListFeed, the same reads, scopes, mutes,
// blocks, hides and place rules as today's Pulse lists (Connections for Close circle, Place for Around me); Moments
// from momentStore (canSee, reports, the home rules, guess-the-spot hiding), as the map and the rings read them.
// This file only mixes the two, in the order the reach asks for, and says each item's distance band.
//
// Close circle: newest first. Around me: by band, nearest band first, newest first inside a band. A band is the
// distance from the reader's place to the point everyone sees, and nothing finer leaves this file: a post's
// `distance_meters` is taken off, and the reader's own point is never sent.
//
// Phase 6 (CONTRACT 11): with the map's box the list is what the map shows there (the map's own reads), nearest the box's
// middle first; with `no_place` the reader's own and connections' posts and Moments without a place follow as one more band.

const feedService = require('../feedService');
const store = require('../moments/momentStore');
const momentPlace = require('../moments/momentPlace');
const { resolveLocation } = require('../context/locationResolver');
const { postScopeAccess } = require('./readAccess');
const postStudio = require('./postStudio');
const filtersOf = require('./filters');
const { haversineMeters } = require('../../utils/trustState');
const { timezoneFromCoordinates } = require('../../utils/timezone');

const MILE = 1609.344;
const REACHES = ['close', 'around'];
const MAX_MILES = 25;
// The bands of Around me, nearest first: their keys, how far each reaches (miles) and their words ("town" says the
// reader's town).
const BANDS = [
  { band: 'street', miles: 0.25, label: 'Your street' },
  { band: 'town', miles: 1, label: null },
  { band: '2', miles: 2, label: '2 mi' },
  { band: '5', miles: 5, label: '5 mi' },
  { band: '10', miles: 10, label: '10 mi' },
  { band: '25', miles: 25, label: '25 mi' },
];

// Each chip is a kind today's Pulse already has (CONTRACT 6a). `moments`: whether Moments are in it; `posts`: the
// getListFeed options that pick its posts, or null for none.
const CHIPS = {
  all: { moments: true, posts: {} },
  live: { moments: true, posts: null },
  // Learn: answered Asks and Local Updates (LEAD-2, 02:28: the Studio's Learning is today's Local Update).
  learn: {
    moments: false,
    posts: { postTypes: ['ask_local', 'local_update'], keep: (post) => post.post_type === 'local_update' || post.resolution === 'answered' },
  },
  spots: { moments: false, posts: { postTypes: ['share', 'recommendation'] } },
  ask: { moments: false, posts: { postTypes: ['ask_local'], keep: (post) => post.resolution !== 'answered' } },
  plans: { moments: false, posts: { postTypes: ['event'] } },
  sports: { moments: false, posts: { keep: (post) => post.topic === 'sports' } },
};
const CHIP_NAMES = Object.keys(CHIPS);

const END_LINES = {
  close: 'Caught up on your circle. Keep exploring?',
  around: 'Caught up around you. Keep exploring?',
};
// The map's box (CONTRACT 11a): the last page's words, and how many posts the map draws at most (its own cap, map.js).
const BOX_END = "That's everything on the map here.";
const MAP_CAP = 200;
// Without a place (CONTRACT 11b): the band they follow under, and how many of each (posts, Moments) at most.
const NO_PLACE_BAND = { band: 'no_place', label: 'Without a place' };
const MAX_NO_PLACE = 100;

// How many reads of each kind one page may take when the reads keep coming back with nothing to show.
const MAX_ROUNDS = 4;
// How many posts Around me's first page reads in one go across the whole reach: a place with no more posts than this
// opens from that one read (cutWhole).
const WHOLE_READ = 60;

function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

// ─── Order ─────────────────────────────────────────────────────────────────

// A time in microseconds since the epoch (PostgREST times carry microseconds), so two in one millisecond still order.
function micros(value) {
  const text = String(value || '');
  const millis = Date.parse(text.replace(/\.\d+/, ''));
  if (Number.isNaN(millis)) return 0;
  const fraction = /\.(\d+)/.exec(text)?.[1] || '';
  return millis * 1000 + Number(fraction.padEnd(6, '0').slice(0, 6));
}

// Newest first, then by id: the order every part of the list follows, and what its cursor names.
function newerFirst(a, b) {
  if (a.key.at !== b.key.at) return b.key.at - a.key.at;
  return a.key.id < b.key.id ? 1 : a.key.id > b.key.id ? -1 : 0;
}

/** Whether `key` comes after `mark` in newerFirst order (strictly below it). */
function below(key, mark) {
  if (!mark) return true;
  if (key.at !== mark.at) return key.at < mark.at;
  return key.id < mark.id;
}

// ─── The cursor ────────────────────────────────────────────────────────────

function encodeCursor(state) {
  return Buffer.from(JSON.stringify({ v: 1, ...state })).toString('base64url');
}

/** The map's box as a cursor names it (CONTRACT 11a), or null without one. */
function boxSignature(box) {
  return box ? [box.south, box.west, box.north, box.east].map((n) => Number(n).toFixed(6)).join(',') : null;
}

function decodeCursor(text, { reach, miles, chip, circle = null, filters = null, box = null, noPlace = false }) {
  if (text == null || text === '') return null;
  let state;
  try {
    state = JSON.parse(Buffer.from(String(text), 'base64url').toString('utf8'));
  } catch {
    state = null;
  }
  const sameAsk = state && state.v === 1 && state.r === reach && state.mi === miles && state.c === chip
    && (state.ci || null) === (circle || null) && (state.f || null) === filtersOf.signature(filters)
    && (state.x || null) === boxSignature(box) && Boolean(state.np) === Boolean(noPlace);
  // The map's box (CONTRACT 11a) and the part without a place (11b) go on from a mark of their own.
  if (sameAsk && state.z === 'box' && box) {
    const key = state.k;
    if (key == null || (Number.isFinite(key.d) && Number.isFinite(key.at) && typeof key.id === 'string')) {
      return { stage: 'box', key: key ?? null };
    }
  }
  if (sameAsk && state.z === 'np' && noPlace) {
    const mark = state.m;
    if (mark == null || (Number.isFinite(mark.at) && typeof mark.id === 'string')) return { stage: 'np', mark: mark ?? null };
  }
  if (box || state?.z) throw fail(400, 'INVALID_CURSOR', 'This list has changed. Pull to refresh.');
  const band = state?.b;
  if (!sameAsk || !Number.isInteger(band) || band < 0 || band >= BANDS.length) {
    throw fail(400, 'INVALID_CURSOR', 'This list has changed. Pull to refresh.');
  }
  const mark = state.m;
  if (mark != null && !(Number.isFinite(mark.at) && typeof mark.id === 'string')) {
    throw fail(400, 'INVALID_CURSOR', 'This list has changed. Pull to refresh.');
  }
  const posts = state.p;
  if (!(posts == null || posts === 'done' || (typeof posts?.createdAt === 'string' && typeof posts?.id === 'string'))) {
    throw fail(400, 'INVALID_CURSOR', 'This list has changed. Pull to refresh.');
  }
  return { band, posts, mark };
}

// ─── Bands ─────────────────────────────────────────────────────────────────

/** The bands up to `miles` (the last one cut at `miles`), each with its inner and outer edge in metres. */
function bandsUpTo(miles, townLabel) {
  const out = [];
  let inner = 0;
  for (const band of BANDS) {
    if (inner >= miles) break;
    const outer = Math.min(band.miles, miles);
    const cut = outer < band.miles;
    out.push({
      band: cut ? String(miles) : band.band,
      label: cut ? `${miles} mi` : band.label || townLabel,
      innerM: inner * MILE,
      outerM: outer * MILE,
    });
    inner = outer;
  }
  return out;
}

function bandIndexOf(meters, bands) {
  const index = bands.findIndex((band) => meters <= band.outerM);
  return index === -1 ? null : index;
}

function boxAround(latitude, longitude, meters) {
  const latDelta = meters / 111000;
  const lngDelta = meters / (111000 * Math.cos(latitude * Math.PI / 180));
  return { south: latitude - latDelta, north: latitude + latDelta, west: longitude - lngDelta, east: longitude + lngDelta };
}

// ─── One part of the list ──────────────────────────────────────────────────

/**
 * One part of the list (all of Close circle, or one band of Around me), from its cursor: up to `room` items, newest
 * first, mixing the posts `readPosts(cursor, limit)` reads (getListFeed, a page at a time) with `moments` (all of the
 * part's Moments, already newest first, as items). A Moment is taken only once the posts read so far reach down to
 * it, so no post newer than it can still be missing. Returns the items and where the part goes on.
 */
async function partPage({ readPosts, moments, posts: postCursor, mark, room }) {
  let cursor = postCursor;
  let momentMark = mark;
  const taken = [];
  for (let round = 0; round < MAX_ROUNDS && taken.length < room; round++) {
    let postItems = [];
    let floor = null;
    let read = null;
    if (readPosts && cursor !== 'done') {
      read = await readPosts(cursor, room - taken.length);
      postItems = read.posts.map((post) => ({
        type: 'post',
        // A global pin (a Pantopus-wide notice, first page only) and a pinned post (Close circle lists them first, as
        // today's Connections does) lead the part.
        key: {
          at: post.is_global_pin || (post.is_pinned && !cursor) ? Number.MAX_SAFE_INTEGER
            : micros(read.reachedAt?.get(post.id) || post.created_at),
          id: post.id,
        },
        reachedAt: read.reachedAt?.get(post.id) || post.created_at,
        post,
      }));
      // Below the point the posts were read down to there may still be posts: Moments wait above it.
      if (read.pagination?.hasMore && read.pagination.nextCursor) {
        floor = { at: micros(read.pagination.nextCursor.createdAt), id: read.pagination.nextCursor.id };
      }
    }
    const momentItems = moments.filter((item) => below(item.key, momentMark) && (!floor || !below(item.key, floor)));
    const merged = [...postItems, ...momentItems].sort(newerFirst).slice(0, room - taken.length);
    taken.push(...merged);

    // A global pin is never where the posts go on: the read after it starts from the top again (without the pins).
    const takenPosts = merged.filter((item) => item.type === 'post' && !item.post.is_global_pin);
    const takenMoments = merged.filter((item) => item.type === 'moment');
    if (takenMoments.length) momentMark = takenMoments[takenMoments.length - 1].key;
    if (read) {
      if (merged.filter((item) => item.type === 'post').length === postItems.length) {
        // Every post read is in: go on where the read stopped (it may have read past posts nobody may see).
        cursor = read.pagination?.hasMore && read.pagination.nextCursor ? read.pagination.nextCursor : 'done';
      } else if (takenPosts.length) {
        const last = takenPosts[takenPosts.length - 1];
        cursor = { createdAt: last.reachedAt, id: last.post.id };
      }
    }
    const postsDone = !readPosts || cursor === 'done';
    const momentsLeft = moments.some((item) => below(item.key, momentMark));
    if (postsDone && !momentsLeft) return { items: taken, posts: 'done', mark: momentMark, done: true };
    // Full, or the read came back with nothing new to show while posts are still to read: read on.
    if (taken.length >= room) break;
  }
  return { items: taken, posts: readPosts ? cursor : 'done', mark: momentMark, done: false };
}

// ─── Filters (CONTRACT 10a) ─────────────────────────────────────────────────

/** The post types a filter can hold (with the Heads-ups), to read fewer posts; null for any type. */
function postTypesFor(filters) {
  let types = null;
  if (filters.kinds) {
    const shapes = filters.kinds.map((name) => CHIPS[name].posts).filter(Boolean);
    types = shapes.some((posts) => !posts.postTypes) ? null : [...new Set(shapes.flatMap((posts) => posts.postTypes))];
  }
  const narrow = (allowed) => { types = types ? types.filter((type) => allowed.includes(type)) : allowed; };
  if (filters.state) {
    narrow([...(filters.state.includes('unanswered') ? ['ask_local'] : []), ...(filters.state.includes('room') ? ['event'] : [])]);
  }
  if (filters.when === 'tonight' || filters.when === 'weekend') narrow(['event']);
  return types ? [...new Set([...types, 'alert'])] : null;
}

/**
 * The list's shape for a request's filters: whether Moments are read, and the posts' types and test, plus the tests
 * themselves for the Moments. Reads only what the filters need: the reader's connections for `from=connections`, the
 * place's time zone for `when`.
 */
async function filteredShape(userId, filters, { placeRead }) {
  const [ids, place] = await Promise.all([
    filters.from === 'connections' ? store.connectionIds(userId) : null,
    filters.when && filters.when !== 'now' && placeRead ? placeRead.catch(() => null) : null,
  ]);
  const people = ids ? new Set([String(userId), ...ids.map(String)]) : null;
  const zone = place ? timezoneFromCoordinates(place.latitude, place.longitude, null) : null;
  const tests = filtersOf.testsFor(filters, { chips: CHIPS, people, zone });
  return { tests, shape: { moments: tests.moments, posts: { postTypes: postTypesFor(filters), keep: tests.post } } };
}

/** The Moments (entries or items, each with its `row`) a request's filters keep; all of them without filters. */
function keptByFilters(list, filtered) {
  if (!filtered) return list;
  return list.filter((entry) => filtered.tests.moment(entry.row, store.shownAt(entry.row)));
}

// ─── The list ──────────────────────────────────────────────────────────────

/**
 * The live Moments of a read and the Moments their authors kept as posts ("Keep this?", CONTRACT 6d), each once: a
 * kept one is listed after its end too, as a post that stays. A failed read of the kept ones leaves only them out.
 */
async function withKept(liveRead, keptRead) {
  const [live, kept] = await Promise.all([liveRead, keptRead.catch(() => [])]);
  const seenIds = new Set(live.map((entry) => entry.row.id));
  return [...live, ...kept.filter((entry) => !seenIds.has(entry.row.id))];
}

function momentItem(entry, bandIndex = null) {
  return { type: 'moment', key: { at: micros(store.shownAt(entry.row)), id: entry.row.id }, row: entry.row, bandIndex };
}

/** Where Around me is read from: the point the app sent, else the reader's home, then a saved place. */
async function readerPlace(userId, latitude, longitude) {
  if (latitude != null && longitude != null) return { latitude, longitude };
  const own = await resolveLocation(userId);
  return own.latitude == null || own.longitude == null ? null : { latitude: own.latitude, longitude: own.longitude };
}

/**
 * GET /api/reinvented/list for `userId` (CONTRACT 6a). `query`: { reach, miles, chip, latitude, longitude, cursor,
 * limit }, already checked by the route.
 */
async function listFor(userId, {
  reach = 'around', miles = MAX_MILES, chip = 'all', latitude = null, longitude = null, cursor = null, limit = 20, circle = null,
  filters = null, box = null, noPlace: noPlaceAsked = false,
}) {
  if (!REACHES.includes(reach)) throw fail(400, 'LIST_INVALID', 'Choose Close circle or Around me.');
  if (!CHIP_NAMES.includes(chip)) throw fail(400, 'LIST_INVALID', 'Choose one of the chips.');
  if (circle && reach !== 'close') throw fail(400, 'LIST_INVALID', 'A circle goes with Close circle.');
  if (box && reach !== 'around') throw fail(400, 'LIST_INVALID', "The map's area goes with Around me.");
  // Without a place (CONTRACT 11b): Close circle already lists them by time, so there it changes nothing.
  const noPlace = Boolean(noPlaceAsked) && reach === 'around';
  const from = decodeCursor(cursor, { reach, miles, chip, circle, filters, box, noPlace });
  // The map's box (CONTRACT 11a): what the map shows there, in a read of its own.
  if (box) return boxListFor(userId, { box, chip, filters, from, limit, noPlace, miles });
  // Around me's part without a place, once its placed bands are all read (CONTRACT 11b).
  if (from?.stage === 'np') {
    const shape = filters ? (await filteredShape(userId, filters, { placeRead: readerPlace(userId, latitude, longitude) })) : null;
    const np = await noPlacePage(userId, { shape: shape ? shape.shape : CHIPS[chip], filtered: shape, chip, mark: from.mark, room: limit });
    const bands = [...bandsUpTo(miles, null), NO_PLACE_BAND];
    return answer({
      userId, reach, miles, chip, chipsRead: null, readyRead: null, place: null, bands,
      items: np.items.map((item) => ({ ...item, bandIndex: bands.length - 1 })),
      next: np.more ? { z: 'np', m: np.mark, np: 1 } : null, filters,
    });
  }
  const firstPage = !from;
  // Filters (CONTRACT 10a): the chip's shape becomes the filters' own (several kinds, when, from, state, since, with the
  // Heads-ups always); without any, the chip's shape as before.
  // Around me's place is read beside what the filters need (the reader's connections), not after it.
  const placeRead = reach === 'around' || (filters?.when && filters.when !== 'now')
    ? readerPlace(userId, latitude, longitude) : null;
  placeRead?.catch(() => {});
  const filtered = filters ? await filteredShape(userId, filters, { placeRead }) : null;
  const shape = filtered ? filtered.shape : CHIPS[chip];
  // Which Pulse read scopes the reader has is read once for every post read below.
  const scopeAccessRead = postScopeAccess(userId);
  scopeAccessRead.catch(() => {});
  // The newest passes (CONTRACT 8f) are read beside the posts, so the page's "passed" parts need no read after them.
  // eslint-disable-next-line global-require
  const recentPasses = require('./passOn').recentPasses();
  recentPasses.catch(() => {});
  // An All first page says its chips from the posts its own reads saw (chipsFromPage); every read is noted here.
  const chipsFromReads = firstPage && chip === 'all' && !filtered;
  const seen = [];
  let complete = true;
  const noted = (read) => {
    const out = read.then((result) => {
      seen.push(...result.posts);
      if (result.pagination?.hasMore) complete = false;
      return result;
    });
    out.catch(() => {});
    return out;
  };

  if (reach === 'close') {
    // One circle of the reader's (CONTRACT 8d): only its members who are in; otherwise the people they are connected with.
    // eslint-disable-next-line global-require
    const circlePeople = circle ? await require('./circles').peopleFor(userId, circle) : null;
    const members = circlePeople ? new Set(circlePeople) : null;
    const connectionsRead = members ? Promise.resolve(circlePeople.filter((id) => id !== String(userId)))
      : store.connectionIds(userId);
    // The Moments are read when the chip shows them, or on the first page to say whether `live` has any.
    const shownRead = shape.moments || firstPage
      ? connectionsRead.then((ids) => withKept(store.shownOfPeople(userId, [String(userId), ...ids]),
        store.shownKept(userId, { people: [String(userId), ...ids] })))
      : Promise.resolve([]);
    const momentsRead = shape.moments ? shownRead.then((entries) => keptByFilters(entries, filtered)) : Promise.resolve([]);
    const chipContext = { userId, reach, scopeAccessRead, momentsRead: shownRead };
    let chipsRead = firstPage && !chipsFromReads ? chipsFor(chipContext) : null;
    const chipKeep = shape.posts?.keep || null;
    const readPosts = shape.posts && ((at, size) => noted(feedService.getListFeed({
      userId, surface: 'connections', cursorCreatedAt: at?.createdAt || null, cursorId: at?.id || null, limit: size,
      scopeAccessRead, withReachedAt: true, ...shape.posts,
      ...(members ? { keep: (post) => members.has(String(post.user_id)) && (!chipKeep || chipKeep(post)) } : {}),
    })));
    const sortedRead = momentsRead.then((entries) => entries.map((entry) => momentItem(entry)).sort(newerFirst));
    // The Moments this page can hold are made ready while the posts are read (at most `limit`, the next in order).
    const readyRead = prepare(userId, sortedRead.then((all) => all.filter((item) => below(item.key, from?.mark ?? null)).slice(0, limit)));
    // The page's first posts read starts now, beside the Moments' reads, not after them (the opening time, LEAD-3 09:22),
    // and so do the Studio parts of the people's posts (the page reads by id only what that can't cover).
    const firstCursor = from?.posts ?? null;
    const firstRead = readPosts && firstCursor !== 'done' ? readPosts(firstCursor, limit) : null;
    firstRead?.catch(() => {});
    let firstUsed = false;
    const readPostsEarly = readPosts && ((at, size) => {
      if (!firstUsed && firstRead && at === firstCursor && size === limit) {
        firstUsed = true;
        return firstRead;
      }
      return readPosts(at, size);
    });
    const studioByPeople = shape.posts ? connectionsRead.then((ids) => postStudio.partsByPeople([String(userId), ...ids])) : null;
    studioByPeople?.catch(() => {});
    const part = await partPage({
      readPosts: readPostsEarly, moments: await sortedRead, posts: firstCursor, mark: from?.mark ?? null, room: limit,
    });
    if (chipsFromReads) chipsRead = chipsFromPage(chipContext, seen, complete);
    return answer({
      userId, reach, miles, chip, chipsRead, readyRead, place: null, bands: [], items: part.items, recentPasses, studioInBox: studioByPeople,
      next: part.done ? null : { b: 0, p: part.posts, m: part.mark, ...(circle ? { ci: circle } : {}) }, filters,
    });
  }

  // Around me.
  const place = await (placeRead || readerPlace(userId, latitude, longitude));
  if (!place) {
    return {
      reach, miles, place: null, needs_place: true, chips: firstPage ? ['all'] : null, bands: [], items: [],
      next_cursor: null, end: null, ...filtersOf.echo(filters),
    };
  }
  const townRead = momentPlace.townAt(place.latitude, place.longitude).catch(() => momentPlace.FALLBACK_LABEL);
  const bands = bandsUpTo(miles, null);
  const reachM = bands[bands.length - 1].outerM;
  // The Studio parts of the posts here (stamps, playable items and their answers, dots) are read beside the posts, not
  // after them: the place is known first (the opening time, LEAD-3 09:06). A failed or too-large read only falls back.
  const studioInBox = shape.posts ? postStudio.partsInBox(boxAround(place.latitude, place.longitude, reachM)) : null;
  studioInBox?.catch(() => {});
  // The Moments are read when the chip shows them, or on the first page to say whether `live` has any.
  const shownRead = shape.moments || firstPage
    ? withKept(store.shownInBox(userId, boxAround(place.latitude, place.longitude, reachM)),
      store.shownKept(userId, { box: boxAround(place.latitude, place.longitude, reachM) })).then((entries) => entries
      .map((entry) => {
        const meters = haversineMeters(place.latitude, place.longitude, entry.point.latitude, entry.point.longitude);
        return Number.isFinite(meters) ? momentItem(entry, bandIndexOf(meters, bands)) : null;
      })
      .filter((item) => item && item.bandIndex != null))
    : Promise.resolve([]);
  const momentsRead = shape.moments ? shownRead.then((items) => keptByFilters(items, filtered)) : Promise.resolve([]);
  const chipContext = { userId, reach, place, reachM, scopeAccessRead, momentsRead: shownRead };
  let chipsRead = firstPage && !chipsFromReads ? chipsFor(chipContext) : null;
  // The Moments this page can hold are made ready while the posts are read: at most `limit`, the next ones in the
  // list's order (nearest band first, newest first inside it) from where the page starts.
  const startBand = from?.band ?? 0;
  const readyRead = prepare(userId, momentsRead.then((all) => all
    .filter((item) => item.bandIndex > startBand || (item.bandIndex === startBand && below(item.key, from?.mark ?? null)))
    .sort((a, b) => (a.bandIndex - b.bandIndex) || newerFirst(a, b))
    .slice(0, limit)));

  // One band's posts, from a cursor: today's Place list within the band's outer edge, beyond its inner one. The global
  // pins (Pantopus-wide notices) lead the first page, as on today's Place list, and never come again.
  let pinsLeft = firstPage;
  const readBand = (index, at, size) => {
    const withPins = pinsLeft && index === 0 && !at;
    if (index === 0) pinsLeft = false;
    return noted(feedService.getListFeed({
      userId, surface: 'place', latitude: place.latitude, longitude: place.longitude,
      radiusMeters: bands[index].outerM, minRadiusMeters: index === 0 ? null : bands[index].innerM,
      cursorCreatedAt: at?.createdAt || null, cursorId: at?.id || null, limit: size,
      scopeAccessRead, withReachedAt: true, globalPins: withPins, ...shape.posts,
    }));
  };
  // The band the page starts in is read first. If it can't fill the page, every band after it is read at once, side
  // by side, so a quiet place costs two reads in a row, not one per band.
  let ahead = null;
  const readAhead = (fromIndex) => {
    ahead = new Map();
    for (let index = fromIndex; index < bands.length; index++) {
      const read = readBand(index, null, limit);
      read.catch(() => {});
      ahead.set(index, read);
    }
  };

  // The first page reads the whole reach once, as today's Place list does. When that holds every post there is (a
  // quiet place), the page is cut from it: each post already says how far its shown point is. Only a busy place reads
  // band by band, every band at once, side by side.
  let whole = null;
  if (firstPage && shape.posts) {
    whole = await noted(feedService.getListFeed({
      userId, surface: 'place', latitude: place.latitude, longitude: place.longitude, radiusMeters: reachM,
      limit: WHOLE_READ, scopeAccessRead, withReachedAt: true, globalPins: true, ...shape.posts,
    }));
    pinsLeft = false;
    if (whole.pagination?.hasMore) {
      whole = null;
      pinsLeft = true;
      readAhead(0);
    }
  }
  const allMoments = await momentsRead;

  const items = [];
  let band = startBand;
  let posts = from?.posts ?? null;
  let mark = from?.mark ?? null;
  let next = null;
  if (whole) {
    const cut = cutWhole(whole, allMoments, bands, limit);
    items.push(...cut.items);
    next = cut.next;
    band = bands.length;
  }
  while (band < bands.length) {
    const room = limit - items.length;
    if (room <= 0) {
      next = { b: band, p: posts, m: mark };
      break;
    }
    const index = band;
    const readPosts = shape.posts && ((at, size) => {
      const early = !at && ahead?.get(index);
      if (early) {
        ahead.delete(index);
        return early;
      }
      return readBand(index, at, size);
    });
    const moments = allMoments.filter((item) => item.bandIndex === index).sort(newerFirst);
    const part = await partPage({ readPosts, moments, posts, mark, room });
    for (const item of part.items) items.push({ ...item, bandIndex: item.post?.is_global_pin ? null : index });
    if (!part.done) {
      next = { b: index, p: part.posts, m: part.mark };
      break;
    }
    band += 1;
    posts = null;
    mark = null;
    if (!ahead && shape.posts && band < bands.length && items.length < limit) readAhead(band);
  }
  if (chipsFromReads) {
    // The bands the page didn't need were read too (all at once, above): what they saw counts for the chips.
    if (ahead) await Promise.all([...ahead.values()].map((read) => read.catch(() => null)));
    chipsRead = chipsFromPage(chipContext, seen, complete);
  }
  const town = await townRead;
  const shownBands = bandsUpTo(miles, town);
  if (noPlace) {
    // Without a place (CONTRACT 11b): once every placed band is read, they follow as one more band, on the same page
    // when it has room. The cursor says so (`np`), so a next page asks for them alike.
    shownBands.push(NO_PLACE_BAND);
    if (next) {
      next = { ...next, np: 1 };
    } else if (items.length < limit) {
      const np = await noPlacePage(userId, { shape, filtered, chip, mark: null, room: limit - items.length });
      items.push(...np.items.map((item) => ({ ...item, bandIndex: shownBands.length - 1 })));
      next = np.more ? { z: 'np', m: np.mark, np: 1 } : null;
    } else {
      next = { z: 'np', m: null, np: 1 };
    }
  }
  return answer({
    userId, reach, miles, chip, chipsRead, readyRead, place: { label: town }, bands: shownBands, items, next, studioInBox, recentPasses,
    filters,
  });
}

// ─── The map's box (CONTRACT 11a) and without a place (11b) ────────────────

/** Whether a post is in the list's chip or passes its filters (the tests the list's own reads make; Heads-ups always). */
function postPasses(post, { shape, filtered, chip }) {
  if (!shape.posts) return false;
  if (filtered) return filtered.tests.post(post);
  return chip === 'all' || inChip(chip, post);
}

function inBox(point, box) {
  return point && point.latitude != null && point.longitude != null
    && point.latitude >= box.south && point.latitude <= box.north && point.longitude >= box.west && point.longitude <= box.east;
}

// Nearest the box's middle first, then newest first, then by id: the order of the box's items, and what its cursor names.
function nearerFirst(a, b) {
  if (a.key.d !== b.key.d) return a.key.d - b.key.d;
  return newerFirst(a, b);
}

function afterKey(key, mark) {
  if (!mark) return true;
  if (key.d !== mark.d) return key.d > mark.d;
  return below(key, mark);
}

/**
 * GET /list with the map's box (CONTRACT 11a): what the map shows in it, by the map's own reads (map.js: the Place map's
 * posts, cap and all; the Moments and kept Moments the reader may see whose shown point is in it), read once, side by
 * side; then the chip or filters, the order (nearest the middle first) and the page. Only the page's Moments are made ready.
 */
async function boxListFor(userId, { box, chip, filters, from, limit, noPlace, miles }) {
  const middle = { latitude: (box.south + box.north) / 2, longitude: (box.west + box.east) / 2 };
  const askMarks = { x: boxSignature(box), ...(noPlace ? { np: 1 } : {}) };
  const bands = noPlace ? [NO_PLACE_BAND] : [];
  const filteredRead = filters ? filteredShape(userId, filters, { placeRead: Promise.resolve(middle) }) : null;
  filteredRead?.catch(() => {});
  if (from?.stage === 'np') {
    const filtered = await filteredRead;
    const np = await noPlacePage(userId, { shape: filtered ? filtered.shape : CHIPS[chip], filtered, chip, mark: from.mark, room: limit });
    return answer({
      userId, reach: 'around', miles, chip, chipsRead: null, readyRead: null, place: null, bands,
      items: np.items.map((item) => ({ ...item, bandIndex: 0 })),
      next: np.more ? { z: 'np', m: np.mark, ...askMarks } : null, filters, endLine: BOX_END, extra: { count: null },
    });
  }
  // The page's Studio parts (stamps, playable items, dots) are read beside the box's posts, as the map reads its stamps.
  const studioInBox = postStudio.partsInBox(box);
  studioInBox.catch(() => {});
  // eslint-disable-next-line global-require
  const recentPasses = require('./passOn').recentPasses();
  recentPasses.catch(() => {});
  const distance = (point) => Math.round(haversineMeters(middle.latitude, middle.longitude, point.latitude, point.longitude) * 10) / 10;
  const momentsRead = withKept(store.shownInBox(userId, box), store.shownKept(userId, { box }));
  // The page's Moments are among the `limit` nearest Moments after the cursor: they are made ready as soon as the
  // Moments are read, beside the posts' read, not after it (the opening time, as 6a's prepare).
  const placedMomentsRead = Promise.all([momentsRead, filteredRead]).then(([moments, filtered]) => {
    const shape = filtered ? filtered.shape : CHIPS[chip];
    const placed = moments.filter((entry) => inBox(entry.point, box));
    const listed = (shape.moments ? keptByFilters(placed, filtered) : []).map((entry) => ({
      ...momentItem(entry), key: { d: distance(entry.point), at: micros(store.shownAt(entry.row)), id: entry.row.id },
    })).sort(nearerFirst);
    return { placed, listed };
  });
  const readyRead = prepare(userId, placedMomentsRead.then(({ listed }) => listed
    .filter((item) => afterKey(item.key, from?.key ?? null)).slice(0, limit)));
  const [posts, { placed: placedMoments, listed }, filtered] = await Promise.all([
    feedService.getMapFeed({ userId, surface: 'place', ...box, limit: MAP_CAP }),
    placedMomentsRead,
    filteredRead,
  ]);
  const shape = filtered ? filtered.shape : CHIPS[chip];
  const placedPosts = posts.filter((post) => inBox(post, box));
  const all = [
    ...placedPosts.filter((post) => postPasses(post, { shape, filtered, chip })).map((post) => ({
      type: 'post', key: { d: distance(post), at: micros(post.created_at), id: post.id }, post,
    })),
    ...listed,
  ].sort(nearerFirst);
  const left = all.filter((item) => afterKey(item.key, from?.key ?? null));
  const items = left.slice(0, limit).map((item) => ({ ...item, bandIndex: null }));
  let next = left.length > limit ? { z: 'box', k: items[items.length - 1].key, ...askMarks } : null;
  if (!next && noPlace) {
    if (items.length < limit) {
      const np = await noPlacePage(userId, { shape, filtered, chip, mark: null, room: limit - items.length });
      items.push(...np.items.map((item) => ({ ...item, bandIndex: 0 })));
      next = np.more ? { z: 'np', m: np.mark, ...askMarks } : null;
    } else {
      next = { z: 'np', m: null, ...askMarks };
    }
  }
  // The chips this box has (first page): from everything the map shows here, before the chip or filters.
  const firstPage = !from;
  const chipsRead = firstPage ? Promise.resolve([
    placedMoments.length ? 'live' : null,
    ...POST_CHIPS.filter((name) => placedPosts.some((post) => inChip(name, post))),
  ]) : null;
  return answer({
    userId, reach: 'around', miles, chip, chipsRead, readyRead, place: null, bands, items, next, studioInBox, recentPasses,
    filters, endLine: BOX_END,
    extra: { count: firstPage ? all.length : null, ...(firstPage && posts.length >= MAP_CAP ? { count_more: true } : {}) },
  });
}

/**
 * The reader's own and connections' posts and Moments without a place (CONTRACT 11b), newest first, from `mark`: the
 * Connections map's "posts with no place" (feedService.getUnplacedConnectionPosts) and those people's live and kept
 * Moments with no place the reader may see, at most MAX_NO_PLACE of each, with the list's chip or filters.
 */
async function noPlacePage(userId, { shape, filtered, chip, mark, room }) {
  const peopleRead = store.connectionIds(userId).then((ids) => [String(userId), ...ids.map(String)]);
  const [unplaced, moments] = await Promise.all([
    shape.posts ? feedService.getUnplacedConnectionPosts({ userId, limit: MAX_NO_PLACE }) : { posts: [] },
    shape.moments
      ? peopleRead.then((people) => withKept(store.shownOfPeople(userId, people), store.shownKept(userId, { people })))
      : [],
  ]);
  const all = [
    ...unplaced.posts.filter((post) => postPasses(post, { shape, filtered, chip })).map((post) => ({
      type: 'post', key: { at: micros(post.created_at), id: post.id }, post,
    })),
    ...keptByFilters(moments.filter((entry) => entry.point?.latitude == null || entry.point?.longitude == null), filtered).slice(0, MAX_NO_PLACE).map((entry) => momentItem(entry)),
  ].sort(newerFirst);
  const left = all.filter((item) => below(item.key, mark));
  const items = left.slice(0, room);
  return { items, more: left.length > room, mark: items.length ? items[items.length - 1].key : mark };
}

/**
 * Around me's first page from one read that held every post in reach (`whole`): every post and Moment by band, nearest
 * band first, newest first inside it (the global pins first of all), cut at `limit`. The cursor it leaves is the one
 * the band reads go on from: the band of the first item left out, and the last post and Moment taken in that band.
 */
function cutWhole(whole, moments, bands, limit) {
  const postItems = whole.posts.map((post) => {
    const reachedAt = whole.reachedAt?.get(post.id) || post.created_at;
    return {
      type: 'post',
      key: { at: post.is_global_pin ? Number.MAX_SAFE_INTEGER : micros(reachedAt), id: post.id },
      reachedAt,
      post,
      bandIndex: post.is_global_pin ? -1 : bandIndexOf(post.distance_meters, bands),
    };
  }).filter((item) => item.bandIndex != null);
  const all = [...postItems, ...moments].sort((a, b) => (a.bandIndex - b.bandIndex) || newerFirst(a, b));
  const taken = all.slice(0, limit);
  const items = taken.map((item) => ({ ...item, bandIndex: item.bandIndex === -1 ? null : item.bandIndex }));
  if (all.length <= limit) return { items, next: null };
  const band = Math.max(all[limit].bandIndex, 0);
  const inBand = taken.filter((item) => item.bandIndex === band);
  const lastPost = [...inBand].reverse().find((item) => item.type === 'post');
  const lastMoment = [...inBand].reverse().find((item) => item.type === 'moment');
  return {
    items,
    next: {
      b: band,
      p: lastPost ? { createdAt: lastPost.reachedAt, id: lastPost.post.id } : null,
      m: lastMoment ? lastMoment.key : null,
    },
  };
}

/** The Moments among `itemsRead` as GET /api/moments/:id answers them, by id (a failed read leaves them to answer()). */
function prepare(userId, itemsRead) {
  const read = itemsRead
    .then((items) => store.serializeMoments(items.map((item) => item.row), userId, { keptPosts: true }))
    .then((moments) => new Map(moments.map((moment) => [moment.id, moment])));
  read.catch(() => {});
  return read;
}

/** The page as the apps read it: Moments serialized as GET /api/moments/:id answers them, posts as the feed lists them. */
async function answer({
  userId, reach, miles, chip, chipsRead, readyRead, place, bands, items, next, studioInBox = null, recentPasses = null, filters = null,
  endLine = null, extra = null,
}) {
  const pagePosts = items.filter((item) => item.type === 'post').map((item) => item.post);
  // A post made in the Studio shows its stamps, its playable items and its dots here (CONTRACT 6d, 7b, 7c); a failed read
  // only leaves them off. Started as soon as the page's posts are known, beside the Moments still being made ready (the
  // opening time, LEAD-3 09:06).
  const studioRead = postStudio.readerParts(pagePosts, userId, { inBox: studioInBox, recentPasses })
    .catch(() => ({ stamps: new Map(), play: new Map(), dots: new Map(), mentions: new Map(), passes: new Map(), eyes: new Map() }));
  const ready = await (readyRead || Promise.resolve(new Map())).catch(() => new Map());
  const rows = items.filter((item) => item.type === 'moment' && !ready.has(item.row.id)).map((item) => item.row);
  const [moments, chips, studio] = await Promise.all([
    rows.length ? store.serializeMoments(rows, userId, { keptPosts: true }) : [],
    chipsRead || null,
    studioRead,
  ]);
  const { stamps, play, dots, mentions, passes, eyes } = studio;
  const byId = new Map([...ready, ...moments.map((moment) => [moment.id, moment])]);
  const bandKey = (index) => (index == null ? null : bands[index]?.band ?? null);
  const out = items.map((item) => {
    if (item.type === 'moment') {
      const moment = byId.get(item.row.id);
      if (!moment) return null;
      // A Moment its author kept as a post is drawn as a post that stays (CONTRACT 6d).
      return { type: 'moment', id: moment.id, band: bandKey(item.bandIndex), ...(moment.kept ? { kept: true } : {}), moment };
    }
    const { distance_meters: _distance, ...post } = item.post;
    const studioShown = stamps.has(post.id) ? { ...post, stamps: stamps.get(post.id), play: play.get(post.id) || [], dots: dots.get(post.id) || [], mentions: mentions?.get(post.id) || [] } : post;
    // Passing on (CONTRACT 8f): `passed` on an original, `passed_on` on a pass; only where there is one.
    const passed = passes?.has(post.id) ? { ...studioShown, ...passes.get(post.id) } : studioShown;
    // Eyes on (CONTRACT 8f): whether the Ask is open and how many answered.
    const shown = eyes?.has(post.id) ? { ...passed, ...eyes.get(post.id) } : passed;
    return { type: 'post', id: post.id, band: bandKey(item.bandIndex), post: shown };
  }).filter(Boolean);
  return {
    reach,
    miles,
    place,
    chips: chips ? chipsFromItems(chips) : null,
    bands: bands.map(({ band, label }) => ({ band, label })),
    items: out,
    next_cursor: next ? encodeCursor({ r: reach, mi: miles, c: chip, ...next, ...(filters ? { f: filtersOf.signature(filters) } : {}) }) : null,
    end: next ? null : (endLine || END_LINES[reach]),
    ...(extra || {}),
    ...filtersOf.echo(filters),
  };
}

// ─── Chips ─────────────────────────────────────────────────────────────────

const POST_CHIPS = CHIP_NAMES.filter((name) => CHIPS[name].posts && name !== 'all');

/** Whether a post belongs to a chip (the same tests its getListFeed options make). */
function inChip(name, post) {
  const { postTypes, keep } = CHIPS[name].posts;
  return (!postTypes || postTypes.includes(post.post_type)) && (!keep || keep(post));
}

/** Whether one read of a single post finds anything for the chip in this reach and place. */
async function chipProbe(name, { userId, reach, place = null, reachM = null, scopeAccessRead }) {
  try {
    const read = await feedService.getListFeed({
      userId,
      surface: reach === 'close' ? 'connections' : 'place',
      latitude: place?.latitude,
      longitude: place?.longitude,
      radiusMeters: reachM || undefined,
      limit: 1,
      scopeAccessRead,
      globalPins: false,
      ...CHIPS[name].posts,
    });
    return read.posts.length ? name : null;
  } catch {
    return null;
  }
}

/**
 * Which chips have something in this reach and place, `all` always. On a chip's own page every other chip is checked
 * with one small read, alongside the page (chipProbe); `live` says whether any Moment is there.
 */
function chipsFor(context) {
  return Promise.all([
    context.momentsRead.then((list) => (list.length ? 'live' : null), () => null),
    ...POST_CHIPS.map((name) => chipProbe(name, context)),
  ]);
}

/**
 * The chips of an All page from what the page itself read (`seen`: every post read, taken or not; `complete`: whether
 * those reads held everything there is). A chip seen needs no read; one not seen is checked only when the reads
 * stopped short, so a quiet place costs nothing more and a busy one reads only the chips its newest posts lack.
 */
async function chipsFromPage(context, seen, complete) {
  const found = POST_CHIPS.filter((name) => seen.some((post) => !post.is_global_pin && inChip(name, post)));
  const missing = complete ? [] : POST_CHIPS.filter((name) => !found.includes(name));
  const [live, ...probed] = await Promise.all([
    context.momentsRead.then((list) => (list.length ? 'live' : null), () => null),
    ...missing.map((name) => chipProbe(name, context)),
  ]);
  return [live, ...found, ...probed];
}

function chipsFromItems(found) {
  const have = new Set(found.filter(Boolean));
  return CHIP_NAMES.filter((name) => name === 'all' || have.has(name));
}

module.exports = {
  listFor, bandsUpTo, bandIndexOf, boxAround, readerPlace, CHIP_NAMES, CHIPS, REACHES, MAX_MILES, END_LINES,
};
