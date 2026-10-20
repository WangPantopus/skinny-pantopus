/**
 * The assistant's Nearby read tools (AI assistant phase 2 contract §6.1 and §6.4): what is new
 * on the person's Nearby feed since they last looked, and what neighbors recommend for
 * something.
 *
 * Both read the feed the Nearby tab shows (feedService.getListFeed, surface "place", with the
 * person as the viewer: the read check, their blocks, mutes and hidden posts, and displayed
 * points within 10 miles), so a tool never shows a post the feed wouldn't. Replies come through
 * the post page's reply rule (onlyShownReplies) and leave out people on either side of a block.
 * Words other people wrote are marked as such (OTHERS_WORDS). The morning brief reads the
 * catch-up through the same function (catchUpNearby); neither tool moves the seen marker,
 * which the apps move when the feed appears (POST /api/posts/feed/seen).
 */
const { DateTime } = require('luxon');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const feedService = require('../feedService');
const feedSeen = require('../pulse/seen');
const blockService = require('../blockService');
const { onlyShownReplies } = require('../pulse/readAccess');
const { normalizeTitle } = require('../gig/jaccardUtils');
const { postForModel } = require('./readTools');
const {
  OTHERS_WORDS, clip, homesOf, zoneOr, dayLabel,
} = require('./assistantKit');

const DAY_MS = 24 * 60 * 60 * 1000;
const NEARBY_RADIUS_METERS = 16093; // 10 miles, as find_posts
const FEED_PAGE = 50;

// Catch-up: since the seen marker, else the last 7 days; never more than 14.
const CATCH_UP_DEFAULT_DAYS = 7;
const CATCH_UP_MAX_DAYS = 14;
const CATCH_UP_PAGES = 4;
const CATCH_UP_ITEMS = 10;
// The apps move the marker when the feed appears, so a marker this fresh means they are
// looking at the feed now (they tapped Ask on it): "what did I miss" is about the last week.
const JUST_LOOKED_MS = 30 * 60 * 1000;

// Recommendations: the last 180 days within 10 miles, up to 8 names.
const RECOMMENDATION_DAYS = 180;
const RECOMMENDATION_PAGES = 3;
const RECOMMENDATION_POSTS = 30;
const RECOMMENDATION_REPLIES = 400;
const RECOMMENDATION_NAMES = 8;

const TYPE_LABELS = {
  alert: 'heads-ups',
  lost_found: 'lost and found',
  event: 'events',
  ask_local: 'questions',
  recommendation: 'recommendations',
  deal: 'deals',
  local_update: 'local updates',
  neighborhood_win: 'good news',
  visitor_guide: 'visitor guides',
};
// Heads-ups and lost and found first (contract §6.1), then what has a date, then the rest.
const TYPE_ORDER = ['alert', 'lost_found', 'event', 'ask_local', 'recommendation', 'deal', 'local_update', 'neighborhood_win', 'visitor_guide'];
const typeRank = (type) => (TYPE_ORDER.includes(type) ? TYPE_ORDER.indexOf(type) : TYPE_ORDER.length);

const nearbyReadToolDefinitions = [
  {
    name: 'catch_up_nearby',
    description: "What is new on the person's Nearby feed within about 10 miles: since they last looked, or over the last `days`. Counts by type and the top posts, heads-ups and lost and found first, each with its post_id for a link button. Without days it covers the time since their last visit (at most 14 days), or the last 7 days when they haven't looked yet or are looking at the feed right now. Use it for \"what did I miss\" and \"what's new around here\".",
    input_schema: {
      type: 'object',
      properties: {
        days: { type: ['integer', 'null'], minimum: 1, maximum: 14, description: 'Days back when they name a period ("this week" is 7). Null for since their last visit.' },
      },
      required: ['days'],
      additionalProperties: false,
    },
  },
  {
    name: 'find_recommendations',
    description: "What neighbors recommend for something (a plumber, a dentist, a dog sitter, a taco place): recommendation posts and questions on their Nearby feed from the last 180 days, within 10 miles, that match the words, and the businesses or people named in them and in their replies, with how many neighbors named each and the post_ids. Names are picked out by their capital letters, so read said_text before calling a mention a recommendation.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What they want recommended, in a few words, e.g. "plumber" or "kids dentist".' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

// ─── The feed ──────────────────────────────────────────────────────────────

/** The person's place for the Nearby feed (home first, then a saved place), as find_posts reads it. */
async function feedLocation(userId) {
  const { location } = await homesOf(userId);
  if (!location || location.latitude == null || location.longitude == null) return null;
  return location;
}

/**
 * The person's Nearby feed back to `sinceMs`, newest first: a few pages of the feed's own query,
 * with its own checks. Pinned posts lead the first page whatever their age, so they are kept only
 * when they are new enough too.
 */
async function feedSince(ctx, location, sinceMs, { postType = null, pages }) {
  const posts = [];
  let cursor = null;
  for (let page = 0; page < pages; page += 1) {
    const result = await feedService.getListFeed({
      userId: ctx.userId,
      surface: 'place',
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMeters: NEARBY_RADIUS_METERS,
      postType,
      cursorCreatedAt: cursor?.createdAt || null,
      cursorId: cursor?.id || null,
      limit: FEED_PAGE,
    });
    const batch = result.posts || [];
    posts.push(...batch);
    const last = batch[batch.length - 1];
    cursor = result.pagination?.nextCursor || null;
    if (!result.pagination?.hasMore || !cursor || !last || Date.parse(last.created_at) < sinceMs) break;
  }
  const seen = new Set();
  return posts.filter((post) => post.id && !seen.has(post.id) && seen.add(post.id)
    && Date.parse(post.created_at) >= sinceMs);
}

const when = (ms, zone) => DateTime.fromMillis(ms).setZone(zoneOr(zone)).toFormat("cccc, LLLL d 'at' h:mm a");

// ─── Catch-up since you last looked ────────────────────────────────────────

/**
 * Posts the person can see on Nearby since the marker (or `days` back), grouped by type with
 * counts; the top items carry their post ids. Their own posts are left out: nothing to catch up on.
 */
async function catchUpNearby(args, ctx) {
  const location = await feedLocation(ctx.userId);
  if (!location) return { error: 'They have no home or saved place yet, so there is no Nearby feed to catch up on.' };
  const now = Date.now();
  let sinceMs;
  let sinceSource;
  if (Number.isInteger(args.days)) {
    sinceMs = now - Math.min(Math.max(args.days, 1), CATCH_UP_MAX_DAYS) * DAY_MS;
    sinceSource = 'the days asked for';
  } else {
    const marker = Date.parse((await feedSeen.lastSeen(ctx.userId, 'nearby').catch(() => null)) || '');
    if (Number.isFinite(marker) && now - marker >= JUST_LOOKED_MS) {
      sinceMs = Math.max(marker, now - CATCH_UP_MAX_DAYS * DAY_MS);
      sinceSource = marker < now - CATCH_UP_MAX_DAYS * DAY_MS ? 'their last visit, more than 14 days ago (14 days shown)' : 'their last visit';
    } else {
      sinceMs = now - CATCH_UP_DEFAULT_DAYS * DAY_MS;
      sinceSource = Number.isFinite(marker) ? 'the last 7 days (they are looking at the feed now)' : 'the last 7 days';
    }
  }

  const posts = (await feedSince(ctx, location, sinceMs, { pages: CATCH_UP_PAGES }))
    .filter((post) => String(post.user_id) !== String(ctx.userId));
  const counts = new Map();
  for (const post of posts) counts.set(post.post_type, (counts.get(post.post_type) || 0) + 1);
  const ordered = [...posts].sort((a, b) => (typeRank(a.post_type) - typeRank(b.post_type))
    || (Date.parse(b.created_at) - Date.parse(a.created_at)));
  return {
    note: OTHERS_WORDS,
    since: when(sinceMs, ctx.timeZone),
    since_means: sinceSource,
    area: location.label || null,
    total: posts.length,
    counts: [...counts.entries()]
      .sort(([a], [b]) => typeRank(a) - typeRank(b))
      .map(([type, count]) => ({ type, label: TYPE_LABELS[type] || 'other posts', count })),
    posts: ordered.slice(0, CATCH_UP_ITEMS).map((post) => ({
      ...postForModel(post, ctx.timeZone),
      body_text: clip(post.content, 160),
      ...(post.safety_alert_kind ? { heads_up_kind: post.safety_alert_kind } : {}),
      ...(post.lost_found_type ? { lost_or_found: post.lost_found_type } : {}),
    })),
    ...(posts.length > CATCH_UP_ITEMS ? { more: posts.length - CATCH_UP_ITEMS } : {}),
    ...(posts.length === 0 ? { nothing_new: true } : {}),
  };
}

// ─── Recommendations, summed up ────────────────────────────────────────────

// Words in a request that say nothing about what is wanted.
const ASKING_WORDS = new Set([
  'recommend', 'recommends', 'recommended', 'recommendation', 'recommendations', 'good', 'great', 'best', 'anyone',
  'know', 'who', 'neighbors', 'neighbor', 'nearby', 'local', 'around', 'here', 'someone', 'place', 'places',
  'any', 'does', 'what', 'where', 'should', 'use', 'used', 'reliable', 'affordable', 'cheap',
]);

/** The words of a request worth matching, each as a short stem ("plumbers" and "plumbing" share "plumb"). */
function queryStems(query) {
  return [...new Set(normalizeTitle(String(query || ''))
    .filter((word) => word.length >= 3 && !ASKING_WORDS.has(word))
    .map((word) => (word.length > 5 ? word.slice(0, Math.max(4, word.length - 3)) : word)))];
}

function matchesStems(stems, text) {
  const words = normalizeTitle(text);
  return stems.some((stem) => words.some((word) => word.startsWith(stem)));
}

// Capitalized words that start sentences or name no one.
const NOT_NAMES = new Set([
  'i', "i'm", "i've", "i'd", "i'll", 'we', "we've", "we're", 'they', "they're", 'he', 'she', 'you', "you'll", 'it', "it's",
  'my', 'our', 'their', 'his', 'her', 'your', 'this', 'that', 'these', 'those', 'the', 'a', 'an', 'and', 'but', 'or',
  'so', 'if', 'when', 'then', 'there', 'here', 'what', 'who', 'where', 'why', 'how', 'thanks', 'thank', 'hi', 'hello',
  'hey', 'yes', 'no', 'ok', 'okay', 'also', 'highly', 'definitely', 'great', 'good', 'best', 'really', 'very', 'just',
  'try', 'call', 'ask', 'check', 'use', 'used', 'get', 'got', 'go', 'went', 'love', 'loved', 'recommend', 'recommended',
  'anyone', 'any', 'does', 'do', 'did', 'has', 'have', 'had', 'is', 'are', 'was', 'were', 'can', 'could', 'would',
  'should', 'will', 'not', 'please', 'pantopus', 'nearby', 'google', 'yelp', 'facebook', 'nextdoor', 'lol', 'omg',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'today', 'tomorrow', 'yesterday',
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'service', 'price', 'prices', 'quality', 'work', 'job', 'staff', 'food', 'everything', 'everyone', 'nothing',
  'communication', 'scheduling', 'customer', 'appointment', 'quote', 'parking', 'delivery',
]);
const CONNECTORS = new Set(['&', 'and', 'of', 'the', 'de', 'la']);
// A run ending in one of these is a street, not someone to recommend.
const STREET_WORDS = new Set(['st', 'street', 'ave', 'avenue', 'rd', 'road', 'blvd', 'boulevard', 'ln', 'lane', 'way', 'ct',
  'court', 'dr', 'drive', 'pl', 'hwy', 'highway', 'pkwy', 'parkway', 'loop', 'cir', 'circle', 'ter', 'terrace']);
// A lone capital starting a sentence is taken as a name only when what follows says someone did something
// ("Mike fixed our sink"), since most sentences start with an ordinary word.
const DID_WORDS = new Set(['was', 'is', 'did', 'does', 'fixed', 'came', 'helped', 'has', 'charged', 'replaced', 'installed',
  'repaired', 'cleaned', 'showed', 'got', 'saved', 'knows', 'recommended', 'answered', 'responded']);
const isCapital = (token) => /^\p{Lu}/u.test(token);

/**
 * The names in a text: runs of capitalized words ("Rose City Roofing", "Joe's Plumbing",
 * "Dr. Patel"), with "&", "and" or "of" inside a run, at most 4 words. A run's leading
 * non-names go ("Thanks Maria" is Maria); a lone capital at the start of a sentence is
 * usually an ordinary word, so it isn't taken.
 */
function namesIn(text) {
  const found = [];
  // "Dr. Patel" and "St. Johns" keep their period out of the sentence split.
  const flat = String(text || '').replace(/’/g, "'").replace(/\b(Dr|Mr|Mrs|Ms|St|Jr|Sr|Mt)\./g, '$1');
  for (const sentence of flat.split(/[.!?\n;:]+(?:\s|$)|\s[-–—]\s/)) {
    const tokens = sentence.match(/[\p{L}\p{N}][\p{L}\p{N}'.-]*|&/gu) || [];
    for (let i = 0; i < tokens.length; i += 1) {
      if (!isCapital(tokens[i])) continue;
      const start = i;
      let end = i;
      while (end + 1 < tokens.length && (isCapital(tokens[end + 1])
        || (CONNECTORS.has(tokens[end + 1].toLowerCase()) && end + 2 < tokens.length && isCapital(tokens[end + 2])))) {
        end += CONNECTORS.has(tokens[end + 1].toLowerCase()) ? 2 : 1;
      }
      i = end;
      let run = tokens.slice(start, end + 1).map((token) => token.replace(/[.-]+$/, ''));
      let first = start;
      while (run.length && (NOT_NAMES.has(run[0].toLowerCase()) || CONNECTORS.has(run[0].toLowerCase()))) {
        run = run.slice(1);
        first += 1;
      }
      while (run.length && CONNECTORS.has(run[run.length - 1].toLowerCase())) run = run.slice(0, -1);
      if (!run.length || run.length > 4) continue;
      if (run.length > 1 && STREET_WORDS.has(run[run.length - 1].toLowerCase())) continue;
      if (run.length === 1 && (run[0].length < 3
        || (first === 0 && !DID_WORDS.has(String(tokens[end + 1] || '').toLowerCase())))) continue;
      const name = run.join(' ');
      if (name.length <= 40) found.push(name);
    }
  }
  return found;
}

/** The grouping key of a name: letters and digits, lowercase, a final possessive dropped. */
function nameKey(name) {
  return name.toLowerCase().replace(/'s$/, '').replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** The sentence around a name, as a short quote. */
function snippet(text, name) {
  const flat = String(text || '').replace(/\s+/g, ' ').replace(/’/g, "'");
  const at = flat.indexOf(name);
  if (at < 0) return clip(flat, 140);
  const from = Math.max(0, flat.lastIndexOf('. ', at) + 1);
  return clip(flat.slice(from, from + 140), 140);
}

/**
 * Recommendation posts and questions on the person's Nearby feed that match the request, and
 * the names in them and their replies, grouped with how many neighbors named each.
 */
async function findRecommendations(args, ctx) {
  const stems = queryStems(args.query);
  if (!stems.length) return { error: 'Ask what they want a recommendation for (a plumber, a dentist, a dog sitter).' };
  const location = await feedLocation(ctx.userId);
  if (!location) return { error: 'They have no home or saved place yet, so there is no Nearby feed to search.' };
  const sinceMs = Date.now() - RECOMMENDATION_DAYS * DAY_MS;
  const [recommendations, questions] = await Promise.all([
    feedSince(ctx, location, sinceMs, { postType: 'recommendation', pages: RECOMMENDATION_PAGES }),
    feedSince(ctx, location, sinceMs, { postType: 'ask_local', pages: RECOMMENDATION_PAGES }),
  ]);
  const posts = [...recommendations, ...questions]
    .filter((post) => matchesStems(stems, `${post.title || ''} ${post.content || ''}`))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, RECOMMENDATION_POSTS);
  const base = { note: OTHERS_WORDS, query: clip(args.query, 80), within: '10 miles, the last 180 days', posts_searched: posts.length };
  if (!posts.length) return { ...base, mentions: [] };

  // Replies as the post page shows them, without people on either side of a block.
  const blocked = await blockService.blockedUserIds(ctx.userId);
  const { data: replies, error } = await onlyShownReplies(supabaseAdmin.from('PostComment')
    .select('id, post_id, user_id, comment, created_at')
    .in('post_id', posts.map((post) => post.id))
    .eq('is_deleted', false), ctx.userId)
    .order('created_at', { ascending: false })
    .limit(RECOMMENDATION_REPLIES);
  if (error) throw new Error(`Reply read failed: ${error.message}`);

  const texts = [
    ...posts.map((post) => ({ postId: post.id, authorId: post.user_id, at: post.created_at, text: `${post.title || ''}. ${post.content || ''}` })),
    ...(replies || []).filter((reply) => !blocked.has(String(reply.user_id)))
      .map((reply) => ({ postId: reply.post_id, authorId: reply.user_id, at: reply.created_at, text: reply.comment })),
  ];
  const queryKeys = new Set(normalizeTitle(String(args.query || '')));
  const groups = new Map();
  const named = new Set();
  for (const item of texts) {
    const inText = new Set();
    for (const name of namesIn(item.text)) {
      const key = nameKey(name);
      if (!key || inText.has(key) || queryKeys.has(key)) continue;
      inText.add(key);
      named.add(item.postId);
      if (!groups.has(key)) groups.set(key, { names: new Map(), by: new Set(), mentions: 0, posts: [], latest: 0, said: [] });
      const group = groups.get(key);
      group.names.set(name, (group.names.get(name) || 0) + 1);
      group.by.add(String(item.authorId));
      group.mentions += 1;
      if (!group.posts.includes(item.postId)) group.posts.push(item.postId);
      group.latest = Math.max(group.latest, Date.parse(item.at) || 0);
      if (group.said.length < 2) group.said.push(snippet(item.text, name));
    }
  }
  const ranked = [...groups.values()]
    .sort((a, b) => (b.by.size - a.by.size) || (b.mentions - a.mentions) || (b.latest - a.latest))
    .slice(0, RECOMMENDATION_NAMES);
  return {
    ...base,
    mentions: ranked.map((group) => ({
      name_text: [...group.names.entries()].sort((a, b) => b[1] - a[1])[0][0],
      neighbors: group.by.size,
      mentions: group.mentions,
      post_ids: group.posts.slice(0, 3),
      latest: dayLabel(new Date(group.latest).toISOString(), ctx.timeZone),
      said_text: group.said,
    })),
    // Matching posts that name no one: their replies may still help (get_post reads them).
    other_posts: posts.filter((post) => !named.has(post.id)).slice(0, 3)
      .map((post) => ({ post_id: post.id, type: post.post_type, title_text: clip(post.title, 120) || clip(post.content, 120), replies: post.comment_count ?? null })),
  };
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

const NEARBY_READ_EXECUTORS = {
  catch_up_nearby: catchUpNearby,
  find_recommendations: findRecommendations,
};

async function runNearbyReadTool(name, args, ctx) {
  const executor = NEARBY_READ_EXECUTORS[name];
  if (!executor) return null;
  try {
    return await executor(args || {}, ctx);
  } catch (err) {
    logger.warn('assistant read tool failed', { tool: name, userId: ctx.userId, error: err?.message });
    return { error: `That couldn't be read just now (${name}).` };
  }
}

module.exports = {
  nearbyReadToolDefinitions,
  runNearbyReadTool,
  NEARBY_READ_EXECUTORS,
  // For the morning brief.
  catchUpNearby,
  findRecommendations,
};
