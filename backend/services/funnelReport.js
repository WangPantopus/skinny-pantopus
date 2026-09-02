'use strict';
// ============================================================
// FUNNEL REPORT — the founder's read-out of the wedge ladder.
//
// Everything before an account is a FunnelEvent row (services/funnelEvents);
// this turns a window of those rows into the handful of numbers the
// wedge is judged by:
//
//   aha rate      previews whose aha card was NOT the calm fallback
//   share rate    "Share this address" taps per preview
//   wall / register / account rates   the ladder itself
//   by route      the same ladder split by the `?r=` route stamped on
//                 every beacon (EDDM cards, invite postcards) → CAC per route
//
// Rates are per DISTINCT visitor (anon_id) when the beacons carried one,
// so a visitor who reloads five times is one preview. Event totals are
// returned alongside. Nothing here identifies a person: anon ids are
// counted, never returned.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { FUNNEL_EVENT_TYPES } = require('./funnelEvents');

const MAX_ROWS = 50000;
const NO_ROUTE = '(direct)';

function emptyLadder() {
  return {
    events: Object.fromEntries(FUNNEL_EVENT_TYPES.map((t) => [t, 0])),
    visitors: Object.fromEntries(FUNNEL_EVENT_TYPES.map((t) => [t, new Set()])),
    aha: { non_calm: 0, calm: 0, by_tone: {}, by_section: {} },
    share: { by_method: {} },
  };
}

function bump(map, key) {
  const k = key || '(none)';
  map[k] = (map[k] || 0) + 1;
}

function ingest(ladder, row) {
  const t = row.event_type;
  if (!(t in ladder.events)) return;
  ladder.events[t] += 1;
  if (row.anon_id) ladder.visitors[t].add(String(row.anon_id));
  const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
  if (t === 't0_aha_viewed') {
    const tone = typeof meta.tone === 'string' ? meta.tone : '(none)';
    if (tone === 'calm') ladder.aha.calm += 1; else ladder.aha.non_calm += 1;
    bump(ladder.aha.by_tone, tone);
    bump(ladder.aha.by_section, typeof meta.section_id === 'string' ? meta.section_id : (tone === 'calm' ? 'calm' : '(none)'));
  }
  if (t === 't0_share_clicked') bump(ladder.share.by_method, typeof meta.method === 'string' ? meta.method : '(none)');
}

// Visitor-based when the beacons carried anon ids; event-based otherwise
// (server-owned t1_account_created carries a user id, not an anon id, so
// it always counts by event).
function size(ladder, t) {
  const v = ladder.visitors[t].size;
  return v > 0 ? v : ladder.events[t];
}

function rate(num, den) {
  return den > 0 ? Math.round((num / den) * 1000) / 1000 : null;
}

function finish(ladder) {
  const previews = size(ladder, 't0_preview_viewed');
  const ahaViews = size(ladder, 't0_aha_viewed');
  const shares = size(ladder, 't0_share_clicked');
  const walls = size(ladder, 't0_wall_viewed');
  const registers = size(ladder, 'register_started');
  const accounts = ladder.events.t1_account_created;
  const nonCalmVisitors = ahaViews > 0 && ladder.aha.non_calm + ladder.aha.calm > 0
    ? Math.round(ahaViews * (ladder.aha.non_calm / (ladder.aha.non_calm + ladder.aha.calm)))
    : 0;
  return {
    events: ladder.events,
    visitors: Object.fromEntries(FUNNEL_EVENT_TYPES.map((t) => [t, ladder.visitors[t].size])),
    ladder: { previews, aha_views: ahaViews, shares, walls, registers, accounts },
    rates: {
      aha: rate(nonCalmVisitors, previews),
      share: rate(shares, previews),
      wall: rate(walls, previews),
      register: rate(registers, previews),
      account: rate(accounts, previews),
    },
    aha: { non_calm: ladder.aha.non_calm, calm: ladder.aha.calm, by_tone: ladder.aha.by_tone, by_section: ladder.aha.by_section },
    share: { by_method: ladder.share.by_method },
  };
}

/**
 * Pure: summarize a window of FunnelEvent rows.
 * @param {Array<{event_type:string, anon_id?:string|null, meta?:object}>} rows
 */
function summarizeFunnel(rows) {
  const all = emptyLadder();
  const routes = new Map();
  for (const row of rows || []) {
    ingest(all, row);
    const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
    const route = typeof meta.route === 'string' && meta.route.trim() ? meta.route.trim().slice(0, 64) : NO_ROUTE;
    if (!routes.has(route)) routes.set(route, emptyLadder());
    ingest(routes.get(route), row);
  }
  const byRoute = [...routes.entries()]
    .map(([route, ladder]) => ({ route, ...finish(ladder) }))
    .sort((a, b) => b.ladder.previews - a.ladder.previews);
  return { ...finish(all), by_route: byRoute, rows: (rows || []).length, truncated: (rows || []).length >= MAX_ROWS };
}

/**
 * Load the last `days` of FunnelEvent and summarize.
 */
async function loadFunnelSummary({ days = 30 } = {}) {
  const d = Math.min(365, Math.max(1, Number(days) || 30));
  const since = new Date(Date.now() - d * 86400000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('FunnelEvent')
    .select('event_type, anon_id, meta, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);
  if (error) {
    logger.warn('funnelReport: read failed', { error: error.message });
    throw new Error(error.message);
  }
  return { days: d, since, ...summarizeFunnel(data || []) };
}

module.exports = { summarizeFunnel, loadFunnelSummary, MAX_ROWS, NO_ROUTE };
