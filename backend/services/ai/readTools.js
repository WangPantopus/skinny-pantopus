/**
 * The assistant's read tools: what the person can see in Plans, Pulse, Place and
 * Today, read through the same services (and the same viewer) as those screens.
 *
 * Plans come from planService with the viewer planViewer builds, so other people's
 * plans carry the area only; posts come from the feed and the post page's read
 * check, placed by their displayed points; Place sections come from
 * composeHomeIntelligence under the person's own access; tasks and members come
 * from the household's locked record functions. A tool never widens what a screen
 * shows, and words other people wrote are marked as such (OTHERS_WORDS).
 */
const { DateTime } = require('luxon');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { isFeatureEnabled } = require('../featureFlagService');
const { loadViewer } = require('../plans/planViewer');
const planService = require('../plans/planService');
const planActions = require('../plans/planActions');
const { KINDS } = require('../plans/planRules');
const feedService = require('../feedService');
const { canReadPost, onlyShownReplies } = require('../pulse/readAccess');
const placeIntelligenceService = require('../placeIntelligenceService');
const { PLACE_SECTION_IDS } = require('../../serializers/placeIntelligenceSerializer');
const homeListService = require('../homeListService');
const homeRecordService = require('../homeRecordService');
const homeDetailService = require('../homeDetailService');
const { checkHomePermission } = require('../../utils/homePermissions');
const { localDisplayNames } = require('../../utils/identityProfiles');
const {
  OTHERS_WORDS, isUuid, clip, chosenHome, homesOf, zoneOr, whenLabel, dayLabel, todayIn, firstNameOf, distanceWords,
} = require('./assistantKit');

/**
 * The kinds of plan the tools offer. Playdates follow the person's plans_playdates flag, as the
 * Plans tab does: the tools list them only for people who have it (agentService's `playdates`
 * capability), and the plan services decide who sees, hosts and joins one (a verified address).
 */
function planKinds(playdates = false) {
  return playdates ? KINDS : KINDS.filter((kind) => kind !== 'playdate');
}

// What the nearby feed accepts from residents (posts.js PLACE types).
const PLACE_POST_TYPES = ['ask_local', 'recommendation', 'event', 'lost_found', 'alert', 'deal', 'local_update', 'neighborhood_win', 'visitor_guide'];
// The Today screen's cards (PlaceStoreReads.todaySections / StoreKeys.TODAY_SECTIONS). These
// come with their data,
const TODAY_SECTIONS = ['weather', 'air_quality', 'alerts', 'sunrise_sunset', 'good_day_to'];
// and these in one line each, so the day fits its screen context: the address calendar (the
// chat context also names the next pickups and dates), radon and the Ballot card. The screen's
// home and block sections only feed its sky drawing.
const TODAY_BRIEFS = ['address_calendar', 'lead_radon', 'civic_election'];
// Tasks due on Today, soonest first; list_home_tasks reads them all.
const TODAY_TASKS = 10;
const NEARBY_RADIUS_METERS = 16093; // 10 miles
const SECTION_DATA_CHARS = 900;
// Sections the tool reads by name share this much, so one or two come whole (all of their
// representatives, every home system) while a read of every section stays at 900 each.
const NAMED_SECTIONS_DATA_CHARS = 5000;
// A section's line in the Place tab's own context, which holds every section at once.
const SECTION_BRIEF_CHARS = 240;

/** find_plans, with playdates among its kinds for people who have plans_playdates. */
function findPlansDefinition({ playdates = false } = {}) {
  return {
    name: 'find_plans',
    description: "Plans (small meetups on the Plans map): the person's own (hosting, going, asked, waitlisted, recent) or ones nearby. Other people's plans show only their area, never the exact place. Use before drafting a plan change, an ask, a message to guests or answering \"what's on\".",
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['mine', 'nearby'], description: '"mine" for plans they host or joined, "nearby" for plans within 5 miles.' },
        window: { type: ['string', 'null'], enum: ['now', 'today', 'week', 'weekend', null], description: 'Nearby only: when. Null means this week.' },
        kinds: { type: ['array', 'null'], items: { type: 'string', enum: planKinds(playdates) }, description: 'Nearby only: kinds to include, or null for all.' },
      },
      required: ['scope', 'window', 'kinds'],
      additionalProperties: false,
    },
  };
}

const readToolDefinitions = [
  findPlansDefinition(),
  {
    name: 'find_teams',
    description: 'Find teams by name, nickname, city or state; null query returns local suggestions. Use the person’s words and remembered preferences when geography is unhelpful. Return ids for draft_sports_teams; never invent a team or follow one automatically.',
    input_schema: { type: 'object', properties: { query: { type: ['string', 'null'], maxLength: 100 } }, additionalProperties: false },
  },
  {
    name: 'find_games',
    description: "Read listed sports games for a direct question or a watch party the person asked for. Optional team name/id or league; otherwise use their followed and local teams. Never volunteer sports when their sports preference is off. Empty means no game listed, not proof there is no game. Use its id and exact start/end in draft_plan.",
    input_schema: { type: 'object', properties: {
      team: { type: ['string', 'null'], maxLength: 100 },
      league: { type: ['string', 'null'], enum: ['nfl', 'nba', 'wnba', 'mlb', 'nhl', 'mls', 'nwsl', 'ncaaf', null] },
      days: { type: ['integer', 'null'], minimum: 1, maximum: 14 },
    }, additionalProperties: false },
  },
  {
    name: 'get_plan',
    description: 'One plan as the person sees it. For the host it includes the people who asked to join and their signals (verified address, distance, plans joined, mutual connections, hosted before, new to Pantopus, note).',
    input_schema: {
      type: 'object',
      properties: { plan_id: { type: 'string', description: 'The plan id from find_plans or the screen context.' } },
      required: ['plan_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'find_posts',
    description: "Recent posts on the person's Nearby feed (questions, recommendations, events, lost and found, heads-ups, deals, local updates), newest first, within about 10 miles, as the feed shows them.",
    input_schema: {
      type: 'object',
      properties: {
        days: { type: ['integer', 'null'], minimum: 1, maximum: 14, description: 'How many days back. Null means 7.' },
        types: { type: ['array', 'null'], items: { type: 'string', enum: PLACE_POST_TYPES }, description: 'Post types to include, or null for all.' },
        query: { type: ['string', 'null'], description: 'Words the post must contain, or null.' },
      },
      required: ['days', 'types', 'query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_post',
    description: 'One post and its replies, as the person can see it.',
    input_schema: {
      type: 'object',
      properties: { post_id: { type: 'string' } },
      required: ['post_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_place_facts',
    description: "Facts about one of the person's homes from the Place tab, each with its source and date: risks (flood, wildfire, seismic, heat), lead and radon, drinking water, environmental hazards, the home itself and its systems' ages, the block, money sections they may see, civic districts and elections. Say when a value is an estimate or not available.",
    input_schema: {
      type: 'object',
      properties: {
        home_id: { type: ['string', 'null'], description: 'One of their homes, or null for the home Today shows.' },
        topics: { type: ['array', 'null'], items: { type: 'string', enum: PLACE_SECTION_IDS }, description: 'Sections to read, or null for all. Name the ones you need: a few named sections come whole, while a read of all of them cuts each one short.' },
      },
      required: ['home_id', 'topics'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_today',
    description: "Today at the person's home: weather and the hourly forecast, air quality, alerts, sunrise and sunset, \"good day to\" picks, and in short the address calendar (pickup days and other dates), radon and the next election; plans today and household tasks due.",
    input_schema: {
      type: 'object',
      properties: { home_id: { type: ['string', 'null'], description: 'One of their homes, or null for the home Today shows.' } },
      required: ['home_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_home_tasks',
    description: "The household's tasks and reminders the person may see, with due dates, who they're assigned to and status.",
    input_schema: {
      type: 'object',
      properties: {
        home_id: { type: ['string', 'null'] },
        status: { type: ['string', 'null'], enum: ['open', 'done', 'all', null], description: 'Null means open.' },
      },
      required: ['home_id', 'status'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_household',
    description: "The people in one of the person's homes (first names, roles and ids), for assigning a task to someone.",
    input_schema: {
      type: 'object',
      properties: { home_id: { type: ['string', 'null'] } },
      required: ['home_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_notification_settings',
    description: "The person's notification settings: quiet hours, the morning and evening briefings and their times, weather and air alerts, home reminders.",
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
];

// The read tools that differ for people with plans_playdates.
const playdateReadToolDefinitions = [findPlansDefinition({ playdates: true })];

// ─── Plans ─────────────────────────────────────────────────────────────────

async function plansOn(ctx) {
  if (typeof ctx.plansEnabled === 'boolean') return ctx.plansEnabled;
  return isFeatureEnabled('plans', ctx.user).catch(() => false);
}

/** A plan card or detail, as the model reads it. */
function planForModel(card, zone) {
  if (!card) return null;
  const isIn = card.viewer?.role === 'host' || card.viewer?.role === 'guest';
  const out = {
    plan_id: card.id,
    kind: card.kind,
    title_text: clip(card.title, 80),
    when: card.starts_at ? whenLabel(card.starts_at, card.ends_at, card.timezone || zone) : (card.starts_on ? `${card.starts_on}, ${card.day_part}` : null),
    starts_at: card.starts_at || null,
    ends_at: card.ends_at || null,
    area: card.area?.label || null,
    distance: distanceWords(card.distance_band),
    host_name: card.host?.display_name || null,
    host_verified: Boolean(card.host?.verified_address),
    spots: card.spots,
    going: card.going_count,
    spots_left: card.spots_left,
    waitlist: card.waitlist_count,
    details: card.details || {},
    people_get_in: card.how_people_get_in,
    state: card.state,
    your_role: card.viewer?.role || 'none',
    your_request: card.viewer?.request_status || null,
    can_ask: card.viewer?.can_ask ?? null,
    cannot_ask_reason: card.viewer?.cannot_ask_reason || null,
  };
  if (card.about) out.about_text = clip(card.about, 300);
  if (isIn && card.place) {
    out.place = { name_text: clip(card.place.name, 120), address_text: clip(card.place.address, 200), note_text: clip(card.place.note, 300) };
    out.people = (card.people || []).map((p) => ({ name: p.display_name, party_size: p.party_size, host: Boolean(p.is_host) }));
    out.chat_open = Boolean(card.chat_open);
  }
  if (card.viewer?.role === 'host') {
    out.waiting_requests = card.requests_count || 0;
    out.auto_rules = card.auto_rules || [];
    out.place_kind = card.place_kind;
  }
  return out;
}

async function findTeams(args, ctx) {
  const user = { id: ctx.userId, role: ctx.user?.role || null };
  if (!(await plansOn(ctx)) || !(await isFeatureEnabled('plans_sports', user))) return { error: 'Sports teams are not available yet.' };
  const { searchTeams, publicTeam } = require('../plans/planTeams');
  const viewer = await loadViewer(user);
  const query = typeof args.query === 'string' ? args.query.trim().slice(0, 100) : '';
  const teams = (query ? searchTeams(query) : require('../plans/planGames').suggestedForViewer(viewer)).map(publicTeam);
  ctx.sportsTeamIds ||= new Set();
  for (const team of teams) ctx.sportsTeamIds.add(team.id);
  return { teams, suggested: !query, preferences: viewer.sports || {},
    note: teams.length ? 'Offer choices, then draft changes for confirmation.' : 'No teams listed here. Ask which team, city or home state they care about; search works nationwide.' };
}

async function findGames(args, ctx) {
  const user = { id: ctx.userId, role: ctx.user?.role || null };
  if (!(await plansOn(ctx)) || !(await isFeatureEnabled('plans_sports', user))) {
    return { error: "Sports games aren't available for this person yet." };
  }
  const { TEAMS } = require('../../data/sportsTeams');
  const { teamById, searchTeams, LEAGUES } = require('../plans/planTeams');
  const { gamesForViewer, upcomingGamesForTeams } = require('../plans/planGames');
  const days = args.days ?? 14;
  if (!Number.isInteger(days) || days < 1 || days > 14) return { error: 'Choose 1 to 14 days.' };
  if (args.league && !LEAGUES.includes(args.league)) return { error: 'Choose a listed league.' };
  const viewer = await loadViewer(user);
  const prefs = viewer.sports || {};
  const query = typeof args.team === 'string' ? args.team.trim().slice(0, 100) : '';
  const matches = query ? (teamById(query) ? [teamById(query)] : searchTeams(query)) : null;
  const teams = matches || (args.league ? TEAMS.filter((team) => team.league === args.league) : null);
  // A direct read does not change any preference. The sheet and background nudges still honor off.
  const result = teams
    ? await upcomingGamesForTeams(teams.filter((team) => !args.league || team.league === args.league).map((team) => team.id))
    : await gamesForViewer({ ...viewer, sports: { ...prefs, watch: 'on' } }, 'composer');
  const until = Date.now() + days * 86400000;
  const games = result.games.filter((game) => Date.parse(game.starts_at) <= until).map((game) => ({
    ...game,
    followed: (prefs.teams || []).includes(game.team),
    starts_local: DateTime.fromISO(game.starts_at).setZone(zoneOr(ctx.timeZone)).toFormat("yyyy-MM-dd'T'HH:mm"),
    ends_local: DateTime.fromISO(game.ends_at).setZone(zoneOr(ctx.timeZone)).toFormat("yyyy-MM-dd'T'HH:mm"),
    when: whenLabel(game.starts_at, game.ends_at, ctx.timeZone),
  }));
  ctx.sportsGames ||= new Map();
  for (const game of games) ctx.sportsGames.set(game.id, game);
  return { games, time_zone: zoneOr(ctx.timeZone), attribution: result.attribution || result.sports?.attribution || null,
    sports_off: prefs.watch === 'off', note: 'These are listed schedules. Answer this request only; never volunteer games when sports is off.' };
}

async function findPlans(args, ctx) {
  if (!(await plansOn(ctx))) return { error: "Plans aren't available for this person yet." };
  const viewer = await loadViewer({ id: ctx.userId, role: ctx.user?.role || null });
  if (args.scope === 'mine') {
    const mine = await planService.listMine(viewer);
    const map = (list) => list.map((card) => planForModel(card, ctx.timeZone));
    return {
      note: OTHERS_WORDS,
      hosting: map(mine.hosting),
      going: map(mine.going),
      asked: map(mine.asked),
      waitlisted: map(mine.waitlisted),
      recent: map(mine.recent),
    };
  }
  if (!viewer.origin) return { error: 'They have no home, saved place or location yet, so nearby plans can\'t be found.' };
  const asked = Array.isArray(args.kinds) ? args.kinds.filter((kind) => KINDS.includes(kind)) : [];
  // Playdates only for people who see them on the map (the flag and a verified address), as
  // GET /api/plans: asking only for kinds they can't see finds nothing, not every plan.
  const kinds = viewer.seesPlaydates ? asked : asked.filter((kind) => kind !== 'playdate');
  const unseen = viewer.playdatesFlag && !viewer.seesPlaydates && (!asked.length || asked.includes('playdate'))
    ? { playdates: 'Playdates are for verified neighbors, so none show until their address is verified.' }
    : {};
  if (asked.length && !kinds.length) return { note: OTHERS_WORDS, plans: [], more: false, ...unseen };
  const result = await planService.listNearby(viewer, { point: viewer.origin, window: args.window || 'week', kinds });
  const items = (result.items || []).slice(0, 12);
  return { note: OTHERS_WORDS, plans: items.map((card) => planForModel(card, ctx.timeZone)), more: Boolean(result.next_cursor), ...unseen };
}

async function getPlan(args, ctx) {
  if (!(await plansOn(ctx))) return { error: "Plans aren't available for this person yet." };
  if (!isUuid(args.plan_id)) return { error: 'That is not a plan id. Use find_plans to get one.' };
  const viewer = await loadViewer({ id: ctx.userId, role: ctx.user?.role || null });
  const { body } = await planService.getForViewer(args.plan_id, viewer);
  if (!body) return { error: "That plan isn't available to them." };
  const plan = planForModel(body, ctx.timeZone);
  if (body.viewer?.role === 'host') {
    const requests = await planActions.listRequests({ id: ctx.userId, role: ctx.user?.role || null }, args.plan_id);
    const view = (r) => ({
      request_id: r.id,
      name: r.user.display_name,
      party_size: r.party_size,
      verified_address: r.user.verified_address,
      distance: distanceWords(r.user.distance_band),
      plans_joined: r.user.plans_joined,
      mutual_connections: r.user.mutual_connections,
      hosted_before: r.user.hosted_before,
      new_to_pantopus: r.user.new_to_pantopus,
      // A playdate's family: how many kids and their ages (never names).
      ...(body.kind === 'playdate' ? { kids_count: r.kids_count, kids_age_bands: r.kids_age_bands } : {}),
      note_text: clip(r.note, 280),
    });
    plan.waiting = requests.pending.map(view);
    plan.waitlisted = requests.waitlisted.map(view);
  }
  return { note: OTHERS_WORDS, plan };
}

// ─── Posts ─────────────────────────────────────────────────────────────────

function postForModel(post, zone) {
  const author = post.author || post.creator || post.user || null;
  return {
    post_id: post.id,
    type: post.post_type,
    title_text: clip(post.title, 120),
    body_text: clip(post.content, 400),
    posted: dayLabel(post.created_at, zone),
    area: post.location_name || null,
    author_name: firstNameOf(author) || null,
    replies: post.comment_count ?? null,
    state: post.state || null,
    event_date: post.event_date || null,
    // An event's time and venue as its page shows them to everyone who reads it: composers post the
    // poster's wall clock labelled UTC, so it reads in UTC.
    ...(post.post_type === 'event' ? {
      event_when: post.event_date ? whenLabel(post.event_date, post.event_end_date, 'UTC') : null,
      event_venue_text: clip(post.event_venue, 120),
    } : {}),
  };
}

async function findPosts(args, ctx) {
  const { location } = await homesOf(ctx.userId);
  if (!location || location.latitude == null || location.longitude == null) {
    return { error: 'They have no home or saved place yet, so there is no Nearby feed to read.' };
  }
  const days = Number.isInteger(args.days) ? Math.min(Math.max(args.days, 1), 14) : 7;
  const types = Array.isArray(args.types) ? args.types.filter((type) => PLACE_POST_TYPES.includes(type)) : [];
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const result = await feedService.getListFeed({
    userId: ctx.userId,
    surface: 'place',
    latitude: location.latitude,
    longitude: location.longitude,
    radiusMeters: NEARBY_RADIUS_METERS,
    postType: types.length === 1 ? types[0] : null,
    limit: 40,
  });
  const words = typeof args.query === 'string' ? args.query.toLowerCase().split(/\s+/).filter(Boolean) : [];
  const posts = (result.posts || [])
    .filter((post) => new Date(post.created_at).getTime() >= since)
    .filter((post) => !types.length || types.includes(post.post_type))
    .filter((post) => {
      if (!words.length) return true;
      const text = `${post.title || ''} ${post.content || ''}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .slice(0, 15);
  return { note: OTHERS_WORDS, area: location.label || null, posts: posts.map((post) => postForModel(post, ctx.timeZone)) };
}

async function getPost(args, ctx) {
  if (!isUuid(args.post_id)) return { error: 'That is not a post id.' };
  const { data: post, error } = await supabaseAdmin.from('Post')
    .select('*')
    .eq('id', args.post_id).maybeSingle();
  if (error) throw new Error(`Post read failed: ${error.message}`);
  if (!post || !(await canReadPost(post, ctx.userId))) return { error: "That post isn't available to them." };
  const { data: comments } = await onlyShownReplies(supabaseAdmin.from('PostComment')
    .select('id, comment, created_at, parent_comment_id, user_id')
    .eq('post_id', post.id).eq('is_deleted', false), ctx.userId)
    .order('created_at', { ascending: true })
    .limit(40);
  feedService.applyPostLocationPrivacy(post, ctx.userId);
  const names = await localDisplayNames([post.user_id, ...(comments || []).map((c) => c.user_id)]).catch(() => new Map());
  const nameOf = (id) => firstNameOf({ display_name: names.get(String(id)) });
  return {
    note: OTHERS_WORDS,
    post: {
      ...postForModel(post, ctx.timeZone),
      author_name: nameOf(post.user_id) || 'A neighbor',
      yours: String(post.user_id) === String(ctx.userId),
      body_text: clip(post.content, 1500),
    },
    replies: (comments || []).map((c) => ({
      reply_id: c.id,
      author_name: nameOf(c.user_id) || 'A neighbor',
      yours: String(c.user_id) === String(ctx.userId),
      reply_text: clip(c.comment, 500),
      in_reply_to: c.parent_comment_id || null,
      posted: dayLabel(c.created_at, ctx.timeZone),
    })),
  };
}

// ─── Place, Today, tasks, household ────────────────────────────────────────

/**
 * The home's intelligence sections under the person's own access, as the Place screen reads them.
 * The screen asks for the Ballot card (`ballot=1`), so the civic sections come with it whenever
 * `ballot_p0` is on for them, as routes/placeIntelligence.js decides.
 */
async function readSections(homeId, userId, sectionIds, user = null) {
  const homeRead = placeIntelligenceService.readHome(homeId);
  const civic = !sectionIds || sectionIds.some((id) => id.startsWith('civic_'));
  const [access, ballot] = await Promise.all([
    checkHomePermission(homeId, userId, 'home.view'),
    civic ? isFeatureEnabled('ballot_p0', user || { id: userId }).catch(() => false) : false,
  ]);
  if (!access.hasAccess) {
    const privateSetup = await homeListService.readAccessState(homeId, userId);
    if (privateSetup.mode !== 'private_setup') return null;
  }
  return placeIntelligenceService.composeHomeIntelligence({ homeId, userId, access, sectionIds, ballot, homeRead });
}

/** The composed payload's sections in screen order; serializePlaceIntelligence nests them under groups. */
function sectionsOf(intelligence) {
  return (intelligence?.groups || []).flatMap((group) => group.sections || []);
}

const HOUR_MS = 60 * 60 * 1000;
/** A code in plain words: "partly_cloudy" → "partly cloudy". */
const words = (code) => (code ? String(code).replace(/_/g, ' ') : null);
/** The forecast hours from the current one on, at most a day of them. */
const nextHours = (hourly) => (Array.isArray(hourly) ? hourly : [])
  .filter((hour) => Date.parse(hour.time) + HOUR_MS > Date.now())
  .slice(0, 24);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar day of a time in `zone`; a bare date ("2026-09-24") is that day. */
function localDate(iso, zone) {
  if (!iso) return null;
  const text = String(iso);
  if (DATE_ONLY.test(text)) return text;
  const at = DateTime.fromISO(text, { zone: 'utc' }).setZone(zoneOr(zone));
  return at.isValid ? at.toISODate() : null;
}

/**
 * When a section's data is from. The Ballot card's is the date a person checked it, which its
 * envelope stores as UTC midnight (a day early once read in the Americas), so its own checked_at
 * is used instead.
 */
const asOfOf = (section) => (DATE_ONLY.test(String(section.data?.checked_at || '')) ? section.data.checked_at : section.as_of);

/**
 * The weather section in the home's own time: now, today's high and low, the next 24
 * hours and the days ahead. Whole it is about 3,300 characters of UTC times, and cut to
 * SECTION_DATA_CHARS its hourly forecast stopped about 7 hours ahead.
 */
function weatherForModel(data, zone) {
  const local = zoneOr(zone);
  let lastDay = null;
  let lastOffset = null;
  const hour = (entry) => {
    const at = DateTime.fromISO(String(entry.time), { zone: 'utc' }).setZone(local);
    // The weekday only where the day changes ("Tue 3 AM", "4 AM", … "Wed 12 AM"), and the
    // zone where the clocks change, so the repeated hour reads "1 AM PST".
    let label = at.toFormat(at.toISODate() === lastDay ? 'h a' : 'ccc h a');
    if (lastOffset !== null && at.offset !== lastOffset) label += ` ${at.offsetNameShort}`;
    lastDay = at.toISODate();
    lastOffset = at.offset;
    const wind = entry.wind_mph == null ? 'wind unknown' : `${entry.wind_mph} mph`;
    return `${label}: ${entry.temp_f}°F, ${entry.precip_chance}%, ${wind}, ${words(entry.condition_code) || 'sky unknown'}`;
  };
  const day = (entry) => {
    const date = DateTime.fromISO(String(entry.date), { zone: local });
    return `${date.isValid ? date.toFormat('ccc, LLL d') : entry.date}: ${entry.high_f}°F/${entry.low_f}°F, ${entry.precip_chance}%, ${words(entry.condition_code) || 'sky unknown'}`;
  };
  return {
    note: "In the home's local time. Each hour: temperature, chance of rain or snow, wind, sky. Each day: high/low, chance of rain or snow, sky.",
    now: {
      temp_f: data.current_temp_f ?? null,
      feels_like_f: data.feels_like_f ?? null,
      sky: data.condition_label || words(data.condition_code),
      wind_mph: data.wind_mph ?? null,
      wind_from: data.wind_direction || null,
    },
    today: { high_f: data.high_f ?? null, low_f: data.low_f ?? null },
    next_24_hours: nextHours(data.hourly).map(hour),
    days: (Array.isArray(data.daily) ? data.daily : []).map(day),
  };
}

/**
 * When a section's data is from, to the hour in the home's time ("2026-10-20 3 AM"): enough to say how current
 * it is, and steady, so a screen's context isn't added to the conversation again on every turn just because a
 * timestamp moved (the weather's and the address calendar's are the time they were read). A bare date stays a date.
 */
function asOfHour(iso, zone) {
  if (!iso || DATE_ONLY.test(String(iso))) return localDate(iso, zone);
  const at = DateTime.fromISO(String(iso), { zone: 'utc' }).setZone(zoneOr(zone));
  return at.isValid ? at.toFormat('yyyy-LL-dd h a') : null;
}

function sectionForModel(section, zone, dataChars = SECTION_DATA_CHARS) {
  let data = null;
  if (section.data != null && section.id === 'weather') {
    data = weatherForModel(section.data, zone);
  } else if (section.data != null) {
    const json = JSON.stringify(section.data);
    data = json.length > dataChars ? `${json.slice(0, dataChars)}…` : section.data;
  }
  return {
    topic: section.id,
    status: section.status,
    access: section.access,
    source: section.source || null,
    as_of: asOfHour(asOfOf(section), zone),
    coverage: section.coverage,
    unavailable_reason: section.unavailable_reason || null,
    data,
    // A cut section says so, and how to read more of it while it shares the read with others.
    ...(typeof data === 'string' ? {
      cut: dataChars < NAMED_SECTIONS_DATA_CHARS ? 'Cut short here. get_place_facts with only this topic reads more of it.' : 'Cut short here.',
    } : {}),
  };
}

/** `value` without nulls, empty strings and empty lists or objects; undefined when nothing is left. */
function withoutEmpty(value) {
  if (Array.isArray(value)) {
    const list = value.map(withoutEmpty).filter((item) => item !== undefined);
    return list.length ? list : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => [key, withoutEmpty(item)]).filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return value === null || value === '' ? undefined : value;
}

const shortDate = (isoDate) => {
  const date = DateTime.fromISO(String(isoDate || ''));
  return date.isValid ? date.toFormat('LLL d') : isoDate;
};

const ALERT_RANK = { warning: 0, watch: 1, advisory: 2 };

// The line for sections whose data has no sentence of its own and runs long.
const BRIEFS = {
  weather: (data) => {
    const hours = nextHours(data.hourly);
    const sky = String(data.condition_label || words(data.condition_code) || '').toLowerCase();
    return [
      data.current_temp_f != null ? `${data.current_temp_f}°F${sky ? ` and ${sky}` : ''} now` : null,
      data.high_f != null && data.low_f != null ? `high ${data.high_f}°F, low ${data.low_f}°F` : null,
      hours.length ? `up to ${Math.max(...hours.map((hour) => hour.precip_chance || 0))}% chance of rain or snow in the next 24 hours` : null,
    ].filter(Boolean).join('; ');
  },
  air_quality: (data) => `AQI ${data.index}, ${data.category_label}. ${data.health_message || ''}`,
  // The strongest first, by their short names.
  alerts: (data) => {
    const active = Array.isArray(data.active) ? [...data.active] : [];
    if (!active.length) return 'No active alerts';
    return active.sort((a, b) => (ALERT_RANK[a.severity] ?? 3) - (ALERT_RANK[b.severity] ?? 3))
      .map((alert) => alert.event || alert.headline).join('; ');
  },
  good_day_to: (data) => (data.tiles || []).map((tile) => `${tile.label} (${tile.verdict}): ${tile.answer}`).join('; '),
  // Each kind of date once, at its next date, saying when it isn't confirmed.
  address_calendar: (data) => {
    const seen = new Set();
    const next = (data.upcoming || []).filter((entry) => !seen.has(entry.title) && seen.add(entry.title));
    const confirmed = (entry) => entry.confidence === 'official' || entry.scope === 'home';
    return `${data.needs_pickup_day ? 'Pickup day not set. ' : ''}${next.map((entry) => `${entry.title}, ${shortDate(entry.date)}${entry.moved_from ? ` (moved from ${shortDate(entry.moved_from)})` : ''}${confirmed(entry) ? '' : ' (not confirmed)'}`).join('; ')}`;
  },
  // The ledger's own headline, and ages estimated from the year built marked as such.
  home_systems: (data) => {
    const systems = data.systems || [];
    const known = systems.filter((system) => system.age_years != null);
    const allEstimated = known.length > 0 && known.every((system) => system.source === 'estimated');
    const age = (system) => (system.age_years == null
      ? 'age unknown'
      : `${system.age_years} years${!allEstimated && system.source === 'estimated' ? ' (estimated)' : ''}`);
    return [
      data.summary?.headline,
      `${allEstimated ? 'Ages estimated from the year built: ' : ''}${systems.map((system) => `${system.label} ${age(system)}`).join('; ')}`,
    ].filter(Boolean).join(' ');
  },
  exemption_check: (data) => [
    data.filing_status === 'on_file'
      ? `On file: ${(data.exemptions || []).join(', ')}${data.homestead_on_file === false ? ' (no homestead exemption)' : ''}.`
      : (data.filing_status ? `Filing status: ${words(data.filing_status)}.` : null),
    data.state_program ? `${data.state_program.label}: ${data.state_program.note}` : null,
  ].filter(Boolean).join(' '),
  civic_districts: (data) => (data.representatives || []).map((person) => `${person.name} (${person.office})`).join('; '),
  // After Election Day the Ballot card says where the count stands instead of a countdown.
  civic_election: (data) => {
    const after = data.phase === 'after';
    let when = '';
    if (!after && data.days_until === 0) when = ' (today)';
    else if (!after && data.days_until > 0) when = ` (in ${data.days_until} day${data.days_until === 1 ? '' : 's'})`;
    return [
      `${data.name}, ${shortDate(data.date)}${when}.`,
      after ? data.note : null,
      ...(data.deadlines || []).map((deadline) => deadline.teaser_lead).filter(Boolean),
      data.how_it_works,
    ].filter(Boolean).join(' ');
  },
};

/**
 * A section in one short line, for the Place tab's own context: the line above for its
 * kind, else its data when that is short, else its own sentence, else the start of its
 * data. Each section of the tab fits, where whole (or cut to SECTION_DATA_CHARS) the
 * context ran out after 9 of 22. get_place_facts reads the details.
 */
function sectionBrief(section, zone) {
  let summary = null;
  if (section.data != null) {
    const data = withoutEmpty(section.data);
    const json = data === undefined ? '' : JSON.stringify(data);
    const sentence = data && [data.summary, data.headline, data.plain_meaning].find((text) => typeof text === 'string');
    summary = (BRIEFS[section.id] && BRIEFS[section.id](section.data))
      || (data !== undefined && json.length <= SECTION_BRIEF_CHARS ? data : null)
      || sentence
      || json
      || null;
    if (typeof summary === 'string') summary = clip(summary, SECTION_BRIEF_CHARS);
  }
  return {
    topic: section.id,
    ...(section.status !== 'ready' ? { status: section.status } : {}),
    ...(section.access !== 'available' ? { access: section.access } : {}),
    ...(section.coverage && section.coverage !== 'full' ? { coverage: section.coverage } : {}),
    source: section.source || null,
    as_of: localDate(asOfOf(section), zone),
    ...(section.unavailable_reason ? { unavailable_reason: clip(section.unavailable_reason, 160) } : {}),
    ...(summary != null ? { summary } : {}),
  };
}

/**
 * Facts from a home's Place tab. The tool gives sections read by name a shared budget. A
 * screen's context keeps SECTION_DATA_CHARS a section (`screen`), so it fits, and the Place
 * tab's own context gives each section in one line instead of its data (`brief`).
 */
async function getPlaceFacts(args, ctx, { screen = false, brief = false } = {}) {
  const home = await chosenHome(ctx.userId, args.home_id);
  if (!home) return { error: 'They have no home in Pantopus yet. Their Place tab is where they add one.' };
  const topics = Array.isArray(args.topics) ? [...new Set(args.topics.filter((id) => PLACE_SECTION_IDS.includes(id)))] : [];
  const intelligence = await readSections(home.id, ctx.userId, topics.length ? topics : null, ctx.user);
  if (!intelligence) return { error: "They can't see this home's Place facts." };
  const zone = intelligence.time_zone || ctx.timeZone;
  const dataChars = topics.length && !screen ? Math.max(SECTION_DATA_CHARS, Math.floor(NAMED_SECTIONS_DATA_CHARS / topics.length)) : SECTION_DATA_CHARS;
  return {
    home: { home_id: home.id, city: home.city, state: home.state },
    ...(brief ? { note: 'Each section in short. get_place_facts with its topic reads the details.' } : {}),
    sections: sectionsOf(intelligence).map((section) => (brief ? sectionBrief(section, zone) : sectionForModel(section, zone, dataChars))),
  };
}

async function openTasks(homeId, userId, { status = 'open' } = {}) {
  const result = await homeRecordService.listCollection({ homeId, actorId: userId, kind: 'task' });
  const records = (result.records || []).filter((task) => {
    if (status === 'all') return true;
    if (status === 'done') return task.status === 'done';
    return task.status === 'open' || task.status === 'in_progress';
  });
  const assigneeIds = [...new Set(records.map((task) => task.assigned_to).filter(isUuid))];
  const shown = await localDisplayNames(assigneeIds).catch(() => new Map());
  const names = new Map(assigneeIds.map((id) => [id, firstNameOf({ display_name: shown.get(String(id)) })]));
  return { canCreate: Boolean(result.can_create), records, names };
}

function taskForModel(task, names, zone) {
  return {
    task_id: task.id,
    title_text: clip(task.title, 120),
    type: task.task_type || null,
    status: task.status,
    due: task.due_at ? dayLabel(task.due_at, zone) : null,
    due_at: task.due_at || null,
    assigned_to: task.assigned_to || null,
    assignee_name: task.assigned_to ? names.get(task.assigned_to) || null : null,
    priority: task.priority || null,
    repeats: Boolean(task.is_recurring),
  };
}

async function listHomeTasks(args, ctx) {
  const home = await chosenHome(ctx.userId, args.home_id);
  if (!home) return { error: 'They have no home in Pantopus yet.' };
  const { canCreate, records, names } = await openTasks(home.id, ctx.userId, { status: args.status || 'open' });
  return {
    note: OTHERS_WORDS,
    home: { home_id: home.id, city: home.city, state: home.state },
    can_create_tasks: canCreate,
    tasks: records.slice(0, 30).map((task) => taskForModel(task, names, ctx.timeZone)),
  };
}

async function getHousehold(args, ctx) {
  const home = await chosenHome(ctx.userId, args.home_id);
  if (!home) return { error: 'They have no home in Pantopus yet.' };
  const { occupants } = await homeDetailService.members(home.id, ctx.userId);
  return {
    home: { home_id: home.id, city: home.city, state: home.state },
    people: (occupants || []).filter((o) => o.is_active !== false).map((o) => ({
      user_id: o.user_id || o.id,
      first_name: firstNameOf({ first_name: o.first_name, name: o.name || o.display_name }) || 'Household member',
      role: o.role || null,
      is_you: String(o.user_id || o.id) === String(ctx.userId),
    })),
  };
}

/**
 * Tasks due by the end of their day: today's first, soonest first, then overdue ones, latest
 * first, so a pile of old ones never hides what is due today.
 */
function dueByToday(records, zone) {
  const today = todayIn(zone);
  const dueDay = (task) => localDate(task.due_at, zone);
  return records.filter((task) => task.due_at && dueDay(task) <= today)
    .sort((a, b) => {
      const aToday = dueDay(a) === today;
      if (aToday !== (dueDay(b) === today)) return aToday ? -1 : 1;
      const soonest = (Date.parse(a.due_at) || 0) - (Date.parse(b.due_at) || 0);
      return aToday ? soonest : -soonest;
    });
}

async function getToday(args, ctx) {
  const home = await chosenHome(ctx.userId, args.home_id);
  if (!home) return { error: 'They have no home in Pantopus yet, so Today has nothing about a home. They can add one on the Place tab.' };
  const [intelligence, tasks, plans] = await Promise.all([
    readSections(home.id, ctx.userId, [...TODAY_SECTIONS, ...TODAY_BRIEFS], ctx.user),
    openTasks(home.id, ctx.userId).catch(() => null),
    (async () => {
      if (!(await plansOn(ctx))) return null;
      const viewer = await loadViewer({ id: ctx.userId, role: ctx.user?.role || null });
      const mine = await planService.listMine(viewer);
      // The Today card's rule: under way now, or starting today in the plan's own time zone
      // (starts_on). UTC's date put a 5:30 PM plan in California on tomorrow.
      return [...mine.hosting, ...mine.going]
        .filter((card) => card.state === 'live'
          || (card.state === 'upcoming' && card.starts_on && card.starts_on === todayIn(card.timezone || ctx.timeZone)))
        .map((card) => planForModel(card, ctx.timeZone));
    })().catch(() => null),
  ]);
  const due = tasks ? dueByToday(tasks.records, ctx.timeZone) : null;
  const read = sectionsOf(intelligence);
  const zone = intelligence?.time_zone || ctx.timeZone;
  // The screen's cards come first, so a long day's context is cut in its plans and tasks
  // (find_plans and list_home_tasks have them all), never in its weather and alerts.
  return {
    note: OTHERS_WORDS,
    today: dayLabel(new Date().toISOString(), ctx.timeZone),
    home: { home_id: home.id, city: home.city, state: home.state },
    sections: read.filter((section) => TODAY_SECTIONS.includes(section.id)).map((section) => sectionForModel(section, zone)),
    in_short: read.filter((section) => TODAY_BRIEFS.includes(section.id)).map((section) => sectionBrief(section, zone)),
    plans_today: plans,
    tasks_due: due ? due.slice(0, TODAY_TASKS).map((task) => taskForModel(task, tasks.names, ctx.timeZone)) : null,
    ...(due && due.length > TODAY_TASKS ? { more_tasks_due: due.length - TODAY_TASKS } : {}),
  };
}

async function getNotificationSettings(_args, ctx) {
  const { data, error } = await supabaseAdmin.from('UserNotificationPreferences')
    .select('daily_briefing_enabled, daily_briefing_time_local, daily_briefing_timezone, evening_briefing_enabled, evening_briefing_time_local, weather_alerts_enabled, aqi_alerts_enabled, home_reminders_enabled, quiet_hours_start_local, quiet_hours_end_local, suggestions_enabled, suggestions_muted')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (error) throw new Error(`Preferences read failed: ${error.message}`);
  // Suggestions exist only in apps that can show them (ctx.suggestions); older builds have no such switch.
  const { suggestions_enabled: suggestionsEnabled, suggestions_muted: suggestionsMuted, ...settings } = data || {};
  const suggestions = ctx.suggestions ? {
    suggestions_enabled: suggestionsEnabled ?? null,
    suggestions_muted: suggestionsMuted || {},
    suggestions_note: 'Suggestions from Pantopus: null means never chosen, which is off. suggestions_muted lists kinds muted with "Fewer like this", until when.',
  } : {};
  return { settings: data ? { ...settings, ...suggestions } : null, note: data ? null : 'No settings saved yet; the defaults apply.' };
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

const READ_EXECUTORS = {
  find_plans: findPlans,
  find_games: findGames,
  find_teams: findTeams,
  get_plan: getPlan,
  find_posts: findPosts,
  get_post: getPost,
  get_place_facts: getPlaceFacts,
  get_today: getToday,
  list_home_tasks: listHomeTasks,
  get_household: getHousehold,
  get_notification_settings: getNotificationSettings,
};

const PLAN_TOOLS = new Set(['find_plans', 'get_plan', 'find_games', 'find_teams']);

async function runReadTool(name, args, ctx) {
  const executor = READ_EXECUTORS[name];
  if (!executor) return null;
  try {
    return await executor(args || {}, ctx);
  } catch (err) {
    if (err && err.code === 'HOME_DASHBOARD_DENIED') return { error: "They can't see that part of this home." };
    if (err instanceof planActions.PlanError) return { error: err.message };
    logger.warn('assistant read tool failed', { tool: name, userId: ctx.userId, error: err?.message });
    return { error: `That couldn't be read just now (${name}).` };
  }
}

module.exports = {
  readToolDefinitions,
  playdateReadToolDefinitions,
  runReadTool,
  READ_EXECUTORS,
  PLAN_TOOLS,
  planKinds,
  PLACE_POST_TYPES,
  // For screen context.
  planForModel,
  postForModel,
  sectionForModel,
  readSections,
  findPlans,
  getPlan,
  getPost,
  findPosts,
  getToday,
  getPlaceFacts,
};
