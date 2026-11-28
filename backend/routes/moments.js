// Moments (build brief and CONTRACT in ~/pantopus-moments/coord, approved 2026-11-08): post a photo, a video of up to
// 30 s or a text card where you are; it shows on the Moments map as your profile picture in a ring for 1, 6, 24 or 48
// hours. Every route needs a signed-in person with the `moments` flag on (404 MOMENTS_UNAVAILABLE otherwise).
// The rows are Posts (services/moments/momentStore.js); files sit in private storage (momentMedia.js); a picture check
// runs before a photo or video goes live (momentCheck.js); replies are chat messages (momentChat.js).

const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const { createHash } = require('node:crypto');
const verifyToken = require('../middleware/verifyToken');
const requireFeatureFlag = require('../middleware/requireFeatureFlag');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const feedService = require('../services/feedService');
const store = require('../services/moments/momentStore');
const { sunPosition } = require('../services/moments/sunPosition');
const media = require('../services/moments/momentMedia');
const momentCheck = require('../services/moments/momentCheck');
const momentPlace = require('../services/moments/momentPlace');
const momentChat = require('../services/moments/momentChat');
const { adultStatus, confirmAdult } = require('../services/adultAttestation');
const momentUpload = require('../services/moments/momentUpload');
const momentNotify = require('../services/moments/momentNotify');
const momentSchedule = require('../services/moments/momentSchedule');
const momentWeather = require('../services/moments/momentWeather');
const momentStamps = require('../services/moments/momentStamps');
const retake = require('../services/pulse/retake');
const pinboard = require('../services/pulse/pinboard');
const yourDay = require('../services/pulse/yourDay');
const beams = require('../services/pulse/beams');
const eyesOn = require('../services/pulse/eyesOn');
const seal = require('../services/pulse/seal');
const mentions = require('../services/pulse/mentions');

/** The mentions kept on a new Moment (CONTRACT 7h), as the Moment's own field: { mentions } or nothing. */
async function keptMentions(ids, authorId, { penName: underPenName, audience, guess }) {
  // As it will be stored: who may see it is today's rule (its audience, blocks, mutes; a live guess-the-spot Moment
  // only for a reader with the switch on).
  const row = { user_id: authorId, audience, post_metadata: { moment: guess ? { guess: { v: 1 } } : {} },
    story_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
  const kept = await mentions.keep(ids, authorId, { penName: underPenName, maySee: (id) => mentions.maySeeMoment(row, id) });
  return kept.length ? { mentions: kept } : {};
}
const playItems = require('../services/pulse/play');
const stepDeck = require('../services/pulse/deck');
const { normalizePostReaction, normalizePostSignal, shownReaction, shownSignal } = require('../utils/postReaction');
const { REPORT_REASONS, filePostReport } = require('../services/postReportService');
const { haversineMeters } = require('../utils/trustState');
const momentGuess = require('../services/moments/momentGuess');
const penName = require('../services/penName');

const router = express.Router();
router.use(verifyToken, requireFeatureFlag('moments', { error: "Moments aren't available.", code: 'MOMENTS_UNAVAILABLE' }));
// Only an app that has Moments asks here: remembered once a day per person, so the push about a connection's Moment
// goes to people it can open for (services/moments/momentNotify.js). Never slows or fails the request.
router.use((req, res, next) => {
  momentNotify.rememberApp(req.user.id);
  next();
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// How long the upload's answer waits for the picture check; past it the answer says `checking` and the check finishes
// on its own (the cleanup job picks up one that never did).
const CHECK_WAIT_MS = 12 * 1000;

function limiter(windowMs, max) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => req.user?.id || req.ip,
    handler: (req, res) => res.status(429).json({ error: 'Too many requests. Please try again in a minute.', code: 'RATE_LIMITED' }),
    standardHeaders: true,
    legacyHeaders: false,
  });
}
const createLimiter = limiter(15 * 60 * 1000, 60);
const uploadLimiter = limiter(15 * 60 * 1000, 60);
const actionLimiter = limiter(60 * 1000, 120);

function sendError(res, error, what) {
  if (error.status) {
    return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
  }
  logger.error(`moments.${what}.error`, { error: error.message });
  return res.status(503).json({ error: "Moments couldn't load. Please try again.", code: 'MOMENTS_FAILED' });
}

function parseBody(schema, value) {
  const { error, value: parsed } = schema.validate(value || {}, { abortEarly: true, stripUnknown: true });
  if (error) throw store.fail(400, 'MOMENT_INVALID', error.details[0].message.replace(/"/g, ''));
  return parsed;
}

function momentId(req) {
  if (!UUID.test(String(req.params.id || ''))) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
  return req.params.id;
}

async function oneMoment(row, viewerId) {
  return (await store.serializeMoments([row], viewerId))[0];
}

const point = { latitude: Joi.number().min(-90).max(90).required(), longitude: Joi.number().min(-180).max(180).required() };

// ─── 18+ and the Post sheet ─────────────────────────────────────────────────

/** POST /adult-confirm — the one-time 18+ confirmation, shared with Pulse (services/adultAttestation.js). */
router.post('/adult-confirm', actionLimiter, async (req, res) => {
  try {
    const result = await confirmAdult(req.user.id);
    if (!result.found) return res.status(404).json({ error: 'Account not found', code: 'ACCOUNT_NOT_FOUND' });
    if (result.ineligible) return res.status(403).json({ error: 'Moments are for people 18 and older.', code: 'AGE_NOT_ELIGIBLE' });
    res.json({ attested_at: result.attestedAt });
  } catch (error) {
    sendError(res, error, 'adult_confirm');
  }
});

/**
 * POST /place-preview — what the Post sheet shows: the place's label, the area's, the names the author may pick for an
 * exact pin (`places`; the first is the label), the home notice, whether "Show height" may be offered
 * (`can_show_height`), the 18+ state, and whether the author has a connection (`has_connections`: a Moment with no
 * location needs one). With no point (location off) it answers only the last two (and `can_show_height: false`).
 * With the Sky on for the caller (`sky_places`) it adds `sky: true`, the area a Moment at home shows (`area`: its town,
 * the street spot it stands over and its disc), the public place that may take a pin there (`place`), whether one may
 * be pinned (`can_pin`) and
 * the "Share later" times on offer now (`share_later`); `pick_within_m` (how far a place picked by name may be) is
 * a mile where the spot is most built up, up to two miles in open country (momentPlace.pickWithinM).
 * With `weather: true` (API v4.1: an app that offers "Show the weather") it adds `weather`, the stamp a Moment taken
 * here would keep ({ temp_f, kind, label }, momentWeather.weatherAt), or null: always null at home and with no point,
 * where nothing is looked up. A request without it looks nothing up, so apps from before add no weather reads.
 * With `stamps: true` from the Studio's tray (Pulse, reinvented; only while `pulse_reinvented` is on for the caller) it
 * adds `stamps`, each stamp's value as a Moment posted here now would keep it (momentStamps.js), null where none. Sent
 * while the switch is off for the caller: 403 PULSE_REINVENTED_OFF (store.reinventedOff).
 */
router.post('/place-preview', actionLimiter, async (req, res) => {
  try {
    const at = parseBody(Joi.object({
      latitude: Joi.number().min(-90).max(90), longitude: Joi.number().min(-180).max(180),
      weather: Joi.boolean().default(false),
    }).and('latitude', 'longitude'), req.body);
    const placed = at.latitude != null;
    const sky = await store.skyOn(req.user);
    const studioAsked = req.body?.stamps !== undefined;
    const studio = studioAsked && await store.reinventedOn(req.user);
    if (studioAsked && !studio) throw store.reinventedOff();
    // A failed home read answers at home, as POST / will treat it: the sheet then offers what the post will do (only the
    // area with the Sky on, no height, no pin at a place).
    const homeCheck = placed ? momentPlace.isAtHome(req.user.id, at.latitude, at.longitude, { onFailure: true }) : false;
    // Asked for after the home check, and only away from home, so a point at home is never sent to the weather source
    // from here.
    const weatherRead = (at.weather || studio) && placed
      ? homeCheck.then((home) => (home ? null : momentWeather.weatherAt(at.latitude, at.longitude)))
      : null;
    const [labels, home, heights, adult, connections, pickWithin, weather] = await Promise.all([
      placed ? momentPlace.labelsAt(at.latitude, at.longitude, { pinnableOnly: sky })
        : { place_label: null, area_label: null, places: [] },
      homeCheck,
      placed ? store.heightsOn(req.user) : false,
      adultStatus(req.user.id),
      // Never in the way of the place's words: a failed read leaves `has_connections` out.
      store.connectionIds(req.user.id).catch((error) => {
        logger.warn('moments.connections_read_failed', { error: error.message });
        return null;
      }),
      sky && placed ? momentPlace.pickWithinM(at.latitude, at.longitude) : momentPlace.PICK_PLACE_M,
      weatherRead,
    ]);
    const atHome = Boolean(home);
    // pick_within_m: how far from the pin the place picker's venues may be (POST / takes a venue_id within it).
    res.json({
      ...labels,
      at_home: atHome,
      // Whether the sheet may offer "Show height" for this point: never at home (and never for an area: the app hides
      // it when the author picks one). POST / decides again.
      can_show_height: heights && !atHome,
      adult_confirmed: Boolean(adult.attestedAt) && !adult.ineligible,
      pick_within_m: pickWithin,
      ...(connections ? { has_connections: connections.length > 0 } : {}),
      ...(at.weather ? { weather: atHome ? null : weather } : {}),
      ...(sky ? await skyPreview(req.user.id, at, atHome) : {}),
      ...(studio ? { stamps: await stampsPreview(req.user.id, at, labels, atHome, weather) } : {}),
    });
  } catch (error) {
    sendError(res, error, 'place_preview');
  }
});

/**
 * The Sky's part of the preview: the area the point is in, which a Moment at home shows (momentPlace.closeArea: its
 * town, read at the area's own point so the words depend on the area only; the spot it stands over; its disc), the
 * place "Pin it at a place" starts with, and whether a pin is possible (never at home), and the "Share later" choices
 * on offer now in the author's time zone (`tonight` only before 7 pm), each with the time it would share. Away from
 * home the area is asked for briefly (only a sheet from before November 17 draws it there), so the sheet never waits
 * on the streets.
 */
const PREVIEW_AREA_WAIT_MS = 600;
async function skyPreview(userId, at, atHome) {
  const shareLater = momentSchedule.choices(Date.now(), await momentSchedule.zoneFor(userId, at.latitude, at.longitude));
  if (at.latitude == null) return { sky: true, area: null, place: null, can_pin: false, share_later: shareLater };
  const area = await momentPlace.closeArea(at.latitude, at.longitude, atHome ? {} : { waitMs: PREVIEW_AREA_WAIT_MS });
  const [label, place] = await Promise.all([
    momentPlace.townAt(area.latitude, area.longitude),
    momentPlace.namingPlace(at.latitude, at.longitude),
  ]);
  return {
    sky: true,
    area: { label, latitude: area.latitude, longitude: area.longitude, radius_m: area.radius_m },
    place: place ? { key: place.key, label: place.label } : null,
    can_pin: !atHome,
    share_later: shareLater,
  };
}

/**
 * The Studio tray's stamps for a point (Pulse, reinvented): what a Moment posted there now would keep, from the
 * preview's own reads (`weather` was read only away from home). With no point only the time is there.
 */
async function stampsPreview(userId, at, labels, atHome, weather) {
  const placed = at.latitude != null;
  const values = await momentStamps.valuesFor({
    userId,
    point: placed ? { latitude: at.latitude, longitude: at.longitude } : null,
    placeLabel: placed ? (atHome ? labels.area_label : labels.place_label) : null,
    town: placed ? labels.area_label : null,
    atHome,
    weather: placed && !atHome ? weather || null : null,
  });
  return momentStamps.previewOf(values, { atHome, placed });
}

/**
 * Where a new Moment goes with the Sky on for its author (founder 2026-11-17): where it was taken, unless its author
 * pins it at a public place close by, picked by name ("Pin it at a place"). `venue` ({ latitude, longitude, label })
 * for a pin at a place, `area` (momentPlace.closeArea of the Moment's own point: over a street close by) for one that
 * shows only its area, neither for one where it was taken. A Moment at the author's home shows only its area whatever
 * was asked, and so does one sent with `show_area` (the "Show the area instead" of an app from before the Sky, and a
 * Post sheet from before November 17, which showed the area unless a place was picked).
 *
 * A place is picked with `pin: "place"`, a `venue_id` or a venue's `place_key`. It may be no farther from the spot
 * than momentPlace.pickWithinM says (422 PLACE_NOT_NEARBY for a `venue_id` that is, or that nobody finds), and
 * `pin: "place"` with no place named and none at the spot is 422 NO_PLACE_HERE. Schools and preschools take a pin
 * like any place (founder 2026-11-17); a place right by the author's home leaves the Moment where it was taken. A
 * place whose own point is farther off than that (the middle of a big park the photo was taken in) names the Moment,
 * and the pin stays where it was taken: no pin is ever farther from the photo than a place may be picked. With no
 * place named (the one at the spot itself) "that" is the shorter distance from before November 17, 2026
 * (pickWithinM's `picked: false`), so that pin moves no farther than it did.
 *
 * `floatAway` (a Moment under a made-up name): away from home with no place picked, it floats over its area too, never
 * where it was taken (founder 2026-11-27; docs/product/made-up-names/README.md, Moments, "It floats").
 */
async function skyPlacement(userId, body, { floatAway = false } = {}) {
  const { latitude, longitude } = body.location;
  // A home read that fails counts as at home: the Moment floats and keeps no height, so a failure never shows where its
  // author lives (the post still succeeds).
  const atHome = await momentPlace.isAtHome(userId, latitude, longitude, { onFailure: true });
  const venueKey = typeof body.place_key === 'string' && body.place_key.startsWith('v_') ? body.place_key : null;
  const picked = body.pin === 'place' || Boolean(body.venue_id) || Boolean(venueKey);
  if (atHome || body.show_area || (floatAway && !picked)) {
    return { atHome, venue: null, area: await momentPlace.closeArea(latitude, longitude) };
  }
  if (!picked) return { atHome, venue: null, area: null };
  const within = await momentPlace.pickWithinM(latitude, longitude, { picked: Boolean(body.venue_id || venueKey) });
  let venue = null;
  if (body.venue_id) {
    const found = await momentPlace.venueNear(body.venue_id, latitude, longitude, within);
    if (!found) {
      throw store.fail(422, 'PLACE_NOT_NEARBY', "That place is too far from this Moment's pin. Pick one nearby.");
    }
    venue = found.pinnable ? found : null;
  } else if (venueKey) {
    venue = await momentPlace.venueForKey(latitude, longitude, venueKey);
  } else {
    venue = await momentPlace.namingPlace(latitude, longitude);
    if (!venue) throw store.fail(422, 'NO_PLACE_HERE', 'There is no public place to pin this Moment at here.');
  }
  // A place whose home check fails takes no pin either.
  if (venue && await momentPlace.isAtHome(userId, venue.latitude, venue.longitude, { onFailure: true })) venue = null;
  if (venue && haversineMeters(latitude, longitude, venue.latitude, venue.longitude) > within) {
    venue = { ...venue, latitude, longitude };
  }
  return { atHome, venue, area: null };
}

/**
 * GET /limits — what a Moment may be, for the apps to shape a video before it goes up: the longest one Moment's video
 * runs, how many Moments a longer one is posted as, and the largest file an upload may be (less than ours when
 * storage takes less). An app that can't read this keeps to 30 seconds and one part.
 */
router.get('/limits', async (req, res) => {
  try {
    res.json({
      video: {
        max_seconds: media.MAX_VIDEO_MS / 1000,
        max_parts: store.MAX_PARTS,
        max_bytes: await media.maxVideoBytes(),
      },
      daily_limit: store.DAILY_LIMIT,
    });
  } catch (error) {
    sendError(res, error, 'limits');
  }
});

// ─── Posting ────────────────────────────────────────────────────────────────

const createSchema = Joi.object({
  // 'pen_name': under the person's made-up name (services/penName; docs/product/made-up-names/README.md).
  post_as: Joi.string().valid('personal', 'pen_name').allow(null),
  kind: Joi.string().valid(...store.KINDS).required(),
  hours: Joi.number().valid(...store.HOURS).default(24),
  audience: Joi.string().valid(...store.AUDIENCES).default('nearby'),
  show_area: Joi.boolean().default(false),
  caption: Joi.string().trim().max(100).allow('', null),
  text: Joi.string().trim().max(200).allow('', null),
  background: Joi.string().valid(...store.BACKGROUNDS).allow(null),
  location: Joi.alternatives().try(
    Joi.object({ source: Joi.string().valid('gps').required(), ...point, fix_at: Joi.string().isoDate().required() }),
    Joi.object({ source: Joi.string().valid('capture').required(), ...point, taken_at: Joi.string().isoDate().required() }),
    // No location (founder 2026-11-11): no pin, not on the map; only the author's connections see it.
    Joi.object({ source: Joi.string().valid('none').required() }),
  ).required(),
  // When an album photo or video pinned where you are (its file doesn't say where) was taken (optional; a `capture`
  // location carries its own `taken_at`). One taken more than a day ago says so on the Moment.
  taken_at: Joi.string().isoDate().allow(null),
  // A venue the place picker listed around the pin (its `osm:` id, optional): the Moment pins there under its name.
  venue_id: Joi.string().max(64).pattern(/^osm:(node|way|relation)\/\d+$/).allow('', null),
  // A retry of the same Post tap returns the Moment it made (optional).
  client_request_id: Joi.string().uuid().allow(null),
  // The Post sheet's pick among place-preview's `places` (optional): a key, never the place's words.
  place_key: Joi.string().max(40).pattern(/^[a-z0-9_]+$/).allow('', null),
  // The Sky (optional; used while `sky_places` is on for the author): pin the Moment at a public place: the one named
  // by `venue_id` or a venue's `place_key`, else the one naming the spot (place-preview's `place`).
  pin: Joi.string().valid('place').allow(null),
  // The Sky (optional; while `sky_places` is on for the author): hold the Moment until then; only its author sees it
  // before (momentSchedule.js).
  share_later: Joi.string().valid(...momentSchedule.KEYS).allow(null),
  // "Show height" (optional; behind the `moment_heights` flag): how high above sea level the phone, or the album
  // photo, says the Moment was made, in metres, with how far off that may be and how fast the phone was moving when
  // it knows. Sent only when the author turned the switch on; everyone reads feet rounded to 10 (store.shownAltitude).
  altitude: Joi.object({
    meters: Joi.number().required(),
    accuracy_m: Joi.number().allow(null),
    speed_mps: Joi.number().allow(null),
  }).allow(null),
  // A video longer than one Moment (GET /limits) is posted as several, in order (optional): the same `id` on each,
  // which part this is and of how many. Later parts need the first; they count as one post and notify once.
  series: Joi.object({
    id: Joi.string().uuid().required(),
    index: Joi.number().integer().min(1).max(store.MAX_PARTS).required(),
    count: Joi.number().integer().min(2).max(store.MAX_PARTS).required(),
  }).allow(null),
  // The Live mark (API v4.1, optional): the app's own camera made this photo or video just now. Kept only for a `gps`
  // location at its exact pin away from home (store.markKept); anywhere else it is dropped, never an error.
  taken_here: Joi.boolean().default(false),
  // "Show the weather" (API v4.1, optional): with the mark kept, the server reads the weather at the pin and keeps it
  // on the Moment. No reading, no stamp; the post goes ahead either way.
  show_weather: Joi.boolean().default(false),
});

// The row id a retry key stands for, so the same tap never makes two Moments.
function retryId(userId, key) {
  if (!key) return null;
  const hex = createHash('sha256').update(`pantopus:moment-create:v1:${userId.toLowerCase()}:${key.toLowerCase()}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** POST / — a new Moment: a text card is live at once; a photo or video waits for its file (POST /:id/media). */
router.post('/', createLimiter, async (req, res) => {
  try {
    const body = parseBody(createSchema, req.body);
    if (body.kind === 'text') {
      if (!body.text) throw store.fail(400, 'MOMENT_INVALID', 'Write something on the card.');
      if (body.caption) throw store.fail(400, 'MOMENT_INVALID', 'A text card has no caption.');
    } else if (body.text || body.background) {
      throw store.fail(400, 'MOMENT_INVALID', 'Only a text card has text and a background.');
    }
    if (body.series && (body.kind !== 'video' || body.series.index > body.series.count)) {
      throw store.fail(400, 'MOMENT_INVALID', 'Only a video is posted in parts.');
    }
    // Pulse, reinvented: the Studio's stamps (`stamps`) and its height reading for the elevation stamp (`elevation`),
    // read only while the switch is on for the author (their values are kept for every Moment they post then, so an
    // edit may add a stamp). Sent while it is off: 403 PULSE_REINVENTED_OFF, so the app goes back to today's screens.
    const reinvented = await store.reinventedOn(req.user);
    if (!reinvented && ['stamps', 'elevation', 'guess', 'explore', 'play', 'dots', 'deck', 'replies_shown', 'mentions', 'retake', 'retake_of', 'eyes_on_for', 'seal', 'join_convergence', 'pinboard', 'pinboard_of', 'your_day', 'heading', 'loop', 'whole', 'placement', 'backdrop'].some((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key))) {
      throw store.reinventedOff();
    }
    const studio = reinvented ? momentStamps.parseStudio(req.body) : null;
    // Playable items (CONTRACT 7b): a poll, a slider, a board, a question box, a guess and reveal, a countdown.
    // Dots on the picture (CONTRACT 7c): a note, a rating, a link, a thing to name. A step deck (7g).
    let play = [];
    let dots = [];
    // Mentions (CONTRACT 7h): the ids sent beside the caption's "@First Last"; who is kept is decided below.
    let mentionIds = null;
    const deck = studio ? stepDeck.parseDeck(req.body?.deck, { kind: body.kind, penName: body.post_as === 'pen_name' }) : null;
    if (deck) await stepDeck.checkStep(req.user.id, deck, retryId(req.user.id, body.client_request_id));
    if (studio) {
      try {
        play = playItems.parseItems(req.body?.play, Date.now(), { photo: body.kind === 'photo' });
        mentionIds = mentions.parse(req.body?.mentions);
        dots = playItems.parseDots(req.body?.dots, {
          photo: body.kind === 'photo', media: body.kind !== 'text', penName: body.post_as === 'pen_name',
          // A thing to name sends its photo to Pantopus AI: only while the author keeps it on (CONTRACT 7d).
          things: Array.isArray(req.body?.dots) && req.body.dots.some((dot) => dot?.kind === 'thing')
            ? await require('../services/pulse/aiSetting').aiOn(req.user.id) : true,
        });
      } catch (playError) {
        throw store.fail(400, 'MOMENT_INVALID', playError.message);
      }
    }
    // Loop (CONTRACT 7j): which span of this one video the new viewers repeat, silently.
    let loop = null;
    if (studio) {
      try {
        loop = require('../services/pulse/loop').parse(req.body?.loop, { kind: body.kind, series: body.series });
      } catch (loopError) {
        throw store.fail(400, 'MOMENT_INVALID', loopError.message);
      }
    }
    // A picture shown as its author composed it (CONTRACT 10c): whole, its backdrop, and a video's placement on the canvas.
    const composed = studio ? require('../services/pulse/composed').parse(req.body, { kind: body.kind }) : {};
    // Retake (CONTRACT 8e): start one (`retake.title`) or add a frame (`retake_of`); checked below, once the place is known.
    const retakeAsk = studio ? retake.parse(req.body) : null;
    // Seal it (CONTRACT 8g): opens on a date, at a place or with rain; checked below, once the place is known.
    const sealAsk = studio ? seal.parse(req.body) : null;
    // Pinboards (CONTRACT 8i): start one (`pinboard.prompt`) or add a piece (`pinboard_of`).
    const pinboardAsk = studio ? pinboard.parse(req.body) : null;
    // Guess the spot (CONTRACT 5a): a photo or video with a place; never at home (checked below, once home is known).
    const guess = Boolean(studio) && req.body?.guess === true;
    if (guess && (!['photo', 'video'].includes(body.kind) || body.location.source === 'none')) {
      throw store.fail(400, 'MOMENT_INVALID', 'Guess the spot needs a photo or video with a place.');
    }
    const id = retryId(req.user.id, body.client_request_id);
    if (id) {
      const prior = await store.ownMoment(id, req.user.id);
      if (prior) return res.status(201).json({ moment: await oneMoment(prior, req.user.id) });
    }
    // ── Under a made-up name: who may, how often, and what a made-up-name Moment never carries ──
    // It goes to people nearby from an area or a public place (never with no location, which is for connections),
    // says nothing of how high or that its writer is there now, and its words are read before it is saved.
    const underPenName = body.post_as === 'pen_name';
    let pen = null;
    if (underPenName) {
      const refusal = req.user.accountType === 'curator' || body.location.source === 'none' || body.audience !== 'nearby'
        ? { status: 400, code: 'PEN_NAME_AUDIENCE', message: 'A made-up name can post to people nearby only. The fewer people who see a Moment, the easier it is to guess who made it.' }
        // A long video's later parts are found by the account that made the first; under a made-up name there is none.
        : body.series ? { status: 400, code: 'PEN_NAME_NOT_FOR_THIS', message: "A video posted in parts can't go out under a made-up name. Post one of up to a minute." }
        : await penName.gate.accountRefusal(req.user.id)
          || await penName.gate.limitRefusal(req.user.id, 'moment')
          || await penName.gate.wordsRefusal([body.caption, body.text, ...playItems.wordsOf(play), ...playItems.wordsOfDots(dots)]);
      if (refusal) throw store.fail(refusal.status, refusal.code, refusal.message);
      pen = await penName.write.requireName(req.user.id);
      Object.assign(body, { show_area: false, altitude: null, taken_here: false, show_weather: false });
    }
    // No location: connections only, no area, no place.
    const unplaced = body.location.source === 'none';
    if (unplaced) Object.assign(body, { audience: 'connections', show_area: false, venue_id: null, place_key: null });
    await store.checkPostingRules(req.user, body);
    // With the Sky on for the author, skyPlacement decides where the Moment goes; off, the rules from before it do.
    const skyFor = await store.skyOn(req.user);
    // A made-up-name Moment always floats over its area (or sits at a public place with its own picture taken there),
    // whatever the Sky's switch says for its writer.
    const sky = !unplaced && (skyFor || underPenName);
    // "Share later" (with the Sky on, a Moment with no place too): the time it shares, worked out now.
    const shareAt = skyFor && body.share_later
      ? momentSchedule.shareAtFor(body.share_later, Date.now(),
        await momentSchedule.zoneFor(req.user.id, body.location.latitude, body.location.longitude))
      : null;
    const placed = sky ? await skyPlacement(req.user.id, body, { floatAway: underPenName }) : null;
    // A venue picked in the place picker moves the pin to it and names it; found again here by its id near the pin.
    const venue = sky ? placed.venue : body.venue_id && !body.show_area
      ? await momentPlace.venueNear(body.venue_id, body.location.latitude, body.location.longitude)
      : null;
    if (!sky && body.venue_id && !body.show_area && !venue) {
      throw store.fail(422, 'PLACE_NOT_NEARBY', "That place is too far from this Moment's pin. Pick one nearby.");
    }
    const area = sky ? placed.area : null;
    const location = venue ? { ...body.location, latitude: venue.latitude, longitude: venue.longitude } : body.location;
    const { latitude, longitude } = location;
    let found;
    let atHome;
    // Whether the author is away from home where they stand (the Live mark is kept only then; a failed read is home).
    let markHomeClear = false;
    if (unplaced) {
      [found, atHome] = [{ place_label: null, area_label: null, places: [] }, false];
    } else if (sky && (venue || area)) {
      // A pin at a place says the place's name; a Moment over its area the area's town, read at the area's point.
      const town = area ? await momentPlace.townAt(area.latitude, area.longitude) : null;
      [found, atHome] = [{ place_label: venue ? venue.label : town, area_label: town, places: [] }, placed.atHome];
      markHomeClear = !placed.atHome;
    } else if (sky) {
      // Where it was taken: the names that fit the spot, as before the Sky (only places that can take a pin).
      [found, atHome] = [await momentPlace.labelsAt(latitude, longitude, { pinnableOnly: true }), false];
      markHomeClear = !placed.atHome;
    } else {
      // A failed home read counts as at home here too: the town's name, no height. A picked place moves the pin, so for
      // the Live mark "at home" is also asked at the point the phone sent.
      const [labelsHere, home, spot] = await Promise.all([
        momentPlace.labelsAt(latitude, longitude),
        momentPlace.isAtHome(req.user.id, latitude, longitude, { onFailure: true }),
        venue && body.taken_here
          ? momentPlace.isAtHome(req.user.id, body.location.latitude, body.location.longitude, { onFailure: true })
          : false,
      ]);
      [found, atHome] = [labelsHere, home];
      markHomeClear = !home && !spot;
    }
    // The name the author picked for this point, worked out again here; an area or at-home Moment says the town.
    const labels = venue
      ? { ...found, place_label: venue.label, places: [{ key: 'venue', label: venue.label }, ...found.places] }
      : { ...found, place_label: momentPlace.pickedLabel(found, body.place_key) || found.place_label };
    const showArea = sky ? Boolean(area) : body.show_area;
    const shown = showArea || atHome ? labels.area_label : labels.place_label;
    // The height is kept only away from home, and only while heights are on for the author: an exact pin's rounded to
    // 10 ft, a floating Moment's to 100 ft.
    const reading = store.shownAltitude(body.altitude, { atHome, showArea, unplaced, floating: Boolean(area) });
    const altitude = reading && (await store.heightsOn(req.user)) ? reading : null;
    const takenAt = store.takenAtShown(body.location.source === 'capture' ? body.location.taken_at : body.taken_at);
    // The Live mark (API v4.1): kept only for a camera photo or video at its exact pin away from home, the places a
    // height is kept (a failed home read counts as home, so it drops the mark); newMomentRow decides again on what it
    // stores. Its weather is read here, within its budget, never taken from
    // the phone.
    // Any top-level `taken_at` means an album item (the apps send it for nothing else): no mark, however recent.
    const marked = body.taken_here && markHomeClear && store.markKept({
      kind: body.kind, source: body.location.source, atHome, showArea, unplaced, floating: Boolean(area),
      takenAt: takenAt || body.taken_at || null,
    });
    const weather = marked && body.show_weather ? await momentWeather.weatherAt(latitude, longitude) : null;
    if (underPenName) {
      // Never an exact point that isn't a public place, and never where too few verified homes could have made it.
      if (!area && !venue) throw store.fail(400, 'PEN_NAME_NEEDS_PLACE', 'A Moment under a made-up name needs a place, so it reaches people nearby.');
      const crowd = await penName.gate.crowdRefusal(area ? area.latitude : latitude, area ? area.longitude : longitude);
      if (crowd) throw store.fail(crowd.status, crowd.code, crowd.message);
    }
    const draft = store.newMomentRow({
      userId: underPenName ? penName.SYSTEM_ACCOUNT_ID : req.user.id,
      pen,
      accountType: req.user.accountType,
      kind: body.kind,
      hours: body.hours,
      audience: body.audience,
      showArea,
      atHome,
      caption: body.caption || null,
      text: body.text || null,
      background: body.background || 'teal',
      location,
      labels,
      labelKind: unplaced ? 'none' : sky && venue ? 'place' : momentPlace.labelKind(labels, shown),
      takenAt,
      venueId: venue && body.venue_id ? body.venue_id : null,
      altitude,
      series: body.series || null,
      area,
      shareAt,
      takenHere: marked,
      weather,
    });
    // Made at home, or from a pin moved off where the author stood at home (a failed home read counts as home).
    const studioAtHome = atHome || (!unplaced && !markHomeClear);
    if (guess && studioAtHome) throw store.fail(422, 'GUESS_AT_HOME', "Guess the spot can't be at your home.");
    seal.checkPosting(sealAsk, { unplaced, floating: Boolean(area), showArea, atHome: studioAtHome, underPenName, guess });
    pinboard.checkPosting(pinboardAsk, { kind: body.kind, underPenName });
    const pinboardStartId = pinboardAsk?.of ? await pinboard.checkPiece(req.user.id, pinboardAsk.of) : null;
    let retakeStartId = null;
    if (retakeAsk) {
      retake.checkPosting(retakeAsk, {
        kind: body.kind, source: body.location.source, shareAt, floating: Boolean(area), showArea, atHome: studioAtHome,
        underPenName, guess,
      });
      if (retakeAsk.of) {
        retakeStartId = await retake.checkFrame(req.user.id, retakeAsk.of, { latitude: body.location.latitude, longitude: body.location.longitude });
      }
    }
    // Eyes on (CONTRACT 8f): an answer is a photo taken there now, never from the answerer's home.
    const eyesOnFor = studio && req.body?.eyes_on_for != null
      ? await eyesOn.checkAnswer(req.user.id, req.body.eyes_on_for, {
        kind: body.kind, source: body.location.source, latitude: body.location.latitude, longitude: body.location.longitude, atHome: studioAtHome,
      })
      : null;
    if (studio) {
      // The values every stamp shows, read by the server now (never from the phone), at the point everyone sees. One
      // made at home, or from a pin moved off where the author stood at home, says no weather, height or distance.
      const stampsAtHome = studioAtHome;
      draft.post_metadata.moment = {
        ...draft.post_metadata.moment,
        stamps: studio.placements,
        stamp_values: await momentStamps.valuesFor({
          userId: req.user.id,
          point: store.displayedPoint(draft),
          placeLabel: draft.location_name,
          town: unplaced ? null : labels.area_label,
          atHome: stampsAtHome,
          penName: underPenName,
          sharedLater: Boolean(shareAt),
          fresh: body.location.source !== 'capture' && !body.taken_at,
          takenAt: body.location.source === 'capture' ? body.location.taken_at : body.taken_at,
          elevation: underPenName ? null
            : store.shownAltitude(studio.reading, { atHome: stampsAtHome, showArea, unplaced, floating: Boolean(area) }),
          // The Live mark's own reading when the post made one (null when it found none); otherwise read here.
          weather: marked && body.show_weather ? weather : undefined,
        }),
        // Guess the spot: the town it is in (for the daily spot), when one was found.
        ...(guess ? { guess: { v: 1, town: labels.area_label && labels.area_label !== momentPlace.FALLBACK_LABEL ? labels.area_label : null } } : {}),
        // My Atlas (CONTRACT 6e): posted with the switch on, its files are kept for its author (jobs/momentsCleanup).
        kept: true,
        // Playable items (CONTRACT 7b); the answers are rows of PostAnswer.
        ...(play.length ? { play } : {}),
        ...(dots.length ? { dots } : {}),
        ...(deck ? { deck } : {}),
        ...(eyesOnFor ? { eyes_on_for: eyesOnFor } : {}),
        // Seal it (CONTRACT 8g): it stays, so it is there when it opens.
        ...(sealAsk ? seal.keptPart(sealAsk) : {}),
        // Pinboards (CONTRACT 8i): a start or a piece; it stays.
        ...(pinboardAsk ? pinboard.keptPart(pinboardAsk, pinboardStartId) : {}),
        // Retake (CONTRACT 8e): a start or a frame; it stays, kept as a post that stays.
        ...(retakeAsk ? retake.keptPart(retakeAsk, retakeStartId) : {}),
        // Convergences (CONTRACT 8h): "Join tonight's sky: your photo stays in the piece", the author's own choice.
        ...(req.body?.join_convergence === true ? { convergence_join: true } : {}),
        // "Your day" (CONTRACT 8k): the approved day (no trail: its line runs through the Moments' own points); it stays.
        ...(studio ? yourDay.keptPart(req.body?.your_day) : {}),
        // Live beams (CONTRACT 9h): the way a photo taken here now faced; never at home, floating, an area, a made-up name or a guess spot.
        ...beams.keptPart(req.body?.heading, {
          kind: body.kind, source: body.location.source, takenAt: body.taken_at, shareAt, atHome: studioAtHome,
          floating: Boolean(area), showArea, underPenName, guess, audience: body.audience,
        }),
        // Loop (CONTRACT 7j): the span the new viewers repeat; the file stays an ordinary video.
        ...require('../services/pulse/loop').keptPart(loop),
        // A picture shown as composed (CONTRACT 10c): fit on its backdrop, and a video's place on the canvas.
        ...composed,
        // Replies people can see (CONTRACT 8a): the author's choice for this Moment, never under a made-up name.
        ...require('../services/pulse/replies').choiceAtPosting(req.body?.replies_shown, { penName: underPenName }),
        // Mentions (CONTRACT 7h): the author's connections who may see it, not blocked either way; none under a made-up name.
        ...(mentionIds?.length ? await keptMentions(mentionIds, req.user.id, {
          penName: underPenName, audience: body.audience, guess: Boolean(guess),
        }) : {}),
        // Explore (CONTRACT 6f): "Also show in Explore", kept only for a Moment with a place, to people nearby, not at
        // home and not under a made-up name (dropped anywhere else, never an error), with the town it is in.
        ...(req.body?.explore === true && !unplaced && body.audience === 'nearby' && !studioAtHome && !underPenName
          ? { explore: { v: 1, town: labels.area_label && labels.area_label !== momentPlace.FALLBACK_LABEL ? labels.area_label : null } }
          : {}),
      };
    }
    const { row, created } = await store.insertMoment(draft, id, underPenName ? { userId: req.user.id, pen } : null);
    logger.info('moments.created', { momentId: row.id, kind: body.kind, hours: body.hours, audience: body.audience,
      ...(sky ? { floating: Boolean(area) } : {}), ...(shareAt ? { share_at: shareAt } : {}),
      ...(studio ? { stamps: studio.placements.length } : {}), ...(guess ? { guess: true } : {}),
      ...(play.length ? { play: play.map((item) => item.kind) } : {}),
      ...(dots.length ? { dots: dots.map((dot) => dot.kind) } : {}),
      ...(marked ? { taken_here: true, weather: Boolean(weather) } : {}) });
    res.status(201).json({ moment: await oneMoment(row, req.user.id) });
    // A text card is live now: its author's connections hear of it (a photo or video when its check finishes; one shared
    // later at its time, from jobs/momentsShareLater.js). After the answer, and on its own: it never slows or fails the
    // post.
    // (Nobody is told a made-up-name Moment is by someone they know.)
    if (created && body.kind === 'text' && !underPenName) momentNotify.notifyConnections(row);
  } catch (error) {
    sendError(res, error, 'create');
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: media.MAX_VIDEO_BYTES, files: 4, fields: 8, parts: 12, fieldSize: 1024, fieldNameSize: 100 },
});
const receive = upload.fields([{ name: 'file', maxCount: 1 }, { name: 'poster', maxCount: 1 },
  { name: 'frames[]', maxCount: 2 }, { name: 'frames', maxCount: 2 }]);

function receiveFiles(req, res, next) {
  receive(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'This file is too large to post.', code: 'MEDIA_TOO_LARGE' });
    }
    return res.status(400).json({ error: 'Send the photo or video as "file", and a video\'s "poster" and "frames[]".', code: 'MOMENT_INVALID' });
  });
}

/** POST /:id/media — the photo or video of the caller's own Moment; the picture check runs, then it goes live. */
router.post('/:id/media', uploadLimiter, receiveFiles, async (req, res) => {
  try {
    const id = momentId(req);
    const row = await store.ownMoment(id, req.user.id);
    if (!row) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
    if (store.momentState(row) === 'ended') throw store.fail(410, 'MOMENT_ENDED', 'This Moment has ended.');
    const kind = store.meta(row).kind;
    if (kind === 'text') throw store.fail(400, 'MOMENT_INVALID', 'A text card has no file.');

    const sentSha = req.files?.file?.[0] ? media.sha256(req.files.file[0].buffer) : null;
    const existing = store.meta(row).media;
    if (existing) {
      // The same file again (a retry after a lost answer) changes nothing.
      if (sentSha && existing.upload_sha256 === sentSha) return res.json({ moment: await oneMoment(row, req.user.id) });
      throw store.fail(409, 'MOMENT_MEDIA_EXISTS', 'This Moment already has its file. Post a new Moment instead.');
    }

    const files = req.files || {};
    const prepared = await momentUpload.prepareFiles(kind, {
      file: files.file?.[0] || null,
      poster: files.poster?.[0] || null,
      frames: [...(files['frames[]'] || []), ...(files.frames || [])],
    });
    const record = await momentUpload.storeFiles(row, prepared);
    const checking = await store.updateMoment(row, {
      moment: { media: record, state: 'checking', checking_since: new Date().toISOString() },
    }, { 'post_metadata->moment->>media': null, archived_at: null });
    if (!checking) {
      // Another upload of this Moment got there first.
      const current = await store.loadMoment(id);
      if (current && store.meta(current).media?.upload_sha256 === prepared.uploadSha) {
        return res.json({ moment: await oneMoment(current, req.user.id) });
      }
      throw store.fail(409, 'MOMENT_MEDIA_EXISTS', 'This Moment already has its file. Post a new Moment instead.');
    }

    const pictures = await Promise.all(momentUpload.checkSources(kind, prepared).map((buffer) => media.checkImage(buffer)));
    const finished = momentCheck.checkPictures(pictures, { madeUpName: penName.isPenNameRow(checking) })
      .then((result) => momentCheck.finishUpload(checking, result));
    finished.catch((error) => logger.error('moments.check_finish_failed', { momentId: id, error: error.message }));
    let timer;
    const done = await Promise.race([
      finished.then((updated) => updated || null, () => null),
      new Promise((resolve) => { timer = setTimeout(() => resolve(undefined), CHECK_WAIT_MS); }),
    ]);
    clearTimeout(timer);
    const latest = done || await store.loadMoment(id) || checking;
    res.json({ moment: await oneMoment(latest, req.user.id) });
  } catch (error) {
    sendError(res, error, 'media');
  }
});

// ─── Reading ────────────────────────────────────────────────────────────────

const mapSchema = Joi.object({
  south: Joi.number().min(-90).max(90).required(),
  west: Joi.number().min(-180).max(180).required(),
  north: Joi.number().min(-90).max(90).required(),
  east: Joi.number().min(-180).max(180).required(),
  zoom: Joi.number().min(0).max(25),
});

/**
 * GET /map — the rings in view: live Moments the caller may see, blocks and mutes removed. `heights_on` says whether
 * Moment heights are on for the caller (the `moment_heights` flag), so an app can offer its "Heights" control even
 * where no ring in view carries a height; it says nothing about anyone else. `float_on` says whether Moments with an
 * elevation float on the caller's map by day (`moment_float`, which needs `moment_heights` too); only then `sun` says
 * where the sun is right now over the middle of the box, so both phones draw the same shadows.
 */
router.get('/map', async (req, res) => {
  try {
    const box = parseBody(mapSchema, req.query);
    if (box.south >= box.north || box.west >= box.east) throw store.fail(400, 'MOMENT_INVALID', 'Send a map area with south < north and west < east.');
    // `unplaced`: connections' Moments with no location (and the caller's own), for the row of faces, whatever the box.
    // Guess the spot (Pulse, reinvented; CONTRACT 5d): the live guess-the-spot Moments in view, with no point, only for
    // a reader with the switch on, read alongside the rings. A failed read leaves them out; the map still answers.
    const guessSpots = async () => ((await store.reinventedOn(req.user))
      ? momentGuess.guessSpotsIn(req.user.id, box).catch((error) => {
        logger.warn('moments.guess_spots_failed', { error: error.message });
        return [];
      })
      : undefined);
    const [rings, unplaced, heights, float, sky, spots] = await Promise.all([
      store.mapRings(req.user.id, box), store.unplacedRings(req.user.id), store.heightsOn(req.user), store.floatOn(req.user),
      store.skyOn(req.user), guessSpots(),
    ]);
    const answer = { rings, unplaced, heights_on: heights, float_on: float };
    if (spots) answer.guess_spots = spots;
    // The Sky (share later): the caller's own Moments waiting for their time, for their own row ("Shares at 6:40 pm"),
    // soonest first. Never anyone else's, never on the map; only while the Sky is on for the caller.
    if (sky) {
      answer.scheduled = (await store.ownMoments(req.user.id))
        .filter((moment) => moment.state === 'scheduled')
        .sort((a, b) => String(a.share_at).localeCompare(String(b.share_at)));
    }
    if (float) answer.sun = sunPosition((box.south + box.north) / 2, (box.west + box.east) / 2);
    res.json(answer);
  } catch (error) {
    sendError(res, error, 'map');
  }
});

/**
 * GET /unseen — the Moments tab's dot: how many people have a live Moment in the box that the caller may see and
 * hasn't watched, new since `since` (the last time they had the tab open; none: any). Never their own.
 */
router.get('/unseen', async (req, res) => {
  try {
    const { since, include_unplaced: includeUnplaced, ...box } = parseBody(mapSchema.keys({
      since: Joi.string().isoDate(),
      // Apps that show Moments with no location (contract v3.4) ask for them to count; older ones don't.
      include_unplaced: Joi.boolean().default(false),
    }), req.query);
    if (box.south >= box.north || box.west >= box.east) throw store.fail(400, 'MOMENT_INVALID', 'Send a map area with south < north and west < east.');
    res.json({ count: await store.unseenPeople(req.user.id, box, since ? Date.parse(since) : null, { includeUnplaced }) });
  } catch (error) {
    sendError(res, error, 'unseen');
  }
});

/** GET /mine — the caller's own Moments that haven't ended, in any state. */
router.get('/mine', async (req, res) => {
  try {
    res.json({ moments: await store.ownMoments(req.user.id) });
  } catch (error) {
    sendError(res, error, 'mine');
  }
});

// A ring holds a person's Moments at one spot: a day's posting limit is far under this.
const BATCH_MAX = 40;

/**
 * GET /batch?ids=a,b,c — several Moments in one read, each as GET /:id answers it (signed links included), in the
 * order asked. The viewer reads a person's whole ring and the next person's first Moment ahead with it. One the caller
 * can't open (ended, not live, blocked, muted, not theirs to see) is left out, never an error.
 */
router.get('/batch', async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').map((id) => id.trim()).filter((id) => UUID.test(id)).slice(0, BATCH_MAX);
    const rows = await store.openMoments(ids, req.user.id);
    res.json({ moments: await store.serializeMoments(rows, req.user.id) });
  } catch (error) {
    sendError(res, error, 'batch');
  }
});

/**
 * GET /people?ids=a,b,c — the rings around profile pictures: for the people on a screen (up to 100 account ids), who
 * has live Moments the caller may see, one ring per person with all of them in the order they play. The map's rules
 * decide (blocks, mutes, "my connections only", the Moments the caller reported): someone with nothing the caller may
 * see is left out, never an error.
 */
router.get('/people', async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').map((id) => id.trim()).filter((id) => UUID.test(id)).slice(0, store.MAX_PEOPLE);
    res.json({ rings: await store.peopleRings(req.user.id, ids) });
  } catch (error) {
    sendError(res, error, 'people');
  }
});

/**
 * GET /daily-spot?latitude=&longitude= — the town's guess-the-spot Moment for today (Pulse, reinvented; CONTRACT 5d),
 * the same for everyone, with no storage: { daily_spot: null | { moment_id, town, day, guessed } }. Only while the
 * switch is on for the caller (403 PULSE_REINVENTED_OFF otherwise). Before GET /:id, which would take its path.
 */
router.get('/daily-spot', reinventedOnly, async (req, res) => {
  try {
    const at = parseBody(Joi.object(point), req.query);
    res.json(await momentGuess.dailySpotFor(req.user.id, at.latitude, at.longitude));
  } catch (error) {
    sendError(res, error, 'daily_spot');
  }
});

/** GET /:id — one Moment, with its signed links; 410 once it has ended. */
router.get('/:id', async (req, res) => {
  try {
    const row = await store.openMoment(momentId(req), req.user.id);
    res.json({ moment: await oneMoment(row, req.user.id) });
  } catch (error) {
    sendError(res, error, 'read');
  }
});

/** POST /:id/view — the caller watched it: one view per person; the author's own views aren't counted. */
router.post('/:id/view', actionLimiter, async (req, res) => {
  try {
    const row = await store.openMoment(momentId(req), req.user.id);
    if (!store.isOwn(row, req.user.id)) {
      const { error } = await supabaseAdmin.rpc('record_post_unique_view', { p_post_id: row.id, p_user_id: req.user.id });
      if (error) throw new Error(`Failed to record the view: ${error.message}`);
    }
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'view');
  }
});

/** GET /:id/viewers — the author's "Seen by": who watched, newest first, with their reaction and whether they replied. */
router.get('/:id/viewers', async (req, res) => {
  try {
    const row = await store.ownMoment(momentId(req), req.user.id);
    if (!row) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
    if (store.momentState(row) === 'ended') throw store.fail(410, 'MOMENT_ENDED', 'This Moment has ended.');
    res.json(await store.viewersOf(row, req.user.id, { signals: await store.reinventedOn(req.user) }));
  } catch (error) {
    sendError(res, error, 'viewers');
  }
});

// ─── Acting on someone's Moment ─────────────────────────────────────────────

async function othersMoment(req) {
  const row = await store.openMoment(momentId(req), req.user.id);
  if (store.isOwn(row, req.user.id)) throw store.fail(400, 'MOMENT_OWN', 'This is your own Moment.');
  return row;
}

/**
 * PUT /:id/reaction — { emoji } (one of the post reactions) or { emoji: null } to take it back. With `pulse_reinvented`
 * on for the caller it also takes { signal } (one of the five signals, or null), and the answer adds `my_signal`;
 * `my_reaction` stays the emoji (a signal's nearest one), as every other answer says it. A signal sent while the
 * switch is off: 403 PULSE_REINVENTED_OFF.
 */
router.put('/:id/reaction', actionLimiter, async (req, res) => {
  try {
    const reinvented = await store.reinventedOn(req.user);
    const sentSignal = Boolean(req.body) && Object.prototype.hasOwnProperty.call(req.body, 'signal');
    // A signal from a person whose switch is off: the Studio-only answer, so their app goes back to today's screens.
    if (sentSignal && !reinvented) throw store.reinventedOff();
    const bySignal = reinvented && sentSignal;
    const raw = bySignal ? req.body.signal : req.body?.emoji;
    const emoji = raw === null ? null : bySignal ? normalizePostSignal(raw) : normalizePostReaction(raw);
    if (raw !== null && !emoji) {
      throw store.fail(400, 'MOMENT_INVALID', bySignal ? 'Choose one of the signals.' : 'Choose one of the reactions.');
    }
    const row = await othersMoment(req);
    const { error } = await supabaseAdmin.rpc('set_post_reaction', { p_post_id: row.id, p_user_id: req.user.id, p_reaction: emoji });
    if (error) throw new Error(`Failed to save the reaction: ${error.message}`);
    if (reinvented) {
      return res.json({ my_reaction: emoji && shownReaction(emoji), my_signal: emoji && shownSignal(emoji) });
    }
    res.json({ my_reaction: emoji });
  } catch (error) {
    sendError(res, error, 'reaction');
  }
});

/** POST /:id/reply — { text }: a message in the caller's direct chat with the author, naming the Moment. */
router.post('/:id/reply', actionLimiter, async (req, res) => {
  try {
    const { text } = parseBody(Joi.object({ text: Joi.string().trim().min(1).max(1000).required() }), req.body);
    const row = await othersMoment(req);
    // A reply is a direct chat message to the Moment's author, and a made-up name has no chats: reactions only.
    if (penName.isPenNameRow(row)) {
      throw store.fail(403, 'MOMENT_REPLY_UNAVAILABLE', 'A Moment under a made-up name takes reactions, not replies.');
    }
    const author = (await store.loadAuthors([row.user_id])).get(String(row.user_id));
    res.json(await momentChat.replyToMoment({
      row, author, replierId: req.user.id, text, io: req.app.get('io'), requestId: req.requestId,
    }));
  } catch (error) {
    sendError(res, error, 'reply');
  }
});

/** POST /:id/report — { reason, details? }: into the report queue; two people's reports hold it until reviewed. */
router.post('/:id/report', actionLimiter, async (req, res) => {
  try {
    const { reason, details } = parseBody(Joi.object({
      reason: Joi.string().valid(...REPORT_REASONS).required(),
      details: Joi.string().trim().max(1000).allow('', null),
    }), req.body);
    const row = await othersMoment(req);
    await filePostReport({ postId: row.id, userId: req.user.id, reason, details: details || null });
    await store.holdIfReported(row);
    res.json({ message: 'Thanks. We will review this Moment.' });
  } catch (error) {
    sendError(res, error, 'report');
  }
});

// ─── Changing one's own Moment (Pulse, reinvented) ─────────────────────────

const editSchema = Joi.object({
  caption: Joi.string().trim().max(100).allow('', null),
  // The whole new list of placements (momentStamps.parsePlacements checks it); the values stay those kept at posting.
  stamps: Joi.any(),
  audience: Joi.string().valid(...store.AUDIENCES),
  mentions: Joi.any(),
}).or('caption', 'stamps', 'audience', 'mentions');

/**
 * PATCH /:id — the author changes the caption, the stamps or who sees it, for 15 minutes after it went out
 * (store.editableUntil). Only while `pulse_reinvented` is on for them: with it off, 403 PULSE_REINVENTED_OFF (today's
 * apps never send this request). A text card has no caption; a Moment
 * with no location stays with connections and one under a made-up name with people nearby. Nobody is notified; others
 * read the change on their next read.
 */
// Before anything else, the rate limit included: with the switch off the edit answers 403 PULSE_REINVENTED_OFF
// (store.reinventedOff), so an app still drawing the Studio re-reads the switch and goes back to today's screens.
async function reinventedOnly(req, res, next) {
  if (await store.reinventedOn(req.user)) return next();
  return sendError(res, store.reinventedOff(), 'edit');
}

router.patch('/:id', reinventedOnly, actionLimiter, async (req, res) => {
  try {
    const id = momentId(req);
    const changes = parseBody(editSchema, req.body);
    const stamps = changes.stamps === undefined ? undefined : momentStamps.parsePlacements(changes.stamps);
    let mentionIds;
    try {
      mentionIds = mentions.parse(changes.mentions);
    } catch (mentionError) {
      throw store.fail(400, 'MOMENT_INVALID', mentionError.message);
    }
    const row = await store.ownMoment(id, req.user.id);
    if (!row) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
    const state = store.momentState(row);
    if (state === 'ended') throw store.fail(410, 'MOMENT_ENDED', 'This Moment has ended.');
    if (!store.editableUntil(row)) {
      throw store.fail(409, 'MOMENT_EDIT_CLOSED', state === 'held'
        ? "This Moment can't be changed while Pantopus reviews it."
        : 'A Moment can be changed for 15 minutes after it goes out.');
    }
    const m = store.meta(row);
    const underPenName = penName.isPenNameRow(row);
    if (changes.caption !== undefined && m.kind === 'text') throw store.fail(400, 'MOMENT_INVALID', 'A text card has no caption.');
    if (changes.audience === 'nearby' && row.latitude == null) {
      throw store.fail(400, 'MOMENT_INVALID', 'A Moment with no location goes only to your connections.');
    }
    if (changes.audience === 'connections' && underPenName) {
      throw store.fail(400, 'PEN_NAME_AUDIENCE', 'A made-up name can post to people nearby only. The fewer people who see a Moment, the easier it is to guess who made it.');
    }
    if (underPenName && changes.caption) {
      const refusal = await penName.gate.wordsRefusal([changes.caption]);
      if (refusal) throw store.fail(refusal.status, refusal.code, refusal.message);
    }
    const updated = await store.updateMoment(row, {
      ...(changes.caption !== undefined ? { content: changes.caption || '' } : {}),
      ...(changes.audience ? { audience: changes.audience } : {}),
      moment: {
        ...(stamps !== undefined ? { stamps } : {}),
        // Mentions (CONTRACT 7h): the whole new list, kept by the same rules as on posting, for who sees it after the edit.
        ...(mentionIds ? {
          mentions: await mentions.keep(mentionIds, req.user.id, {
            penName: underPenName,
            maySee: (person) => mentions.maySeeMoment({ ...row, audience: changes.audience || row.audience }, person),
          }),
        } : {}),
        edited_at: new Date().toISOString(),
      },
    }, { archived_at: null });
    if (!updated) throw store.fail(410, 'MOMENT_ENDED', 'This Moment has ended.');
    logger.info('moments.edited', { momentId: id, caption: changes.caption !== undefined, audience: changes.audience || null,
      ...(stamps !== undefined ? { stamps: stamps.length } : {}) });
    res.json({ moment: await oneMoment(updated, req.user.id) });
  } catch (error) {
    sendError(res, error, 'edit');
  }
});

/** DELETE /:id — the author deletes their Moment; its files go unless a review holds them. */
router.delete('/:id', actionLimiter, async (req, res) => {
  try {
    const row = await store.ownMoment(momentId(req), req.user.id);
    if (!row) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
    if (!row.archived_at) await store.deleteMoment(row);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'delete');
  }
});

// ─── Guess the spot (Pulse, reinvented) ────────────────────────────────────

/**
 * POST /:id/guess — { latitude, longitude }: the caller's one guess on someone's live guess-the-spot Moment (CONTRACT
 * 5c). Answers how far off it was and the Moment in full; a second guess answers the first again. Only while the switch
 * is on for the caller (403 PULSE_REINVENTED_OFF otherwise).
 */
router.post('/:id/guess', reinventedOnly, actionLimiter, async (req, res) => {
  try {
    const at = parseBody(Joi.object(point), req.body);
    const row = await othersMoment(req);
    if (!momentGuess.isGuess(row)) throw store.fail(400, 'MOMENT_INVALID', "This Moment isn't a guess-the-spot one.");
    const answer = store.displayedPoint(row);
    if (answer.latitude == null) throw store.fail(400, 'MOMENT_INVALID', "This Moment isn't a guess-the-spot one.");
    const result = await momentGuess.recordGuess(row, req.user.id, at, answer);
    logger.info('moments.guessed', { momentId: row.id, distance_m: result.distance_m });
    res.json({ guess: result, moment: await oneMoment(row, req.user.id) });
  } catch (error) {
    sendError(res, error, 'guess');
  }
});

// ─── Muting a person's Moments ──────────────────────────────────────────────

async function mutedAccount(req) {
  const userId = String(req.params.userId || '');
  if (!UUID.test(userId)) throw store.fail(404, 'USER_NOT_FOUND', 'This person could not be found.');
  if (userId === req.user.id) throw store.fail(400, 'MOMENT_OWN', "You can't mute your own Moments.");
  const { data, error } = await supabaseAdmin.from('User').select('id, account_type').eq('id', userId).maybeSingle();
  if (error) throw new Error(`Failed to load the person: ${error.message}`);
  if (!data) throw store.fail(404, 'USER_NOT_FOUND', 'This person could not be found.');
  return { id: data.id, type: data.account_type === 'business' ? 'business' : 'user' };
}

// A made-up name's id rides where an account's would. Muting it hides everything that account makes under any made-up
// name, Moments and posts alike (services/penName): there is no Moments-only mute of a name.
async function mutedPenName(req, undo) {
  const id = String(req.params.userId || '');
  if (!UUID.test(id) || !await penName.present.isPenNameId(id)) return false;
  try {
    if (undo) await penName.present.unhide(req.user.id, id);
    else await penName.present.hide(req.user.id, id);
  } catch (error) {
    if (!error.code) throw error;
    throw store.fail(error.status, error.code, error.message);
  }
  feedService.invalidateFilterCache(req.user.id);
  return true;
}

/** PUT /authors/:userId/mute — hide this person's Moments (only their Moments; Settings lists it to undo). */
router.put('/authors/:userId/mute', actionLimiter, async (req, res) => {
  try {
    if (await mutedPenName(req, false)) return res.status(204).end();
    const account = await mutedAccount(req);
    const { data: existing, error: readError } = await supabaseAdmin.from('PostMute').select('id')
      .eq('user_id', req.user.id).eq('muted_entity_type', account.type).eq('muted_entity_id', account.id)
      .eq('surface', 'moments').limit(1);
    if (readError) throw new Error(`Failed to read mutes: ${readError.message}`);
    if (!existing?.length) {
      const { error } = await supabaseAdmin.from('PostMute').insert({
        user_id: req.user.id, muted_entity_type: account.type, muted_entity_id: account.id, surface: 'moments',
      });
      if (error && String(error.code) !== '23505') throw new Error(`Failed to mute: ${error.message}`);
    }
    feedService.invalidateFilterCache(req.user.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'mute');
  }
});

/** DELETE /authors/:userId/mute — show this person's Moments again. */
router.delete('/authors/:userId/mute', actionLimiter, async (req, res) => {
  try {
    if (await mutedPenName(req, true)) return res.status(204).end();
    const account = await mutedAccount(req);
    const { error } = await supabaseAdmin.from('PostMute').delete()
      .eq('user_id', req.user.id).eq('muted_entity_id', account.id).eq('surface', 'moments');
    if (error) throw new Error(`Failed to unmute: ${error.message}`);
    feedService.invalidateFilterCache(req.user.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'unmute');
  }
});

module.exports = router;
