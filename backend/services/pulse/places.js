'use strict';

// Places (S16, contract §2.19): a park, trail, lake, library, school zone, council district, or a
// restricted building or HOA whose conversation is only for verified homes inside it. The place page
// gathers the place's conversations, events, official updates, sourced facts and dated
// observations, each through the feed's reader rules.
const { createHash } = require('crypto');
const db = require('../../config/supabaseAdmin');
const legacy = require('../feedService');
const feed = require('./feed');
const { postCards } = require('./cards');
const { homeAreaContext, labelFor, openAreas, areaDto, AREA_SELECT } = require('./areas');
const { postScopeAccess, canReadPost } = require('./readAccess');
const limits = require('./limits');
const parsePoint = require('../../utils/parsePostGISPoint');
const { UUID } = require('./feedCursor');

const OBSERVATION_MS = 72 * 60 * 60 * 1000;
const OBSERVATION_SELECT = `id, user_id, content, created_at, expires_at, area_id, read_scope, moderation_state, archived_at,
  allow_external_share, post_metadata, identity_context_type, visibility, audience, origin, latitude, longitude,
  location_name, radius_miles, distribution_targets, archive_reason, identity_context_id, target_tier_rank, post_type,
  business_id, creator:user_id (id, username, name, first_name, last_name, profile_picture_url, account_type)`;

function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
const firstName = name => String(name || '').trim().split(/\s+/)[0] || 'Neighbor';
function facts(list) {
  return (Array.isArray(list) ? list : []).filter(fact => fact && typeof fact.text === 'string')
    .map(fact => ({ label: fact.label || null, text: fact.text, source_label: fact.source_label || null,
      source_url: fact.source_url || null, retrieved_at: fact.retrieved_at || null }));
}

// A reader's context for a place, in the shape feed.scan takes. A restricted place reads only
// for verified homes inside it.
async function placeContext(viewerId, placeId) {
  if (typeof placeId !== 'string' || !UUID.test(placeId)) throw fail(404, 'AREA_NOT_FOUND', 'This place is not available.');
  const place = await checked(openAreas(db.from('PulseArea').select(`${AREA_SELECT}, facts`)).eq('id', placeId)
    .eq('kind', 'place').maybeSingle());
  if (!place) throw fail(404, 'AREA_NOT_FOUND', 'This place is not available.');
  const [homes, filters] = await Promise.all([homeAreaContext(viewerId), legacy.getMuteAndHideFilters(viewerId)]);
  return { userId: viewerId, homes, filters, area: place, available: [], defaults: {}, follows: [],
    scope: await postScopeAccess(viewerId, homes), canRead: !place.restricted || homes.verifiedAreaIds.has(place.id) };
}

async function observationDtos(rows, place, viewerId) {
  const identities = await legacy.attachIdentityAuthors(rows.map(row => ({ user_id: row.user_id, creator: row.creator })), viewerId);
  return Promise.all(rows.map(async (row, i) => ({
    id: row.id, text: row.content || '', created_at: row.created_at, expires_at: row.expires_at,
    author: { display_name: firstName(identities[i]?.author?.displayName),
      label: await labelFor({ userId: row.user_id, accountType: row.creator?.account_type,
        origin: row.origin === 'curator' ? 'curator' : null, identityType: 'local' }, place.id) },
  })));
}

// Live, current observations the reader may see: the shared wall, mutes, hides and blocks.
async function observationsFor(context) {
  const rows = await checked(context.scope.query(db.from('Post').select(OBSERVATION_SELECT)
    .eq('area_id', context.area.id).contains('distribution_targets', ['place_observation'])
    .eq('moderation_state', 'live').is('archived_at', null).gt('expires_at', new Date().toISOString()))
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(60));
  const shown = legacy.applyMuteHideFilters(rows || [], context.filters, 'place', context.userId);
  const readable = await Promise.all(shown.map(post => canReadPost(post, context.userId, context.scope)));
  return observationDtos(shown.filter((_, i) => readable[i]).slice(0, 30), context.area, context.userId);
}

/** GET /api/pulse/places/:id */
async function page(viewerId, placeId) {
  const context = await placeContext(viewerId, placeId);
  const place = context.area;
  const result = { place: { ...areaDto(place), place_type: place.place_type, restricted: place.restricted,
    facts: facts(place.facts) }, can_read: context.canRead, conversations: [], upcoming: [], official_updates: [],
    observations: [] };
  if (!context.canRead) return result;
  const rows = await feed.scan(context, { view: 'nearby', ended: true, readAt: new Date().toISOString(), take: 60 });
  const official = new Set(rows.filter(row => row.origin === 'curator' || row.creator?.account_type === 'official')
    .map(row => row.id));
  const [cards, upcoming, observations] = await Promise.all([
    postCards(rows, { viewerId, homes: context.homes, areas: [place], fallbackArea: place,
      blockedIds: context.filters.blockedUserIds }),
    require('./upcoming').eventsFor(context),
    observationsFor(context),
  ]);
  return { ...result, conversations: cards.filter(card => !official.has(card.id)).slice(0, 20),
    official_updates: cards.filter(card => official.has(card.id)).slice(0, 5), upcoming, observations };
}

/** POST /api/pulse/places/:id/observations { text, clientRequestId? } */
async function observe(viewerId, placeId, body = {}) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 280) throw fail(400, 'INVALID_OBSERVATION', 'Write what you saw in up to 280 characters.');
  if (body.clientRequestId != null && (typeof body.clientRequestId !== 'string' || !UUID.test(body.clientRequestId))) {
    throw fail(400, 'INVALID_OBSERVATION', 'Write what you saw in up to 280 characters.');
  }
  const context = await placeContext(viewerId, placeId);
  const place = context.area;
  const user = await checked(db.from('User').select('adult_attested_at, account_type').eq('id', viewerId).maybeSingle());
  if (user?.account_type === 'business') throw fail(403, 'BUSINESS_CANNOT_POST', 'Businesses reply in Pulse; they don’t start posts.');
  if (!user?.adult_attested_at) throw fail(403, 'ADULT_ATTESTATION_REQUIRED', 'Confirm you are 18 or older to post in Pulse.');
  if (!context.canRead) throw fail(403, 'NEEDS_VERIFIED_ADDRESS', 'A verified address in this place is needed.');

  // A retry of the same observation returns it instead of counting again.
  const id = body.clientRequestId ? createHash('sha256')
    .update(`pantopus:place-observation:v1:${viewerId.toLowerCase()}:${body.clientRequestId.toLowerCase()}`)
    .digest('hex').slice(0, 32) : null;
  const existing = id ? await checked(db.from('Post').select(OBSERVATION_SELECT).eq('id', id).maybeSingle()) : null;
  if (existing) {
    if (existing.user_id !== viewerId || existing.area_id !== place.id || existing.content !== text) {
      throw fail(409, 'INVALID_OBSERVATION', 'This request was already used for a different observation.');
    }
    return { observation: (await observationDtos([existing], place, viewerId))[0] };
  }

  const compose = require('./compose');
  const label = await labelFor({ userId: viewerId, accountType: user.account_type, identityType: 'local' }, place.id, context.homes);
  const scope = label === 'visitor' ? 'visitor_observation' : label === 'new_here' ? 'new_here' : null;
  if (scope) {
    const over = await limits.check(viewerId, scope);
    if (over) {
      const refusal = compose.limitRefusal(scope, over).body;
      throw Object.assign(fail(429, refusal.code, refusal.error), { body: refusal });
    }
  }
  const checks = await compose.composerChecks(text, [], { userId: viewerId, postType: 'share', topic: null,
    areaId: place.id, readScope: place.restricted ? 'verified_area' : 'public', mode: 'create' });
  if (checks.blocks.length) {
    throw Object.assign(fail(422, 'COMPOSER_BLOCKED', "This can't be posted as written."), { body: { blocks: checks.blocks } });
  }
  const hold = checks.holds[0];
  const [row] = await checked(db.from('PulseArea').select('centroid').eq('id', place.id));
  const point = parsePoint(row?.centroid);
  const now = Date.now();
  const inserted = await checked(db.from('Post').insert({
    ...(id ? { id } : {}),
    user_id: viewerId, author_user_id: viewerId, title: null, content: text, post_type: 'share', post_format: 'standard',
    read_scope: place.restricted ? 'verified_area' : 'public', area_id: place.id,
    visibility: place.restricted ? 'neighborhood' : 'public', visibility_scope: 'neighborhood',
    audience: 'nearby', distribution_targets: ['place_observation'], allow_external_share: false,
    latitude: point?.latitude ?? null, longitude: point?.longitude ?? null,
    effective_latitude: point?.latitude ?? null, effective_longitude: point?.longitude ?? null,
    location_precision: 'none', location_name: place.name, location_address: null, post_as: 'personal',
    profile_visibility_scope: 'hidden', show_on_profile: false, is_visitor_post: label === 'visitor', state: 'open',
    expires_at: new Date(now + OBSERVATION_MS).toISOString(), origin: 'user',
    post_metadata: { observation: true, pulse_about: place.name },
    ...(hold ? { moderation_state: 'held', moderation_rule: hold.rule, moderated_at: new Date(now).toISOString() } : {}),
  }).select(OBSERVATION_SELECT).single());
  // Two observations that passed a limit at once: the later one is undone.
  if (scope && await limits.exceededBy(viewerId, scope, inserted.id)) {
    await checked(db.from('Post').delete().eq('id', inserted.id).eq('user_id', viewerId));
    const body429 = compose.limitRefusal(scope, await limits.check(viewerId, scope)).body;
    throw Object.assign(fail(429, body429.code, body429.error), { body: body429 });
  }
  return { observation: (await observationDtos([inserted], place, viewerId))[0] };
}

module.exports = { page, observe, placeContext };
