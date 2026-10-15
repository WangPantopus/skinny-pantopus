'use strict';

// Known (S12, contract §2.14): short, sourced answers for an area. Residents confirm, suggest a
// correction or flag an entry outdated; the curator and staff write entries through the functions
// at the end (PS's drafting and console). An entry shows only what public, live, web-visible posts
// and live replies by existing accounts say, decided each time it is read.
const db = require('../../config/supabaseAdmin');
const legacy = require('../feedService');
const blockService = require('../blockService');
const { SAFE_CREATOR_SELECT } = require('../../serializers/identitySerializers');
const { homeAreaContext, labelFor, openAreas, areaDto, AREA_SELECT } = require('./areas');
const { isPulseTopic } = require('./topics');
const { UUID } = require('./feedCursor');

const ENTRY_SELECT = `id, area_id, topic, kind, question, answer, items, sources, source_post_ids, status,
  last_confirmed_at, asked_post_id, asked_at, created_at, updated_at`;
const SHOWN = ['published', 'stale'];
const KINDS = ['official', 'neighbor'];
const RESPONSES = ['confirm', 'correct', 'outdated'];
const QUOTE_LENGTH = 280;
const ERRORS = {
  KNOWN_NOT_FOUND: [404, 'This answer is not available.'],
  NOTE_REQUIRED: [400, 'Say what should change, in up to 500 characters.'],
  NEEDS_VERIFIED_ADDRESS: [403, 'A verified address in this town is needed.'],
  BUSINESS_CANNOT_POST: [403, 'Businesses can’t confirm or correct Known.'],
  INVALID_SEARCH: [400, 'Search with up to 80 characters.'],
  INVALID_TOPIC: [400, 'Choose one of the Pulse topics.'],
  INVALID_KNOWN: [400, 'This Known entry is not valid.'],
  INVALID_KNOWN_SOURCE: [400, 'Known can cite only public, live conversations.'],
};
function fail(code, message) {
  const [status, text] = ERRORS[code];
  return Object.assign(new Error(message || text), { status, code });
}
async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
function chunks(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}
const firstName = name => String(name || '').trim().split(/\s+/)[0] || 'Neighbor';
const clip = (text, max) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
};

// The posts and replies an entry may show to this reader (contract §2.14): public, live, not
// removed from the web view, by an existing account the reader isn't blocked from.
async function shownRefs(entries, blocked) {
  const postIds = new Set();
  const replyIds = new Set();
  for (const entry of entries) {
    for (const id of entry.source_post_ids || []) postIds.add(id);
    for (const item of entry.items || []) {
      for (const ref of item.refs || []) {
        if (ref.post_id) postIds.add(ref.post_id);
        if (ref.reply_id) replyIds.add(ref.reply_id);
      }
    }
  }
  const posts = new Map();
  for (const ids of chunks([...postIds], 200)) {
    const rows = await checked(db.from('Post').select(`id, user_id, title, content, created_at, read_scope,
      moderation_state, allow_external_share, identity_context_type, post_as, origin,
      creator:user_id (${SAFE_CREATOR_SELECT})`).in('id', ids));
    for (const row of rows || []) {
      if (row.read_scope === 'public' && row.moderation_state === 'live' && row.allow_external_share !== false
        && row.user_id && !blocked.has(row.user_id) && !['home', 'persona'].includes(row.identity_context_type)
        && !['home', 'persona'].includes(row.post_as)) posts.set(row.id, row);
    }
  }
  const replies = new Map();
  for (const ids of chunks([...replyIds], 200)) {
    const rows = await checked(db.from('PostComment').select(`id, post_id, user_id, comment, created_at,
      is_deleted, moderation_state, author:user_id (${SAFE_CREATOR_SELECT})`).in('id', ids));
    for (const row of rows || []) {
      if (posts.has(row.post_id) && row.is_deleted !== true && row.moderation_state === 'live'
        && row.user_id && !blocked.has(row.user_id)) replies.set(row.id, row);
    }
  }
  return { posts, replies };
}

// Each person as public town content shows them: the chosen identity's first name and their
// label in the entry's area (cards.js does the same for public posts).
function personProjector(viewerId) {
  const cache = new Map();
  return (person, areaId) => {
    const key = `${person.user_id}:${areaId}`;
    if (!cache.has(key)) cache.set(key, (async () => {
      const [identity] = await legacy.attachIdentityAuthors([{ user_id: person.user_id, creator: person.creator }], viewerId);
      const label = await labelFor({ userId: person.user_id, accountType: person.creator?.account_type,
        origin: person.creator?.account_type === 'curator' ? 'curator' : null, identityType: 'local' },
      areaId, await homeAreaContext(person.user_id));
      const name = identity?.author?.displayName || 'Neighbor';
      return { display_name: ['pantopus', 'official'].includes(label) ? name : firstName(name), label };
    })());
    return cache.get(key);
  };
}

function residentHome(homes, areaId) {
  const verified = new Set(homes.homes.filter(home => home.verified).map(home => home.id));
  const inside = homes.matches.filter(match => match.area_id === areaId && match.inside === true
    && verified.has(match.home_id)).map(match => match.home_id);
  return inside.includes(homes.primary?.id) ? homes.primary.id : inside[0] || null;
}

async function askedAgain(entries) {
  const ids = entries.map(entry => entry.asked_post_id).filter(Boolean);
  if (!ids.length) return new Set();
  const rows = await checked(db.from('Post').select('id, state, resolution, archived_at, expires_at, read_scope, moderation_state')
    .in('id', ids));
  const now = Date.now();
  return new Set((rows || []).filter(post => post.state === 'open' && !post.resolution && !post.archived_at
    && (!post.expires_at || Date.parse(post.expires_at) > now) && post.read_scope === 'public'
    && post.moderation_state === 'live').map(post => post.id));
}

/** Serialize entries for one reader; `full` adds items, sources and the reader's own state. */
async function dtos(entries, { viewerId, homes, blocked, areas, full, accountType }) {
  if (!entries.length) return [];
  const [refs, openAsks, mine] = await Promise.all([
    shownRefs(entries, blocked),
    full ? askedAgain(entries) : new Set(),
    full ? checked(db.from('KnownConfirmation').select('entry_id, kind, created_at, resolved_at')
      .eq('user_id', viewerId).in('entry_id', entries.map(entry => entry.id))) : [],
  ]);
  const person = personProjector(viewerId);
  const areaById = new Map(areas.map(area => [area.id, area]));
  return Promise.all(entries.map(async entry => {
    const conversations = (entry.source_post_ids || []).map(id => refs.posts.get(id)).filter(Boolean)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const items = (await Promise.all((entry.items || []).map(async item => {
      const shown = (item.refs || []).map(ref => {
        const post = refs.posts.get(ref.post_id);
        if (!post) return null;
        if (!ref.reply_id) return { ref, post, at: post.created_at, user_id: post.user_id, creator: post.creator, text: post.content };
        const reply = refs.replies.get(ref.reply_id);
        return reply && reply.post_id === post.id ? { ref, post, reply, at: reply.created_at, user_id: reply.user_id,
          creator: reply.author, text: reply.comment } : null;
      }).filter(Boolean).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      if (!shown.length) return null;
      if (!full) return { latest_at: shown[0].at };
      const people = [...new Map(shown.map(row => [row.user_id, row])).values()];
      const names = await Promise.all(people.slice(0, 2).map(row => person(row, entry.area_id)));
      const quoted = shown.find(row => row.ref.quote && String(row.text || '').trim());
      const quoteBy = quoted ? await person(quoted, entry.area_id) : null;
      return {
        name: item.name,
        recommended_by: { names: names.map(name => name.display_name), others: people.length - names.length },
        latest_at: shown[0].at,
        quote: quoted ? { text: clip(quoted.text, QUOTE_LENGTH), display_name: quoteBy.display_name, label: quoteBy.label,
          post_id: quoted.post.id, reply_id: quoted.reply?.id || null } : null,
      };
    }))).filter(Boolean).sort((a, b) => Date.parse(b.latest_at) - Date.parse(a.latest_at));
    const summary = { id: entry.id, title: entry.question, topic: entry.topic || null, kind: entry.kind,
      status: entry.status, last_confirmed_at: entry.last_confirmed_at, conversation_count: conversations.length,
      item_count: items.length };
    if (!full) return summary;
    const since = Date.parse(entry.last_confirmed_at || 0) || 0;
    const current = kind => mine.some(row => row.entry_id === entry.id && row.kind === kind && !row.resolved_at
      && (kind === 'correct' || Date.parse(row.created_at) > since));
    return {
      id: entry.id, area: areaDto(areaById.get(entry.area_id)), topic: entry.topic || null, kind: entry.kind,
      status: entry.status, title: entry.question, answer: entry.answer || null, items,
      sources: {
        conversations: conversations.slice(0, 20).map(post => ({ post_id: post.id,
          title: clip(post.title || post.content, 120), created_at: post.created_at })),
        conversation_count: conversations.length,
        first_at: conversations.length ? conversations[conversations.length - 1].created_at : null,
        last_at: conversations.length ? conversations[0].created_at : null,
        official: (entry.sources?.official || []).map(source => ({ label: source.label, url: source.url,
          retrieved_at: source.retrieved_at || null })),
      },
      last_confirmed_at: entry.last_confirmed_at,
      asked_again: openAsks.has(entry.asked_post_id) ? { post_id: entry.asked_post_id, at: entry.asked_at } : null,
      viewer: { can_respond: accountType !== 'business' && !!residentHome(homes, entry.area_id),
        confirmed: current('confirm'), suggested_correction: current('correct'), flagged_outdated: current('outdated') },
    };
  }));
}

function searchText(q) {
  if (q == null || q === '') return null;
  if (typeof q !== 'string' || q.trim().length > 80) throw fail('INVALID_SEARCH');
  return q.trim() || null;
}

/** GET /api/pulse/known: published and stale entries in the area, most recently confirmed first. */
async function list(viewerId, { areaId, q, topic } = {}) {
  const text = searchText(q);
  if (topic != null && !isPulseTopic(topic)) throw fail('INVALID_TOPIC');
  const context = await require('./feed').contextFor(viewerId, areaId);
  if (!context.area) return { area: null, entries: [] };
  let query = db.from('KnownEntry').select(ENTRY_SELECT).eq('area_id', context.area.id).in('status', SHOWN)
    .order('last_confirmed_at', { ascending: false, nullsFirst: false }).order('id').limit(50);
  if (topic) query = query.eq('topic', topic);
  if (text) query = query.textSearch('search', text, { type: 'websearch', config: 'english' });
  const entries = await checked(query);
  return { area: areaDto(context.area), entries: await dtos(entries || [], { viewerId, homes: context.homes,
    blocked: context.filters.blockedUserIds, areas: [context.area], full: false }) };
}

async function readable(viewerId, id, homes) {
  if (typeof id !== 'string' || !UUID.test(id)) throw fail('KNOWN_NOT_FOUND');
  const entry = await checked(db.from('KnownEntry').select(ENTRY_SELECT).eq('id', id).in('status', SHOWN).maybeSingle());
  if (!entry) throw fail('KNOWN_NOT_FOUND');
  const area = await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).eq('id', entry.area_id).maybeSingle());
  if (!area || !(['town', 'place'].includes(area.kind) || homes.verifiedAreaIds.has(area.id))) throw fail('KNOWN_NOT_FOUND');
  return { entry, area };
}

/** GET /api/pulse/known/:id */
async function read(viewerId, id) {
  const [homes, blocked, user] = await Promise.all([homeAreaContext(viewerId), blockService.blockedUserIds(viewerId),
    checked(db.from('User').select('account_type').eq('id', viewerId).maybeSingle())]);
  const { entry, area } = await readable(viewerId, id, homes);
  const [dto] = await dtos([entry], { viewerId, homes, blocked, areas: [area], full: true, accountType: user?.account_type });
  return { entry: dto };
}

/** POST /api/pulse/known/:id/{confirm,correct,outdated} */
async function respond(viewerId, id, kind, note) {
  if (!RESPONSES.includes(kind)) throw fail('INVALID_KNOWN');
  const text = typeof note === 'string' ? note.trim() : null;
  if ((kind === 'correct' && !text) || (note != null && typeof note !== 'string') || (text && text.length > 500)) {
    throw fail('NOTE_REQUIRED');
  }
  const [homes, user] = await Promise.all([homeAreaContext(viewerId),
    checked(db.from('User').select('account_type').eq('id', viewerId).maybeSingle())]);
  if (user?.account_type === 'business') throw fail('BUSINESS_CANNOT_POST');
  const { entry } = await readable(viewerId, id, homes);
  const home = residentHome(homes, entry.area_id);
  if (!home) throw fail('NEEDS_VERIFIED_ADDRESS');
  const result = await checked(db.rpc('pulse_known_respond', { p_entry_id: entry.id, p_user_id: viewerId,
    p_home_id: home, p_kind: kind, p_note: kind === 'confirm' ? null : text || null }));
  if (result?.code) throw fail('KNOWN_NOT_FOUND');
  return read(viewerId, id);
}

// ── For the curator and staff (PS's drafting and console), and Pulse mode ──

function validDraft(input) {
  const { areaId, topic, kind, question, answer, items = [], sources = {} } = input || {};
  const url = value => typeof value === 'string' && value.length <= 500 && /^https?:\/\/\S+$/i.test(value);
  const ref = value => value && UUID.test(value.post_id || '') && (value.reply_id == null || UUID.test(value.reply_id));
  return typeof areaId === 'string' && UUID.test(areaId) && KINDS.includes(kind)
    && (topic == null || isPulseTopic(topic))
    && typeof question === 'string' && question.trim().length >= 1 && question.trim().length <= 200
    && (answer == null || (typeof answer === 'string' && answer.length <= 4000))
    && Array.isArray(items) && items.length <= 50 && items.every(item => typeof item?.name === 'string'
      && item.name.trim().length >= 1 && item.name.trim().length <= 120 && Array.isArray(item.refs)
      && item.refs.length >= 1 && item.refs.length <= 100 && item.refs.every(ref))
    && sources && typeof sources === 'object' && !Array.isArray(sources)
    && (sources.official == null || (Array.isArray(sources.official) && sources.official.length <= 20
      && sources.official.every(source => typeof source?.label === 'string' && source.label.trim()
        && source.label.length <= 120 && url(source.url))))
    && (sources.posts == null || (Array.isArray(sources.posts) && sources.posts.length <= 200
      && sources.posts.every(id => typeof id === 'string' && UUID.test(id))));
}

/**
 * Create or update a draft entry (`id` updates one that isn't retired). Every cited post and
 * reply must be public and live now; reading applies the same rule again later.
 */
async function saveDraft(input) {
  if (!validDraft(input)) throw fail('INVALID_KNOWN');
  const area = await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).eq('id', input.areaId).maybeSingle());
  if (!area) throw fail('INVALID_KNOWN', 'This area is not open.');
  const items = (input.items || []).map(item => ({ name: item.name.trim(), refs: item.refs.map(ref => ({
    post_id: ref.post_id.toLowerCase(), reply_id: ref.reply_id ? ref.reply_id.toLowerCase() : null, quote: ref.quote === true })) }));
  const official = (input.sources?.official || []).map(source => ({ label: source.label.trim(), url: source.url,
    retrieved_at: source.retrieved_at || new Date().toISOString() }));
  const posts = [...new Set((input.sources?.posts || []).map(id => id.toLowerCase()))];
  const sourcePostIds = [...new Set([...posts, ...items.flatMap(item => item.refs.map(ref => ref.post_id))])];
  const draft = { source_post_ids: sourcePostIds, items };
  const refs = await shownRefs([draft], new Set());
  const missing = sourcePostIds.filter(id => !refs.posts.has(id))
    .concat(items.flatMap(item => item.refs.filter(ref => ref.reply_id && !refs.replies.has(ref.reply_id))
      .map(ref => ref.reply_id)));
  if (missing.length) throw Object.assign(fail('INVALID_KNOWN_SOURCE'), { body: { ids: missing } });
  const row = { area_id: area.id, topic: input.topic || null, kind: input.kind, question: input.question.trim(),
    answer: input.answer == null ? null : input.answer.trim(), items, sources: { official, posts },
    source_post_ids: sourcePostIds, review_by: input.reviewBy || null, updated_at: new Date().toISOString() };
  if (input.id) {
    const updated = await checked(db.from('KnownEntry').update(row).eq('id', input.id).neq('status', 'retired')
      .select(ENTRY_SELECT).maybeSingle());
    if (!updated) throw fail('KNOWN_NOT_FOUND');
    return updated;
  }
  return checked(db.from('KnownEntry').insert({ ...row, created_by: input.createdBy || null }).select(ENTRY_SELECT).single());
}

/** Staff publish a draft (or an edited entry); it counts as confirmed now. */
async function publish(id, staffId) {
  const now = new Date().toISOString();
  const entry = await checked(db.from('KnownEntry').update({ status: 'published', published_by: staffId || null,
    last_confirmed_at: now, updated_at: now }).eq('id', id).neq('status', 'retired').select(ENTRY_SELECT).maybeSingle());
  if (!entry) throw fail('KNOWN_NOT_FOUND');
  return entry;
}

async function retire(id, staffId) {
  const entry = await checked(db.from('KnownEntry').update({ status: 'retired', published_by: staffId || null,
    updated_at: new Date().toISOString() }).eq('id', id).select(ENTRY_SELECT).maybeSingle());
  if (!entry) throw fail('KNOWN_NOT_FOUND');
  return entry;
}

/** Residents' suggested corrections staff haven't resolved, oldest first. */
async function openCorrections(areaId) {
  return checked(db.from('KnownConfirmation').select('id, entry_id, user_id, note, created_at, entry:entry_id!inner(area_id, question)')
    .eq('kind', 'correct').is('resolved_at', null).eq('entry.area_id', areaId).order('created_at').limit(200));
}

async function resolveCorrection(confirmationId, staffId) {
  return checked(db.from('KnownConfirmation').update({ resolved_at: new Date().toISOString(), resolved_by: staffId || null })
    .eq('id', confirmationId).eq('kind', 'correct').is('resolved_at', null).select('id').maybeSingle());
}

/** The composer check's "existing" items (contract §2.6): up to 3 entries sharing the most words. */
async function similar(text, areaId, { viewerId = null } = {}) {
  const words = [...new Set((typeof text === 'string' ? text.slice(0, 400) : '').toLowerCase()
    .split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 3))].slice(0, 30);
  if (!words.length || typeof areaId !== 'string' || !UUID.test(areaId)) return [];
  const found = await checked(db.from('KnownEntry').select(ENTRY_SELECT).eq('area_id', areaId).in('status', SHOWN)
    .textSearch('search', words.join(' or '), { type: 'websearch', config: 'english' }).limit(30));
  const score = entry => {
    const body = `${entry.question} ${entry.answer || ''} ${(entry.items || []).map(item => item.name).join(' ')}`.toLowerCase();
    return words.filter(word => body.includes(word)).length;
  };
  const entries = (found || []).map(entry => ({ entry, score: score(entry) })).filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.entry.last_confirmed_at || 0) - Date.parse(a.entry.last_confirmed_at || 0))
    .slice(0, 3).map(row => row.entry);
  const blocked = viewerId ? await blockService.blockedUserIds(viewerId) : new Set();
  const summaries = await dtos(entries, { viewerId, homes: null, blocked, areas: [], full: false });
  const month = iso => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;
  return summaries.map(entry => ({ kind: 'known', id: entry.id, title: entry.title,
    meta: ['Known', entry.conversation_count ? `${entry.conversation_count} ${entry.conversation_count === 1 ? 'answer' : 'answers'}` : null,
      entry.last_confirmed_at ? `confirmed ${month(entry.last_confirmed_at)}` : null].filter(Boolean).join(' · ') }));
}

/** Pulse mode's `knownEntryId` (contract §2.5): the entry an Ask asks again, or null. */
async function forAsk(entryId) {
  if (typeof entryId !== 'string' || !UUID.test(entryId)) return null;
  return checked(db.from('KnownEntry').select(ENTRY_SELECT).eq('id', entryId).in('status', SHOWN).maybeSingle());
}

async function linkAsk(entryId, postId) {
  await checked(db.from('KnownEntry').update({ asked_post_id: postId, asked_at: new Date().toISOString() })
    .eq('id', entryId).in('status', SHOWN));
}

/**
 * The asker marked a reply Helpful on an Ask that asks a Known entry again: the conversation
 * joins the entry's sources when it is public, and the entry is refreshed.
 */
async function answered(post, replyId) {
  const entryId = post.post_metadata?.known_entry_id;
  const entry = await forAsk(entryId);
  if (!entry) return null;
  const refs = await shownRefs([{ source_post_ids: [post.id], items: [{ refs: [{ post_id: post.id, reply_id: replyId }] }] }], new Set());
  if (!refs.posts.has(post.id) || !refs.replies.has(replyId)) return null;
  const now = new Date().toISOString();
  const posts = [...new Set([...(entry.sources?.posts || []), post.id])];
  return checked(db.from('KnownEntry').update({
    sources: { ...(entry.sources || {}), posts }, source_post_ids: [...new Set([...(entry.source_post_ids || []), post.id])],
    last_confirmed_at: now, status: 'published', updated_at: now,
    ...(entry.asked_post_id === post.id ? { asked_post_id: null, asked_at: null } : {}),
  }).eq('id', entry.id).in('status', SHOWN).select('id').maybeSingle());
}

module.exports = { list, read, respond, saveDraft, publish, retire, openCorrections, resolveCorrection,
  similar, forAsk, linkAsk, answered, dtos };
