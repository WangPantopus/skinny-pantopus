// Pulse, reinvented, phase 1 (the one Pulse tab): the routes only its new screens call (coord CONTRACT section 6).
// Every one is for a signed-in person whose `pulse_reinvented` switch is on; with it off they answer
// 403 PULSE_REINVENTED_OFF, and nothing any other route answers changes. They live here, not under /api/pulse, whose
// router belongs to the paused Pulse redesign and answers 403 PULSE_REDESIGN_UNAVAILABLE while that launch key is off.
const express = require('express');
const Joi = require('joi');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const store = require('../services/moments/momentStore');
const list = require('../services/pulse/list');
const pulseMap = require('../services/pulse/map');
const pulseFilters = require('../services/pulse/filters');
const atlas = require('../services/pulse/atlas');
const explore = require('../services/pulse/explore');
const keep = require('../services/pulse/keep');
const wantToCome = require('../services/pulse/wantToCome');
const play = require('../services/pulse/play');
const fieldCard = require('../services/pulse/fieldCard');
const planActions = require('../services/plans/planActions');
const requireFeatureFlag = require('../middleware/requireFeatureFlag');
const { contentCreationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(verifyToken);
router.use(async (req, res, next) => {
  if (await store.reinventedOn(req.user)) return next();
  const off = store.reinventedOff();
  return res.status(off.status).json({ error: off.message, code: off.code });
});

function sendError(res, error, what) {
  if (error.status) {
    return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
  }
  logger.error(`reinvented.${what}.error`, { error: error.message });
  return res.status(503).json({ error: "Pulse couldn't load. Please try again.", code: 'PULSE_LIST_FAILED' });
}

const listSchema = Joi.object({
  reach: Joi.string().valid(...list.REACHES).default('around'),
  miles: Joi.number().integer().min(1).max(list.MAX_MILES).default(list.MAX_MILES),
  chip: Joi.string().valid(...list.CHIP_NAMES).default('all'),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  cursor: Joi.string().max(2000).allow(''),
  limit: Joi.number().integer().min(1).max(50).default(20),
  // One of the reader's circles, with Close circle (CONTRACT 8d).
  circle: Joi.string().guid(),
  // Filters (CONTRACT 10a): checked by filters.parse from the raw query, so a request without them reads as before.
  kinds: Joi.string().max(80),
  when: Joi.string().max(16),
  from: Joi.string().max(16),
  state: Joi.string().max(40),
  since: Joi.string().max(40),
  // The map's box (CONTRACT 11a): all four or none, as the map takes them.
  south: Joi.number().min(-90).max(90),
  west: Joi.number().min(-180).max(180),
  north: Joi.number().min(-90).max(90),
  east: Joi.number().min(-180).max(180),
  // Posts and Moments without a place after the placed ones (CONTRACT 11b).
  no_place: Joi.boolean().truthy('1').falsy('0'),
}).and('latitude', 'longitude');

const BOX_SIDES = ['south', 'west', 'north', 'east'];

/** GET /list — Close circle or Around me: the Moments and posts the caller may see, mixed (CONTRACT 6a). */
router.get('/list', async (req, res) => {
  try {
    const { error, value } = listSchema.validate(req.query || {}, { abortEarly: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message.replace(/"/g, ''), code: 'LIST_INVALID' });
    const {
      kinds: _k, when: _w, from: _f, state: _s, since: _si, south, west, north, east, no_place: noPlace, ...asked
    } = value;
    // The map's box (CONTRACT 11a): all four sides or none; south < north and west < east, as the map takes it.
    const sides = BOX_SIDES.filter((side) => value[side] !== undefined).length;
    if (sides && sides < 4) {
      return res.status(400).json({ error: "Send the map's area as south, west, north and east.", code: 'LIST_INVALID' });
    }
    if (sides && (south >= north || west >= east)) {
      return res.status(400).json({ error: 'Send a map area with south < north and west < east.', code: 'LIST_INVALID' });
    }
    const filters = pulseFilters.parse(req.query, { code: 'LIST_INVALID' });
    res.json(await list.listFor(req.user.id, {
      ...asked, ...(filters ? { filters } : {}), ...(sides ? { box: { south, west, north, east } } : {}), ...(noPlace ? { noPlace } : {}),
    }));
  } catch (error) {
    sendError(res, error, 'list');
  }
});

// The map's box, as GET /api/moments/map takes it.
const mapSchema = Joi.object({
  south: Joi.number().min(-90).max(90).required(),
  west: Joi.number().min(-180).max(180).required(),
  north: Joi.number().min(-90).max(90).required(),
  east: Joi.number().min(-180).max(180).required(),
  zoom: Joi.number().min(0).max(25),
  time: Joi.string().valid(...pulseMap.TIMES).default('live'),
  // Filters (CONTRACT 10a); the map's `time` is its When.
  kinds: Joi.string().max(80),
  when: Joi.string().max(16),
  from: Joi.string().max(16),
  state: Joi.string().max(40),
  since: Joi.string().max(40),
});

/** GET /map — the one map for a box and a time: rings, marks, tickets, guess spots (CONTRACT 6b). */
router.get('/map', async (req, res) => {
  try {
    const { error, value } = mapSchema.validate(req.query || {}, { abortEarly: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message.replace(/"/g, ''), code: 'MAP_INVALID' });
    const { time, zoom: _zoom, kinds: _k, when: _w, from: _f, state: _s, since: _si, ...box } = value;
    if (box.south >= box.north || box.west >= box.east) {
      return res.status(400).json({ error: 'Send a map area with south < north and west < east.', code: 'MAP_INVALID' });
    }
    const filters = pulseFilters.parse(req.query, { forMap: true, code: 'MAP_INVALID' });
    res.json(await pulseMap.mapFor(req.user, box, { time, ...(filters ? { filters } : {}) }));
  } catch (error) {
    sendError(res, error, 'map');
  }
});

const stripSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
}).and('latitude', 'longitude');

/** GET /strip — "Alive right now": Live from here, plans starting soon, rings of people you know (CONTRACT 6c). */
router.get('/strip', async (req, res) => {
  try {
    const { error, value } = stripSchema.validate(req.query || {}, { abortEarly: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message.replace(/"/g, ''), code: 'STRIP_INVALID' });
    res.json(await pulseMap.stripFor(req.user, value));
  } catch (error) {
    sendError(res, error, 'strip');
  }
});

// ─── Explore (CONTRACT 6f) ──────────────────────────────────────────────────

const exploreSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  cursor: Joi.string().max(500).allow(''),
}).and('latitude', 'longitude');

/** GET /explore — "Today, elsewhere", then newest with variety, each with why it is there. */
router.get('/explore', async (req, res) => {
  try {
    const { error, value } = exploreSchema.validate(req.query || {}, { abortEarly: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message.replace(/"/g, ''), code: 'EXPLORE_INVALID' });
    res.json(await explore.exploreFor(req.user.id, value));
  } catch (error) {
    sendError(res, error, 'explore');
  }
});

// ─── "Keep this?" (CONTRACT 6d) ─────────────────────────────────────────────

const keepSchema = Joi.object({ keep: Joi.boolean().required() });

/** POST /moments/:id/keep — { keep }: the author answers "Keep this?" once, in their Moment's last two hours. */
router.post('/moments/:id/keep', async (req, res) => {
  try {
    const { error, value } = keepSchema.validate(req.body || {}, { abortEarly: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message.replace(/"/g, ''), code: 'KEEP_INVALID' });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(404).json({ error: 'This Moment could not be found.', code: 'MOMENT_NOT_FOUND' });
    }
    res.json(await keep.answerKeep(req.user.id, req.params.id, value.keep));
  } catch (error) {
    sendError(res, error, 'keep');
  }
});

// ─── My Atlas (CONTRACT 6e) ─────────────────────────────────────────────────

const atlasSchema = Joi.object({
  cursor: Joi.string().max(500).allow(''),
  limit: Joi.number().integer().min(1).max(50).default(30),
  south: Joi.number().min(-90).max(90),
  west: Joi.number().min(-180).max(180),
  north: Joi.number().min(-90).max(90),
  east: Joi.number().min(-180).max(180),
}).and('south', 'west', 'north', 'east');

/** GET /atlas — the caller's own kept Moments, by date (cursor) or in a box, private to them. */
router.get('/atlas', async (req, res) => {
  try {
    const { error, value } = atlasSchema.validate(req.query || {}, { abortEarly: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message.replace(/"/g, ''), code: 'ATLAS_INVALID' });
    const { south, west, north, east, ...page } = value;
    const box = south == null ? null : { south, west, north, east };
    if (box && (box.south >= box.north || box.west >= box.east)) {
      return res.status(400).json({ error: 'Send a map area with south < north and west < east.', code: 'ATLAS_INVALID' });
    }
    res.json(await atlas.atlasFor(req.user.id, { ...page, box }));
  } catch (error) {
    sendError(res, error, 'atlas');
  }
});

/** DELETE /atlas/:id — Delete for good: the Moment ends, its files and picture keys go at once. */
router.delete('/atlas/:id', async (req, res) => {
  try {
    await atlas.deleteForGood(req.user.id, req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'atlas_delete');
  }
});

// ─── "Want to come?" (CONTRACT 6g) ──────────────────────────────────────────

/**
 * POST /moments/:id/plan — the author starts a plan in Plans from their own Moment. The body is a plan as
 * POST /api/plans takes it, and its answers and errors are Plans' own; `more`, `guests` and `extras` in the query
 * say what this app can draw, as on the Plans routes. Never a business's plan.
 */
router.post('/moments/:id/plan', requireFeatureFlag('plans'), contentCreationLimiter, async (req, res) => {
  try {
    const user = {
      ...req.user,
      plansMore: req.query.more === '1',
      plansGuests: req.query.guests === '1',
      plansExtras: req.query.extras === '1',
    };
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    res.status(201).json(await wantToCome.startPlan(user, req.params.id, body));
  } catch (error) {
    if (error instanceof planActions.PlanError) {
      return res.status(error.status).json({ error: error.code, message: error.message, ...error.extra });
    }
    if (error.status && error.extra) {
      return res.status(error.status).json({ error: error.message, code: error.code, ...error.extra });
    }
    return sendError(res, error, 'moment_plan');
  }
});

// ─── Playable items and the answers (CONTRACT 7b) ───────────────────────────

/** GET /play/:id — a post's or a Moment's playable items, with what this reader may see of the answers. */
router.get('/play/:id', async (req, res) => {
  try {
    res.json(await play.playOf(req.params.id, req.user.id));
  } catch (error) {
    sendError(res, error, 'play');
  }
});

/** PUT /play/:id/:item — the reader's answer: a vote, a slider value, a spot on the board, a question, a guess. */
router.put('/play/:id/:item', contentCreationLimiter, async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    res.json(await play.answer(req.params.id, req.params.item, req.user.id, body));
  } catch (error) {
    sendError(res, error, 'play_answer');
  }
});

/** DELETE /play/:id/:item — the reader takes their answer back (never a guess). */
router.delete('/play/:id/:item', async (req, res) => {
  try {
    await play.takeBack(req.params.id, req.params.item, req.user.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'play_take_back');
  }
});

/** GET /play/:id/:item/answers — the question box's answers or a board's notes, for the author only. */
router.get('/play/:id/:item/answers', async (req, res) => {
  try {
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor.slice(0, 12) : '';
    res.json(await play.authorAnswers(req.params.id, req.params.item, req.user.id, cursor));
  } catch (error) {
    sendError(res, error, 'play_answers');
  }
});

/** DELETE /play/:id/:item/answers/:answer — the author removes one answer on their post. */
router.delete('/play/:id/:item/answers/:answer', async (req, res) => {
  try {
    await play.removeAnswer(req.params.id, req.params.item, req.params.answer, req.user.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'play_remove');
  }
});

// ─── Dots on the picture (CONTRACT 7c) ──────────────────────────────────────

/** DELETE /dots/:id/:dot — the author removes one dot from their post. */
router.delete('/dots/:id/:dot', async (req, res) => {
  try {
    await play.removeDot(req.params.id, req.params.dot, req.user.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'dot_remove');
  }
});

// ─── Field cards (CONTRACT 7d) ──────────────────────────────────────────────

/** POST /dots/:id/:dot/card — a thing's field card: the kept one, or made now with one Pantopus AI call and kept. */
router.post('/dots/:id/:dot/card', contentCreationLimiter, async (req, res) => {
  try {
    res.json(await fieldCard.cardFor(req.params.id, req.params.dot, req.user.id));
  } catch (error) {
    sendError(res, error, 'field_card');
  }
});

/** POST /dots/:id/:dot/card/correction — "Not right?": { name, note }. */
router.post('/dots/:id/:dot/card/correction', contentCreationLimiter, async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    res.json(await fieldCard.correct(req.params.id, req.params.dot, req.user.id, body));
  } catch (error) {
    sendError(res, error, 'field_card_correction');
  }
});

// ─── Collect: the reader's field guide (CONTRACT 7f) ────────────────────────

/** POST /dots/:id/:dot/collect — keeps a kept field card in the reader's own field guide. */
router.post('/dots/:id/:dot/collect', contentCreationLimiter, async (req, res) => {
  try {
    res.json(await fieldCard.collect(req.params.id, req.params.dot, req.user.id));
  } catch (error) {
    sendError(res, error, 'collect');
  }
});

/** DELETE /dots/:id/:dot/collect — lets it go. */
router.delete('/dots/:id/:dot/collect', async (req, res) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id) || !/^[a-z0-9_-]{1,38}$/.test(req.params.dot)) {
      return res.status(404).json({ error: 'This could not be found.', code: 'PLAY_NOT_FOUND' });
    }
    await fieldCard.letGo(req.params.id, req.params.dot, req.user.id);
    return res.status(204).end();
  } catch (error) {
    return sendError(res, error, 'collect_let_go');
  }
});

/** GET /field-guide — the reader's own collected cards, newest first. */
router.get('/field-guide', async (req, res) => {
  try {
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor.slice(0, 12) : '';
    res.json(await fieldCard.fieldGuide(req.user.id, cursor));
  } catch (error) {
    sendError(res, error, 'field_guide');
  }
});

// ─── The person's own Pantopus AI switch (CONTRACT 7d) ──────────────────────

const aiSetting = require('../services/pulse/aiSetting');
// `strands` (CONTRACT 8c): "Tell people when their post led me somewhere". `cabinet_shown` (9d): "Show my cabinet to
// people I know". `echoes` (9e): 'off', 'on' or 'names'. Send any of them.
const settingsSchema = Joi.object({
  pantopus_ai: Joi.boolean(), strands: Joi.boolean(), cabinet_shown: Joi.boolean(), echoes: Joi.string().valid('off', 'on', 'names'),
}).or('pantopus_ai', 'strands', 'cabinet_shown', 'echoes');

/** GET /settings — { pantopus_ai, strands, cabinet_shown, echoes }: the person's own choices. */
router.get('/settings', async (req, res) => {
  try {
    res.json(await aiSetting.settingsOf(req.user.id));
  } catch (error) {
    sendError(res, error, 'settings');
  }
});

/** PATCH /settings — { pantopus_ai?, strands?, cabinet_shown? (true | false), echoes? ('off' | 'on' | 'names') }. */
router.patch('/settings', async (req, res) => {
  try {
    const { error, value } = settingsSchema.validate(req.body || {}, { abortEarly: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message.replace(/"/g, ''), code: 'SETTINGS_INVALID' });
    if (value.pantopus_ai !== undefined) {
      logger.info('reinvented.pantopus_ai_set', { on: value.pantopus_ai });
      await aiSetting.setAi(req.user.id, value.pantopus_ai);
    }
    if (value.strands !== undefined) {
      logger.info('reinvented.strands_set', { on: value.strands });
      await aiSetting.setStrands(req.user.id, value.strands);
    }
    if (value.cabinet_shown !== undefined) {
      logger.info('reinvented.cabinet_shown_set', { on: value.cabinet_shown });
      // eslint-disable-next-line global-require
      await require('../services/pulse/cabinet').setShown(req.user.id, value.cabinet_shown);
    }
    if (value.echoes !== undefined) {
      logger.info('reinvented.echoes_set', { level: value.echoes });
      // eslint-disable-next-line global-require
      await require('../services/pulse/echoes').setLevel(req.user.id, value.echoes);
    }
    return res.json(await aiSetting.settingsOf(req.user.id));
  } catch (error) {
    return sendError(res, error, 'settings_set');
  }
});

// ─── Voice and sound as media (CONTRACT 7e) ─────────────────────────────────

const multer = require('multer');
const soundMedia = require('../services/pulse/sound');

const soundUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: soundMedia.MAX_BYTES.voice, files: 1, fields: 8, parts: 10, fieldSize: 32 * 1024, fieldNameSize: 40 },
}).single('file');

function receiveSound(req, res, next) {
  soundUpload(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'This sound is too large to post.', code: 'MEDIA_TOO_LARGE' });
    return res.status(400).json({ error: 'Send the sound as "file", with kind, duration_ms and (for a voice) words.', code: 'SOUND_INVALID' });
  });
}

/** POST /moments/:id/sound — the author's voice, place sound, or a dot's whisper on their own Moment. */
router.post('/moments/:id/sound', contentCreationLimiter, receiveSound, async (req, res) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(404).json({ error: 'This Moment could not be found.', code: 'MOMENT_NOT_FOUND' });
    }
    const row = await soundMedia.upload(req.params.id, req.user, req.file, req.body || {});
    const [moment] = await store.serializeMoments([row], req.user.id);
    return res.json({ moment });
  } catch (error) {
    return sendError(res, error, 'sound');
  }
});

/** DELETE /moments/:id/sound?kind=voice|place — the author takes it off. */
router.delete('/moments/:id/sound', async (req, res) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(404).json({ error: 'This Moment could not be found.', code: 'MOMENT_NOT_FOUND' });
    }
    await soundMedia.remove(req.params.id, req.user, String(req.query.kind || ''));
    return res.status(204).end();
  } catch (error) {
    return sendError(res, error, 'sound_remove');
  }
});

// ─── A Live Photo's motion (CONTRACT 10b) ───────────────────────────────────

const motionMedia = require('../services/pulse/motion');

const motionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: motionMedia.MAX_BYTES, files: 3, fields: 4, parts: 8, fieldSize: 1024, fieldNameSize: 40 },
}).fields([{ name: 'file', maxCount: 1 }, { name: 'frames[]', maxCount: 2 }, { name: 'frames', maxCount: 2 }]);

function receiveMotion(req, res, next) {
  motionUpload(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'This motion clip is too large to post.', code: 'MEDIA_TOO_LARGE' });
    return res.status(400).json({ error: 'Send the motion clip as "file", with one or two "frames[]".', code: 'MOTION_INVALID' });
  });
}

const MOMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /moments/:id/motion — the motion clip of the author's own photo Moment, beside its photo. */
router.post('/moments/:id/motion', contentCreationLimiter, receiveMotion, async (req, res) => {
  try {
    if (!MOMENT_ID.test(req.params.id)) return res.status(404).json({ error: 'This Moment could not be found.', code: 'MOMENT_NOT_FOUND' });
    const files = req.files || {};
    const row = await motionMedia.upload(req.params.id, req.user, {
      file: files.file?.[0] || null, frames: [...(files['frames[]'] || []), ...(files.frames || [])],
    });
    const [moment] = await store.serializeMoments([row], req.user.id);
    return res.json({ moment });
  } catch (error) {
    return sendError(res, error, 'motion');
  }
});

/** DELETE /moments/:id/motion — the author takes the motion off; the photo stays. */
router.delete('/moments/:id/motion', async (req, res) => {
  try {
    if (!MOMENT_ID.test(req.params.id)) return res.status(404).json({ error: 'This Moment could not be found.', code: 'MOMENT_NOT_FOUND' });
    await motionMedia.remove(req.params.id, req.user);
    return res.status(204).end();
  } catch (error) {
    return sendError(res, error, 'motion_remove');
  }
});

// ─── "Save the steps" of a step deck (CONTRACT 7g) ───────────────────────────

const stepDeck = require('../services/pulse/deck');

/** POST /moments/:id/deck/save — keeps the words of the deck's steps in the reader's field guide. */
router.post('/moments/:id/deck/save', contentCreationLimiter, async (req, res) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(404).json({ error: 'This step deck could not be found.', code: 'PLAY_NOT_FOUND' });
    }
    return res.json(await stepDeck.saveSteps(req.params.id, req.user.id));
  } catch (error) {
    return sendError(res, error, 'deck_save');
  }
});

/** DELETE /moments/:id/deck/save — lets them go. */
router.delete('/moments/:id/deck/save', async (req, res) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(404).json({ error: 'This step deck could not be found.', code: 'PLAY_NOT_FOUND' });
    }
    await stepDeck.unsaveSteps(req.params.id, req.user.id);
    return res.status(204).end();
  } catch (error) {
    return sendError(res, error, 'deck_unsave');
  }
});

// ─── Replies people can see on a Moment (CONTRACT 8a) ───────────────────────

const shownReplies = require('../services/pulse/replies');

/** GET /moments/:id/replies — the replies this reader may see, oldest first. */
router.get('/moments/:id/replies', async (req, res) => {
  try {
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor.slice(0, 12) : '';
    res.json(await shownReplies.list(req.params.id, req.user.id, cursor));
  } catch (error) {
    sendError(res, error, 'replies');
  }
});

/** POST /moments/:id/replies — { text }. */
router.post('/moments/:id/replies', contentCreationLimiter, async (req, res) => {
  try {
    res.status(201).json(await shownReplies.create(req.params.id, req.user, req.body?.text));
  } catch (error) {
    sendError(res, error, 'reply_create');
  }
});

/** DELETE /moments/:id/replies/:reply — its writer or the Moment's author. */
router.delete('/moments/:id/replies/:reply', async (req, res) => {
  try {
    await shownReplies.remove(req.params.id, req.params.reply, req.user.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'reply_remove');
  }
});

/** POST /moments/:id/replies/:reply/report — { reason, details }: Pulse's reply report. */
router.post('/moments/:id/replies/:reply/report', contentCreationLimiter, async (req, res) => {
  try {
    await shownReplies.report(req.params.id, req.params.reply, req.user.id, req.body || {});
    res.json({ message: 'Reply reported successfully. We will review it shortly.' });
  } catch (error) {
    sendError(res, error, 'reply_report');
  }
});

/** POST /moments/:id/replies-shown — { shown }: the author's choice for this Moment. */
router.post('/moments/:id/replies-shown', async (req, res) => {
  try {
    if (typeof req.body?.shown !== 'boolean') return res.status(400).json({ error: 'Send shown: true or false.', code: 'REPLY_INVALID' });
    const row = await shownReplies.setShown(req.params.id, req.user.id, req.body.shown);
    const [moment] = await store.serializeMoments([row], req.user.id);
    return res.json({ moment });
  } catch (error) {
    return sendError(res, error, 'replies_shown');
  }
});

// ─── Pins on the photo (CONTRACT 8b) ────────────────────────────────────────

const pins = require('../services/pulse/pins');

const pinUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 10, parts: 12, fieldSize: 4 * 1024, fieldNameSize: 40 },
}).single('file');

/** GET /moments/:id/pins — the pins this reader may see on the picture. */
router.get('/moments/:id/pins', async (req, res) => {
  try {
    res.json(await pins.list(req.params.id, req.user.id));
  } catch (error) {
    sendError(res, error, 'pins');
  }
});

/** POST /moments/:id/pins — a reaction (JSON), or a voice bubble or a cutout (multipart `file`), on a spot. */
router.post('/moments/:id/pins', contentCreationLimiter, (req, res, next) => pinUpload(req, res, (error) => {
  if (!error) return next();
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'This file is too large to post.', code: 'MEDIA_TOO_LARGE' });
  return res.status(400).json({ error: 'Send the pin as kind, x, y and, for a voice or a cutout, "file".', code: 'PIN_INVALID' });
}), async (req, res) => {
  try {
    res.status(201).json(await pins.create(req.params.id, req.user, req.body || {}, req.file || null));
  } catch (error) {
    sendError(res, error, 'pin_create');
  }
});

// ─── Strands: "went because of you" (CONTRACT 8c) ────────────────────────────

const strands = require('../services/pulse/strands');

/** GET /strands — the strands told to the reader (their posts' followers); `side=mine`: the strands they are in. */
router.get('/strands', async (req, res) => {
  try {
    res.json(await strands.list(req.user.id, { side: req.query.side, cursor: req.query.cursor }));
  } catch (error) {
    sendError(res, error, 'strands');
  }
});

/** POST /strands/seen — { ids } or { all: true }. */
router.post('/strands/seen', async (req, res) => {
  try {
    await strands.markSeen(req.user.id, req.body || {});
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'strands_seen');
  }
});

/** DELETE /strands/:id — the follower takes back a strand they are in. */
router.delete('/strands/:id', async (req, res) => {
  try {
    await strands.remove(req.user.id, req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'strand_remove');
  }
});

// ─── Circles and the weekly magazine (CONTRACT 8d) ───────────────────────────

const circles = require('../services/pulse/circles');

const circleRoute = (fn, label, { status = 200 } = {}) => async (req, res) => {
  try {
    const out = await fn(req);
    if (out == null) return res.status(204).end();
    return res.status(status).json(out);
  } catch (error) {
    return sendError(res, error, label);
  }
};

router.get('/circles', circleRoute((req) => circles.list(req.user.id, { tz: req.query.tz }), 'circles'));
router.post('/circles', contentCreationLimiter, circleRoute((req) => circles.create(req.user.id, req.body || {}), 'circle_create', { status: 201 }));
router.post('/circles/:id/join', circleRoute((req) => circles.join(req.user.id, req.params.id, req.body || {}), 'circle_join'));
router.post('/circles/:id/me', circleRoute((req) => circles.setMine(req.user.id, req.params.id, req.body || {}), 'circle_me'));
router.post('/circles/:id/leave', circleRoute((req) => circles.leave(req.user.id, req.params.id), 'circle_leave'));
router.patch('/circles/:id', contentCreationLimiter, circleRoute((req) => circles.change(req.user.id, req.params.id, req.body || {}), 'circle_change'));
router.delete('/circles/:id', circleRoute(async (req) => { await circles.remove(req.user.id, req.params.id); return null; }, 'circle_remove'));
router.get('/circles/:id/magazine', circleRoute((req) => circles.magazine(req.user.id, req.params.id, req.query.week || null, req.query.tz || null), 'circle_magazine'));

// ─── Retake (CONTRACT 8e) ───────────────────────────────────────────────────

const retake = require('../services/pulse/retake');

/** GET /retakes/:id — a Retake (from its start or any frame): its frames by date and season, as the reader may see them. */
router.get('/retakes/:id', async (req, res) => {
  try {
    res.json(await retake.view(req.params.id, req.user.id));
  } catch (error) {
    sendError(res, error, 'retake');
  }
});

// ─── Eyes on (CONTRACT 8f) ──────────────────────────────────────────────────

const eyesOn = require('../services/pulse/eyesOn');

/** POST /eyes-on/near — { latitude, longitude } in the body (never in the address, never kept): open Eyes-on Asks near you. */
router.post('/eyes-on/near', async (req, res) => {
  try {
    res.json(await eyesOn.near(req.user.id, req.body || {}));
  } catch (error) {
    sendError(res, error, 'eyes_on');
  }
});

// ─── Relics and "Seal it" (CONTRACT 8g) ─────────────────────────────────────

const seal = require('../services/pulse/seal');

/** POST /seals/near — { latitude, longitude } in the body (never in the address, never kept): place relics near you. */
router.post('/seals/near', async (req, res) => {
  try {
    res.json(await seal.near(req.user.id, req.body || {}));
  } catch (error) {
    sendError(res, error, 'seals_near');
  }
});

/** POST /seals/:id/open — { latitude, longitude } in the body: a place relic, whole, for a reader standing there. */
router.post('/seals/:id/open', async (req, res) => {
  try {
    res.json(await seal.openHere(req.params.id, req.user.id, req.body || {}));
  } catch (error) {
    sendError(res, error, 'seal_open');
  }
});

// ─── Convergences and the sky strip (CONTRACT 8h) ────────────────────────────

const convergence = require('../services/pulse/convergence');

/** POST /convergences/near — { latitude, longitude } in the body (never kept): windows open now or in the last day nearby. */
router.post('/convergences/near', async (req, res) => {
  try {
    res.json(await convergence.near(req.user.id, req.body || {}));
  } catch (error) {
    sendError(res, error, 'convergences_near');
  }
});

/** GET /convergences/:id — the kept piece: its Moments this reader may see, and their colour bands. */
router.get('/convergences/:id', async (req, res) => {
  try {
    res.json(await convergence.view(req.params.id, req.user.id));
  } catch (error) {
    sendError(res, error, 'convergence');
  }
});

/** GET /strip/sky?cell=<a sunset convergence id>&days= — one day's sunset bands per entry. */
router.get('/strip/sky', async (req, res) => {
  try {
    res.json(await convergence.skyStrip(req.query.cell, req.user.id, req.query.days));
  } catch (error) {
    sendError(res, error, 'sky_strip');
  }
});

// ─── Pinboards and the crowd freeze (CONTRACT 8i) ────────────────────────────

const pinboard = require('../services/pulse/pinboard');

/** GET /pinboards/:id — a pinboard (from its start or any piece): its pieces, as the reader may see them. */
router.get('/pinboards/:id', async (req, res) => {
  try {
    res.json(await pinboard.view(req.params.id, req.user.id));
  } catch (error) {
    sendError(res, error, 'pinboard');
  }
});

/** GET /crowd/:id — the scene around one Live photo or video, from the phones there in the same minute (or null). */
router.get('/crowd/:id', async (req, res) => {
  try {
    res.json(await pinboard.crowdOf(req.params.id, req.user.id));
  } catch (error) {
    sendError(res, error, 'crowd');
  }
});

// ─── Tomorrow's mail and "Mail it" (CONTRACT 8j) ─────────────────────────────

const postcards = require('../services/pulse/postcards');

/**
 * POST /moments/:id/enclosure — the sender's own Moment's picture as one of their mail enclosures, for a letter the app
 * then sends through today's POST /api/mailbox/send ("Mail it"; today's letter rules apply).
 */
router.post('/moments/:id/enclosure', contentCreationLimiter, async (req, res) => {
  try {
    res.status(201).json(await postcards.enclosureFor(req.user.id, req.params.id));
  } catch (error) {
    sendError(res, error, 'moment_enclosure');
  }
});

// ─── "Your day" and "Tonight in <town>" (CONTRACT 8k) ────────────────────────

const yourDay = require('../services/pulse/yourDay');

/** GET /your-day/:user/:date — that person's approved day, as the reader may see it. */
router.get('/your-day/:user/:date', async (req, res) => {
  try {
    res.json(await yourDay.view(req.params.user, req.params.date, req.user.id));
  } catch (error) {
    sendError(res, error, 'your_day');
  }
});

/** POST /town-film — { latitude, longitude } in the body (never kept): tonight's film of the town, or null. */
router.post('/town-film', async (req, res) => {
  try {
    res.json(await yourDay.townFilm(req.user.id, req.body || {}));
  } catch (error) {
    sendError(res, error, 'town_film');
  }
});

// ─── Ask the map and Atlas search (CONTRACT 9b) ──────────────────────────────

const search = require('../services/pulse/search');

// A search is limited per person (LEAD-3 08:17): 30 a minute, for both routes together.
const searchLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `pulse-search:${req.user.id}`,
  message: { error: "You're searching very quickly. Try again in a minute.", code: 'SEARCH_LIMIT' },
});

// The words go in the body, never in the address, and nothing of them is logged (CONTRACT 9b).
const askSchema = Joi.object({
  q: Joi.string().min(2).max(100).required(),
  south: Joi.number().min(-90).max(90).required(),
  west: Joi.number().min(-180).max(180).required(),
  north: Joi.number().min(-90).max(90).required(),
  east: Joi.number().min(-180).max(180).required(),
  time: Joi.string().valid(...pulseMap.TIMES).default('live'),
});

/** POST /map/ask — { q, south, west, north, east, time }: the pins in view whose words match, to light. */
router.post('/map/ask', searchLimiter, async (req, res) => {
  try {
    const { error, value } = askSchema.validate(req.body || {}, { abortEarly: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: 'Send what to look for (2 to 100 characters) and the map area.', code: 'SEARCH_INVALID' });
    const { q, time, ...box } = value;
    if (box.south >= box.north || box.west >= box.east) {
      return res.status(400).json({ error: 'Send a map area with south < north and west < east.', code: 'SEARCH_INVALID' });
    }
    res.json(await search.askMap(req.user, { q, box, time }));
  } catch (error) {
    sendError(res, error, 'map_ask');
  }
});

const atlasSearchSchema = Joi.object({
  q: Joi.string().min(2).max(100).required(),
  cursor: Joi.string().max(40).allow('', null),
});

/** POST /atlas/search — { q, cursor? }: plain words across yours, people you know, your places, what you learned. */
router.post('/atlas/search', searchLimiter, async (req, res) => {
  try {
    const { error, value } = atlasSearchSchema.validate(req.body || {}, { abortEarly: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: 'Send what to look for in 2 to 100 characters.', code: 'SEARCH_INVALID' });
    res.json(await search.atlasSearch(req.user.id, { q: value.q, cursor: value.cursor || null }));
  } catch (error) {
    sendError(res, error, 'atlas_search');
  }
});

// ─── Places you follow (CONTRACT 9c) ─────────────────────────────────────────

const followedPlaces = require('../services/pulse/places');

/** GET /places — the places the reader follows (private to them). */
router.get('/places', async (req, res) => {
  try {
    res.json(await followedPlaces.list(req.user.id));
  } catch (error) {
    sendError(res, error, 'places');
  }
});

/** POST /places — { label, latitude, longitude } from today's place picker: follow it. */
router.post('/places', contentCreationLimiter, async (req, res) => {
  try {
    const { place, added } = await followedPlaces.add(req.user.id, req.body || {});
    res.status(added ? 201 : 200).json({ place });
  } catch (error) {
    sendError(res, error, 'places_add');
  }
});

/** DELETE /places/:id — stop following it. */
router.delete('/places/:id', async (req, res) => {
  try {
    await followedPlaces.remove(req.user.id, String(req.params.id));
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'places_remove');
  }
});

// ─── Curiosity constellations (CONTRACT 9c) ──────────────────────────────────

const constellations = require('../services/pulse/constellations');

/** POST /constellations — { latitude, longitude } in the body (never kept): Retakes, skies, specimens and answers near. */
router.post('/constellations', async (req, res) => {
  try {
    res.json(await constellations.constellationsFor(req.user, req.body || {}));
  } catch (error) {
    sendError(res, error, 'constellations');
  }
});

// ─── The cabinet profile and the yearly poster (CONTRACT 9d) ─────────────────

const cabinet = require('../services/pulse/cabinet');

/** GET /cabinet/:userId — a person's numbers (no follower count), for themself and, while shown, people they know. */
router.get('/cabinet/:userId', async (req, res) => {
  try {
    res.json(await cabinet.cabinetOf(String(req.params.userId), req.user.id));
  } catch (error) {
    sendError(res, error, 'cabinet');
  }
});

/** GET /poster/:year — the reader's own year: its numbers and one kept Moment a month. */
router.get('/poster/:year', async (req, res) => {
  try {
    res.json(await cabinet.posterOf(req.user.id, req.params.year));
  } catch (error) {
    sendError(res, error, 'poster');
  }
});

// ─── Echoes and curiosity twins (CONTRACT 9e) ────────────────────────────────

const echoes = require('../services/pulse/echoes');

/** GET /echoes — the reader's own echoes of today and their twins, only when they take part (opt-in). */
router.get('/echoes', async (req, res) => {
  try {
    res.json(await echoes.echoesFor(req.user.id));
  } catch (error) {
    sendError(res, error, 'echoes');
  }
});

// ─── Homes talk to homes (CONTRACT 9f) ───────────────────────────────────────

const homeWindows = require('../services/pulse/windows');

/** GET /windows — the windows members of the reader's circles show them; lit when that member shared today. */
router.get('/windows', async (req, res) => {
  try {
    res.json(await homeWindows.windowsFor(req.user.id));
  } catch (error) {
    sendError(res, error, 'windows');
  }
});

// ─── Listen to the town (CONTRACT 9g) ────────────────────────────────────────

const townSounds = require('../services/pulse/sounds');

/** GET /sounds — the map's box and time: the place sounds there, kept for people nearby. */
router.get('/sounds', async (req, res) => {
  try {
    const { error, value } = mapSchema.validate(req.query || {}, { abortEarly: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message.replace(/"/g, ''), code: 'SOUNDS_INVALID' });
    const { time, zoom: _zoom, ...box } = value;
    if (box.south >= box.north || box.west >= box.east) {
      return res.status(400).json({ error: 'Send a map area with south < north and west < east.', code: 'SOUNDS_INVALID' });
    }
    return res.json(await townSounds.soundsIn(req.user, box, { time }));
  } catch (error) {
    return sendError(res, error, 'sounds');
  }
});

// ─── A mentioned person's own mentions (CONTRACT 7h) ─────────────────────────

const mentionsMine = require('../services/pulse/mentions');

/** GET /mentions — the Moments and Studio posts that mention the reader, that they may see now. */
router.get('/mentions', async (req, res) => {
  try {
    res.json(await mentionsMine.mentionsOf(req.user.id, typeof req.query.cursor === 'string' ? req.query.cursor.slice(0, 40) : null));
  } catch (error) {
    sendError(res, error, 'mentions');
  }
});

/** DELETE /mentions/:id — takes the reader's own mention off a Moment or a Studio post. */
router.delete('/mentions/:id', async (req, res) => {
  try {
    await mentionsMine.removeMine(req.user.id, String(req.params.id));
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'mentions_remove');
  }
});

// ─── Live beams (CONTRACT 9h) ─────────────────────────────────────────────────

const liveBeams = require('../services/pulse/beams');

const beamsSchema = Joi.object({
  south: Joi.number().min(-90).max(90).required(),
  west: Joi.number().min(-180).max(180).required(),
  north: Joi.number().min(-90).max(90).required(),
  east: Joi.number().min(-180).max(180).required(),
  zoom: Joi.number().min(0).max(25),
});

/** GET /beams — the map's box: where three or more live photos by three or more people all point. */
router.get('/beams', async (req, res) => {
  try {
    const { error, value } = beamsSchema.validate(req.query || {}, { abortEarly: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message.replace(/"/g, ''), code: 'BEAMS_INVALID' });
    const { zoom: _zoom, ...box } = value;
    if (box.south >= box.north || box.west >= box.east) {
      return res.status(400).json({ error: 'Send a map area with south < north and west < east.', code: 'BEAMS_INVALID' });
    }
    return res.json(await liveBeams.beamsIn(req.user, box));
  } catch (error) {
    return sendError(res, error, 'beams');
  }
});

module.exports = router;
