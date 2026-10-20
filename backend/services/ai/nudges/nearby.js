'use strict';

/**
 * The assistant's Nearby nudges (AI assistant phase 2 contract §6.2, §6.3 and §3.7), run hourly
 * (jobs/index.js):
 *  - lost_found_match: an open found post and an open lost post (or a missing-pet heads-up)
 *    within 3 miles and 7 days of each other, whose words overlap, judged "likely" by one
 *    text-only model call per batch. Both authors hear of it, each only when they can read the
 *    other post (canReadPost: its audience, and blocks either way). No place is named.
 *  - question_answered: an open question with 2 or more replies, or one reply older than 12
 *    hours, at most once every 48 hours. Written from counts and first names; no model call.
 *
 * Nudges go out through the nudge engine (./engine.js, sendNudge), which decides whether the
 * person gets one at all. Their cards are the chat's own post cards, drafted with the recipient
 * as the viewer (actionCards.js).
 */

const { DateTime } = require('luxon');
const supabaseAdmin = require('../../../config/supabaseAdmin');
const logger = require('../../../utils/logger');
const { haversineMeters } = require('../../../utils/geo');
const { timezoneFromCoordinates } = require('../../../utils/timezone');
const { localDisplayNames } = require('../../../utils/identityProfiles');
const { resolveEffort, DRAFT_MODEL } = require('../../../config/anthropic');
const feedService = require('../../feedService');
const blockService = require('../../blockService');
const { canReadPost, POST_READ_SELECT } = require('../../pulse/readAccess');
const { writeRow } = require('../../placeSectionCache');
const { normalizeTitle, jaccardSimilarity } = require('../../gig/jaccardUtils');
const rules = require('../../plans/planRules');
const prompts = require('../prompts');
const { complete } = require('../llm');
const { toClaudeSchema } = require('../schemas');
const { backgroundCall } = require('../background');
const { clip, firstNameOf, distanceWords } = require('../assistantKit');
const { fit, capitalized } = require('./words');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MILE_METERS = 1609.344;

/** The nudge engine (contract §3.5). Required when used, so the job runs without it. */
const engine = () => require('./engine');

/** Whether this person would get this nudge now (Suggestions, "Fewer like this", the day's cap, a duplicate). */
async function wouldHear(userId, kind, subject, checkpoint) {
  const verdict = await engine().canNudge({ userId, kind, subject, checkpoint });
  if (!verdict.ok) logger.debug('nearby.nudge.not_now', { kind, reason: verdict.reason });
  return verdict.ok;
}

async function send(userId, nudge) {
  const result = await engine().sendNudge({ userId, ...nudge, title: fit(nudge.title, 60), body: fit(nudge.body, 160) });
  if (!result || !result.sent) logger.info('nearby.nudge.not_sent', { kind: nudge.kind, reason: result?.reason || null });
  return result;
}

/** A card from the chat's own drafter, as the recipient (engine.nudgeCard); null when it can't be offered. */
async function cardFor(userId, tool, args, expiresAt) {
  const { card, error } = await engine().nudgeCard(tool, args, { userId, expiresAt });
  if (!card) logger.info('nearby.nudge.card_skipped', { tool, reason: error || null });
  return card || null;
}

// ─── Lost and found ────────────────────────────────────────────────────────

const PAIR_RADIUS_METERS = 3 * MILE_METERS;
const PAIR_DAYS = 7;
// Open posts this recent are paired: a lost post may meet a found one up to 7 days later.
const LOOKBACK_DAYS = 14;
const PAIRS_PER_CALL = 20;
const CALLS_PER_RUN = 3;
// A pair judged once is not judged again for 7 days (contract §6.2), whatever the verdict.
const JUDGED_SECTION = 'ai_lostfound_pair';
const JUDGED_TTL_MS = 7 * DAY_MS;
const LOST_FOUND_EFFORT = resolveEffort(process.env.ANTHROPIC_DRAFT_EFFORT, 'low');
const LOST_FOUND_TIMEOUT_MS = 60_000;
const LOST_FOUND_MAX_TOKENS = 4096;
// Words every lost or found post shares, which say nothing about what it is.
const LOST_FOUND_WORDS = new Set([
  'lost', 'found', 'missing', 'seen', 'last', 'near', 'around', 'please', 'call', 'text', 'contact', 'if', 'you', 'see',
  'today', 'yesterday', 'tonight', 'morning', 'evening', 'night', 'street', 'st', 'ave', 'road', 'rd', 'park',
]);
const SAME_WORD = { puppy: 'dog', pup: 'dog', doggy: 'dog', kitten: 'cat', kitty: 'cat', kitties: 'cat', dogs: 'dog', cats: 'cat' };

const ITEMS = ['dog', 'cat', 'bird', 'pet', 'keys', 'wallet', 'phone', 'bag', 'bike', 'jewelry', 'item'];
// "a found dog" and "the dog you found", for each item the model may name.
const FOUND_PHRASE = {
  dog: 'a found dog', cat: 'a found cat', bird: 'a found bird', pet: 'a found pet', keys: 'found keys', wallet: 'a found wallet',
  phone: 'a found phone', bag: 'a found bag', bike: 'a found bike', jewelry: 'found jewelry', item: 'something found',
};
const MINE = {
  dog: 'my dog', cat: 'my cat', bird: 'my bird', pet: 'my pet', keys: 'my keys', wallet: 'my wallet', phone: 'my phone',
  bag: 'my bag', bike: 'my bike', jewelry: 'mine', item: 'mine',
};
const YOURS = {
  dog: 'your dog', cat: 'your cat', bird: 'your bird', pet: 'your pet', keys: 'your keys', wallet: 'your wallet',
  phone: 'your phone', bag: 'your bag', bike: 'your bike', jewelry: 'your jewelry', item: 'what you lost',
};

const MATCH_SCHEMA = toClaudeSchema({
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pair: { type: 'integer' },
          verdict: { type: 'string', enum: ['likely', 'unlikely'] },
          item: { type: 'string', enum: ITEMS },
          reason: { type: 'string' },
        },
        required: ['pair', 'verdict', 'item', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
});

const LOST_FOUND_SELECT = `${POST_READ_SELECT}, title, content, post_type, lost_found_type, safety_alert_kind, created_at, effective_latitude, effective_longitude, expires_at, resolution`;

/** The words that say what a post is about ("golden", "retriever", "collar"), pet words made one. */
function wordsOf(post) {
  return normalizeTitle(`${post.title || ''} ${post.content || ''}`)
    .map((word) => SAME_WORD[word] || word)
    .filter((word) => word.length > 2 && !LOST_FOUND_WORDS.has(word));
}

/** Where a post really is: its stored point, server-side only (never shown or sent to the model). */
function pointOf(post) {
  const [lat, lng] = post.latitude != null && post.longitude != null
    ? [post.latitude, post.longitude] : [post.effective_latitude, post.effective_longitude];
  if (lat == null || lng == null) return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

const pairKey = (found, lost) => `pair:${found.id}:${lost.id}`;

/** Open lost and found posts from the last 14 days: found posts, and lost posts with missing-pet heads-ups. */
async function openLostAndFound(now) {
  const since = new Date(now - LOOKBACK_DAYS * DAY_MS).toISOString();
  const open = () => feedService.onlyShownPosts(supabaseAdmin.from('Post').select(LOST_FOUND_SELECT))
    .is('archived_at', null)
    .is('resolution', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);
  const [found, lost, missing] = await Promise.all([
    open().eq('post_type', 'lost_found').eq('lost_found_type', 'found'),
    open().eq('post_type', 'lost_found').eq('lost_found_type', 'lost'),
    open().eq('post_type', 'alert').eq('safety_alert_kind', 'missing_pet'),
  ]);
  const failed = found.error || lost.error || missing.error;
  if (failed) throw new Error(`Failed to read lost and found posts: ${failed.message}`);
  return { found: found.data || [], lost: [...(lost.data || []), ...(missing.data || [])] };
}

/** Pairs worth asking about: different authors, within 3 miles and 7 days, sharing words. */
function candidatePairs({ found, lost }) {
  const pairs = [];
  for (const f of found) {
    const fPoint = pointOf(f);
    const fWords = wordsOf(f);
    if (!fPoint || fWords.length === 0) continue;
    for (const l of lost) {
      if (String(f.user_id) === String(l.user_id)) continue;
      if (Math.abs(Date.parse(f.created_at) - Date.parse(l.created_at)) > PAIR_DAYS * DAY_MS) continue;
      const lPoint = pointOf(l);
      if (!lPoint) continue;
      const meters = haversineMeters(fPoint.latitude, fPoint.longitude, lPoint.latitude, lPoint.longitude);
      if (!(meters <= PAIR_RADIUS_METERS)) continue;
      const lWords = wordsOf(l);
      const shared = fWords.filter((word, i) => fWords.indexOf(word) === i && lWords.includes(word)).length;
      const overlap = jaccardSimilarity(fWords, lWords);
      if (shared >= 2 || (shared >= 1 && overlap >= 0.1)) pairs.push({ found: f, lost: l, meters, overlap });
    }
  }
  return pairs.sort((a, b) => b.overlap - a.overlap);
}

async function judgedRecently(pairs) {
  if (pairs.length === 0) return new Set();
  const keys = pairs.map((pair) => pairKey(pair.found, pair.lost));
  const judged = new Set();
  for (let i = 0; i < keys.length; i += 100) {
    const { data, error } = await supabaseAdmin.from('PlaceSectionCache')
      .select('cache_key')
      .eq('section_id', JUDGED_SECTION)
      .in('cache_key', keys.slice(i, i + 100))
      .gt('expires_at', new Date().toISOString());
    if (error) throw new Error(`Failed to read judged pairs: ${error.message}`);
    for (const row of data || []) judged.add(row.cache_key);
  }
  return judged;
}

const postedText = (post) => DateTime.fromISO(String(post.created_at), { zone: 'utc' })
  .setZone(timezoneFromCoordinates(post.latitude, post.longitude, rules.DEFAULT_TIMEZONE)).toFormat('cccc, LLLL d, h a');

/** One batch for the model: text and dates only, never photos, places or names. */
function batchText(batch) {
  return batch.map((pair, i) => [
    `Pair ${i + 1}`,
    `Found, posted ${postedText(pair.found)}: ${JSON.stringify({ title_text: clip(pair.found.title, 120), body_text: clip(pair.found.content, 600) })}`,
    `${pair.lost.post_type === 'alert' ? 'Missing pet heads-up' : 'Lost'}, posted ${postedText(pair.lost)}: ${JSON.stringify({ title_text: clip(pair.lost.title, 120), body_text: clip(pair.lost.content, 600) })}`,
  ].join('\n')).join('\n\n');
}

/**
 * The model's verdicts for one batch, by pair number. One text-only call through the background
 * budget (background.js: AI_ASSISTANT, the shared daily cap, the AIRequestLog row as lostfound).
 * Null when it didn't run or didn't answer: the batch is tried again next hour.
 */
async function judge(batch) {
  const call = await backgroundCall({
    userId: null,
    endpoint: 'lostfound',
    model: DRAFT_MODEL,
    promptVersion: prompts.VERSIONS.lostFound,
    run: (client) => complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.LOST_FOUND_MATCH_SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text: batchText(batch) }] }],
      schema: MATCH_SCHEMA,
      effort: LOST_FOUND_EFFORT,
      maxTokens: LOST_FOUND_MAX_TOKENS,
      timeoutMs: LOST_FOUND_TIMEOUT_MS,
    }),
  });
  if (!call.ok) return null;
  let parsed = null;
  try {
    parsed = JSON.parse(call.value.text);
  } catch {
    logger.warn('nearby.lostfound.unreadable_answer');
    return null;
  }
  const verdicts = new Map();
  for (const result of Array.isArray(parsed?.results) ? parsed.results : []) {
    if (Number.isInteger(result.pair) && result.pair >= 1 && result.pair <= batch.length) {
      verdicts.set(result.pair, {
        likely: result.verdict === 'likely',
        item: ITEMS.includes(result.item) ? result.item : 'item',
        reason: clip(result.reason, 200),
      });
    }
  }
  return verdicts;
}

/** The day a post went up, as a nudge says it: "Tuesday" this week, else "Oct 14". */
function dayOf(post, now) {
  const at = DateTime.fromISO(String(post.created_at), { zone: 'utc' })
    .setZone(timezoneFromCoordinates(post.latitude, post.longitude, rules.DEFAULT_TIMEZONE));
  return now - at.toMillis() < 6 * DAY_MS ? at.toFormat('cccc') : at.toFormat('LLL d');
}

/**
 * Tell one author about the other post, when they can read it. The nudge names neither post's
 * place: only how far apart the two posts are, in the Plans distance bands.
 */
async function tellAuthor({ own, other, item, meters, lostSide, now }) {
  const userId = String(own.user_id);
  const subject = { type: 'post', id: own.id };
  // The other post's id without dashes keeps the key under the engine's 40 characters.
  const checkpoint = `match.${String(other.id).replace(/-/g, '')}`;
  // The other post's audience and blocks either way, as its page checks them (a failed check is a no).
  if (!(await canReadPost(other, userId).catch(() => false))) return null;
  if (!(await wouldHear(userId, 'lost_found_match', subject, checkpoint))) return null;
  const expiresAt = new Date(now + 7 * DAY_MS);
  const apart = (distanceWords(rules.distanceBandFromMeters(meters)) || 'nearby').toLowerCase();
  const reply = await cardFor(userId, 'draft_post_reply', {
    post_id: other.id,
    reply_to: null,
    text: lostSide ? `Hi! I think this might be ${MINE[item]}. Could we connect?` : `Hi! I may have found ${YOURS[item]}. Could we connect?`,
    note: null,
  }, expiresAt);
  const kindWord = item === 'item' ? 'what you found' : `the ${item} you found`;
  return send(userId, {
    kind: 'lost_found_match',
    subject,
    checkpoint,
    title: lostSide ? capitalized(`${FOUND_PHRASE[item]} nearby may be yours`) : `Someone nearby may be missing ${kindWord}`,
    body: lostSide
      ? `Posted ${dayOf(other, now)}, ${apart} from your post. Take a look, and reply if it's yours.`
      : `A ${other.post_type === 'alert' ? 'missing pet heads-up' : 'lost post'} from ${dayOf(other, now)}, ${apart} from yours. Take a look, and reply if it's theirs.`,
    cards: reply ? [reply] : [],
    expiresAt,
  });
}

async function lostFoundMatch(now = Date.now()) {
  const pairs = candidatePairs(await openLostAndFound(now));
  if (pairs.length === 0) return { judged: 0, likely: 0, sent: 0 };
  const judged = await judgedRecently(pairs);
  const fresh = pairs.filter((pair) => !judged.has(pairKey(pair.found, pair.lost))).slice(0, PAIRS_PER_CALL * CALLS_PER_RUN);
  const counts = { judged: 0, likely: 0, sent: 0 };
  for (let i = 0; i < fresh.length; i += PAIRS_PER_CALL) {
    const batch = fresh.slice(i, i + PAIRS_PER_CALL);
    const verdicts = await judge(batch);
    if (!verdicts) break;
    for (let n = 0; n < batch.length; n += 1) {
      const pair = batch[n];
      const verdict = verdicts.get(n + 1);
      if (!verdict) continue;
      counts.judged += 1;
      await writeRow(pairKey(pair.found, pair.lost), JUDGED_SECTION,
        { verdict: verdict.likely ? 'likely' : 'unlikely', item: verdict.item, reason: verdict.reason }, JUDGED_TTL_MS, new Date().toISOString());
      if (!verdict.likely) continue;
      counts.likely += 1;
      for (const [own, other, lostSide] of [[pair.lost, pair.found, true], [pair.found, pair.lost, false]]) {
        try {
          const result = await tellAuthor({ own, other, item: verdict.item, meters: pair.meters, lostSide, now });
          if (result?.sent) counts.sent += 1;
        } catch (err) {
          logger.warn('nearby.lostfound.nudge_failed', { postId: own.id, error: err.message });
        }
      }
    }
  }
  return counts;
}

// ─── Your question got answers ─────────────────────────────────────────────

// Open questions this recent: an Ask stays up 7 days and may be kept open 7 more.
const QUESTION_LOOKBACK_DAYS = 14;
const ONE_REPLY_WAIT_MS = 12 * HOUR_MS;
const QUESTION_AGAIN_MS = 48 * HOUR_MS;

/** "Ana", "Ana and Ben", "Ana, Ben and Cy", "Ana, Ben and 3 others". */
function namesText(names) {
  if (names.length <= 1) return names[0] || 'A neighbor';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

async function askedRecently(authorId, postId, now) {
  const { data, error } = await supabaseAdmin.from('Notification')
    .select('id')
    .eq('user_id', authorId)
    .like('idempotency_key', `nudge:question_answered:${authorId}:${postId}:%`)
    .gte('created_at', new Date(now - QUESTION_AGAIN_MS).toISOString())
    .limit(1);
  if (error) throw new Error(`Failed to read earlier question nudges: ${error.message}`);
  return Boolean(data && data.length);
}

async function questionsAnswered(now = Date.now()) {
  const { data: asks, error } = await feedService.onlyShownPosts(supabaseAdmin.from('Post')
    .select('id, user_id, title, content, created_at, comment_count'))
    .eq('post_type', 'ask_local')
    .eq('state', 'open')
    .is('resolution', null)
    .is('resolved_at', null)
    .is('archived_at', null)
    .gt('comment_count', 0)
    .gte('created_at', new Date(now - QUESTION_LOOKBACK_DAYS * DAY_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(`Failed to read open questions: ${error.message}`);
  if (!asks || asks.length === 0) return { sent: 0 };
  const { data: replies, error: replyError } = await supabaseAdmin.from('PostComment')
    .select('post_id, user_id, created_at')
    .in('post_id', asks.map((ask) => ask.id))
    .eq('is_deleted', false)
    .eq('moderation_state', 'live')
    .order('created_at', { ascending: true })
    .limit(5000);
  if (replyError) throw new Error(`Failed to read replies: ${replyError.message}`);
  const byPost = new Map();
  for (const reply of replies || []) {
    if (!byPost.has(reply.post_id)) byPost.set(reply.post_id, []);
    byPost.get(reply.post_id).push(reply);
  }

  let sent = 0;
  for (const ask of asks) {
    const authorId = String(ask.user_id);
    try {
      const all = byPost.get(ask.id) || [];
      // Replies the author can see: not their own, and nobody on either side of a block.
      const blocked = await blockService.blockedUserIds(authorId);
      const theirs = all.filter((reply) => String(reply.user_id) !== authorId && !blocked.has(String(reply.user_id)));
      const ready = theirs.length >= 2 || (theirs.length === 1 && Date.parse(theirs[0].created_at) <= now - ONE_REPLY_WAIT_MS);
      if (!ready || (await askedRecently(authorId, ask.id, now))) continue;
      const subject = { type: 'post', id: ask.id };
      const checkpoint = `r${theirs.length}`;
      if (!(await wouldHear(authorId, 'question_answered', subject, checkpoint))) continue;
      const expiresAt = new Date(now + 3 * DAY_MS);

      const people = [...new Set(theirs.map((reply) => String(reply.user_id)))];
      const shown = await localDisplayNames(people).catch(() => new Map());
      const names = people.map((id) => firstNameOf({ display_name: shown.get(id) }) || 'A neighbor');
      const question = clip(ask.title, 50) || clip(ask.content, 50) || 'your question';
      // They already said thanks after the latest reply: only Mark solved is offered.
      const lastTheirs = theirs[theirs.length - 1];
      const thankedAfter = all.some((reply) => String(reply.user_id) === authorId && Date.parse(reply.created_at) > Date.parse(lastTheirs.created_at));
      const solve = await cardFor(authorId, 'draft_post_solve', { post_id: ask.id, note: null }, expiresAt);
      if (!solve) continue;
      const thanks = thankedAfter ? null : await cardFor(authorId, 'draft_post_reply', {
        post_id: ask.id,
        reply_to: null,
        text: names.length <= 2 ? `Thanks, ${namesText(names)}! This helped.` : 'Thanks, everyone! This helped.',
        note: null,
      }, expiresAt);
      const result = await send(authorId, {
        kind: 'question_answered',
        subject,
        checkpoint,
        title: `Your question got ${theirs.length} ${theirs.length === 1 ? 'reply' : 'replies'}`,
        body: `${namesText(names)} replied to “${question}”. Mark it solved${thanks ? ', or say thanks' : ''}?`,
        cards: [solve, thanks].filter(Boolean),
        expiresAt,
      });
      if (result?.sent) sent += 1;
    } catch (err) {
      logger.warn('nearby.question.nudge_failed', { postId: ask.id, error: err.message });
    }
  }
  return { sent };
}

// ─── The hourly job ────────────────────────────────────────────────────────

async function runNearbyNudges(now = Date.now()) {
  const result = {};
  for (const [name, step] of [['lostFound', lostFoundMatch], ['questions', questionsAnswered]]) {
    try {
      result[name] = await step(now);
    } catch (err) {
      logger.warn('nearby.nudge.step_failed', { step: name, error: err.message });
      result[name] = null;
    }
  }
  logger.info('nearby.nudges', result);
  return result;
}

module.exports = {
  runNearbyNudges,
  lostFoundMatch,
  questionsAnswered,
  // For scripts.
  candidatePairs,
  wordsOf,
};
