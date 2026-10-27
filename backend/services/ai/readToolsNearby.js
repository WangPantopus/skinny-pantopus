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
 * which the apps move when the feed appears (POST /api/posts/feed/seen). The post composers'
 * "Before you ask" (earlierAnswers) searches the same feed, with no model call.
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
 * when they are new enough too. `includeEnded` also reads posts whose time ran out (an Ask ends
 * after 7 days), which still open on their pages.
 */
async function feedSince(ctx, location, sinceMs, { postType = null, pages, includeEnded = false }) {
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
      includeEnded,
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
function queryStems(query, skip = ASKING_WORDS) {
  return [...new Set(normalizeTitle(String(query || ''))
    .filter((word) => word.length >= 3 && !skip.has(word))
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
  'second', 'seconded', 'seconding', 'another', 'plus', 'agree', 'agreed', 'same', 'ditto', 'downtown',
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

/**
 * One business named two ways is one group: "Joe's Plumbing" takes in "Second Joe's Plumbing" and
 * "Joe's Plumbing Co", by whole words at either end. A one-word name ("Joe") is left alone, so it
 * never swallows every business that shares it.
 */
function mergeContainedNames(groups) {
  const keys = [...groups.keys()].sort((a, b) => a.length - b.length);
  for (const short of keys) {
    if (!groups.has(short) || !short.includes(' ')) continue;
    for (const long of keys) {
      if (long === short || !groups.has(long) || !(long.startsWith(`${short} `) || long.endsWith(` ${short}`))) continue;
      const into = groups.get(short);
      const from = groups.get(long);
      for (const [name, count] of from.names) into.names.set(name, (into.names.get(name) || 0) + count);
      for (const id of from.by) into.by.add(id);
      into.mentions += from.mentions;
      for (const postId of from.posts) if (!into.posts.includes(postId)) into.posts.push(postId);
      into.latest = Math.max(into.latest, from.latest);
      for (const said of from.said) if (into.said.length < 2 && !into.said.includes(said)) into.said.push(said);
      groups.delete(long);
    }
  }
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
 * the names in them and their replies, grouped with how many neighbors named each. Ended posts
 * count too: an Ask ends after 7 days and a recommendation after 60, well inside the 180 days.
 */
async function findRecommendations(args, ctx) {
  const stems = queryStems(args.query);
  if (!stems.length) return { error: 'Ask what they want a recommendation for (a plumber, a dentist, a dog sitter).' };
  const location = await feedLocation(ctx.userId);
  if (!location) return { error: 'They have no home or saved place yet, so there is no Nearby feed to search.' };
  const sinceMs = Date.now() - RECOMMENDATION_DAYS * DAY_MS;
  const [recommendations, questions] = await Promise.all([
    feedSince(ctx, location, sinceMs, { postType: 'recommendation', pages: RECOMMENDATION_PAGES, includeEnded: true }),
    feedSince(ctx, location, sinceMs, { postType: 'ask_local', pages: RECOMMENDATION_PAGES, includeEnded: true }),
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
  // Their own town is named in posts all the time ("near downtown Bend"); it's no one to recommend.
  const placeKeys = new Set(String(location.label || '').toLowerCase().replace(/^near\s+/, '').split(/[,\s]+/).filter(Boolean));
  const groups = new Map();
  const named = new Set();
  for (const item of texts) {
    const inText = new Set();
    for (const name of namesIn(item.text)) {
      const key = nameKey(name);
      if (!key || inText.has(key) || queryKeys.has(key) || placeKeys.has(key)) continue;
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
  mergeContainedNames(groups);
  const ranked = [...groups.values()]
    .sort((a, b) => (b.by.size - a.by.size) || (b.mentions - a.mentions) || (b.latest - a.latest))
    .slice(0, RECOMMENDATION_NAMES);
  return {
    ...base,
    mentions: ranked.map((group) => ({
      // The way most neighbors wrote it; on a tie, the shorter (without "Second" and the like).
      name_text: [...group.names.entries()].sort((a, b) => (b[1] - a[1]) || (a[0].length - b[0].length))[0][0],
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

// ─── Before you ask ────────────────────────────────────────────────────────

// While someone writes a question, the composer shows earlier questions and recommendations
// nearby that match its words, each with its best reply (contract §6.5): a plain search of the
// feed find_recommendations reads, ended posts included, with no model call.
const EARLIER_PAGES = 2;
const EARLIER_SHOWN = 3;
// The best matches whose replies are read; a question nobody answered is passed over.
const EARLIER_READ = 8;
// A match is shown only when it scores at least this share of the best one.
const EARLIER_MIN_SHARE = 0.4;
// A post sharing one word with the question is about it when that word is this share of its title.
const TITLE_SHARE = 0.4;
// Words questions are written with that say nothing about what is asked.
const QUESTION_WORDS = new Set([
  ...ASKING_WORDS,
  'would', 'could', 'might', 'like', 'want', 'wanted', 'wondering', 'there', 'their', 'they', 'them', 'about', 'from',
  'been', 'just', 'really', 'thanks', 'thank', 'advance', 'tips', 'ideas', 'idea', 'suggestions', 'suggestion',
  'suggest', 'thoughts', 'advice', 'experience', 'experiences', 'question', 'anybody', 'everyone', 'everybody',
  'folks', 'people', 'which', 'when', 'how', 'why', 'are', 'was', 'were', 'did', 'had', 'you', 'all', 'one', 'thing',
  'things', 'something', 'find', 'trying', 'try', 'recently', 'area', 'town', 'neighborhood', 'close', 'near', 'week',
  'today', 'tomorrow', 'also', 'still', 'much', 'many', 'more', 'other', 'than', 'then', 'into', 'over', 'maybe',
  'well', 'better', 'getting', 'going', 'come', 'see', 'out', 'hello', 'hey', 'options', 'worth', 'okay', 'make',
  'making', 'call', 'called', 'calling', 'needs', 'hire', 'hiring',
]);
// Replies that answer nothing.
const NOT_AN_ANSWER = /^\s*(\+1|bump|following|same|same here|same question|me too|ditto|interested|subscribing|commenting to follow)[\s.!]*$/i;

/** The stems a text holds, as the start of one of its words. */
function stemsIn(stems, text) {
  const words = normalizeTitle(text);
  return stems.filter((stem) => words.some((word) => word.startsWith(stem)));
}

/**
 * Posts about what a question asks, best first. A post is about it when it holds two of the
 * question's words, or when they make up a good part of its title ("Honest mechanic?" for a long
 * question about brakes); a single shared word elsewhere ("kids") isn't enough. A word most of
 * the posts share says little about which one is meant, so it counts for less; a word in the
 * title counts for more, and a solved question a little more.
 */
function rankEarlier(stems, posts) {
  const found = posts.map((post) => {
    const title = post.title || String(post.content || '').split(/[.?!\n]/)[0];
    return {
      post,
      titleWords: queryStems(title, QUESTION_WORDS).length,
      inTitle: stemsIn(stems, title),
      inPost: stemsIn(stems, `${post.title || ''} ${post.content || ''}`),
    };
  }).filter(({ inPost, inTitle, titleWords }) => inPost.length >= Math.min(2, stems.length)
    || (inTitle.length > 0 && inTitle.length >= TITLE_SHARE * titleWords));
  const postsWith = new Map();
  for (const { inPost } of found) for (const stem of inPost) postsWith.set(stem, (postsWith.get(stem) || 0) + 1);
  const weight = (stem) => Math.log(1 + posts.length / postsWith.get(stem));
  const scored = found.map((item) => ({
    ...item,
    score: item.inPost.reduce((sum, stem) => sum + weight(stem) * (item.inTitle.includes(stem) ? 1.5 : 1), 0)
      * (item.post.state === 'solved' ? 1.2 : 1),
  })).sort((a, b) => (b.score - a.score)
    || (Number(b.post.state === 'solved') - Number(a.post.state === 'solved'))
    || ((b.post.comment_count || 0) - (a.post.comment_count || 0))
    || (Date.parse(b.post.created_at) - Date.parse(a.post.created_at)));
  const best = scored[0]?.score || 0;
  return scored.filter(({ score }) => score >= best * EARLIER_MIN_SHARE);
}

/** The reply to show: the one the asker marked Helpful, else the most liked, else the first. */
function bestReply(replies) {
  return [...replies].sort((a, b) => (Number(Boolean(b.helpful_at)) - Number(Boolean(a.helpful_at)))
    || ((b.like_count || 0) - (a.like_count || 0))
    || (Date.parse(a.created_at) - Date.parse(b.created_at)))[0] || null;
}

/**
 * Up to 3 earlier questions and recommendations matching the words of a question being written,
 * each with its best reply: posts the person can see on their Nearby feed within 10 miles of the
 * point given (else of their own place) from the last 180 days, ended ones included, their blocks,
 * mutes and hidden posts respected. Their own posts are left out, and so is a question nobody has
 * answered; a recommendation is an answer itself.
 */
async function earlierAnswers({ query, latitude, longitude }, ctx) {
  const stems = queryStems(query, QUESTION_WORDS);
  if (!stems.length) return { posts: [] };
  const location = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude } : await feedLocation(ctx.userId);
  if (!location) return { posts: [] };
  const sinceMs = Date.now() - RECOMMENDATION_DAYS * DAY_MS;
  const read = (postType) => feedSince(ctx, location, sinceMs, { postType, pages: EARLIER_PAGES, includeEnded: true });
  const [questions, recommendations] = await Promise.all([read('ask_local'), read('recommendation')]);
  const ranked = rankEarlier(stems, [...questions, ...recommendations]
    // A global pin leads every first page whatever its type.
    .filter((post) => ['ask_local', 'recommendation'].includes(post.post_type)
      && String(post.user_id) !== String(ctx.userId)))
    .slice(0, EARLIER_READ);
  if (!ranked.length) return { posts: [] };

  // Replies as the post page shows them, without people on either side of a block.
  const blocked = await blockService.blockedUserIds(ctx.userId);
  const { data: replies, error } = await onlyShownReplies(supabaseAdmin.from('PostComment')
    .select('id, post_id, user_id, comment, like_count, helpful_at, created_at')
    .in('post_id', ranked.map(({ post }) => post.id))
    .eq('is_deleted', false), ctx.userId)
    .order('created_at', { ascending: true })
    .limit(RECOMMENDATION_REPLIES);
  if (error) throw new Error(`Reply read failed: ${error.message}`);
  const shownByPost = new Map();
  for (const reply of replies || []) {
    if (reply.user_id && blocked.has(String(reply.user_id))) continue;
    if (!shownByPost.has(reply.post_id)) shownByPost.set(reply.post_id, []);
    shownByPost.get(reply.post_id).push(reply);
  }

  const posts = [];
  for (const { post } of ranked) {
    const shown = shownByPost.get(post.id) || [];
    // The asker's own replies ("Thanks all!") and "+1" answer nothing.
    const answers = shown.filter((reply) => String(reply.user_id) !== String(post.user_id)
      && clip(reply.comment, 400) && !NOT_AN_ANSWER.test(reply.comment));
    if (post.post_type === 'ask_local' && !answers.length) continue;
    const reply = bestReply(answers);
    posts.push({
      post_id: post.id,
      type: post.post_type,
      title: clip(post.title, 120) || clip(post.content, 120),
      body: post.title ? clip(post.content, 160) : null,
      created_at: post.created_at,
      solved: post.state === 'solved' || post.resolution === 'answered',
      reply_count: shown.length,
      best_reply: reply ? { text: clip(reply.comment, 240), helpful: Boolean(reply.helpful_at), likes: reply.like_count || 0 } : null,
    });
    if (posts.length === EARLIER_SHOWN) break;
  }
  return { posts };
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
  // For "Before you ask" in the post composers (GET /api/posts/before-you-ask).
  earlierAnswers,
};
