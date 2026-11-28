'use strict';

// Pulse, reinvented, phase 3: "Your day" at 8 pm and "Tonight in <town>" (coord CONTRACT 8k; board B12). No new table.
// Your day: no GPS trail ever leaves the phone; the approved day is the Moments the person posts with `your_day`, and its
// line runs through their own shown points. Tonight in <town>: a read of
// the town's Moments of that day shared with people nearby, only where a town has enough. Nothing is pushed.

const { DateTime } = require('luxon');
const supabaseAdmin = require('../../config/supabaseAdmin');
const penName = require('../penName');
const { timezoneFromCoordinates } = require('../../utils/timezone');

const FILM_MIN = 8;
const FILM_PEOPLE = 4;
// Where the town's own zone can't be told from its point (the pilot is in the Pacific zone).
const ZONE = 'America/Los_Angeles';
const NEAR = [-1, 0, 1];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// eslint-disable-next-line global-require
const momentStore = () => require('../moments/momentStore');

function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

/**
 * What a posted Moment keeps (`your_day` sent): { your_day: { v, id?, date }, kept_post_at }. No GPS trail ever leaves the
 * phone (LEAD-3 07:43): the day's line is drawn later through the approved Moments' own shown points.
 */
function keptPart(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || !DATE.test(String(value.date || ''))) throw fail(400, 'YOUR_DAY_INVALID', 'Send your_day with its date (YYYY-MM-DD).');
  const id = UUID.test(String(value.id || '')) ? String(value.id).toLowerCase() : null;
  return { your_day: { v: 1, date: value.date, ...(id ? { id } : {}) }, kept_post_at: new Date().toISOString() };
}

async function visible(rows, viewerId) {
  const store = momentStore();
  const standing = rows.filter((row) => !row.archived_at && row.moderation_state === 'live');
  if (!standing.length) return [];
  const [ctx, reported] = await Promise.all([store.viewerContext(viewerId, standing.map((r) => r.user_id), null, standing), store.reportedIds(viewerId)]);
  // Listed only as lists show it (listedFor): never another's live guess spot or unopened relic (CONTRACT 5b, 8g).
  return standing.filter((row) => store.isOwn(row, viewerId)
    || (store.canSee(row, ctx) && store.listedFor(row, viewerId) && !reported.has(row.id)));
}

/**
 * GET /your-day/:user/:date — that person's approved day as the reader may see it: its Moments in time order, and the
 * line through their own shown points (a Moment at home is in the day but not on the line). Nothing finer than each
 * Moment already shows.
 */
async function view(userId, date, viewerId) {
  const store = momentStore();
  if (!UUID.test(String(userId || '')) || !DATE.test(String(date || ''))) throw fail(404, 'YOUR_DAY_NOT_FOUND', 'This day could not be found.');
  const { data, error } = await supabaseAdmin.from('Post').select(store.MOMENT_SELECT).eq('is_story', true).eq('user_id', userId)
    .eq('post_metadata->moment->your_day->>date', date).order('created_at', { ascending: true }).limit(100);
  if (error) throw new Error(`Failed to load the day: ${error.message}`);
  const shown = await visible((data || []).filter((r) => !penName.isPenNameRow(r)), viewerId);
  if (!shown.length) throw fail(404, 'YOUR_DAY_NOT_FOUND', 'This day could not be found.');
  const moments = await store.serializeMoments(shown, viewerId, { keptPosts: true });
  // The line takes each point from the answer this reader gets, so a spot the answer hides (a live guess-the-spot
  // Moment, a sealed one) is never on it either.
  const atHome = new Set(shown.filter((r) => store.meta(r).at_home).map((r) => r.id));
  const line = moments.filter((m) => m && !atHome.has(m.id) && m.latitude != null && m.longitude != null)
    .map((m) => ({ latitude: m.latitude, longitude: m.longitude, at: m.created_at }));
  return { day: { date, line, moments } };
}

/** POST /town-film — { latitude, longitude } in the body, never kept: tonight's film of the town, or null. */
async function townFilm(viewerId, body, now = Date.now()) {
  const store = momentStore();
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);
  if (body?.latitude == null || body?.longitude == null || !(Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180)) {
    throw fail(400, 'TOWN_FILM_INVALID', 'Send where you are as latitude and longitude.');
  }
  // 8 pm to 4 am, and "that day", in the town's own time zone (CONTRACT 8k), not the server's.
  const local = DateTime.fromMillis(now, { zone: timezoneFromCoordinates(latitude, longitude, ZONE) });
  if (local.hour < 20 && local.hour >= 4) return { film: null };
  const day = local.hour < 4 ? local.minus({ days: 1 }).startOf('day') : local.startOf('day');
  const cell = (v) => Math.floor(v * 10);
  const [lo, hi] = [Math.min(...NEAR), Math.max(...NEAR)];
  const { data, error } = await supabaseAdmin.from('Post').select(store.MOMENT_SELECT).eq('is_story', true).eq('audience', 'nearby')
    .gte('created_at', day.toUTC().toISO()).lt('created_at', day.plus({ days: 1 }).toUTC().toISO())
    .gte('latitude', (cell(latitude) + lo) / 10).lt('latitude', (cell(latitude) + hi + 1) / 10)
    .gte('longitude', (cell(longitude) + lo) / 10).lt('longitude', (cell(longitude) + hi + 1) / 10)
    .is('archived_at', null).eq('moderation_state', 'live').order('created_at', { ascending: true }).limit(500);
  if (error) throw new Error(`Failed to load the town's day: ${error.message}`);
  const sealedOrGuess = (row) => {
    const m = store.meta(row);
    // eslint-disable-next-line global-require
    return (m.seal && require('./seal').isSealed(row)) || (require('../moments/momentGuess').isGuess(row) && !store.hasEnded(row));
  };
  // Only Moments still live, or kept as posts by their authors: an ended Moment stays ended (LEAD-3 07:43).
  const candidates = (data || []).filter((row) => !penName.isPenNameRow(row) && !store.meta(row).at_home && !sealedOrGuess(row)
    && ['photo', 'video'].includes(store.meta(row).kind)
    && (store.momentState(row, now) === 'live' || Boolean(store.meta(row).kept_post_at)));
  const authors = [...new Set(candidates.map((r) => String(r.user_id)))];
  const on = new Set((await Promise.all(authors.map(async (id) => ((await store.reinventedOn(id)) ? id : null)))).filter(Boolean));
  const rows = await visible(candidates.filter((r) => on.has(String(r.user_id))), viewerId);
  const people = new Set(rows.map((r) => String(r.user_id)));
  if (rows.length < FILM_MIN || people.size < FILM_PEOPLE) return { film: null };
  // eslint-disable-next-line global-require
  const town = await require('../moments/momentPlace').townAt(latitude, longitude).catch(() => null);
  return {
    film: {
      town: town || null, date: day.toISODate(), count: rows.length, people: people.size,
      moments: await store.serializeMoments(rows, viewerId, { keptPosts: true, keptEnded: false }),
    },
  };
}

module.exports = { keptPart, view, townFilm };
