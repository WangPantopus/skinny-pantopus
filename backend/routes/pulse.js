// Pulse's own routes (docs/product/pulse-build/02-contract.md §2). The existing post routes stay in
// routes/posts.js; the composer checks, notes and moderation notices are routes/pulseSafety.js (PS).
const express = require('express');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const areas = require('../services/pulse/areas');
const pulseFeed = require('../services/pulse/feed');
const feedSeen = require('../services/pulse/seen');
const feedCursor = require('../services/pulse/feedCursor');
const conversation = require('../services/pulse/conversation');
const replyActions = require('../services/pulse/replyActions');
const follows = require('../services/pulse/follows');
const claims = require('../services/pulse/claims');
const readScope = require('../services/pulse/readScope');
const { isPulseTopic } = require('../services/pulse/topics');
const {
  DAY_MS, askIdsWithReplies, windowDays, endsAt,
} = require('../services/pulse/lifecycle');

const router = express.Router();

// Days an Ask's author can add, once, from the day-6 reminder (build spec §4).
const KEEP_OPEN_DAYS = 7;
const ASK_SELECT = 'id, user_id, post_type, state, resolution, archived_at, created_at, expires_at, post_metadata';

function feedOptions(query) {
  const view = query.view ?? 'nearby';
  if (!['nearby', 'following'].includes(view)) throw Object.assign(new Error('Choose Nearby or Following.'), { status: 400 });
  if (query.topic != null && !isPulseTopic(query.topic)) throw Object.assign(new Error('Choose one of the Pulse topics.'), { status: 400 });
  if (query.area_id != null && (typeof query.area_id !== 'string' || !feedCursor.UUID.test(query.area_id))) {
    throw Object.assign(new Error('That area could not be found.'), { status: 400 });
  }
  if (query.limit != null && (typeof query.limit !== 'string' || !/^\d+$/.test(query.limit) || Number(query.limit) < 1)) {
    throw Object.assign(new Error('Choose a positive page size.'), { status: 400 });
  }
  return { view, topic: query.topic, areaId: query.area_id, earlierBefore: query.earlier_before,
    limit: Math.min(Number(query.limit) || 30, 40) };
}

function feedError(res, error) {
  if (error.status) {
    return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}), ...(error.body || {}) });
  }
  logger.error('pulse.feed.error', { error: error.message });
  return res.status(503).json({ error: "Couldn't load Pulse. Please try again." });
}

router.get('/feed', verifyToken, async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    res.json(await pulseFeed.page(req.user.id, feedOptions(req.query)));
  } catch (error) { feedError(res, error); }
});

router.get('/feed/new', verifyToken, async (req, res) => {
  try {
    if (!feedCursor.timestamp(req.query.after)) return res.status(400).json({ error: 'Choose a valid time to check for new conversations.' });
    res.set('Cache-Control', 'private, no-store');
    res.json(await pulseFeed.newCount(req.user.id, { ...feedOptions(req.query), after: req.query.after }));
  } catch (error) { feedError(res, error); }
});

router.post('/feed/seen', verifyToken, async (req, res) => {
  try {
    if (!['nearby', 'following'].includes(req.body?.view) || !feedCursor.timestamp(req.body?.through)) {
      return res.status(400).json({ error: 'Choose a view and a valid time to mark as read.' });
    }
    res.json(await feedSeen.advance(req.user.id, req.body.view, req.body.through));
  } catch (error) { feedError(res, error); }
});

router.get('/posts/:postId', verifyToken, async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    res.json(await conversation.read(req.params.postId, req.user.id));
  } catch (error) { feedError(res, error); }
});

router.get('/posts/:postId/replies', verifyToken, async (req, res) => {
  try {
    if (req.query.after != null && !feedCursor.timestamp(req.query.after)) {
      return res.status(400).json({ error: 'Choose a valid time to check for new replies.' });
    }
    res.set('Cache-Control', 'private, no-store');
    res.json(await conversation.read(req.params.postId, req.user.id, { repliesOnly: true, after: req.query.after }));
  } catch (error) { feedError(res, error); }
});

router.post('/posts/:postId/replies/:replyId/helpful', verifyToken, async (req, res) => {
  try {
    if (typeof req.body?.helpful !== 'boolean') return res.status(400).json({ error: 'Choose whether this reply was Helpful.' });
    res.json(await replyActions.act(req.params.postId, req.params.replyId, req.user.id, 'helpful', req.body.helpful));
  } catch (error) { feedError(res, error); }
});

router.post('/posts/:postId/replies/:replyId/thanks', verifyToken, async (req, res) => {
  try {
    res.json(await replyActions.act(req.params.postId, req.params.replyId, req.user.id, 'thanks'));
  } catch (error) { feedError(res, error); }
});

router.post('/posts/:postId/replies/:replyId/report', verifyToken, async (req, res) => {
  try {
    res.json(await replyActions.report(req.params.postId, req.params.replyId, req.user.id, req.body || {}));
  } catch (error) { feedError(res, error); }
});

router.post('/posts/:postId/claims', verifyToken, async (req, res) => {
  try { res.json(await claims.request(req.params.postId, req.user.id, req.body || {})); }
  catch (error) { feedError(res, error); }
});

router.get('/posts/:postId/claims', verifyToken, async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    res.json(await claims.list(req.params.postId, req.user.id));
  } catch (error) { feedError(res, error); }
});

router.post('/posts/:postId/claims/:claimId/choose', verifyToken, async (req, res) => {
  try { res.json(await claims.choose(req.params.postId, req.params.claimId, req.user.id)); }
  catch (error) { feedError(res, error); }
});

router.put('/posts/:postId/read-scope', verifyToken, async (req, res) => {
  try { res.json(await readScope.narrow(req.params.postId, req.user.id, req.body || {})); }
  catch (error) { feedError(res, error); }
});

router.get('/follows', verifyToken, async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    res.json(await follows.list(req.user.id));
  } catch (error) { feedError(res, error); }
});

router.put('/follows', verifyToken, async (req, res) => {
  try { res.json(await follows.put(req.user.id, req.body)); }
  catch (error) { feedError(res, error); }
});

router.delete('/follows', verifyToken, async (req, res) => {
  try { res.json(await follows.remove(req.user.id, req.query)); }
  catch (error) { feedError(res, error); }
});

router.get('/preferences/summary', verifyToken, async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    res.json(await follows.summary(req.user.id));
  } catch (error) { feedError(res, error); }
});

router.get('/posts/:postId/why', verifyToken, async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    res.json(await follows.why(req.user.id, req.params.postId, feedOptions(req.query)));
  } catch (error) { feedError(res, error); }
});

router.get('/areas/mine', verifyToken, async (req, res) => {
  try {
    res.json(await areas.myAreas(req.user.id));
  } catch (err) {
    logger.error('pulse.areas.mine.error', { error: err.message, userId: req.user.id });
    res.status(503).json({ error: "Couldn't load your areas. Please try again." });
  }
});

router.get('/areas/search', verifyToken, async (req, res) => {
  const q = req.query.q ?? '';
  if (typeof q !== 'string' || q.length > 80) {
    return res.status(400).json({ error: 'Search for a town using up to 80 characters.' });
  }
  try {
    res.json({ areas: await areas.searchTowns(q.trim()) });
  } catch (err) {
    logger.error('pulse.areas.search.error', { error: err.message });
    res.status(503).json({ error: "Couldn't search areas. Please try again." });
  }
});

/** Whole years from a date of birth to today; NaN for a date that can't be read. A date of birth
 * ('2008-10-14') reads as UTC midnight, so both sides are compared as UTC calendar dates. */
function ageFrom(dateOfBirth) {
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return NaN;
  const today = new Date();
  const hadBirthday = today.getUTCMonth() > born.getUTCMonth()
    || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() >= born.getUTCDate());
  return today.getUTCFullYear() - born.getUTCFullYear() - (hadBirthday ? 0 : 1);
}

/**
 * POST /api/pulse/adult-attestation — the person confirms they're 18 or older, once (contract §2.10):
 * → { attested_at }. Confirming again returns the first time. A date of birth on file that says
 * they're younger wins (403 AGE_NOT_ELIGIBLE).
 */
router.post('/adult-attestation', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const { data: user, error } = await supabaseAdmin
      .from('User')
      .select('adult_attested_at, date_of_birth')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ error: 'Account not found' });

    if (user.date_of_birth && ageFrom(user.date_of_birth) < 18) {
      return res.status(403).json({ error: 'Posting in Pulse is for people 18 and older.', code: 'AGE_NOT_ELIGIBLE' });
    }
    if (user.adult_attested_at) return res.json({ attested_at: user.adult_attested_at });

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('User')
      .update({ adult_attested_at: new Date().toISOString() })
      .eq('id', userId)
      .is('adult_attested_at', null)
      .select('adult_attested_at')
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) return res.json({ attested_at: updated.adult_attested_at });

    // Another tap set it a moment ago; answer with the time that one kept.
    const { data: again, error: againError } = await supabaseAdmin
      .from('User').select('adult_attested_at').eq('id', userId).maybeSingle();
    if (againError || !again?.adult_attested_at) throw againError || new Error('attestation not saved');
    res.json({ attested_at: again.adult_attested_at });
  } catch (err) {
    logger.error('pulse.adult_attestation.error', { error: err.message, userId });
    res.status(500).json({ error: "Couldn't save that. Please try again." });
  }
});

/** The asker's own Ask that is still open, or null after answering why it can't be acted on. */
async function ownOpenAsk(postId, userId, days, res) {
  const { data: ask, error } = await supabaseAdmin.from('Post').select(ASK_SELECT).eq('id', postId).maybeSingle();
  // An id that isn't a UUID is "not found"; a failed read is not.
  if (error && error.code !== '22P02') throw error;
  if (!ask) {
    res.status(404).json({ error: "This post isn't available.", code: 'POST_NOT_FOUND' });
    return null;
  }
  if (ask.user_id !== userId) {
    res.status(403).json({ error: 'Only the person who asked can do this.', code: 'NOT_POST_AUTHOR' });
    return null;
  }
  if (ask.post_type !== 'ask_local') {
    res.status(400).json({ error: 'Only questions can be kept open or closed.', code: 'NOT_AN_ASK' });
    return null;
  }
  if (ask.state !== 'open' || ask.resolution || ask.archived_at || endsAt(ask, days) <= new Date()) {
    res.status(409).json({ error: 'This question has already ended.', code: 'ASK_ENDED' });
    return null;
  }
  return ask;
}

/**
 * POST /api/pulse/posts/:postId/keep-open — the asker keeps an open Ask up for 7 more days, once
 * (contract §2.12): → { post_status: { state: 'open', resolution: null, ends_at } }.
 */
router.post('/posts/:postId/keep-open', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const days = await windowDays('ask_local');
    const ask = await ownOpenAsk(req.params.postId, userId, days, res);
    if (!ask) return;
    if (ask.post_metadata?.kept_open_at) {
      return res.status(409).json({ error: 'This question was already kept open once.', code: 'ALREADY_KEPT_OPEN' });
    }

    const endsAtIso = new Date(endsAt(ask, days).getTime() + KEEP_OPEN_DAYS * DAY_MS).toISOString();
    const { data: updated, error } = await supabaseAdmin
      .from('Post')
      .update({
        expires_at: endsAtIso,
        post_metadata: { ...(ask.post_metadata || {}), kept_open_at: new Date().toISOString() },
      })
      .eq('id', ask.id)
      .eq('state', 'open')
      .is('resolution', null)
      .is('archived_at', null)
      .is('post_metadata->>kept_open_at', null)
      .select('expires_at')
      .maybeSingle();
    if (error) throw error;
    if (!updated) {
      // Another tap kept it open, or it ended, a moment ago.
      const { data: again } = await supabaseAdmin.from('Post').select('post_metadata').eq('id', ask.id).maybeSingle();
      return again?.post_metadata?.kept_open_at
        ? res.status(409).json({ error: 'This question was already kept open once.', code: 'ALREADY_KEPT_OPEN' })
        : res.status(409).json({ error: 'This question has already ended.', code: 'ASK_ENDED' });
    }
    res.json({ post_status: { state: 'open', resolution: null, ends_at: updated.expires_at } });
  } catch (err) {
    logger.error('pulse.ask_keep_open.error', { error: err.message, userId, postId: req.params.postId });
    res.status(500).json({ error: "Couldn't keep it open. Please try again." });
  }
});

/**
 * POST /api/pulse/posts/:postId/close — the asker closes an open Ask (contract §2.12): it ends
 * `closed` when someone else replied, `closed_unanswered` when nobody did, and leaves the views:
 * → { post_status: { state: 'resolved', resolution } }.
 */
router.post('/posts/:postId/close', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const ask = await ownOpenAsk(req.params.postId, userId, await windowDays('ask_local'), res);
    if (!ask) return;

    const resolution = (await askIdsWithReplies([ask])).has(ask.id) ? 'closed' : 'closed_unanswered';
    const { data: updated, error } = await supabaseAdmin
      .from('Post')
      .update({
        resolution,
        state: 'archived',
        is_archived: true,
        archived_at: new Date().toISOString(),
        archive_reason: 'resolved',
      })
      .eq('id', ask.id)
      .eq('state', 'open')
      .is('resolution', null)
      .is('archived_at', null)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!updated) return res.status(409).json({ error: 'This question has already ended.', code: 'ASK_ENDED' });
    res.json({ post_status: { state: 'resolved', resolution } });
  } catch (err) {
    logger.error('pulse.ask_close.error', { error: err.message, userId, postId: req.params.postId });
    res.status(500).json({ error: "Couldn't close it. Please try again." });
  }
});

module.exports = router;
