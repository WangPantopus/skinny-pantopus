'use strict';

// Search (S12, contract §2.17): conversations, Known entries and places in an area. Posts are read
// through the feed's own scan in its search mode (the same wall, moderation, mutes, hides and
// blocks), resolved and ended ones included, newest first.
const db = require('../../config/supabaseAdmin');
const feed = require('./feed');
const known = require('./known');
const { postCards } = require('./cards');
const { openAreas, areaDto, AREA_SELECT } = require('./areas');
const { UUID } = require('./feedCursor');

const PAGE = 20;

function invalid(message = 'Search with 2 to 80 characters.') {
  return Object.assign(new Error(message), { status: 400, code: 'INVALID_SEARCH' });
}
async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
function encode(row) {
  return Buffer.from(JSON.stringify({ v: 1, t: row.created_at, id: row.id })).toString('base64url');
}
function decode(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 300 || !/^[A-Za-z0-9_-]+$/.test(value)) throw invalid('This page link is not valid. Search again.');
  let cursor;
  try { cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); } catch (_) { cursor = null; }
  if (cursor?.v !== 1 || typeof cursor.id !== 'string' || !UUID.test(cursor.id) || typeof cursor.t !== 'string'
    || !Number.isFinite(Date.parse(cursor.t))) throw invalid('This page link is not valid. Search again.');
  return { t: cursor.t, id: cursor.id };
}

// Open places, and the streets and neighborhoods the reader may open, in the town whose names
// contain the words.
async function places(context, text) {
  if (context.area.kind !== 'town') return [];
  const pattern = `%${text.replace(/[\\%_]/g, char => `\\${char}`)}%`;
  const rows = await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).eq('parent_id', context.area.id)
    .in('kind', ['place', 'neighborhood', 'street']).ilike('name', pattern).order('name').limit(20));
  return rows.filter(area => area.kind === 'place' || context.homes.verifiedAreaIds.has(area.id)).slice(0, 5).map(areaDto);
}

/** GET /api/pulse/search */
async function search(viewerId, { q, areaId, cursor } = {}) {
  const text = typeof q === 'string' ? q.trim() : '';
  if (text.length < 2 || text.length > 80) throw invalid();
  const before = decode(cursor);
  const context = await feed.contextFor(viewerId, areaId);
  if (!context.area) return { area: null, q: text, posts: [], known: [], places: [], next_cursor: null };
  const rows = await feed.scan(context, { view: 'nearby', search: text, before, readAt: new Date().toISOString(),
    take: PAGE + 1 });
  const page = rows.slice(0, PAGE);
  const ids = [...new Set(page.map(row => row.area_id).filter(Boolean))];
  const areas = ids.length ? await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).in('id', ids)) : [];
  const [posts, entries, found] = await Promise.all([
    postCards(page, { viewerId, homes: context.homes, areas, fallbackArea: context.area,
      blockedIds: context.filters.blockedUserIds }),
    // Known and places come with the first page; later pages carry only posts.
    before ? [] : known.search(context, text, 5),
    before ? [] : places(context, text),
  ]);
  return { area: areaDto(context.area), q: text, posts, known: entries, places: found,
    next_cursor: rows.length > PAGE ? encode(page[page.length - 1]) : null };
}

module.exports = { search };
