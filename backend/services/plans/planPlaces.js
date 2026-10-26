'use strict';

/**
 * Public places for the host's place picker (board H6): parks, playgrounds,
 * libraries, courts, trails, cafés, bars and restaurants near a point.
 *
 * Mapbox's geocoding no longer returns points of interest, so the places come
 * from OpenStreetMap: in the US from our own monthly index of it
 * (placesIndex.js), which answers a new area in about a second, and anywhere
 * the index can't answer, from the public Overpass API (free, no key). Those
 * servers are often busy: a new area can take 20 to 40 seconds, or fail. So:
 *   - The second server is asked too when the first hasn't answered in 15
 *     seconds; the first good answer wins. An answer Overpass cut short
 *     ("runtime error: timed out") counts as a failure, never as no places.
 *   - A server that fails is asked again after 3, 6, 12… seconds for up to
 *     100 seconds: overpass-api.de often answers 502 "at capacity" at once
 *     and then answers in full moments later.
 *   - Results are cached for 24 hours per area (a ~5 km geohash cell, padded
 *     so every point in the cell sees ~3 km around it) in PlaceSectionCache.
 *     A cached area answers at once, even when its day is up (it refreshes in
 *     the background).
 *   - An area seen for the first time waits up to 8 seconds, then answers
 *     `loading: true` while the fetch finishes, so the app can ask again.
 *   - The Plans tab and the host flow warm the host's areas (`warmAround`),
 *     so the places are usually ready before the picker opens.
 *   - An area whose fetch just failed answers "unavailable" at once for 90
 *     seconds instead of asking the servers again on every request, and is
 *     fetched again in the background a few times so its places are ready
 *     on the next look.
 * OSM's license asks for credit where the data shows: responses carry
 * `attribution`.
 *
 * With a plan's kind and time, each place also says whether it's open then
 * (placeHours.js) and a few facts that matter for that kind (lit courts,
 * Wi-Fi, restrooms), and the list puts the places that suit the plan first.
 */

const { DateTime } = require('luxon');
const logger = require('../../utils/logger');
const { encodeGeohash, decodeGeohashBbox } = require('../../utils/geohash');
const { timezoneFromCoordinates } = require('../../utils/timezone');
const placeSectionCache = require('../placeSectionCache');
const placesIndex = require('./placesIndex');
const rules = require('./planRules');
const { hoursDuring, sunMinutes } = require('./placeHours');

// Each request carries a box around the host's neighborhood, so only servers
// we'd be comfortable sending that to are listed here.
const OVERPASS_URLS = [
  process.env.OVERPASS_API_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
].filter(Boolean);
const QUERY_TIMEOUT_S = 50;
const FETCH_TIMEOUT_MS = 55000;
const HEDGE_AFTER_MS = 15000;
// How long one fetch keeps asking busy servers (the apps ask again for up to 150 seconds).
const ASK_BUDGET_MS = 100 * 1000;
const RETRY_PAUSE_MS = 3000;
// A query takes 25 to 40 seconds, so none starts with less time left than this.
const MIN_ASK_MS = 30 * 1000;
const FIRST_ANSWER_WAIT_MS = 8000;
const FAILURE_COOLDOWN_MS = 90 * 1000;
// An area whose fetch failed is fetched again in the background, after 90 s, 3, 6 and 12 minutes.
const MAX_REFILLS = 4;
const KNOWN_CELL_MS = 6 * 60 * 60 * 1000;
const MAX_KNOWN_CELLS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SECTION_ID = 'plans_places_osm_v1';
const CELL_PRECISION = 5;
const PAD_DEGREES = 0.03;
const SHOW_RADIUS_METERS = 3 * rules.MILE_METERS;
const MAX_RESULTS = 40;
const MAX_FACTS = 2;
const ATTRIBUTION = '© OpenStreetMap contributors';

const SPORT_NAMES = {
  pickleball: 'pickleball courts',
  tennis: 'tennis courts',
  basketball: 'basketball court',
  soccer: 'soccer field',
  volleyball: 'volleyball court',
  baseball: 'baseball field',
  softball: 'softball field',
  american_football: 'football field',
  multi: 'sports courts',
};
// What follows the park's name in an unnamed court's or playground's name, longest first.
const FACILITY_NAMES = [...new Set([...Object.values(SPORT_NAMES), 'courts', 'playground'])]
  .sort((a, b) => b.length - a.length);

// The places that suit each kind, best first (the apps' PlanPlaceFit uses the same lists).
const PREFERRED = {
  watch_party: ['bar', 'restaurant', 'cafe', 'community_center'],
  playdate: ['playground', 'park', 'library', 'community_center'],
  pickup_game: ['court', 'park', 'playground', 'community_center'],
  walk_coffee: ['trail', 'park', 'cafe'],
  study_group: ['library', 'cafe', 'community_center'],
};

// The facts worth a few words for each kind, in the order they're said.
const FACTS_FOR = {
  pickup_game: ['lit', 'covered', 'indoor', 'toilets', 'wheelchair'],
  watch_party: ['outdoor_seating', 'wheelchair', 'toilets', 'wifi'],
  walk_coffee: ['dogs', 'outdoor_seating', 'toilets', 'wheelchair'],
  study_group: ['wifi', 'outdoor_seating', 'wheelchair', 'toilets'],
  playdate: ['toilets', 'covered', 'wheelchair', 'fee'],
};
const FACTS_ANY = ['wheelchair', 'lit', 'wifi', 'outdoor_seating', 'toilets'];
const FACT_WORDS = {
  lit: (v) => (v === true ? 'Lit at night' : null),
  covered: (v) => (v === true ? 'Covered' : null),
  indoor: (v) => (v === true ? 'Indoors' : null),
  wifi: (v) => (v === true ? 'Wi-Fi' : null),
  outdoor_seating: (v) => (v === true ? 'Outdoor seating' : null),
  toilets: (v) => (v === true ? 'Restrooms' : null),
  wheelchair: (v) => ({ yes: 'Wheelchair accessible', limited: 'Partly wheelchair accessible' }[v] || null),
  dogs: (v) => ({ yes: 'Dogs welcome', leashed: 'Dogs on leash', no: 'No dogs' }[v] || null),
  fee: (v) => (v === true ? 'Entry fee' : null),
};

/**
 * Plain tag matches only (no regular expressions): the cheapest query for the
 * public servers. The elements are placesIndex.SELECTORS, as in the index.
 */
function overpassQuery({ south, west, north, east }) {
  const b = `${south},${west},${north},${east}`;
  const lines = placesIndex.SELECTORS.flatMap(([types, key, values]) => values.map((value) => [...types]
    .map((type) => `${type === 'n' ? 'node' : 'way'}["${key}"="${value}"](${b});`).join(' ')));
  return `[out:json][timeout:${QUERY_TIMEOUT_S}];
(
  ${lines.join('\n  ')}
);
out center tags 1500;`;
}

function categoryOf(tags) {
  if (tags.amenity === 'library') return 'library';
  if (tags.amenity === 'cafe' || tags.amenity === 'ice_cream') return 'cafe';
  if (tags.amenity === 'bar' || tags.amenity === 'pub') return 'bar';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.amenity === 'community_centre') return 'community_center';
  if (tags.leisure === 'playground') return 'playground';
  if (tags.leisure === 'pitch') return tags.sport ? 'court' : null;
  if (tags.highway) return /\btrail\b/i.test(tags.name || '') ? 'trail' : null;
  if (tags.leisure === 'park' && /\btrail\b/i.test(tags.name || '')) return 'trail';
  if (['park', 'dog_park', 'nature_reserve', 'garden'].includes(tags.leisure)) return 'park';
  return null;
}

function addressOf(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = tags['addr:city'];
  return [street, city].filter(Boolean).join(', ') || null;
}

function pointOf(element) {
  const lat = Number(element.center ? element.center.lat : element.lat);
  const lng = Number(element.center ? element.center.lon : element.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
}

const yesNo = (value) => {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return undefined;
};

/**
 * What a place's tags say that a host may care about: the opening_hours tag
 * as written, and a few yes/no facts. Every place gets a `traits` object (so
 * a row cached before these existed can be told apart and refreshed).
 */
function traitsOf(tags) {
  const internet = String(tags.internet_access || '');
  const traits = {
    lit: yesNo(tags.lit),
    covered: yesNo(tags.covered),
    indoor: yesNo(tags.indoor),
    wifi: ['wlan', 'yes', 'wifi'].includes(internet) ? true : yesNo(internet),
    outdoor_seating: yesNo(tags.outdoor_seating),
    toilets: yesNo(tags.toilets),
    wheelchair: ['yes', 'limited', 'no'].includes(tags.wheelchair) ? tags.wheelchair : undefined,
    dogs: ['yes', 'leashed', 'no'].includes(tags.dog) ? tags.dog : undefined,
    fee: yesNo(tags.fee),
  };
  for (const key of Object.keys(traits)) if (traits[key] === undefined) delete traits[key];
  const hours = typeof tags.opening_hours === 'string' ? tags.opening_hours.trim().slice(0, 255) : '';
  return { traits, opening_hours: hours || null };
}

/** OSM elements → places: named ones as they are; unnamed courts and playgrounds named after their park. */
function toPlaces(elements) {
  const parks = [];
  const raw = [];
  for (const element of elements || []) {
    const tags = element.tags || {};
    const category = categoryOf(tags);
    const point = pointOf(element);
    if (!category || !point) continue;
    const item = { id: `osm:${element.type}/${element.id}`, tags, category, point, name: (tags.name || '').trim() };
    if (category === 'park' && item.name) parks.push(item);
    raw.push(item);
  }
  const nearestPark = (point) => {
    let best = null;
    for (const park of parks) {
      const d = rules.distanceMeters(point, park.point);
      if (d <= 400 && (!best || d < best.d)) best = { park, d };
    }
    return best ? best.park : null;
  };

  const places = [];
  const merged = new Map();
  for (const item of raw) {
    let name = item.name;
    if (!name && (item.category === 'court' || item.category === 'playground')) {
      const park = nearestPark(item.point);
      if (!park) continue;
      const what = item.category === 'playground' ? 'playground' : (SPORT_NAMES[String(item.tags.sport).split(';')[0]] || 'courts');
      name = `${park.name} ${what}`;
    }
    if (!name) continue;
    // One row per name in a neighborhood: trail segments and side-by-side courts merge.
    const key = `${item.category}:${name.toLowerCase()}`;
    const existing = merged.get(key);
    if (existing && rules.distanceMeters(existing.point, item.point) < 1500) {
      // Side-by-side courts: the merged row plays every sport any of them is marked for.
      for (const sport of String(item.tags.sport || '').split(';').filter(Boolean)) {
        if (!existing.categories.includes(sport)) existing.categories.push(sport);
      }
      continue;
    }
    const place = {
      place_id: item.id,
      name,
      category: item.category,
      categories: [item.category, ...String(item.tags.sport || '').split(';').filter(Boolean)],
      address: addressOf(item.tags),
      point: item.point,
      ...traitsOf(item.tags),
    };
    merged.set(key, place);
    places.push(place);
  }
  return places;
}

/** One server's answer: its elements, or an error for anything short of a full answer. */
async function askOverpass(url, query, signal, timeoutMs = FETCH_TIMEOUT_MS) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Pantopus/1.0 (Nearby Plans place picker)' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.any([signal, AbortSignal.timeout(Math.max(1000, Math.min(FETCH_TIMEOUT_MS, timeoutMs)))]),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Overpass answered ${response.status}`);
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error('Overpass answered with an error page');
  }
  if (!Array.isArray(data.elements)) throw new Error('Overpass answered without elements');
  // A query that ran out of time or memory answers 200 with what it had so far (often nothing).
  if (typeof data.remark === 'string' && /runtime error|timed out|out of memory/i.test(data.remark)) {
    throw new Error(`Overpass cut the answer short: ${data.remark.slice(0, 120)}`);
  }
  return data.elements;
}

/**
 * The servers in turn, the next one starting when the one before fails or
 * hasn't answered within HEDGE_AFTER_MS. A server that fails is asked again
 * after a pause that doubles each time: a busy one answers 502 "at capacity"
 * at once and usually has room a few seconds later. The first full answer
 * wins and the others are stopped; with none in ASK_BUDGET_MS, the last error.
 */
function askServers(query) {
  return new Promise((resolve, reject) => {
    const stop = new AbortController();
    const deadline = Date.now() + ASK_BUDGET_MS;
    const timers = new Set();
    let started = 0;
    let pending = 0; // requests running or waiting for their pause
    let done = false;
    let lastError = null;
    const later = (fn, ms) => {
      const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms);
      timer.unref?.();
      timers.add(timer);
    };
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      stop.abort();
      fn(value);
    };
    const ask = (url, attempt) => {
      if (done) return;
      askOverpass(url, query, stop.signal, deadline - Date.now()).then(
        (elements) => finish(resolve, elements),
        (err) => {
          if (done) return;
          lastError = err;
          logger.warn('plans.places.overpass_failed', { host: new URL(url).host, attempt, error: err.message });
          if (attempt === 0) startNext();
          const pause = RETRY_PAUSE_MS * 2 ** attempt;
          if (Date.now() + pause + MIN_ASK_MS < deadline) {
            later(() => ask(url, attempt + 1), pause);
          } else {
            pending -= 1;
            if (pending === 0 && started >= OVERPASS_URLS.length) finish(reject, lastError);
          }
        },
      );
    };
    const startNext = () => {
      if (done || started >= OVERPASS_URLS.length) return;
      const url = OVERPASS_URLS[started];
      started += 1;
      pending += 1;
      later(startNext, HEDGE_AFTER_MS);
      ask(url, 0);
    };
    if (OVERPASS_URLS.length === 0) {
      reject(new Error('No Overpass server is set'));
      return;
    }
    later(() => finish(reject, lastError || new Error('Overpass gave no answer in time')), ASK_BUDGET_MS);
    startNext();
  });
}

/** The area's elements from our index, or from Overpass where the index can't answer just now. */
async function fetchCell(cell) {
  const cellBox = decodeGeohashBbox(cell);
  const box = {
    south: cellBox.minLat - PAD_DEGREES,
    north: cellBox.maxLat + PAD_DEGREES,
    west: cellBox.minLng - PAD_DEGREES,
    east: cellBox.maxLng + PAD_DEGREES,
  };
  let elements = null;
  try {
    elements = await placesIndex.elementsIn(box);
  } catch (err) {
    logger.warn('plans.places.index_failed', { cell, error: err.message });
  }
  if (!elements) elements = await askServers(overpassQuery(box));
  return toPlaces(elements).map((p) => ({ ...p, latitude: p.point.latitude, longitude: p.point.longitude, point: undefined }));
}

const inflight = new Map();
// Areas whose last fetch failed, until when they answer "unavailable" without asking again.
const failedUntil = new Map();
// Areas known to be cached or on their way, so warming them costs no database read.
const knownCells = new Map();
// Areas whose cached row predates the hours and facts, already sent for a refresh in this process.
const upgradedCells = new Set();
// Areas whose last fetch failed: how many background fetches they've had since.
const refills = new Map();

class PlacesUnavailableError extends Error {
  constructor() {
    super("Places nearby aren't loading right now");
    this.name = 'PlacesUnavailableError';
  }
}

const coolingDown = (cell) => (failedUntil.get(cell) || 0) > Date.now();

/**
 * One fetch per area at a time; the result is written to the cache. A failure
 * is logged here, once, and the area is fetched again later in the background,
 * so the next person to open the picker there finds its places.
 */
function refreshCell(cell) {
  if (inflight.has(cell)) return inflight.get(cell);
  const job = fetchCell(cell)
    .then(async (places) => {
      await placeSectionCache.writeRow(`geo:${cell}`, SECTION_ID, places, CACHE_TTL_MS, new Date().toISOString());
      failedUntil.delete(cell);
      refills.delete(cell);
      return places;
    }, (err) => {
      failedUntil.set(cell, Date.now() + FAILURE_COOLDOWN_MS);
      logger.warn('plans.places.fetch_failed', { cell, error: err.message });
      refillLater(cell);
      throw err;
    })
    .finally(() => inflight.delete(cell));
  inflight.set(cell, job);
  return job;
}

function refillLater(cell) {
  const done = refills.get(cell) || 0;
  if (done >= MAX_REFILLS || (!refills.has(cell) && refills.size >= MAX_KNOWN_CELLS)) {
    refills.delete(cell);
    return;
  }
  refills.set(cell, done + 1);
  const timer = setTimeout(() => refreshQuietly(cell), FAILURE_COOLDOWN_MS * 2 ** done + 1000);
  timer.unref?.();
}

/** Refresh in the background (an expired or older row keeps answering meanwhile). */
function refreshQuietly(cell) {
  if (coolingDown(cell)) return;
  refreshCell(cell).catch(() => {});
}

/**
 * Cached places for the area: at once when cached (fresh or not), else a short
 * wait for the first fetch (none with `waitMs: 0`). Throws
 * PlacesUnavailableError while a failed area cools down.
 */
async function areaPlaces(cell, { waitMs = FIRST_ANSWER_WAIT_MS } = {}) {
  const row = await placeSectionCache.readRow(`geo:${cell}`, SECTION_ID);
  if (row && Array.isArray(row.payload)) {
    if (Date.parse(row.expires_at) <= Date.now()) {
      refreshQuietly(cell);
    } else if (row.payload.length > 0 && !row.payload[0].traits && !upgradedCells.has(cell)) {
      // Cached before places carried their hours and facts: shown as they are, refreshed in the background.
      upgradedCells.add(cell);
      refreshQuietly(cell);
    }
    return { places: row.payload, loading: false };
  }
  if (!inflight.has(cell) && coolingDown(cell)) throw new PlacesUnavailableError();
  const job = refreshCell(cell);
  job.catch(() => {});
  if (waitMs <= 0) return { places: [], loading: true };
  const timeout = new Promise((resolve) => { setTimeout(() => resolve(null), waitMs).unref?.(); });
  let places;
  try {
    places = await Promise.race([job, timeout]);
  } catch (_) {
    throw new PlacesUnavailableError();
  }
  return places ? { places, loading: false } : { places: [], loading: true };
}

/**
 * Start gathering the places around these points without waiting (the host's
 * homes and fresh fix, when the Plans tab or the host flow opens), so the
 * picker usually opens on a full list. Never throws.
 */
function warmAround(points) {
  const now = Date.now();
  if (knownCells.size > MAX_KNOWN_CELLS) knownCells.clear();
  for (const point of points || []) {
    const latitude = Number(point?.latitude);
    const longitude = Number(point?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const cell = encodeGeohash(latitude, longitude, CELL_PRECISION);
    if ((knownCells.get(cell) || 0) > now || inflight.has(cell) || coolingDown(cell)) continue;
    knownCells.set(cell, now + KNOWN_CELL_MS);
    areaPlaces(cell, { waitMs: 0 }).catch(() => {});
  }
}

// ─── One request's view of the places ──────────────────────────────────────

/** The plan's time as instants, or null when it isn't given or makes no sense. */
function planWindow(startsAt, endsAt) {
  const start = startsAt ? new Date(startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  let end = endsAt ? new Date(endsAt) : null;
  if (!end || Number.isNaN(end.getTime()) || end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);
  // Plans are hosted up to a few weeks out; anything stranger isn't worth reading hours for.
  if (Math.abs(start.getTime() - Date.now()) > 60 * 24 * 60 * 60 * 1000) return null;
  return { start, end };
}

/** True when the plan ends after dark at this point (an unlit court then needs a word). */
function endsAfterDark(point, window, timezone) {
  const end = DateTime.fromJSDate(window.end, { zone: timezone });
  const sun = sunMinutes(end.startOf('day'), point.latitude, point.longitude);
  if (sun.sunset == null) return false;
  return end.diff(end.startOf('day'), 'minutes').minutes > sun.sunset;
}

/** The few facts worth showing for the kind, and a caution when the plan needs what the place lacks. */
function factsFor(place, kind, window, timezone) {
  const traits = place.traits || {};
  const facts = [];
  for (const key of FACTS_FOR[kind] || FACTS_ANY) {
    const words = FACT_WORDS[key](traits[key]);
    // "No dogs" only matters on a walk.
    if (words && !(words === 'No dogs' && kind !== 'walk_coffee')) facts.push(words);
  }
  let caution = null;
  if (kind === 'pickup_game' && place.category === 'court' && traits.lit === false && window
    && endsAfterDark(place, window, timezone)) {
    caution = 'Not lit after dark';
  }
  return { facts: facts.slice(0, MAX_FACTS), caution };
}

/** The line under the place's name: hours first when they need a look, then the facts. */
function detailOf(hours, facts, caution) {
  const warning = Boolean(caution) || Boolean(hours && hours.status !== 'open');
  const parts = [caution, hours && hours.text].filter(Boolean);
  // Hours that need a look stand alone; open hours share the line with a fact or two.
  if (!warning) parts.push(...facts);
  const text = parts.slice(0, 3).join(' · ');
  return text ? { text, tone: warning ? 'warning' : 'neutral' } : null;
}

/**
 * How well a place suits the plan: open ones before ones that close early or
 * open late, closed ones last; then the kind's own places (a pickup game's
 * courts for its sport first); then nearest.
 */
function fitOrder(kind, sport) {
  const preferred = PREFERRED[kind] || [];
  const categoryRank = (place) => {
    if (kind === 'pickup_game' && sport && place.category === 'court'
      && (place.categories || []).some((c) => c === sport || c === 'multi')) return -1;
    const at = preferred.indexOf(place.category);
    return at >= 0 ? at : preferred.length;
  };
  const hoursRank = (place) => {
    const status = place.hours?.status;
    if (status === 'closed') return 2;
    if (status === 'closes_early' || status === 'opens_late') return 1;
    return 0;
  };
  return (a, b) => (hoursRank(a) - hoursRank(b))
    || (categoryRank(a) - categoryRank(b))
    || (a.distance_m - b.distance_m);
}

/**
 * Places near a point within about 3 miles: nearest first, or with a kind,
 * the ones that suit the plan first.
 *
 * @param {object} opts
 * @param {number} opts.latitude
 * @param {number} opts.longitude
 * @param {string} [opts.q]         Filters by name or category.
 * @param {string} [opts.kind]      The plan's kind: orders by fit, picks the facts, never a bar for a playdate.
 * @param {string} [opts.sport]     A pickup game's sport: its courts first.
 * @param {string} [opts.startsAt]  The plan's start (ISO): each place says whether it's open then.
 * @param {string} [opts.endsAt]
 * @param {number} [opts.waitMs]    How long a new area may wait for its first fetch (0: don't wait).
 * @param {number} [opts.limit]
 * @returns {Promise<{ places: object[], loading: boolean, attribution: string }>}
 * @throws {PlacesUnavailableError} while the area's last fetch just failed.
 */
async function placesNear({
  latitude, longitude, q = '', kind = null, sport = null, startsAt = null, endsAt = null,
  waitMs = FIRST_ANSWER_WAIT_MS, limit = MAX_RESULTS,
}) {
  const cell = encodeGeohash(latitude, longitude, CELL_PRECISION);
  knownCells.set(cell, Date.now() + KNOWN_CELL_MS);
  const { places: payload, loading } = await areaPlaces(cell, { waitMs });
  const origin = { latitude, longitude };
  const needle = String(q || '').trim().toLowerCase();
  const fitKind = PREFERRED[kind] ? kind : null;
  const window = planWindow(startsAt, endsAt);
  const timezone = timezoneFromCoordinates(latitude, longitude, 'America/Los_Angeles');
  const places = (payload || [])
    .map((p) => ({ ...p, distance_m: Math.round(rules.distanceMeters(origin, p)) }))
    .filter((p) => p.distance_m <= SHOW_RADIUS_METERS)
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.category.includes(needle))
    .filter((p) => fitKind !== 'playdate' || p.category !== 'bar')
    .map((p) => {
      const hours = window && p.opening_hours
        ? hoursDuring(p.opening_hours, { startsAt: window.start, endsAt: window.end, timezone, latitude: p.latitude, longitude: p.longitude })
        : null;
      const { facts, caution } = factsFor(p, fitKind, window, timezone);
      return { ...p, hours, facts, detail: detailOf(hours, facts, caution) };
    })
    .sort(fitKind ? fitOrder(fitKind, sport) : (a, b) => a.distance_m - b.distance_m)
    .slice(0, limit)
    .map(({
      place_id, name, category, categories, address, latitude: lat, longitude: lng, distance_m, hours, facts, detail,
    }) => ({
      place_id, name, category, categories, address, latitude: lat, longitude: lng, distance_m, hours, facts, detail,
    }));
  return { places, loading, attribution: ATTRIBUTION };
}

/** The park a court or playground is named after ("Crown Park pickleball courts" → "Crown Park"), or null. */
function parkNameOf(name) {
  const text = String(name || '').trim();
  const what = FACILITY_NAMES.find((facility) => text.toLowerCase().endsWith(` ${facility}`));
  const park = what ? text.slice(0, -(what.length + 1)).trim() : '';
  // One word ("Community playground") describes the place rather than naming a park.
  return park.includes(' ') ? park : null;
}

module.exports = {
  placesNear, warmAround, toPlaces, parkNameOf, PlacesUnavailableError, ATTRIBUTION, PREFERRED,
};
