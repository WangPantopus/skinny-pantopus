'use strict';

// Right now (S12, contract §2.16): one card at the top of Pulse while something affects many
// homes. Official information comes first; neighbors add "Me too" or "It's back" for their verified
// home, never text. The kinds below are the only ones, so it is never used for crime.
const db = require('../../config/supabaseAdmin');
const { homeAreaContext, openAreas, areaDto, AREA_SELECT } = require('./areas');
const { UUID } = require('./feedCursor');
const logger = require('../../utils/logger');

// [the card's ending line, a waiting Heads-up's line]
const KINDS = {
  power_outage: ['The card ends when power is restored.', 'Ends when power returns'],
  water_outage: ['The card ends when water service is back.', 'Ends when water returns'],
  smoke: ['The card ends when the air clears.', 'Ends when the air clears'],
  road_closure: ['The card ends when the road reopens.', 'Ends when the road reopens'],
  severe_weather: ['The card ends when the warning ends.', 'Ends when the warning ends'],
  boil_notice: ['The card ends when the notice is lifted.', 'Ends when the notice is lifted'],
};
const SELECT = `id, area_id, kind, title, origin, status, official_source_label, official_source_url, official_text,
  official_updated_at, started_at, resolved_at, last_activity_at, updated_at`;
const OFFICIAL_ACCOUNTS = ['official', 'curator'];
// Neighbors start an outage from this many homes' Heads-ups within the window; a neighbors' event
// ends when nobody reported or posted about it for QUIET_MS (the hourly job).
const NEIGHBOR_HOMES = 3;
const NEIGHBOR_WINDOW_MS = 60 * 60 * 1000;
const QUIET_MS = 3 * 60 * 60 * 1000;
// A Heads-up waiting on an event keeps this horizon until the event ends it.
const WAIT_MS = 14 * 24 * 60 * 60 * 1000;
const ERRORS = {
  RIGHT_NOW_NOT_FOUND: [404, 'This update is not available.'],
  RIGHT_NOW_ENDED: [409, 'This has ended.'],
  NOT_OFFICIAL: [403, 'Only official accounts can post Right now updates.'],
  INVALID_RIGHT_NOW: [400, 'Choose what is happening and where, with the official source and its words.'],
  NEEDS_VERIFIED_ADDRESS: [403, 'A verified address in this area is needed.'],
};
function fail(code) {
  const [status, message] = ERRORS[code];
  return Object.assign(new Error(message), { status, code });
}
async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
async function townOf(area) {
  if (!area) return null;
  if (area.kind === 'town') return area.id;
  return checked(db.rpc('pulse_area_town_id', { p_area_id: area.id }));
}
function homeIn(homes, areaId) {
  const verified = new Set(homes.homes.filter(home => home.verified).map(home => home.id));
  const inside = homes.matches.filter(match => match.area_id === areaId && match.inside === true
    && verified.has(match.home_id)).map(match => match.home_id);
  return inside.includes(homes.primary?.id) ? homes.primary.id : inside[0] || null;
}
// A town event is for everyone reading the town; a street or neighborhood one only for homes there.
function canSee(area, homes) {
  return area.kind === 'town' || homes.verifiedAreaIds.has(area.id);
}

async function reportCounts(eventId, viewerId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await checked(db.from('RightNowReport').select('id, user_id, home_id, kind').eq('event_id', eventId)
      .order('id').range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const homes = kind => new Set(rows.filter(row => row.kind === kind).map(row => row.home_id)).size;
  return { me_too: homes('me_too'), its_back: homes('its_back'),
    viewer: rows.find(row => row.user_id === viewerId)?.kind || null };
}

async function dto(event, area, viewerId, homes) {
  const counts = await reportCounts(event.id, viewerId);
  return {
    id: event.id, kind: event.kind, title: event.title, area: areaDto(area), origin: event.origin,
    official: event.origin === 'official' ? { source_label: event.official_source_label, text: event.official_text,
      url: event.official_source_url || null, updated_at: event.official_updated_at } : null,
    updated_at: event.updated_at,
    reports: { me_too: counts.me_too, its_back: counts.its_back },
    ends_when: KINDS[event.kind][0],
    viewer: { report: counts.viewer, can_report: event.status === 'active' && !!homeIn(homes, area.id) },
  };
}

/** The feed's `right_now` for a reader of `context` (feed.contextFor): official first, then the newest. */
async function current(context) {
  if (!context.area || context.area.kind !== 'town') return null;
  const events = await checked(db.from('RightNowEvent').select(`${SELECT}, area:area_id (${AREA_SELECT})`)
    .eq('status', 'active').order('updated_at', { ascending: false }).limit(50));
  const now = Date.now();
  const candidates = [];
  for (const event of events || []) {
    const area = event.area;
    if (!area?.opened_at || Date.parse(area.opened_at) > now || !canSee(area, context.homes)) continue;
    if (await townOf(area) !== context.area.id) continue;
    candidates.push(event);
  }
  candidates.sort((a, b) => (a.origin === 'official' ? 0 : 1) - (b.origin === 'official' ? 0 : 1)
    || Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const event = candidates[0];
  return event ? dto(event, event.area, context.userId, context.homes) : null;
}

async function load(id) {
  if (typeof id !== 'string' || !UUID.test(id)) throw fail('RIGHT_NOW_NOT_FOUND');
  const event = await checked(db.from('RightNowEvent').select(`${SELECT}, area:area_id (${AREA_SELECT})`).eq('id', id).maybeSingle());
  if (!event) throw fail('RIGHT_NOW_NOT_FOUND');
  return event;
}

/** GET /api/pulse/right-now */
async function read(viewerId, areaId) {
  const context = await require('./feed').contextFor(viewerId, areaId);
  return { right_now: await current(context) };
}

/** POST|DELETE /api/pulse/right-now/:id/report: `kind` null withdraws the reader's report. */
async function report(viewerId, id, kind) {
  if (kind !== null && !['me_too', 'its_back'].includes(kind)) throw fail('INVALID_RIGHT_NOW');
  const event = await load(id);
  const homes = await homeAreaContext(viewerId);
  if (!event.area?.opened_at || !canSee(event.area, homes)) throw fail('RIGHT_NOW_NOT_FOUND');
  if (event.status !== 'active') throw fail('RIGHT_NOW_ENDED');
  const home = homeIn(homes, event.area.id);
  if (!home) throw fail('NEEDS_VERIFIED_ADDRESS');
  const result = await checked(db.rpc('pulse_right_now_report', { p_event_id: event.id, p_user_id: viewerId,
    p_home_id: home, p_kind: kind }));
  if (result?.code) throw fail(result.code);
  const fresh = await load(id);
  return { right_now: await dto(fresh, fresh.area, viewerId, homes) };
}

async function officialAccount(userId) {
  const user = await checked(db.from('User').select('account_type').eq('id', userId).maybeSingle());
  if (!OFFICIAL_ACCOUNTS.includes(user?.account_type)) throw fail('NOT_OFFICIAL');
}
function officialFields(body) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const label = typeof body.sourceLabel === 'string' ? body.sourceLabel.trim() : '';
  const url = body.sourceUrl == null ? null : body.sourceUrl;
  if (!text || text.length > 1000 || !label || label.length > 120
    || (url !== null && !(typeof url === 'string' && url.length <= 500 && /^https?:\/\/\S+$/i.test(url)))) {
    throw fail('INVALID_RIGHT_NOW');
  }
  const now = new Date().toISOString();
  return { official_text: text, official_source_label: label, official_source_url: url, official_updated_at: now,
    updated_at: now, last_activity_at: now };
}

/**
 * POST /api/pulse/right-now (Official and curator accounts): starts an event, or confirms an active
 * neighbors' event of the same kind in the area, which becomes official.
 */
async function start(userId, body = {}) {
  await officialAccount(userId);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!KINDS[body.kind] || !title || title.length > 120 || typeof body.areaId !== 'string' || !UUID.test(body.areaId)) {
    throw fail('INVALID_RIGHT_NOW');
  }
  const fields = officialFields(body);
  const area = await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).eq('id', body.areaId).maybeSingle());
  if (!area || !['town', 'neighborhood', 'street'].includes(area.kind)) throw fail('INVALID_RIGHT_NOW');
  const update = { ...fields, title, origin: 'official' };
  let event = await checked(db.from('RightNowEvent').update(update).eq('area_id', area.id).eq('kind', body.kind)
    .eq('status', 'active').select('id').maybeSingle());
  if (!event) {
    const { data, error } = await db.from('RightNowEvent').insert({ ...update, area_id: area.id, kind: body.kind,
      created_by: userId }).select('id').single();
    // A neighbors' event can start in between; the one active event takes the official words.
    if (error?.code === '23505') {
      event = await checked(db.from('RightNowEvent').update(update).eq('area_id', area.id).eq('kind', body.kind)
        .eq('status', 'active').select('id').single());
    } else if (error) throw error;
    else event = data;
  }
  return read(userId, (await townOf(area)) || area.id);
}

/** POST /api/pulse/right-now/:id/update { text } */
async function update(userId, id, body = {}) {
  await officialAccount(userId);
  const event = await load(id);
  if (event.status !== 'active') throw fail('RIGHT_NOW_ENDED');
  const fields = officialFields({ sourceLabel: event.official_source_label || body.sourceLabel,
    sourceUrl: body.sourceUrl ?? event.official_source_url, text: body.text });
  await checked(db.from('RightNowEvent').update({ ...fields, origin: 'official' }).eq('id', event.id).eq('status', 'active'));
  return read(userId, await townOf(event.area));
}

/** POST /api/pulse/right-now/:id/clear */
async function clear(userId, id) {
  await officialAccount(userId);
  const event = await load(id);
  if (!await checked(db.rpc('pulse_right_now_end', { p_event_id: event.id, p_reason: 'cleared' }))) throw fail('RIGHT_NOW_ENDED');
  return { ok: true };
}

/** Pulse mode's `rightNowEventId` (contract §2.16): the active event in the post's town, or null. */
async function forHeadsUp(eventId, postArea) {
  if (typeof eventId !== 'string' || !UUID.test(eventId)) return null;
  const event = await checked(db.from('RightNowEvent').select(`${SELECT}, area:area_id (${AREA_SELECT})`)
    .eq('id', eventId).eq('status', 'active').maybeSingle());
  if (!event?.area?.opened_at) return null;
  const [eventTown, postTown] = await Promise.all([townOf(event.area), townOf(postArea)]);
  return eventTown && eventTown === postTown ? event : null;
}

async function touch(eventId) {
  await checked(db.from('RightNowEvent').update({ last_activity_at: new Date().toISOString() })
    .eq('id', eventId).eq('status', 'active'));
}

// Tag Heads-ups to an event: one without its own end waits on the event (contract §2.16).
async function tag(posts, eventId) {
  for (const post of posts) {
    const waits = post.post_metadata?.alert_ends_set !== true;
    await checked(db.from('Post').update({ right_now_event_id: eventId,
      ...(waits ? { expires_at: new Date(Date.now() + WAIT_MS).toISOString(),
        post_metadata: { ...(post.post_metadata || {}), ends_with_event: true } } : {}) })
      .eq('id', post.id).is('right_now_event_id', null));
  }
}

/**
 * After a Pulse Heads-up about a power outage is created: three different verified homes' outage
 * Heads-ups in one town within an hour start a neighbors' event for the town and are tagged to it.
 */
async function neighborOutage(post) {
  if (post.post_type !== 'alert' || post.safety_alert_kind !== 'power_outage' || !post.read_scope || !post.area_id
    || post.moderation_state !== 'live') return null;
  const area = await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).eq('id', post.area_id).maybeSingle());
  const townId = await townOf(area);
  if (!townId) return null;
  const town = area.kind === 'town' ? area : await checked(db.from('PulseArea').select(AREA_SELECT).eq('id', townId).maybeSingle());
  const active = await checked(db.from('RightNowEvent').select('id').eq('area_id', townId).eq('kind', 'power_outage')
    .eq('status', 'active').maybeSingle());
  if (active) {
    if (!post.right_now_event_id) await tag([post], active.id);
    await touch(active.id);
    return active.id;
  }
  const recent = await checked(db.from('Post').select('id, user_id, area_id, post_metadata, right_now_event_id')
    .eq('post_type', 'alert').eq('safety_alert_kind', 'power_outage').eq('moderation_state', 'live')
    .not('read_scope', 'is', null).is('archived_at', null)
    .gte('created_at', new Date(Date.now() - NEIGHBOR_WINDOW_MS).toISOString()).limit(200));
  const towns = new Map();
  const inTown = [];
  for (const row of recent || []) {
    if (!towns.has(row.area_id)) towns.set(row.area_id, row.area_id === townId ? townId
      : await checked(db.rpc('pulse_area_town_id', { p_area_id: row.area_id })));
    if (towns.get(row.area_id) === townId) inTown.push(row);
  }
  const homeOf = new Map();
  for (const userId of new Set(inTown.map(row => row.user_id))) {
    const homes = await homeAreaContext(userId);
    if (homes.primary?.verified) homeOf.set(userId, homes.primary.id);
  }
  const reporting = inTown.filter(row => homeOf.has(row.user_id));
  if (new Set(reporting.map(row => homeOf.get(row.user_id))).size < NEIGHBOR_HOMES) return null;
  const { data, error } = await db.from('RightNowEvent').insert({ area_id: townId, kind: 'power_outage',
    title: `Power outage reported around ${town.name}`, origin: 'neighbors' }).select('id').single();
  let eventId = data?.id;
  if (error?.code === '23505') {
    eventId = (await checked(db.from('RightNowEvent').select('id').eq('area_id', townId).eq('kind', 'power_outage')
      .eq('status', 'active').single())).id;
  } else if (error) throw error;
  await tag(reporting.filter(row => !row.right_now_event_id), eventId);
  logger.info('pulse.right_now.neighbors_started', { eventId, homes: new Set(reporting.map(row => homeOf.get(row.user_id))).size });
  return eventId;
}

/** The hourly job: a neighbors' event nobody reported or posted about for three hours ends. */
async function endQuiet(now = Date.now()) {
  const quiet = await checked(db.from('RightNowEvent').select('id').eq('status', 'active').eq('origin', 'neighbors')
    .lt('last_activity_at', new Date(now - QUIET_MS).toISOString()).limit(200));
  let ended = 0;
  for (const event of quiet || []) {
    if (await checked(db.rpc('pulse_right_now_end', { p_event_id: event.id, p_reason: 'quiet' }))) ended += 1;
  }
  return ended;
}

/** For cards: whether each tagged post still waits on an active event, and that event's line. */
async function waitingLines(posts) {
  const ids = [...new Set(posts.filter(post => post.right_now_event_id && post.post_metadata?.ends_with_event)
    .map(post => post.right_now_event_id))];
  if (!ids.length) return new Map();
  const events = await checked(db.from('RightNowEvent').select('id, kind').in('id', ids).eq('status', 'active'));
  return new Map((events || []).map(event => [event.id, KINDS[event.kind][1]]));
}

module.exports = { KINDS, current, read, report, start, update, clear, forHeadsUp, tag, touch, neighborOutage,
  endQuiet, waitingLines };
