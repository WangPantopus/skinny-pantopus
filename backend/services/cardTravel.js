/**
 * The travelling card (launch key `card_travel`, docs/product/travelling-card-2026-11-21). Whoever receives a Christmas
 * card that travels can pass the same card on, free, with a note of their own, to up to two people. The envelope
 * collects a postmark in every town, a public page shows the journey on a map (towns and dates only), and everyone who
 * held the card hears when it reaches a town.
 *
 * Nothing here is a second system: a passed-on card is a Christmas card stored by the send route's storeCard without
 * postage. What a card keeps is `Mail.mail_extracted.card.travel`, written by the server only and never shown to an
 * app as it is stored (services/mailPiece strips it; the apps read the views below):
 *
 *   travel: {
 *     journey: "<uuid>",            the same on every card of one journey (random, long; public only in its page's address)
 *     hop: 1,                       1 = the card that started it
 *     parent: "<mail id>" | null,   the card this sender received
 *     place: 1 | 2 | null,          which of the parent's two places this card takes
 *     from: { town, state, lat, lon, on },        the sender's town and local date when sent: its postmark
 *     to: { town, state, lat, lon, on } | null,   the receiver's town, set when the card reaches them
 *     waits_town: true,             reached someone who has no town yet: `to` is set once they give one
 *     told: ["<user id>", ...],     who has heard that it reached `to` (one notice a day per journey per person)
 *     told_all: true,               everyone who held it on the way has heard
 *     taken_back: ["<request id>"]  on a parent: requests of pass-ons taken back, so a late retry never sends them
 *   }
 *
 * `lat` and `lon` are a town's own centre from the Census lists (data/travelTowns.json), never a person's point. A
 * stop outside the United States is { town: 'Abroad', state: null, lat: null, lon: null } and adds no miles.
 */
const crypto = require('crypto');
const { DateTime } = require('luxon');
const path = require('path');
const fs = require('fs');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { areLaunchFeaturesEnabled } = require('../utils/featureFlags');
const mailDelivery = require('./mailDelivery');
const holidayCards = require('./holidayCards');

const PLACES = 2;
const ABROAD = 'Abroad';
const STATES_OF = 50;
const NON_STATES = new Set(['DC']);
const GOAL_KEEP_MS = 5 * 60 * 1000;

/** Whether the travelling card is on: its key and the three it rides on. */
const travelOn = () => areLaunchFeaturesEnabled(['mailbox', 'holiday_cards', 'card_table', 'card_travel']);

// ---- Towns (data/travelTowns.json, built by scripts/build-travel-towns.js) ----
// Read on first use, never at the server's start: only travelling-card routes pay its ~40 ms parse, once.
let towns = null;
function loadTowns() {
  if (towns) return towns;
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/travelTowns.json'), 'utf8'));
  const places = raw.places.map(([geoid, name, state, lat, lon, rank, alias]) => ({
    geoid, name, state, lat, lon, rank, alias: alias || null, key: norm(name), aliasKey: alias ? norm(alias) : null,
  }));
  const byNameState = new Map();
  for (const p of places) {
    for (const k of [p.key, p.aliasKey].filter(Boolean)) {
      const id = `${k}|${p.state}`;
      const had = byNameState.get(id);
      if (!had || p.rank > had.rank) byNameState.set(id, p);
    }
  }
  const byGeoid = new Map(places.map((p) => [p.geoid, p]));
  const zips = new Map(Object.entries(raw.zips).map(([zip, i]) => [zip, places[i]]));
  // Searched in this order: the bigger town first, then by name.
  const ranked = [...places].sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));
  towns = { places, ranked, byNameState, byGeoid, zips };
  return towns;
}

function norm(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\bsaint\b/g, 'st').replace(/\bst\./g, 'st').replace(/[^a-z0-9]+/g, ' ').trim();
}

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
const STATE_BY_NAME = new Map(Object.entries(STATE_NAMES).map(([code, name]) => [norm(name), code]));

/** A state as its two-letter code ("wa", "Washington" -> "WA"), or null when it isn't one of the 50 or DC. */
function stateCode(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (/^[a-z]{2}$/i.test(text) && STATE_NAMES[text.toUpperCase()]) return text.toUpperCase();
  return STATE_BY_NAME.get(norm(text)) || null;
}

const townOf = (p, zip = null) => ({ town: p.name, state: p.state, lat: p.lat, lon: p.lon, ...(zip ? { zip } : {}) });
const label = (stop) => (!stop ? null : stop.state ? `${stop.town}, ${stop.state}` : stop.town);

/** The town of a city and state as a person or home keeps them, or of a ZIP code; null when the lists don't have it. */
function matchTown({ city, state, zipcode } = {}) {
  const t = loadTowns();
  const code = stateCode(state);
  const key = norm(city);
  if (key && code) {
    const p = t.byNameState.get(`${key}|${code}`);
    if (p) return townOf(p);
  }
  const zip = String(zipcode || '').trim().slice(0, 5);
  if (/^\d{5}$/.test(zip) && t.zips.has(zip)) {
    const p = t.zips.get(zip);
    if (!code || p.state === code) return townOf(p);
  }
  return null;
}

/** A town by the id the towns list gives it ("5374060", or "zip:98660"), or null. */
function townById(id) {
  const t = loadTowns();
  const text = String(id || '');
  if (text.startsWith('zip:')) {
    const zip = text.slice(4);
    return t.zips.has(zip) ? townOf(t.zips.get(zip), zip) : null;
  }
  const p = t.byGeoid.get(text);
  return p ? townOf(p) : null;
}

const listed = (p, zip = null) => ({ id: zip ? `zip:${zip}` : p.geoid, town: p.name, state: p.state,
  label: `${p.name}, ${p.state}`, ...(zip ? { zip } : {}) });

/**
 * Up to 8 towns for a few typed letters ("van", "vancouver wa", "Vancouver, Washington") or a ZIP code ("98660", or its
 * first three or four digits). Bigger towns first; with `state`, that state's towns first.
 */
function searchTowns(q, { state = null, limit = 8 } = {}) {
  const t = loadTowns();
  const text = String(q || '').trim();
  if (/^\d{3,5}$/.test(text)) {
    if (text.length === 5) return t.zips.has(text) ? [listed(t.zips.get(text), text)] : [];
    const out = [];
    const seen = new Set();
    for (const [zip, p] of t.zips) {
      if (!zip.startsWith(text) || seen.has(p.geoid)) continue;
      seen.add(p.geoid);
      out.push(listed(p, zip));
      if (out.length >= limit) break;
    }
    return out;
  }
  let words = norm(text);
  if (words.length < 2) return [];
  // "vancouver wa" or "vancouver, washington": the state at the end narrows the list.
  let only = null;
  const lastTwo = /^(.*?)\s+([a-z]{2})$/.exec(words);
  const byName = [...STATE_BY_NAME.keys()].find((n) => words.endsWith(` ${n}`));
  if (byName) { only = STATE_BY_NAME.get(byName); words = words.slice(0, -byName.length - 1).trim(); }
  else if (lastTwo && STATE_NAMES[lastTwo[2].toUpperCase()]) { only = lastTwo[2].toUpperCase(); words = lastTwo[1].trim(); }
  if (!words) return [];
  const prefer = stateCode(state);
  const starts = [];
  const inside = [];
  for (const p of t.ranked) {
    if (only && p.state !== only) continue;
    const keys = [p.key, p.aliasKey].filter(Boolean);
    if (keys.some((k) => k.startsWith(words))) starts.push(p);
    else if (inside.length < 40 && keys.some((k) => k.includes(` ${words}`))) inside.push(p);
    if (starts.length >= 200) break;
  }
  const ordered = [...starts, ...inside];
  if (prefer) ordered.sort((a, b) => (b.state === prefer) - (a.state === prefer));
  return ordered.slice(0, limit).map((p) => listed(p));
}

/** The nearest town to a point (a suggestion only; the point itself is never kept). */
function nearestTown(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
  const t = loadTowns();
  let found = null; let best = Infinity;
  const cos = Math.cos((Number(lat) * Math.PI) / 180);
  for (const p of t.places) {
    // Weighted towards bigger towns a little, so a suggestion is the town people name.
    const dy = p.lat - lat; const dx = (p.lon - lon) * cos;
    const d = (dx * dx + dy * dy) / (1 + Math.min(p.rank, 20) * 0.15);
    if (d < best) { best = d; found = p; }
  }
  // Farther than about 60 miles from any town: no suggestion (likely abroad).
  return found && best < 1 ? listed(found) : null;
}

// ---- A person's town ----

const US = new Set(['', 'us', 'usa', 'united states', 'united states of america']);

/**
 * A person's town for a travelling card: their home's town and state, else the town they keep in their profile
 * (User.city, state, zipcode), matched to the towns list for its centre. { town, state, lat, lon }, the Abroad stop for
 * someone whose home is outside the United States, or null when they have none yet (the apps ask once: D4).
 */
async function travelTown(userId) {
  if (!userId) return null;
  const [occupancies, defaults, user] = await Promise.all([
    supabaseAdmin.from('HomeOccupancy').select('home_id, home:home_id(id, city, state, zipcode, country)')
      .eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: true }),
    supabaseAdmin.from('UserNotificationPreferences').select('default_home_id').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('User').select('city, state, zipcode').eq('id', userId).maybeSingle(),
  ]);
  if (occupancies.error) throw new Error(occupancies.error.message);
  if (user.error) throw new Error(user.error.message);
  const homes = (occupancies.data || []).map((row) => row.home).filter(Boolean);
  const preferred = defaults.data?.default_home_id;
  homes.sort((a, b) => (b.id === preferred) - (a.id === preferred));
  for (const home of homes) {
    if (!US.has(String(home.country || '').trim().toLowerCase())) return { town: ABROAD, state: null, lat: null, lon: null };
    const town = matchTown({ city: home.city, state: home.state, zipcode: home.zipcode });
    if (town) return town;
  }
  return matchTown(user.data || {});
}

/** The town a person keeps for travelling cards, as GET /cards says it ("Boise, ID"), or null. */
async function townLabel(userId) {
  return label(await travelTown(userId));
}

// ---- Miles ----

function miles(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat) || !Number.isFinite(a.lon) || !Number.isFinite(b.lon)) return 0;
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return Math.round(2 * 3958.8 * Math.asin(Math.sqrt(h)));
}

const stopOf = (t, on) => (t ? { town: t.town, state: t.state ?? null, lat: t.lat ?? null, lon: t.lon ?? null, on } : null);

// ---- Rows ----

/** The row id of the card a pass-on stores in one of a card's two places (`taken`: how many there were taken back). */
function placeRowId(parentId, place, taken = 0) {
  return holidayCards.uuidOf(['holiday_card_travel_v1', String(parentId).toLowerCase(), Number(place), Number(taken)]);
}

/** What a pass-on asked for, as one digest. */
function passOnDigest({ parentId, place, message, signature = null, to }) {
  const toKey = to.user_id ? `user:${String(to.user_id).toLowerCase()}` : to.link ? 'link' : `email:${String(to.email || '').trim().toLowerCase()}`;
  return crypto.createHash('sha256')
    .update(JSON.stringify(['holiday_card_travel_v1', String(parentId).toLowerCase(), Number(place), message, toKey,
      ...(signature ? [signature] : [])]))
    .digest('hex');
}

const JOURNEY_SELECT = 'id, sender_user_id, recipient_user_id, escrow_status, escrow_recipient_contact, created_at, delivered_at, '
  + 'deleted_at, travel:mail_extracted->card->travel, design:mail_extracted->card->>design, '
  + 'to_name:mail_extracted->card->>to_name, by_link:mail_extracted->card->>by_link, arrival:mail_extracted->card->>arrival, '
  + 'sealed_until:mail_extracted->card->>sealed_until, take_back_until:mail_extracted->card->>take_back_until, '
  + 'withdrawn:mail_extracted->card->withdrawn';

/** Every card of one journey (the index mail_card_travel_journey_idx finds them). Throws on a read failure. */
async function journeyRows(journey) {
  const { data, error } = await supabaseAdmin.from('Mail').select(JOURNEY_SELECT)
    .eq('mail_extracted->card->travel->>journey', String(journey))
    .not('mail_extracted->card->travel', 'is', null)
    .contains('tags', [holidayCards.CARD_TAG])
    .order('created_at', { ascending: true }).order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).filter((row) => row.travel && row.travel.journey === String(journey));
}

/** Every card of these journeys, by journey. */
async function journeysRows(journeys) {
  const ids = [...new Set(journeys.filter(Boolean).map(String))];
  const out = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return out;
  const { data, error } = await supabaseAdmin.from('Mail').select(JOURNEY_SELECT)
    .in('mail_extracted->card->travel->>journey', ids)
    .not('mail_extracted->card->travel', 'is', null)
    .contains('tags', [holidayCards.CARD_TAG])
    .order('created_at', { ascending: true }).order('id', { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of data || []) if (row.travel && out.has(row.travel.journey)) out.get(row.travel.journey).push(row);
  return out;
}

const live = (row) => row && row.escrow_status !== 'withdrawn';

/**
 * A journey as a tree: its cards by id, each live card's children, and its stops. A stop is a town the card was held
 * in: the first is the town it started in (the first card's `from`), then one for each card that reached someone, at
 * its `to`, with `from` the index of the stop it came from. Miles are straight lines between those town centres.
 */
function journeyTree(rows) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const children = new Map();
  for (const row of rows) {
    if (!live(row) || !row.travel.parent) continue;
    if (!children.has(row.travel.parent)) children.set(row.travel.parent, []);
    children.get(row.travel.parent).push(row);
  }
  const first = rows.find((row) => Number(row.travel.hop) === 1) || null;
  const stops = [];
  const stopOfCard = new Map();
  if (first?.travel.from) stops.push({ ...stopOf(first.travel.from, first.travel.from.on), from: null, card: null });
  const reached = rows.filter((row) => live(row) && row.travel.to)
    .sort((a, b) => String(a.travel.to.on).localeCompare(String(b.travel.to.on)) || Number(a.travel.hop) - Number(b.travel.hop)
      || String(a.created_at).localeCompare(String(b.created_at)));
  // A child is listed after its parent: a card reaches someone only after its parent reached its sender.
  const placed = new Set();
  const order = [];
  const visit = (row) => {
    if (placed.has(row.id)) return;
    const parent = row.travel.parent ? byId.get(row.travel.parent) : null;
    if (parent && live(parent) && parent.travel.to && !placed.has(parent.id)) visit(parent);
    placed.add(row.id);
    order.push(row);
  };
  reached.forEach(visit);
  for (const row of order) {
    const parent = row.travel.parent ? byId.get(row.travel.parent) : null;
    const from = parent && stopOfCard.has(parent.id) ? stopOfCard.get(parent.id) : (stops.length ? 0 : null);
    stopOfCard.set(row.id, stops.length);
    stops.push({ ...stopOf(row.travel.to, row.travel.to.on), from, card: row.id });
  }
  return { byId, children, first, stops, stopOfCard };
}

/** The legs' miles of these stops, and their towns and states counted once each (states: the 50 only). */
function totals(stops) {
  let total = 0;
  for (const stop of stops) if (stop.from !== null && stop.from !== undefined) total += miles(stops[stop.from], stop);
  const towns = new Set(stops.filter((s) => s.town && s.town !== ABROAD).map((s) => `${s.town}|${s.state}`));
  const abroad = stops.some((s) => s.town === ABROAD);
  const states = new Set(stops.map((s) => s.state).filter((s) => s && !NON_STATES.has(s)));
  return { miles: total, towns: towns.size + (abroad ? 1 : 0), states: states.size, stateCodes: [...states].sort() };
}

/** The chain of cards from the one that started the journey to this one, oldest first. */
function chainTo(tree, row) {
  const chain = [];
  let at = row;
  const seen = new Set();
  while (at && !seen.has(at.id)) {
    seen.add(at.id);
    chain.unshift(at);
    at = at.travel.parent ? tree.byId.get(at.travel.parent) : null;
  }
  return chain;
}

/** The cards in this card's own subtree (it and every card passed on from it, live), in tree order. */
function subtree(tree, row) {
  const out = [];
  const walk = (r) => {
    out.push(r);
    for (const child of tree.children.get(r.id) || []) walk(child);
  };
  walk(row);
  return out;
}

function firstNameOf(people, userId) {
  const name = String(people?.get?.(String(userId))?.displayName || '').trim();
  return name ? name.split(/\s+/)[0] : null;
}

// ---- What the apps read ----

/** Why this reader can't pass this card on now, or null. `row` is the reader's card as journeyRows reads it. */
function passOnRefusal(row, readerId, now, placesLeft) {
  if (String(row.recipient_user_id) !== String(readerId)) {
    return { code: 'CARD_TRAVEL_NOT_YOURS', error: 'Only the person this card went to can pass it on.' };
  }
  if (row.deleted_at) return { code: 'CARD_NOT_FOUND', error: 'This card isn’t here any more.' };
  if (!row.delivered_at || Date.parse(row.delivered_at) > now.getTime()) {
    return { code: 'CARD_TRAVEL_NOT_OPEN', error: 'You can pass it on once the card arrives.' };
  }
  if (row.sealed_until && Date.parse(row.sealed_until) > now.getTime()) {
    return { code: 'CARD_TRAVEL_SEALED', error: 'You can pass it on once it opens on Christmas morning.' };
  }
  if (placesLeft < 1) return { code: 'CARD_TRAVEL_FULL', error: 'You’ve passed this card on to two people.' };
  return null;
}

/** The places of a card's pass-ons ({ place: row }) and the next free one. */
function placesOf(tree, row) {
  const taken = new Map();
  for (const child of tree.children.get(row.id) || []) {
    const place = Number(child.travel.place);
    if (place >= 1 && place <= PLACES && !taken.has(place)) taken.set(place, child);
  }
  let next = null;
  for (let p = 1; p <= PLACES; p += 1) if (!taken.has(p)) { next = p; break; }
  return { taken, next, left: PLACES - taken.size };
}

/**
 * `piece.card.travel` for the person a travelling card went to: the journey's id, the postmarks on the way to them
 * (oldest first: the towns it left and the days it left them), the miles and towns so far, the places left and the
 * cards they passed on. Null when the card doesn't travel or the key is off. `readerTown`: their own town when the card
 * hasn't been given one yet (to work out its last miles); never stored here.
 */
async function readerView(mailId, readerId, { now = new Date(), readerTown = undefined } = {}) {
  if (!travelOn()) return null;
  const { data: own, error } = await supabaseAdmin.from('Mail').select('id, journey:mail_extracted->card->travel->>journey')
    .eq('id', mailId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!own?.journey) return null;
  const rows = await journeyRows(own.journey);
  const tree = journeyTree(rows);
  const row = tree.byId.get(mailId);
  if (!row || !live(row)) return null;
  const chain = chainTo(tree, row);
  const postmarks = chain.map((c) => c.travel.from).filter(Boolean)
    .map((f) => ({ town: f.town, state: f.state ?? null, on: f.on }));
  let total = 0;
  for (let i = 0; i < chain.length; i += 1) {
    const next = chain[i + 1]?.travel.from || chain[i].travel.to
      || (i === chain.length - 1 ? (readerTown === undefined ? await travelTown(readerId).catch(() => null) : readerTown) : null);
    total += miles(chain[i].travel.from, next);
  }
  const places = placesOf(tree, row);
  const people = await (async () => {
    const ids = [...places.taken.values()].map((c) => c.recipient_user_id).filter(Boolean);
    if (!ids.length) return new Map();
    // eslint-disable-next-line global-require
    return require('./chatPeople').loadChatPeople(ids);
  })();
  const passed = [...places.taken.entries()].sort(([a], [b]) => a - b).map(([place, child]) => {
    const summary = holidayCards.sentSummary(childAsMail(child), now);
    return { place, id: child.id, first_name: child.recipient_user_id ? firstNameOf(people, child.recipient_user_id) : null,
      to_name: summary.to_name, by_email: summary.by_email, ...(summary.by_link ? { by_link: true } : {}),
      status: summary.status, can_take_back: summary.can_take_back, take_back_until: summary.take_back_until };
  });
  let refusal = passOnRefusal(row, readerId, now, places.left);
  if (!refusal) {
    const zone = (await mailDelivery.personTimeZone(readerId)) || mailDelivery.FALLBACK_TIME_ZONE;
    if (!holidayCards.seasonOpen(zone, now)) refusal = { code: 'CARDS_CLOSED', error: 'Christmas cards are done for this year.' };
  }
  return {
    journey: row.travel.journey,
    hop: Number(row.travel.hop),
    postmarks,
    miles: total,
    towns: postmarks.length,
    places: PLACES,
    places_left: places.left,
    next_place: places.next,
    passed,
    can_pass_on: !refusal,
    pass_on_refusal: refusal,
  };
}

/**
 * Sets `card_travel` on a Mail row read for its reader (GET /api/mailbox/:id, the v2 piece routes), which
 * services/mailPiece present() puts under `card.travel`. Only for a travelling card, only for the person it went to.
 * A card in their mailbox whose town wasn't kept yet (the morning run hasn't come) reaches it now. Never throws: the
 * card opens without its journey when it can't be read.
 */
async function attachReaderView(mail, readerId, now = new Date()) {
  if (!mail?.mail_extracted?.card?.travel?.journey || !travelOn()) return mail;
  if (String(mail.recipient_user_id) !== String(readerId)) return mail;
  try {
    if (!mail.mail_extracted.card.travel.to && mail.delivered_at && Date.parse(mail.delivered_at) <= now.getTime()) {
      await reached(mail.id, { now });
    }
    const view = await readerView(mail.id, readerId, { now });
    if (view) mail.card_travel = view;
  } catch (err) {
    logger.warn('Travelling card view not read', { mailId: mail.id, error: err.message });
  }
  return mail;
}

/** `card.travel` on Look it over's piece: the card as its reader will first see it, before it has a journey of its own. */
function previewView(travel) {
  const f = travel?.from;
  return { journey: null, hop: Number(travel?.hop) || 1, postmarks: f ? [{ town: f.town, state: f.state ?? null, on: f.on }] : [],
    miles: 0, towns: f ? 1 : 0, places: PLACES, places_left: PLACES, next_place: 1, passed: [], can_pass_on: false,
    pass_on_refusal: null };
}

// A journey row in the shape holidayCards.sentSummary reads.
function childAsMail(row) {
  return { id: row.id, escrow_status: row.escrow_status, delivered_at: row.delivered_at, created_at: row.created_at,
    mail_extracted: { card: { design: row.design, to_name: row.to_name, arrival: row.arrival,
      ...(row.by_link === 'true' || row.by_link === true ? { by_link: true } : {}), take_back_until: row.take_back_until,
      sealed_until: row.sealed_until } } };
}

/**
 * `travel` on a sender's Sent cards that travel, by mail id: the journey's id, and from this card on the towns, the
 * miles and the newest town ("5 towns · 2,692 miles. Now in Tampa, FL."). One read for every journey on the page.
 */
async function sentViews(mails) {
  const out = new Map();
  if (!travelOn()) return out;
  const travelling = (mails || []).filter((m) => m?.mail_extracted?.card?.travel?.journey);
  if (!travelling.length) return out;
  const byJourney = await journeysRows(travelling.map((m) => m.mail_extracted.card.travel.journey));
  for (const mail of travelling) {
    const rows = byJourney.get(mail.mail_extracted.card.travel.journey) || [];
    const tree = journeyTree(rows);
    const row = tree.byId.get(mail.id);
    if (!row) continue;
    const view = holderView(tree, row);
    out.set(mail.id, { journey: row.travel.journey, towns: view.towns, miles: view.miles, now_in: view.newest });
  }
  return out;
}

// From the stop this card left (its sender's) through every stop of its subtree: towns, miles and the newest town.
function holderView(tree, sent) {
  const parent = sent.travel.parent ? tree.byId.get(sent.travel.parent) : null;
  const startIndex = parent && tree.stopOfCard.has(parent.id) ? tree.stopOfCard.get(parent.id) : 0;
  const ids = new Set(subtree(tree, sent).map((r) => r.id));
  const indexes = new Map([[startIndex, 0]]);
  const stops = tree.stops[startIndex] ? [{ ...tree.stops[startIndex], from: null }] : [];
  tree.stops.forEach((stop, i) => {
    if (!stop.card || !ids.has(stop.card)) return;
    indexes.set(i, stops.length);
    stops.push({ ...stop, from: indexes.has(stop.from) ? indexes.get(stop.from) : null });
  });
  const sum = totals(stops);
  const newest = stops.length > 1 ? stops.slice(1).reduce((a, b) => (String(b.on) >= String(a.on) ? b : a)) : null;
  return { ...sum, stops, newest: newest ? label(newest) : null, newestStop: newest };
}

// ---- The public journey page and the shared goal ----

/**
 * GET /cards/journeys/:journey: the picture, the stops as { town, state, lat, lon, on, from, holding }, miles, towns,
 * states, days on the road and the goal line. Nothing else: no names, addresses, notes or ids of people or mail.
 * Null when there is no such journey.
 */
async function publicJourney(journey, now = new Date()) {
  const rows = await journeyRows(journey);
  const tree = journeyTree(rows);
  if (!tree.first || !live(tree.first) || !tree.stops.length) return null;
  const design = holidayCards.designById(tree.first.design);
  const sum = totals(tree.stops);
  const leaves = new Set();
  tree.stops.forEach((stop, i) => {
    const hasChild = tree.stops.some((s) => s.from === i);
    if (!hasChild) leaves.add(i);
  });
  const ons = tree.stops.map((s) => s.on).filter(Boolean).sort();
  const days = ons.length > 1 ? holidayCards.daysBetween(ons[0], ons[ons.length - 1]) : 0;
  const goal = await goalLine(now);
  return {
    id: String(journey),
    card: design ? { design: design.id, number: design.number, caption: design.caption, slug: design.slug, table: design.table,
      paper: design.paper, height: design.height } : null,
    stops: tree.stops.map((s, i) => ({ town: s.town, state: s.state, lat: s.lat, lon: s.lon, on: s.on, from: s.from,
      holding: leaves.has(i) })),
    miles: sum.miles,
    towns: sum.towns,
    states: sum.states,
    states_of: STATES_OF,
    state_codes: sum.stateCodes,
    days,
    travelling: holidayCards.seasonOpen(mailDelivery.FALLBACK_TIME_ZONE, now),
    goal,
  };
}

let goalKept = null;
/** All cards this Christmas: the states reached, the journeys and their miles. Kept for five minutes. */
async function goalLine(now = new Date()) {
  if (goalKept && goalKept.until > now.getTime()) return goalKept.value;
  const states = new Set();
  const journeys = new Set();
  let total = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin.from('Mail')
      .select('id, escrow_status, travel:mail_extracted->card->travel')
      .not('mail_extracted->card->travel', 'is', null)
      .contains('tags', [holidayCards.CARD_TAG])
      // By journey first, so the partial index (mail_card_travel_journey_idx) holds the rows to read.
      .order('mail_extracted->card->travel->>journey', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      if (!live(row) || !row.travel) continue;
      journeys.add(row.travel.journey);
      for (const t of [row.travel.from, row.travel.to]) if (t?.state && !NON_STATES.has(t.state)) states.add(t.state);
      if (row.travel.to) total += miles(row.travel.from, row.travel.to);
    }
    if (!data || data.length < PAGE) break;
  }
  const value = { states: states.size, of: STATES_OF, state_codes: [...states].sort(), travelling: journeys.size, miles: total,
    line: `All cards this Christmas: ${states.size} of ${STATES_OF} states.` };
  goalKept = { value, until: now.getTime() + GOAL_KEEP_MS };
  return value;
}

// ---- Reaching a town and telling people ----

// Changes one card's `travel` (a key given as undefined is removed). Read again first: the rest of the row may have moved.
async function writeTravel(row, travel) {
  const { data: current, error } = await supabaseAdmin.from('Mail').select('mail_extracted').eq('id', row.id).maybeSingle();
  if (error) throw new Error(error.message);
  const card = current?.mail_extracted?.card;
  if (!card?.travel) return false;
  const next = { ...card.travel, ...travel(card.travel) };
  for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
  const { error: updateError } = await supabaseAdmin.from('Mail')
    .update({ mail_extracted: { ...current.mail_extracted, card: { ...card, travel: next } } })
    .eq('id', row.id);
  if (updateError) throw new Error(updateError.message);
  return true;
}

/**
 * A card reached its person (its 7 a.m. delivery, or someone took it from an email or link): its `to` is their town,
 * and everyone who held it on the way hears. Someone with no town yet is asked for one; their card reaches it then
 * (reachedTownOf). Best effort: a failure is logged and the next morning run tries again.
 */
async function reached(mailId, { now = new Date() } = {}) {
  if (!travelOn()) return;
  try {
    const { data: row, error } = await supabaseAdmin.from('Mail')
      .select('id, recipient_user_id, delivered_at, escrow_status, travel:mail_extracted->card->travel').eq('id', mailId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.travel || row.travel.to || !live(row) || !row.recipient_user_id) return;
    if (!row.delivered_at || Date.parse(row.delivered_at) > now.getTime()) return;
    const town = await travelTown(row.recipient_user_id);
    const zone = (await mailDelivery.personTimeZone(row.recipient_user_id)) || mailDelivery.FALLBACK_TIME_ZONE;
    if (!town) {
      if (!row.travel.waits_town) await writeTravel(row, () => ({ waits_town: true }));
      return;
    }
    await writeTravel(row, (t) => (t.to ? {} : { to: stopOf(town, mailDelivery.localDate(new Date(row.delivered_at), zone)), waits_town: undefined }));
    await tellJourney(row.travel.journey, now);
  } catch (err) {
    logger.warn('Travelling card: reaching a town failed', { mailId, error: err.message });
  }
}

/** Someone gave their town (PUT /cards/town): the travelling cards that reached them while they had none reach it now. */
async function reachedTownOf(userId, now = new Date()) {
  if (!travelOn()) return;
  try {
    const { data, error } = await supabaseAdmin.from('Mail').select('id')
      .eq('recipient_user_id', userId)
      .not('mail_extracted->card->travel', 'is', null)
      .is('mail_extracted->card->travel->>to', null)
      .lte('delivered_at', now.toISOString())
      .contains('tags', [holidayCards.CARD_TAG]);
    if (error) throw new Error(error.message);
    for (const row of data || []) await reached(row.id, { now });
  } catch (err) {
    logger.warn('Travelling card: town arrivals failed', { userId, error: err.message });
  }
}

const NOTICE_TYPE = 'holiday_card_travelled';
const NOTICE_FROM_HOUR = 7;
const NOTICE_UNTIL_HOUR = 21;

/**
 * Tell everyone who held a journey's cards on the way about the towns it reached that they haven't heard of: one notice
 * a day for one journey for one person (its idempotency key holds the day), so a second town the same day is counted
 * in the next day's notice. It opens that person's own Sent card.
 */
async function tellJourney(journey, now = new Date()) {
  const rows = await journeyRows(journey);
  const tree = journeyTree(rows);
  // Who is owed which arrivals: for each card that reached a town, every sender on its way there.
  const owed = new Map();
  for (const row of rows) {
    if (!live(row) || !row.travel.to || row.travel.told_all) continue;
    const told = new Set((row.travel.told || []).map(String));
    for (const sent of chainTo(tree, row)) {
      const holder = String(sent.sender_user_id || '');
      if (!holder || told.has(holder)) continue;
      if (!owed.has(holder)) owed.set(holder, { sent, arrivals: [] });
      const entry = owed.get(holder);
      entry.arrivals.push(row);
      // Their own Sent card on the way: the one nearest the start that leads to these arrivals.
      if (Number(sent.travel.hop) < Number(entry.sent.travel.hop)) entry.sent = sent;
    }
  }
  const toldNow = new Map();
  for (const [holder, { sent, arrivals }] of owed) {
    const zone = (await mailDelivery.personTimeZone(holder)) || mailDelivery.FALLBACK_TIME_ZONE;
    // Never in someone's night: a later run tells them once it's 7 a.m. where they live.
    const hour = Number(DateTime.fromJSDate(now, { zone }).toFormat('H'));
    if (hour < NOTICE_FROM_HOUR || hour >= NOTICE_UNTIL_HOUR) continue;
    const day = mailDelivery.localDate(now, zone);
    const key = `card_travel:${journey}:${holder}:${day}`;
    const { data: had } = await supabaseAdmin.from('Notification').select('id').eq('idempotency_key', key).limit(1);
    if (had?.length) continue;
    const view = holderView(tree, sent);
    const newest = arrivals.reduce((a, b) => (String(b.travel.to.on) >= String(a.travel.to.on) ? b : a));
    const left = sent.travel.from?.town === ABROAD ? 'abroad' : `in ${sent.travel.from?.town || 'your town'}`;
    // From the stop it left them to the newest town: the towns and miles on that way.
    const pathRows = chainTo(tree, newest).filter((r) => Number(r.travel.hop) >= Number(sent.travel.hop));
    const pathMiles = pathRows.reduce((sum, r) => sum + miles(r.travel.from, r.travel.to), 0);
    const one = arrivals.length === 1;
    const place = label(newest.travel.to);
    const notice = one
      ? { title: place === ABROAD ? 'Your card went abroad' : `Your card reached ${place}`,
        body: `${pathRows.length + 1} towns and ${pathMiles.toLocaleString('en-US')} miles since it left you ${left}.` }
      : { title: `Your card reached ${arrivals.length} more towns`,
        body: `${view.towns} towns and ${view.miles.toLocaleString('en-US')} miles so far.` };
    // eslint-disable-next-line global-require
    const notificationService = require('./notificationService');
    const created = await notificationService.createNotification({
      userId: holder, type: NOTICE_TYPE, title: notice.title, body: notice.body, icon: '✉️',
      link: `/app/mailbox/sent/${sent.id}`, idempotencyKey: key,
      metadata: { mail_id: sent.id, journey: String(journey) },
    });
    if (!created) continue;
    for (const row of arrivals) {
      if (!toldNow.has(row.id)) toldNow.set(row.id, new Set());
      toldNow.get(row.id).add(holder);
    }
  }
  for (const [id, holders] of toldNow) {
    const row = tree.byId.get(id);
    const owedBy = new Set(chainTo(tree, row).map((r) => String(r.sender_user_id || '')).filter(Boolean));
    await writeTravel(row, (t) => {
      const told = [...new Set([...(t.told || []).map(String), ...holders])];
      return { told, ...([...owedBy].every((h) => told.includes(h)) ? { told_all: true } : {}) };
    }).catch((err) => logger.warn('Travelling card: told not kept', { mailId: id, error: err.message }));
  }
}

/**
 * The morning run (rides the mail notification Lambda's call, POST /api/internal/briefing/mail-morning, every five
 * minutes): travelling cards to people whose 7 a.m. delivery has come reach their towns, and arrivals someone hasn't
 * heard of yet because they heard of another that day are told now that it's a new day. Answers counts.
 */
async function runArrivals(now = new Date()) {
  if (!travelOn()) return { skipped: true };
  const stats = { reached: 0, journeys_told: 0 };
  const { data: due, error } = await supabaseAdmin.from('Mail').select('id')
    .not('mail_extracted->card->travel', 'is', null)
    .is('mail_extracted->card->travel->>to', null)
    .is('mail_extracted->card->travel->>waits_town', null)
    .is('escrow_status', null)
    .not('recipient_user_id', 'is', null)
    .lte('delivered_at', now.toISOString())
    .contains('tags', [holidayCards.CARD_TAG])
    .limit(2000);
  if (error) throw new Error(error.message);
  for (const row of due || []) {
    await reached(row.id, { now });
    stats.reached += 1;
  }
  const { data: untold, error: untoldError } = await supabaseAdmin.from('Mail')
    .select('journey:mail_extracted->card->travel->>journey')
    .not('mail_extracted->card->travel->>to', 'is', null)
    .is('mail_extracted->card->travel->>told_all', null)
    .contains('tags', [holidayCards.CARD_TAG])
    .limit(2000);
  if (untoldError) throw new Error(untoldError.message);
  for (const journey of new Set((untold || []).map((r) => r.journey).filter(Boolean))) {
    try {
      await tellJourney(journey, now);
      stats.journeys_told += 1;
    } catch (err) {
      logger.warn('Travelling card: telling a journey failed', { journey, error: err.message });
    }
  }
  return stats;
}

module.exports = {
  PLACES, ABROAD, NOTICE_TYPE, travelOn, loadTowns, matchTown, townById, searchTowns, nearestTown, stateCode, travelTown,
  townLabel, label, miles, stopOf, placeRowId, passOnDigest, journeyRows, journeyTree, chainTo, placesOf, passOnRefusal,
  readerView, attachReaderView, previewView, sentViews, publicJourney, goalLine, reached, reachedTownOf, tellJourney, runArrivals, live,
};
