'use strict';

// Upcoming (S12, contract §2.15): Pulse events and plans open to the area, soonest first. Events
// are read through the feed's scan (its wall, moderation, mutes, hides and blocks); plans come
// from the Plans list itself, with its own rules, and only while the `plans` switch is on.
const db = require('../../config/supabaseAdmin');
const feed = require('./feed');
const { postCards } = require('./cards');
const { openAreas, areaDto, AREA_SELECT } = require('./areas');
const parsePoint = require('../../utils/parsePostGISPoint');
const { isFeatureEnabled } = require('../featureFlagService');

const HOUR_MS = 60 * 60 * 1000;
const HORIZON_MS = 14 * 24 * HOUR_MS;
// An event with no end stays this long after it starts.
const NO_END_MS = 3 * HOUR_MS;

async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function plansFor(user, area) {
  if (!await isFeatureEnabled('plans', user)) return [];
  const [row] = await checked(db.from('PulseArea').select('centroid').eq('id', area.id));
  const point = parsePoint(row?.centroid);
  if (!point) return [];
  const { loadViewer } = require('../plans/planViewer');
  const planService = require('../plans/planService');
  const viewer = await loadViewer(user, { point });
  const { items } = await planService.listNearby(viewer, { point, window: 'week' });
  return items.filter(plan => plan.starts_at).map(plan => ({ kind: 'plan', starts_at: plan.starts_at,
    ends_at: plan.ends_at || null, plan }));
}

/** GET /api/pulse/upcoming */
async function upcoming(user, { areaId, limit = 20 } = {}) {
  const context = await feed.contextFor(user.id, areaId);
  if (!context.area) return { area: null, items: [] };
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const rows = await feed.scan(context, { view: 'nearby', readAt: nowIso, refine: query => query
    .eq('post_type', 'event').not('event_date', 'is', null).lte('event_date', new Date(now + HORIZON_MS).toISOString())
    .or(`event_end_date.gte.${nowIso},and(event_end_date.is.null,event_date.gte.${new Date(now - NO_END_MS).toISOString()})`) });
  const ids = [...new Set(rows.map(row => row.area_id).filter(Boolean))];
  const areas = ids.length ? await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).in('id', ids)) : [];
  const [cards, plans] = await Promise.all([
    postCards(rows, { viewerId: user.id, homes: context.homes, areas, fallbackArea: context.area,
      blockedIds: context.filters.blockedUserIds }),
    plansFor(user, context.area),
  ]);
  const events = cards.map((card, i) => ({ kind: 'event', starts_at: new Date(rows[i].event_date).toISOString(),
    ends_at: rows[i].event_end_date ? new Date(rows[i].event_end_date).toISOString() : null, post: card }));
  const items = [...events, ...plans].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).slice(0, limit);
  return { area: areaDto(context.area), items };
}

module.exports = { upcoming };
