/**
 * Moments for the assistant: the person's own Moments and who watched them, what is new from people whose Moments
 * they may see, and one person's Moments, read through the Moments store with the person as the viewer.
 *
 * Moments are short-lived photos, videos of up to 30 seconds and text cards pinned where they were posted, for 1, 6, 24
 * or 48 hours (routes/moments.js, services/moments/momentStore.js). Every read here is one the apps make, through the
 * store's own functions:
 *   - their own list is GET /api/moments/mine (store.ownMoments), and its "Seen by" GET /:id/viewers (store.viewersOf);
 *   - what is around them is the map's first read, GET /map (store.mapRings and store.unplacedRings, in the box the
 *     map opens on and the tab's dot counts in), with the rings on their connections' profile pictures, GET /people
 *     (store.peopleRings); a ring's Moments are opened as GET /batch opens them (store.openMoments);
 *   - one Moment is GET /:id (store.openMoment).
 * So blocks, mutes (everywhere or in Moments only), "My connections" Moments, held and unfinished Moments, ended
 * Moments and the Moments the person reported all apply as they do in the apps, and a Moment's place is the label
 * everyone reads (a venue, a street's name or a town; the town for one shown as an area or posted at home), never a
 * point or an address. Photos, videos, links and coordinates never reach the model.
 *
 * Read only: looking here is not watching. Nothing records a view (so the poster's "Seen by" doesn't change and the
 * person's rings and dot still say new), marks anything seen, remembers the app (the routes' rememberApp) or notifies
 * anyone. The `moments` flag decides, as the routes' guard does.
 */
const { DateTime } = require('luxon');
const logger = require('../../utils/logger');
const { isFeatureEnabled } = require('../featureFlagService');
const store = require('../moments/momentStore');
const {
  OTHERS_WORDS, isUuid, clip, homesOf, zoneOr, whenLabel, firstNameOf,
} = require('./assistantKit');

// Moments in one answer, newest first; the rest are counted.
const MAX_MOMENTS = 15;
// People listed in a "Seen by"; the rest are counted.
const MAX_VIEWERS = 25;
// The map's first read and the tab's dot (iOS MomentsViewport(around:)): about two miles around a point.
const BOX_LAT = 0.015;
const BOX_LNG = 0.02;
// Connections whose profile-picture rings are read: the people route takes store.MAX_PEOPLE at a time.
const MAX_CONNECTION_READS = 5;

const OFF = { error: "Moments aren't available for this person yet." };

const momentReadToolDefinitions = [
  {
    name: 'find_moments',
    description: "Moments: short-lived photos, videos (up to 30 seconds) and text cards people post where they are, shown on the Moments map as the poster's face in a ring and as a ring on their profile picture for 1, 6, 24 or 48 hours, then gone for everyone. scope \"mine\": the person's own Moments that haven't ended, in any state (uploading, being checked, held for review, live), with how many watched, the reactions and how many replied. \"new\": live Moments they haven't watched yet, around them (about two miles around their home or saved place, where the Moments map opens) and from their connections anywhere, never their own. \"all\": the same Moments, watched or not: use it to find someone by first name (\"what did Maria post today\"). \"person\": one person's live Moments they may see. Each comes with its moment_id, who posted it (first name; person_id for others), kind, caption or card text, the place as everyone reads it (a venue, a street or a town; an approximate area for some; never an address), when it was posted and ends, and who it is shared with. Ended Moments aren't kept anywhere, the poster's own included. Reading here doesn't count as watching. Use get_moment for one Moment, and for who watched one of theirs.",
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['mine', 'new', 'all', 'person'], description: '"mine" for their own, "new" for ones they haven\'t watched, "all" for everything they may see around them and from their connections, "person" for one person\'s.' },
        person_id: { type: ['string', 'null'], description: 'For "person": the person_id from find_moments, the screen or another read. Null otherwise.' },
      },
      required: ['scope', 'person_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_moment',
    description: "One Moment by moment_id, as the person may open it: who posted it, kind, caption or card text, place, when it was posted and ends, who it is shared with, and whether they watched it and their reaction. For the person's own Moment also its state and its Seen by list as the app shows it: who watched (first names, newest first), each one's reaction and whether they replied (the reply itself is in Messages). Use it for \"who saw my Moment\". It doesn't count as watching.",
    input_schema: {
      type: 'object',
      properties: { moment_id: { type: 'string', description: 'The moment_id from find_moments or the screen context.' } },
      required: ['moment_id'],
      additionalProperties: false,
    },
  },
];

const MOMENT_TOOL_NAMES = new Set(momentReadToolDefinitions.map((tool) => tool.name));

// ─── What the screens say ──────────────────────────────────────────────────

async function momentsOn(ctx) {
  if (typeof ctx.momentsEnabled === 'boolean') return ctx.momentsEnabled;
  return isFeatureEnabled('moments', ctx.user?.id ? ctx.user : ctx.userId);
}

/** `value` without null and undefined fields (false and 0 stay: they are answers). */
function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined));
}

/** The name the apps show for an author or a watcher (store.loadAuthors): a person's first name, a business's name. */
function nameOf(author) {
  // loadAuthors calls someone it couldn't read "Pantopus member"; its first word isn't their name.
  if (!author || author.name === 'Pantopus member') return 'A Pantopus member';
  return clip(author.first_name, 60) || firstNameOf(author) || 'A Pantopus member';
}

/** "22h left", "35m left": the viewer's own words (iOS MomentTime.left), rounded up and never under a minute. */
function timeLeft(iso) {
  const ends = Date.parse(iso || '');
  if (!Number.isFinite(ends)) return null;
  const minutes = Math.max(1, Math.ceil(Math.max(0, ends - Date.now()) / 60000));
  return minutes >= 60 ? `${Math.ceil(minutes / 60)}h left` : `${minutes}m left`;
}

/** "Taken Oct 3" (with the year when it isn't this one): an old album photo or video, as everyone reads it. */
function takenLabel(iso, zone) {
  if (!iso) return null;
  const at = DateTime.fromISO(String(iso), { zone: 'utc' }).setZone(zoneOr(zone));
  if (!at.isValid) return null;
  return `Taken ${at.toFormat(at.year === DateTime.now().setZone(zoneOr(zone)).year ? 'LLL d' : 'LLL d, yyyy')}`;
}

// The author's own Moment's state (CONTRACT "Shapes"); others only ever open live ones.
const STATE_WORDS = {
  live: 'live',
  uploading: "still uploading: nobody sees it yet, and its time starts when it's live",
  checking: "being checked before it shows: nobody sees it yet, and its time starts when it's live",
  held: 'held for review: hidden from everyone else until Pantopus reviews it',
};

/** "❤️ 2, 👍 1" from the store's reaction counts, most used first; "none" without any. */
function reactionsLine(counts) {
  const list = (counts || []).filter((entry) => entry && entry.count > 0);
  return list.length ? list.map((entry) => `${entry.reaction} ${entry.count}`).join(', ') : 'none';
}

/**
 * A serialized Moment (store.serializeMoments, CONTRACT "Moment") as the model reads it: no picture, link or point.
 * The place is the label everyone reads; `place_is` says when it is only an area or there is none.
 */
function momentForModel(moment, ctx) {
  const zone = ctx.timeZone;
  const own = String(moment.author?.id) === String(ctx.userId);
  // A photo or video still uploading or being checked hasn't started its time: its end isn't known yet.
  const pending = moment.state === 'uploading' || moment.state === 'checking';
  return compact({
    moment_id: moment.id,
    kind: moment.kind,
    caption_text: clip(moment.caption, 100),
    card_text: clip(moment.text, 200),
    place_text: moment.no_location ? null : clip(moment.place_label, 80),
    place_is: moment.no_location
      ? 'no location: not on the map, only connections see it'
      : (moment.show_area ? 'an approximate area, not the spot' : null),
    taken: takenLabel(moment.taken_at, zone),
    // Feet above sea level, rounded to 10, when the poster chose "Show height" (the store sends it only while the
    // moment_heights flag is on for this person).
    height_ft: Number.isFinite(moment.altitude_ft) ? moment.altitude_ft : null,
    posted_from_the_air: moment.flying ? true : null,
    video_seconds: moment.kind === 'video' && Number.isFinite(moment.duration_ms) ? Math.round(moment.duration_ms / 1000) : null,
    posted: whenLabel(moment.created_at, null, zone),
    ends: pending ? null : whenLabel(moment.expires_at, null, zone),
    time_left: pending ? null : timeLeft(moment.expires_at),
    lasts_hours: pending ? moment.hours ?? null : null,
    // The Post sheet's words: "Everyone nearby" is anyone who looks at that part of the Moments map.
    shared_with: moment.audience === 'connections' ? (own ? 'My connections' : 'Their connections') : 'Everyone nearby',
    ...(own ? {
      state: STATE_WORDS[moment.state] || moment.state,
    } : {
      watched: Boolean(moment.seen),
      your_reaction: moment.my_reaction || null,
    }),
  });
}

/** The poster as the model reads them, for a group of someone else's Moments. */
function posterForModel(author) {
  return compact({
    posted_by: nameOf(author),
    person_id: author?.id || null,
    yours: false,
    // The check beside the name: a verified resident, or a business Pantopus verified.
    verified: author?.verified ? true : null,
    business: author?.kind === 'business' ? true : null,
  });
}

/** Someone else's Moments grouped by poster, in the order of each poster's newest. */
function byPoster(moments, ctx) {
  const groups = new Map();
  for (const moment of moments) {
    const id = String(moment.author?.id || '');
    if (!groups.has(id)) groups.set(id, { ...posterForModel(moment.author), moments: [] });
    groups.get(id).moments.push(momentForModel(moment, ctx));
  }
  return [...groups.values()];
}

// ─── Reading ───────────────────────────────────────────────────────────────

/** The map's first box around a point, kept on the globe. */
function boxAround({ latitude, longitude }) {
  return {
    south: Math.max(-90, latitude - BOX_LAT),
    north: Math.min(90, latitude + BOX_LAT),
    west: Math.max(-180, longitude - BOX_LNG),
    east: Math.min(180, longitude + BOX_LNG),
  };
}

/**
 * The rings the person may see around them and on their connections' profile pictures, by the map's rules (blocks,
 * mutes, "My connections", Moments they reported, live only): the map's first box around their home or saved place
 * (GET /map), their connections' Moments with no location (GET /map `unplaced`) and their connections' rings anywhere
 * (GET /people, up to MAX_CONNECTION_READS reads of store.MAX_PEOPLE).
 */
async function ringsAround(ctx) {
  const userId = ctx.userId;
  const [{ location }, connections] = await Promise.all([homesOf(userId), store.connectionIds(userId)]);
  const center = location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude) ? location : null;
  const batches = [];
  for (let at = 0; at < connections.length && batches.length < MAX_CONNECTION_READS; at += store.MAX_PEOPLE) {
    batches.push(connections.slice(at, at + store.MAX_PEOPLE));
  }
  const [map, unplaced, ...people] = await Promise.all([
    center ? store.mapRings(userId, boxAround(center)) : [],
    store.unplacedRings(userId),
    ...batches.map((batch) => store.peopleRings(userId, batch)),
  ]);
  return {
    around: center ? clip(location.label, 60) || 'their home' : null,
    connectionsLeftOut: Math.max(0, connections.length - MAX_CONNECTION_READS * store.MAX_PEOPLE),
    rings: [...map, ...unplaced, ...people.flat()],
  };
}

/** Each Moment in these rings once, never the person's own, newest first: [{ id, authorId, seen }]. */
function momentsInRings(rings) {
  const seen = new Map();
  for (const ring of rings) {
    if (ring.mine) continue;
    for (const brief of ring.moments || []) {
      if (!seen.has(brief.id)) seen.set(brief.id, { id: brief.id, authorId: ring.author?.id || null, seen: Boolean(brief.seen), at: brief.created_at });
    }
  }
  return [...seen.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** These Moments as GET /batch opens them for the person (store.openMoments, then the store's own serializer). */
async function openForModel(ids, ctx) {
  if (!ids.length) return [];
  const rows = await store.openMoments(ids, ctx.userId);
  return store.serializeMoments(rows, ctx.userId);
}

/** Their own Moments that haven't ended (GET /mine), each with its Seen by count, reactions and replies. */
async function findMine(ctx) {
  const all = await store.ownMoments(ctx.userId);
  const shown = all.slice(0, MAX_MOMENTS);
  // The Seen by sheet's numbers (GET /:id/viewers): who watched, blocked people left out, and who replied. A Moment
  // nobody watched has neither; one whose list can't be read keeps the view count alone.
  const lists = await Promise.all(shown.map(async (moment) => {
    if (!(Number(moment.viewer_count) > 0)) return { count: 0, viewers: [] };
    // The route's own checks: theirs, and not ended (it may have ended since the list was read).
    const row = await store.loadMoment(moment.id);
    if (!row || row.user_id !== ctx.userId || store.momentState(row) === 'ended') return null;
    return store.viewersOf(row).catch((err) => {
      logger.warn('assistant moment viewers read failed', { userId: ctx.userId, error: err?.message });
      return null;
    });
  }));
  const moments = shown.map((moment, index) => {
    const list = lists[index];
    return compact({
      ...momentForModel(moment, ctx),
      seen_by: list ? list.count : Number(moment.viewer_count) || 0,
      reactions: reactionsLine(moment.reaction_counts),
      replies: list ? list.viewers.filter((viewer) => viewer.replied).length : null,
    });
  });
  return compact({
    note: `${OTHERS_WORDS} Their own Moments that haven't ended; an ended Moment is gone, so its views can't be read anymore.`,
    scope: 'mine',
    yours: true,
    moments,
    more_moments: all.length > MAX_MOMENTS ? all.length - MAX_MOMENTS : null,
    empty: moments.length ? null : 'They have no Moments right now. A Moment is posted from the Moments tab.',
  });
}

/** What's around them and from their connections: everything ("all") or only what they haven't watched ("new"). */
async function findAround(ctx, { onlyNew }) {
  const { around, connectionsLeftOut, rings } = await ringsAround(ctx);
  const found = momentsInRings(rings).filter((moment) => !onlyNew || !moment.seen);
  const opened = await openForModel(found.slice(0, MAX_MOMENTS).map((moment) => moment.id), ctx);
  const people = new Set(found.map((moment) => moment.authorId).filter(Boolean));
  return compact({
    note: `${OTHERS_WORDS} Live Moments only, none of their own. Reading these doesn't count as watching${onlyNew ? ': the app still shows them as new' : ''}.`,
    scope: onlyNew ? 'new' : 'all',
    around: around || null,
    ...(around ? {} : { not_around: 'They have no home or saved place, so only their connections\' Moments are here.' }),
    people_count: people.size,
    people: byPoster(opened, ctx),
    more_moments: found.length > opened.length ? found.length - opened.length : null,
    connections_not_checked: connectionsLeftOut || null,
    empty: opened.length
      ? null
      : (onlyNew ? "Nothing new: no live Moment around them or from their connections that they haven't watched." : 'No live Moments around them or from their connections right now.'),
  });
}

/** One person's live Moments the person may see: the ring on that person's profile picture (GET /people, GET /batch). */
async function findPerson(args, ctx) {
  if (!isUuid(args.person_id)) {
    return { error: 'Give the person_id of whose Moments to read (from find_moments or the screen). To find someone by first name, use scope "all".' };
  }
  if (String(args.person_id) === String(ctx.userId)) return findMine(ctx);
  const rings = await store.peopleRings(ctx.userId, [args.person_id]);
  // A ring plays oldest first; newest first reads better here.
  const ids = rings.flatMap((ring) => (ring.mine ? [] : (ring.moments || []).map((brief) => brief.id))).reverse();
  const opened = await openForModel(ids.slice(0, MAX_MOMENTS), ctx);
  return compact({
    note: `${OTHERS_WORDS} Live Moments only. Reading these doesn't count as watching.`,
    scope: 'person',
    people: byPoster(opened, ctx),
    more_moments: ids.length > opened.length ? ids.length - opened.length : null,
    // Never why: no Moments, none shared with them, or a block or mute all read the same.
    empty: opened.length ? null : 'Nothing from this person that they can see right now.',
  });
}

async function findMoments(args, ctx) {
  if (!(await momentsOn(ctx))) return OFF;
  if (args.scope === 'mine') return findMine(ctx);
  if (args.scope === 'new') return findAround(ctx, { onlyNew: true });
  if (args.scope === 'all') return findAround(ctx, { onlyNew: false });
  if (args.scope === 'person') return findPerson(args, ctx);
  return { error: 'Choose a scope: mine, new, all or person.' };
}

/**
 * One Moment as GET /:id opens it (store.openMoment: theirs while it hasn't ended, someone else's only while it is
 * live and theirs to see). Someone else's must also still be in that person's ring by the map's rules, so a Moment the
 * person reported stays gone for them here too. For their own, the Seen by list (GET /:id/viewers, store.viewersOf).
 */
async function getMoment(args, ctx) {
  if (!(await momentsOn(ctx))) return OFF;
  if (!isUuid(args.moment_id)) return { error: 'That is not a Moment id. Use find_moments to get one.' };
  const row = await store.openMoment(args.moment_id, ctx.userId);
  const own = row.user_id === ctx.userId;
  if (!own) {
    const rings = await store.peopleRings(ctx.userId, [row.user_id]);
    if (!rings.some((ring) => (ring.moments || []).some((brief) => brief.id === row.id))) {
      return { error: "That Moment doesn't show for them anymore." };
    }
  }
  const [moment] = await store.serializeMoments([row], ctx.userId);
  if (!moment) return { error: "That Moment isn't available to them." };
  if (!own) {
    return { note: `${OTHERS_WORDS} Reading it doesn't count as watching.`, moment: { ...posterForModel(moment.author), ...momentForModel(moment, ctx) } };
  }
  const list = await store.viewersOf(row).catch((err) => {
    logger.warn('assistant moment viewers read failed', { userId: ctx.userId, error: err?.message });
    return null;
  });
  const viewers = list ? list.viewers : [];
  return compact({
    note: `${OTHERS_WORDS} Their own Moment and its Seen by list, as the app shows it.`,
    moment: compact({
      posted_by: 'you',
      yours: true,
      ...momentForModel(moment, ctx),
      seen_by: list ? list.count : Number(moment.viewer_count) || 0,
      reactions: reactionsLine(moment.reaction_counts),
      replies: list ? viewers.filter((viewer) => viewer.replied).length : null,
    }),
    seen_by: list ? viewers.slice(0, MAX_VIEWERS).map((viewer) => compact({
      name: nameOf(viewer.user),
      watched: whenLabel(viewer.viewed_at, null, ctx.timeZone),
      reaction: viewer.reaction || null,
      replied: viewer.replied ? true : null,
    })) : null,
    more_viewers: list && viewers.length > MAX_VIEWERS ? viewers.length - MAX_VIEWERS : null,
    not_checked: list ? null : "Who watched couldn't be read just now; say so rather than guessing.",
  });
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

const MOMENT_EXECUTORS = {
  find_moments: findMoments,
  get_moment: getMoment,
};

async function runMomentReadTool(name, args, ctx) {
  const executor = MOMENT_EXECUTORS[name];
  if (!executor) return null;
  try {
    return await executor(args || {}, ctx);
  } catch (err) {
    // The store's own answers (store.fail): not theirs to see (or not there), or over.
    if (err?.code === 'MOMENT_NOT_FOUND') return { error: "That Moment isn't available to them." };
    if (err?.code === 'MOMENT_ENDED') return { error: 'That Moment has ended. Ended Moments are gone for everyone, the poster included.' };
    logger.warn('assistant read tool failed', { tool: name, userId: ctx.userId, error: err?.message });
    return { error: `That couldn't be read just now (${name}).` };
  }
}

module.exports = { momentReadToolDefinitions, runMomentReadTool, MOMENT_TOOL_NAMES };
