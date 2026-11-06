'use strict';

/**
 * Venues for the post place-tag picker (GET /api/geo/places/nearby and
 * /places/search): the named restaurants, cafés, bars, schools, places of
 * worship, parks, stadiums, theaters and other venues, museums, shops, hotels
 * and stations around the photo's capture point or the device. Mapbox's
 * geocoding no longer returns points of interest, so like the Plans picker
 * (plans/planPlaces.js) they come from OpenStreetMap:
 *   - in the US from our own monthly venues index (placesIndexFormat VENUES,
 *     built and published beside the Plans index), which answers in about a
 *     second;
 *   - anywhere the index can't answer (abroad, not published yet, a stretch
 *     with no venues) from the public Overpass servers, asked through
 *     planPlaces' client (hedged, retried) and cached for a day per small area.
 *     A new area waits a few seconds, then answers `loading: true` while the
 *     fetch finishes, so the app can ask again.
 *
 * Nearest first, except that a venue whose outline holds the point (the
 * stadium the photo was taken in) comes first, ahead of everything but the
 * places right beside the point; a bigger outline (a campus, a large park)
 * counts for less. The list widens from 400 m to 1.5 km to 6 km until it has
 * enough rows, for sparse and rural areas. Every row carries a category label
 * ("Barbecue restaurant", "Church") and an icon key the apps draw.
 *
 * The data is © OpenStreetMap contributors under the ODbL; responses carry
 * `attribution` and the picker shows it.
 */

const logger = require('../../utils/logger');
const { encodeGeohash, decodeGeohashBbox } = require('../../utils/geohash');
const placeSectionCache = require('../placeSectionCache');
const { createIndexReader, RELEASE_URL } = require('../plans/placesIndex');
const { VENUES } = require('../plans/placesIndexFormat');
const { askServers, ATTRIBUTION } = require('../plans/planPlaces');

const USER_AGENT = 'Pantopus/1.0 (post place-tag picker)';
const LOG_PREFIX = 'geo.venues';

// An empty VENUES_INDEX_URL turns the index off (every area asks Overpass).
const venuesIndex = createIndexReader({
  manifestUrl: process.env.VENUES_INDEX_URL ?? `${RELEASE_URL}/venues-manifest.json`,
  precision: VENUES.PRECISION,
  set: { name: VENUES.NAME, version: VENUES.VERSION },
  logPrefix: LOG_PREFIX,
  userAgent: USER_AGENT,
  keptAreas: 64,
  maxCellElements: 6000,
  sampleDegrees: 0.02,
});

// The list widens through these radii until it has ENOUGH rows.
const RADII_M = [400, 1500, 6000];
const ENOUGH = 8;
const NEARBY_LIMIT = 30;
const SEARCH_LIMIT = 8;
const SEARCH_RADIUS_M = 5000;
const FIRST_ANSWER_WAIT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 60 * 1000;
const SECTION_ID = 'geo_venues_osm_v1';
// Overpass answers are cached per geohash-7 cell (~150 m), asked around the cell's middle.
const CELL_PRECISION = 7;
const CELL_REACH_M = 110;
const METERS_PER_DEGREE = 111320;
// Same name and kind this close together is one venue drawn twice (a building and a point on it).
const SAME_VENUE_M = 80;

// ─── What a venue is ────────────────────────────────────────────────────────

// [icon, label] per tag value. The apps draw the icon (an unknown one as a pin).
const AMENITY = {
  restaurant: ['restaurant', 'Restaurant'],
  fast_food: ['restaurant', 'Fast food'],
  food_court: ['restaurant', 'Food court'],
  cafe: ['cafe', 'Café'],
  ice_cream: ['cafe', 'Ice cream'],
  bar: ['bar', 'Bar'],
  pub: ['bar', 'Pub'],
  biergarten: ['bar', 'Beer garden'],
  nightclub: ['bar', 'Nightclub'],
  theatre: ['venue', 'Theater'],
  cinema: ['venue', 'Movie theater'],
  arts_centre: ['arts', 'Arts center'],
  events_venue: ['venue', 'Event venue'],
  conference_centre: ['venue', 'Conference center'],
  exhibition_centre: ['venue', 'Exhibition center'],
  music_venue: ['venue', 'Music venue'],
  casino: ['venue', 'Casino'],
  planetarium: ['museum', 'Planetarium'],
  community_centre: ['community', 'Community center'],
  library: ['library', 'Library'],
  townhall: ['government', 'City hall'],
  courthouse: ['government', 'Courthouse'],
  marketplace: ['shop', 'Market'],
  school: ['school', 'School'],
  college: ['school', 'College'],
  university: ['school', 'University'],
  kindergarten: ['school', 'Preschool'],
  place_of_worship: ['worship', 'Place of worship'],
  hospital: ['health', 'Hospital'],
  clinic: ['health', 'Clinic'],
  doctors: ['health', "Doctor's office"],
  dentist: ['health', 'Dentist'],
  pharmacy: ['health', 'Pharmacy'],
  veterinary: ['pet', 'Veterinarian'],
  bus_station: ['transit', 'Bus station'],
  ferry_terminal: ['transit', 'Ferry terminal'],
};
const LEISURE = {
  park: ['park', 'Park'],
  garden: ['park', 'Garden'],
  nature_reserve: ['park', 'Nature reserve'],
  dog_park: ['park', 'Dog park'],
  playground: ['park', 'Playground'],
  marina: ['park', 'Marina'],
  stadium: ['stadium', 'Stadium'],
  sports_centre: ['sports', 'Sports center'],
  fitness_centre: ['sports', 'Gym'],
  golf_course: ['sports', 'Golf course'],
  ice_rink: ['sports', 'Ice rink'],
  water_park: ['venue', 'Water park'],
  bowling_alley: ['venue', 'Bowling alley'],
  amusement_arcade: ['venue', 'Arcade'],
  miniature_golf: ['venue', 'Mini golf'],
};
const TOURISM = {
  museum: ['museum', 'Museum'],
  attraction: ['attraction', 'Attraction'],
  viewpoint: ['attraction', 'Viewpoint'],
  zoo: ['zoo', 'Zoo'],
  aquarium: ['zoo', 'Aquarium'],
  theme_park: ['venue', 'Theme park'],
  gallery: ['arts', 'Art gallery'],
  hotel: ['hotel', 'Hotel'],
  motel: ['hotel', 'Motel'],
  hostel: ['hotel', 'Hostel'],
  camp_site: ['park', 'Campground'],
};
const OTHER = {
  craft: { brewery: ['bar', 'Brewery'], winery: ['bar', 'Winery'], distillery: ['bar', 'Distillery'] },
  railway: { station: ['transit', 'Train station'] },
  aeroway: { aerodrome: ['airport', 'Airport'] },
  place: { square: ['attraction', 'Square'] },
  natural: { beach: ['water', 'Beach'], peak: ['park', 'Peak'] },
  waterway: { waterfall: ['water', 'Waterfall'] },
};
const SHOP_LABELS = {
  supermarket: 'Grocery store',
  convenience: 'Convenience store',
  mall: 'Shopping mall',
  department_store: 'Department store',
  bakery: 'Bakery',
  pastry: 'Pastry shop',
  confectionery: 'Candy store',
  deli: 'Deli',
  butcher: 'Butcher',
  seafood: 'Seafood market',
  greengrocer: 'Produce market',
  farm: 'Farm stand',
  alcohol: 'Liquor store',
  wine: 'Wine shop',
  coffee: 'Coffee shop',
  tea: 'Tea shop',
  clothes: 'Clothing store',
  shoes: 'Shoe store',
  jewelry: 'Jewelry store',
  books: 'Bookstore',
  gift: 'Gift shop',
  toys: 'Toy store',
  sports: 'Sporting goods store',
  outdoor: 'Outdoor store',
  bicycle: 'Bike shop',
  electronics: 'Electronics store',
  mobile_phone: 'Phone store',
  computer: 'Computer store',
  furniture: 'Furniture store',
  hardware: 'Hardware store',
  doityourself: 'Home improvement store',
  garden_centre: 'Garden center',
  florist: 'Florist',
  pet: 'Pet store',
  hairdresser: 'Hair salon',
  beauty: 'Beauty salon',
  massage: 'Massage',
  tattoo: 'Tattoo studio',
  optician: 'Optician',
  chemist: 'Drugstore',
  cosmetics: 'Beauty supply',
  laundry: 'Laundromat',
  dry_cleaning: 'Dry cleaner',
  car: 'Car dealer',
  car_repair: 'Auto repair',
  tyres: 'Tire shop',
  second_hand: 'Thrift store',
  charity: 'Thrift store',
  variety_store: 'Variety store',
  music: 'Music store',
  musical_instrument: 'Music store',
  art: 'Art store',
  craft: 'Craft store',
  cannabis: 'Dispensary',
};
const RELIGION_LABELS = {
  christian: 'Church',
  muslim: 'Mosque',
  jewish: 'Synagogue',
  buddhist: 'Buddhist temple',
  hindu: 'Hindu temple',
  sikh: 'Gurdwara',
  jain: 'Jain temple',
};
const STADIUM_LABELS = {
  baseball: 'Baseball stadium',
  soccer: 'Soccer stadium',
  american_football: 'Football stadium',
  basketball: 'Arena',
  ice_hockey: 'Arena',
  athletics: 'Track stadium',
  motor: 'Raceway',
};

/** "coffee_shop" → "Coffee shop". */
function words(value) {
  const text = String(value || '').split(';')[0].trim().replace(/_/g, ' ');
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

/** A restaurant's label from its first cuisine ("Barbecue restaurant"), or plain "Restaurant". */
function restaurantLabel(cuisine) {
  const kind = words(cuisine);
  if (!kind || /\b(shop|restaurant|food|regional)\b/i.test(kind)) return 'Restaurant';
  return `${kind} restaurant`;
}

/** { icon, label } for a venue's tags, or null when it isn't one the picker lists. */
function categoryOf(tags) {
  const { amenity, leisure, tourism, shop } = tags;
  if (amenity && AMENITY[amenity]) {
    const [icon, label] = AMENITY[amenity];
    if (amenity === 'restaurant') return { icon, label: restaurantLabel(tags.cuisine) };
    if (amenity === 'place_of_worship') return { icon, label: RELIGION_LABELS[tags.religion] || label };
    return { icon, label };
  }
  if (tourism && TOURISM[tourism]) {
    const [icon, label] = TOURISM[tourism];
    return { icon, label };
  }
  if (leisure && LEISURE[leisure]) {
    const [icon, label] = LEISURE[leisure];
    if (leisure === 'stadium') return { icon, label: STADIUM_LABELS[String(tags.sport || '').split(';')[0]] || label };
    return { icon, label };
  }
  if (shop && !['no', 'vacant', 'disused'].includes(shop)) {
    const known = SHOP_LABELS[shop];
    if (known) return { icon: 'shop', label: known };
    const kind = words(shop);
    return { icon: 'shop', label: !kind || shop === 'yes' ? 'Shop' : `${kind} shop` };
  }
  for (const [key, values] of Object.entries(OTHER)) {
    const found = values[tags[key]];
    if (found) return { icon: found[0], label: found[1] };
  }
  return null;
}

/** "1213 U St NW" and "1213 U St NW, Washington, DC", from the address tags. */
function addressOf(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const full = [street, tags['addr:city'], tags['addr:state']].filter(Boolean).join(', ');
  return { address: street || tags['addr:city'] || null, fullAddress: full || null };
}

/**
 * OSM elements (the index's or Overpass's) → venue records, independent of
 * where they're looked at from: what's cached, and what nearby and search rank.
 */
function toRecords(elements) {
  const records = [];
  for (const element of elements || []) {
    const tags = element.tags || {};
    const name = typeof tags.name === 'string' ? tags.name.trim() : '';
    if (!name) continue;
    const category = categoryOf(tags);
    if (!category) continue;
    // The index stores an outline's middle and half its box; Overpass answers the box (`out bb`), whose
    // middle is what its `out center` would give.
    const { bounds } = element;
    const lat = Number(bounds ? (bounds.minlat + bounds.maxlat) / 2 : element.lat);
    const lng = Number(bounds ? (bounds.minlon + bounds.maxlon) / 2 : element.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const halfLat = bounds ? Math.abs(bounds.maxlat - bounds.minlat) / 2 : Number(element.halfLat) || 0;
    const halfLng = bounds ? Math.abs(bounds.maxlon - bounds.minlon) / 2 : Number(element.halfLng) || 0;
    const { address, fullAddress } = addressOf(tags);
    records.push({
      id: `osm:${element.type}/${element.id}`,
      name,
      icon: category.icon,
      label: category.label,
      lat,
      lng,
      halfLat: Number.isFinite(halfLat) ? halfLat : 0,
      halfLng: Number.isFinite(halfLng) ? halfLng : 0,
      address,
      fullAddress,
    });
  }
  return records;
}

// ─── Where a venue is from the point ────────────────────────────────────────

function metersBetween(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * A record seen from the point: how far away it is (to its outline's box for
 * an area, 0 inside it), whether the point is inside, and its rank: the
 * distance, or for an outline holding the point a few metres more the bigger
 * the outline, so the place right beside the point still comes first.
 */
function seenFrom(record, latitude, longitude) {
  const hasOutline = record.halfLat > 0 || record.halfLng > 0;
  if (!hasOutline) {
    const distance = metersBetween(latitude, longitude, record.lat, record.lng);
    return { distance, contains: false, rank: distance };
  }
  const nearestLat = Math.min(Math.max(latitude, record.lat - record.halfLat), record.lat + record.halfLat);
  const nearestLng = Math.min(Math.max(longitude, record.lng - record.halfLng), record.lng + record.halfLng);
  const distance = metersBetween(latitude, longitude, nearestLat, nearestLng);
  if (distance > 0) return { distance, contains: false, rank: distance };
  // Inside: a building ranks as if a few metres away, a stadium ~20 m, a campus ~50 m, a big park ~130 m.
  const heightM = 2 * record.halfLat * METERS_PER_DEGREE;
  const widthM = 2 * record.halfLng * METERS_PER_DEGREE * Math.cos((record.lat * Math.PI) / 180);
  return { distance: 0, contains: true, rank: 5 + Math.sqrt(Math.max(0, heightM * widthM)) / 20 };
}

// "Ben's Café" → "bens cafe": accents and apostrophes dropped, other punctuation a space.
const normalized = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/['\u2019`]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

/**
 * Records within `maxDistance` of the point, seen from it, one row per venue
 * (a building and a point on it drawn twice count once), best first.
 */
function ranked(records, latitude, longitude, maxDistance = Infinity) {
  const rows = [];
  for (const record of records) {
    const seen = seenFrom(record, latitude, longitude);
    if (seen.distance <= maxDistance) rows.push({ record, ...seen });
  }
  rows.sort((a, b) => a.rank - b.rank);
  const kept = [];
  const byName = new Map();
  for (const row of rows) {
    const key = `${row.record.icon}:${normalized(row.record.name)}`;
    const twins = byName.get(key) || [];
    const twin = twins.find((other) => metersBetween(other.record.lat, other.record.lng, row.record.lat,
      row.record.lng) < SAME_VENUE_M);
    if (twin) {
      if (!twin.record.address && row.record.address) {
        twin.record = { ...twin.record, address: row.record.address, fullAddress: row.record.fullAddress };
      }
      continue;
    }
    twins.push(row);
    byName.set(key, twins);
    kept.push(row);
  }
  return kept;
}

/** A row in the shape the apps read (GeoPlace), the same as the Mapbox rows. */
function toPlace({ record, distance, contains }) {
  return {
    place_id: record.id,
    name: record.name,
    category: record.label,
    icon: record.icon,
    address: record.address,
    full_address: record.fullAddress,
    center: { lat: record.lat, lng: record.lng },
    kind: 'poi',
    distance_m: Math.round(distance),
    ...(contains ? { contains: true } : {}),
  };
}

// ─── Where the venues come from ─────────────────────────────────────────────

function boxAround(latitude, longitude, radiusM) {
  const dLat = radiusM / METERS_PER_DEGREE;
  const dLng = radiusM / (METERS_PER_DEGREE * Math.max(0.01, Math.cos((latitude * Math.PI) / 180)));
  return { south: latitude - dLat, north: latitude + dLat, west: longitude - dLng, east: longitude + dLng };
}

/**
 * The named elements around the point, then the venues among them by plain
 * tag matches (no regular expressions: the cheapest query for the public
 * servers), plus the venue outlines that hold the point even when their edge
 * is farther than the radius (a stadium, a campus, a big park). `out bb` gives
 * each outline's box.
 */
function overpassQuery(latitude, longitude, radiusM) {
  const lat = latitude.toFixed(6);
  const lng = longitude.toFixed(6);
  const statements = VENUES.SELECTORS.flatMap(([types, key, values]) => {
    const kinds = types === 'nwr' ? ['nwr'] : [...types].map((t) => ({ n: 'node', w: 'way', r: 'relation' }[t]));
    const filters = values === '*' ? [`["${key}"]`] : values.map((value) => `["${key}"="${value}"]`);
    return kinds.flatMap((kind) => filters.map((filter) => `${kind}.named${filter};`));
  });
  const holding = ['amenity', 'leisure', 'tourism', 'shop']
    .flatMap((key) => [`way(pivot.holding)["${key}"]["name"];`, `relation(pivot.holding)["${key}"]["name"];`]);
  return `[out:json][timeout:25];
nwr["name"](around:${Math.round(radiusM)},${lat},${lng})->.named;
is_in(${lat},${lng})->.holding;
(
  ${[...statements, ...holding].join('\n  ')}
);
out tags bb 4000;`;
}

const inflight = new Map();
const failedUntil = new Map();

/**
 * Venue records within `radiusM` of a geohash-7 cell's middle (so every point
 * in the cell is covered), from the cache or Overpass. One fetch per cell and
 * radius at a time; a failed one isn't asked again for a minute.
 */
function overpassRecords(cell, radiusM) {
  const key = `geo7:${cell}:${radiusM}`;
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    const row = await placeSectionCache.readRow(key, SECTION_ID);
    if (row && Array.isArray(row.payload) && Date.parse(row.expires_at) > Date.now()) return row.payload;
    if ((failedUntil.get(key) || 0) > Date.now()) {
      if (row && Array.isArray(row.payload)) return row.payload;
      throw new Error('Venues just failed to load here');
    }
    const box = decodeGeohashBbox(cell);
    const middle = { latitude: (box.minLat + box.maxLat) / 2, longitude: (box.minLng + box.maxLng) / 2 };
    try {
      const elements = await askServers(overpassQuery(middle.latitude, middle.longitude, radiusM + CELL_REACH_M),
        { logPrefix: LOG_PREFIX, userAgent: USER_AGENT });
      const records = toRecords(elements);
      await placeSectionCache.writeRow(key, SECTION_ID, records, CACHE_TTL_MS, new Date().toISOString());
      failedUntil.delete(key);
      return records;
    } catch (err) {
      failedUntil.set(key, Date.now() + FAILURE_COOLDOWN_MS);
      logger.warn(`${LOG_PREFIX}.fetch_failed`, { cell, radius_m: radiusM, error: err.message });
      // A day-old answer beats none.
      if (row && Array.isArray(row.payload)) return row.payload;
      throw err;
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/**
 * Venue records within `radiusM` of the point: the index's when it answers
 * there, else Overpass's. With Overpass, waits until `deadline` at most, then
 * answers null (still loading; the fetch carries on and is cached).
 */
async function recordsAround(latitude, longitude, radiusM, deadline) {
  let elements = null;
  try {
    elements = await venuesIndex.elementsIn(boxAround(latitude, longitude, radiusM));
  } catch (err) {
    logger.warn(`${LOG_PREFIX}.index_failed`, { error: err.message });
  }
  if (elements) return { records: toRecords(elements), source: 'index' };
  const job = overpassRecords(encodeGeohash(latitude, longitude, CELL_PRECISION), radiusM);
  job.catch(() => {});
  const wait = Math.max(0, deadline - Date.now());
  const timeout = new Promise((resolve) => { setTimeout(() => resolve(null), wait).unref?.(); });
  const records = await Promise.race([job, timeout]);
  return { records, source: 'overpass' };
}

// ─── The two questions the picker asks ──────────────────────────────────────

/**
 * Named venues around a point, best first (see the header).
 *
 * @param {{ latitude: number, longitude: number, limit?: number, waitMs?: number }} opts
 * @returns {Promise<{ places: object[], loading: boolean, attribution: string|null }>}
 * @throws when neither the index nor Overpass can answer
 */
async function venuesNear({ latitude, longitude, limit = NEARBY_LIMIT, waitMs = FIRST_ANSWER_WAIT_MS }) {
  const deadline = Date.now() + waitMs;
  const answer = (rows, loading) => ({
    places: rows.slice(0, limit).map(toPlace), loading, attribution: rows.length ? ATTRIBUTION : null,
  });
  let rows = [];
  for (const radius of RADII_M) {
    const { records } = await recordsAround(latitude, longitude, radius, deadline);
    // Still on its way: what the smaller radius found, and the app asks again.
    if (!records) return answer(rows, true);
    rows = ranked(records, latitude, longitude, radius);
    if (rows.length >= ENOUGH) break;
  }
  return answer(rows, false);
}

/**
 * Venues near the point whose name matches the query: names with a word that
 * starts with it, nearest first, then names that hold it anywhere, nearest
 * first. From the index within 5 km, or (abroad, or
 * before the index is published) from what nearby already gathered here, so
 * typing never sends a query per keystroke to the public servers.
 *
 * @returns {Promise<{ places: object[], attribution: string|null }>}
 */
async function searchVenues({ q, latitude, longitude, limit = SEARCH_LIMIT }) {
  const needle = normalized(q);
  if (!needle || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return { places: [], attribution: null };
  let records = null;
  try {
    const elements = await venuesIndex.elementsIn(boxAround(latitude, longitude, SEARCH_RADIUS_M));
    if (elements) records = toRecords(elements);
  } catch (err) {
    logger.warn(`${LOG_PREFIX}.index_failed`, { error: err.message });
  }
  if (!records) {
    const cell = encodeGeohash(latitude, longitude, CELL_PRECISION);
    const cached = await Promise.all(RADII_M.map(async (radius) => {
      const row = await placeSectionCache.readRow(`geo7:${cell}:${radius}`, SECTION_ID);
      return row && Array.isArray(row.payload) ? row.payload : [];
    }));
    records = cached.flat();
  }
  // 0: a word starts with the query; 1: the name holds it elsewhere (spaces ignored).
  const qualityOf = (name) => {
    const text = normalized(name);
    if (text.startsWith(needle) || text.includes(` ${needle}`)) return 0;
    return text.includes(needle) || text.replace(/ /g, '').includes(needle.replace(/ /g, '')) ? 1 : null;
  };
  const quality = new Map();
  for (const record of records) {
    const score = qualityOf(record.name);
    if (score !== null) quality.set(record, score);
  }
  const rows = ranked([...quality.keys()], latitude, longitude, SEARCH_RADIUS_M)
    .sort((a, b) => quality.get(a.record) - quality.get(b.record) || a.rank - b.rank)
    .slice(0, limit);
  return { places: rows.map(toPlace), attribution: rows.length ? ATTRIBUTION : null };
}

module.exports = {
  venuesNear, searchVenues, categoryOf, toRecords, overpassQuery, ATTRIBUTION,
};
