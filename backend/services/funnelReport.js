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
const { currentOccupancy, resolveHomeRole, NON_RESIDENT_ROLES } = require('../utils/homeAccessPolicy');

const MAX_ROWS = 50000;
const PAGE_SIZE = 1000;
const ID_BATCH_SIZE = 200;
const MAX_ACTIVATION_CHECKS = 1000;
const PILOT_EVENT_TYPES = ['session_open', 'reminder_sent', 'reminder_action', 'suggestion_decision'];
const PILOT_DIMENSIONS = ['kind', 'action', 'decision', 'trigger'];
const WEEK_MS = 7 * 86400000;
const NO_ROUTE = '(direct)';

function emptyLadder() {
  return {
    events: Object.fromEntries(FUNNEL_EVENT_TYPES.map((t) => [t, 0])),
    visitors: Object.fromEntries(FUNNEL_EVENT_TYPES.map((t) => [t, new Set()])),
    aha: { non_calm: 0, calm: 0, by_tone: {}, by_section: {} },
    share: { by_method: {} },
    pilot: Object.fromEntries(PILOT_EVENT_TYPES.map(type => [type, Object.fromEntries(
      PILOT_DIMENSIONS.map(dimension => [`by_${dimension}`, Object.create(null)]),
    )])),
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
  if (ladder.pilot[t]) {
    for (const dimension of PILOT_DIMENSIONS) {
      const value = meta[dimension];
      bump(ladder.pilot[t][`by_${dimension}`], typeof value === 'string' && value.length <= 40 ? value : '(none)');
    }
  }
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
    pilot: Object.fromEntries(PILOT_EVENT_TYPES.map(type => [type, { count: ladder.events[type], ...ladder.pilot[type] }])),
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

// PostgREST pages every report read, including servers with smaller row caps.
async function readPages(query, maxRows = MAX_ROWS) {
  const rows = [];
  while (rows.length < maxRows) {
    const start = rows.length;
    const end = Math.min(start + PAGE_SIZE, maxRows) - 1;
    const { data, error } = await query().range(start, end);
    if (error || !Array.isArray(data)) {
      logger.warn('funnelReport: read failed', { errorCode: error?.code || 'INVALID_RESULT' });
      throw new Error('Could not load the funnel report');
    }
    rows.push(...data);
    // A configured server cap can be smaller than PAGE_SIZE. A short page is
    // not proof of completion; advance by the returned count until empty.
    if (data.length === 0) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

function timestamp(value) {
  return value == null ? NaN : new Date(value).getTime();
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = key(row);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return groups;
}

async function checkedRpc(name, args) {
  const { data, error } = await supabaseAdmin.rpc(name, args);
  if (error || data == null) throw new Error('Could not load activation authority');
  return data;
}

// Current records cannot reconstruct removed places/tasks or previous access
// states. A household resource can predate joining: acquisition is the later
// association/resource date. Unstamped legacy verification is not dated proof.
async function summarizeActivation({ users, savedPlaces, homes, occupancies, rules, tasks }, now) {
  const cohort = users.filter(user => user.account_type !== 'curator' && Number.isFinite(timestamp(user.created_at)));
  const homeById = new Map(homes.map(home => [home.id, home]));
  const savedByUser = groupBy(savedPlaces, row => row.user_id);
  const createdByUser = groupBy(homes, row => row.created_by_user_id);
  const ownedByUser = groupBy(homes, row => row.owner_id);
  const occupiedByUser = groupBy(occupancies, row => row.user_id);
  const rulesByHome = groupBy(rules, row => row.scope_key);
  const tasksByHome = groupBy(tasks, row => row.home_id);
  const usable = home => home && !['archived', 'merged'].includes(home.home_status)
    && !['frozen', 'frozen_silent', 'disputed'].includes(home.security_state);
  let activated = 0;
  let matured = 0;
  let activatedMatured = 0;
  let checks = 0;
  let truncated = false;
  for (const user of cohort) {
    const created = timestamp(user.created_at);
    const deadline = Math.min(created + WEEK_MS, now);
    const inWeek = time => Number.isFinite(time) && time >= created && time <= deadline;
    const associations = new Map();
    for (const home of [...(createdByUser.get(user.id) || []), ...(ownedByUser.get(user.id) || [])]) {
      // A legacy owner pointer has no separate acquisition timestamp. Count
      // it only when the Home itself was created during the first week.
      if (usable(home) && (home.created_by_user_id === user.id || home.owner_id === user.id)
        && inWeek(timestamp(home.created_at))) associations.set(home.id, timestamp(home.created_at));
    }
    for (const occupancy of occupiedByUser.get(user.id) || []) {
      if (occupancy.user_id !== user.id || !usable(homeById.get(occupancy.home_id))
        || !currentOccupancy(occupancy, now) || occupancy.verification_status !== 'verified'
        || occupancy.verified_at == null
        || !resolveHomeRole(occupancy) || NON_RESIDENT_ROLES.has(resolveHomeRole(occupancy))) continue;
      const acquired = Math.max(created, timestamp(occupancy.created_at),
        ...['start_at', 'access_start_at', 'verified_at'].map(key => occupancy[key] == null ? created : timestamp(occupancy[key])));
      if (inWeek(acquired)) associations.set(occupancy.home_id, Math.min(associations.get(occupancy.home_id) ?? Infinity, acquired));
    }
    const hasPlace = associations.size > 0 || (savedByUser.get(user.id) || []).some(place => inWeek(timestamp(place.created_at)));
    const acquiredInWeek = (homeId, resource) => associations.has(homeId)
      && inWeek(Math.max(associations.get(homeId), timestamp(resource.created_at)));
    let active = false;
    for (const homeId of associations.keys()) {
      const pickups = (rulesByHome.get(homeId) || []).filter(rule => rule.scope_type === 'home' && rule.kind === 'garbage'
        && rule.confidence === 'official' && rule.source === 'Set by your household'
        && rule.created_by != null && acquiredInWeek(homeId, rule));
      const radon = (tasksByHome.get(homeId) || []).filter(task => task.task_type === 'reminder' && task.details?.suggestion === 'radon_test'
        && !task.details.sourceMailId && !task.details.source_mail_id
        && ['open', 'in_progress', 'done'].includes(task.status) && acquiredInWeek(homeId, task));
      if (!hasPlace || (!pickups.length && !radon.length)) continue;
      if (checks >= MAX_ACTIVATION_CHECKS) { truncated = true; break; }
      checks += 1;
      // Reuse the existing mounted collection authority, including private
      // creator setup, owner revocations and permission overrides. Metadata
      // alone must not turn a denied Home or hidden task into activation.
      const context = await checkedRpc('home_record_context', { p_home_id: homeId, p_user_id: user.id });
      if (typeof context.allowed !== 'boolean' || typeof context.private !== 'boolean' || !Array.isArray(context.permissions)) {
        throw new Error('Invalid activation authority');
      }
      if (!context.allowed) continue;
      if (context.user_id !== user.id) throw new Error('Invalid activation actor');
      if (pickups.length && context.permissions.includes('calendar.view')) { active = true; break; }
      for (const task of radon) {
        if (checks >= MAX_ACTIVATION_CHECKS) { truncated = true; break; }
        checks += 1;
        const visible = await checkedRpc('home_record_visible', {
          p_context: context, p_kind: 'task', p_created_by: task.created_by, p_visibility: task.visibility,
        });
        if (typeof visible !== 'boolean') throw new Error('Invalid activation visibility');
        if (visible) { active = true; break; }
      }
      if (active) break;
    }
    if (active) activated += 1;
    if (created + WEEK_MS <= now) {
      matured += 1;
      if (active) activatedMatured += 1;
    }
  }
  return {
    window_days: 7, basis: 'current_records', cohort_users: cohort.length,
    activated_users: activated, matured_users: matured, activated_matured_users: activatedMatured,
    pending_users: cohort.length - matured, matured_rate: truncated ? null : rate(activatedMatured, matured), truncated,
  };
}

async function readForIds(ids, query) {
  const rows = new Map();
  let truncated = false;
  for (let start = 0; start < ids.length && rows.size < MAX_ROWS; start += ID_BATCH_SIZE) {
    const result = await readPages(() => query(ids.slice(start, start + ID_BATCH_SIZE)).order('id'), MAX_ROWS - rows.size);
    result.rows.forEach(row => rows.set(row.id, row));
    truncated ||= result.truncated;
  }
  return { rows: [...rows.values()], truncated: truncated || rows.size >= MAX_ROWS };
}

async function loadActivation(since, now) {
  const cohort = await readPages(() => supabaseAdmin.from('User').select('id, created_at, account_type')
    .gte('created_at', since).lte('created_at', new Date(now).toISOString())
    .or('account_type.is.null,account_type.neq.curator').order('id'));
  const ids = cohort.rows.map(user => user.id);
  const homeColumns = 'id, owner_id, created_by_user_id, created_at, home_status, security_state';
  const [saved, created, owned, occupied] = await Promise.all([
    readForIds(ids, batch => supabaseAdmin.from('SavedPlace').select('id, user_id, created_at').in('user_id', batch)),
    readForIds(ids, batch => supabaseAdmin.from('Home').select(homeColumns).in('created_by_user_id', batch)),
    readForIds(ids, batch => supabaseAdmin.from('Home').select(homeColumns).in('owner_id', batch)),
    readForIds(ids, batch => supabaseAdmin.from('HomeOccupancy').select('id, user_id, home_id, created_at, role, role_base, is_active, verification_status, start_at, end_at, access_start_at, access_end_at, verified_at')
      .in('user_id', batch).eq('is_active', true)),
  ]);
  const homes = new Map([...created.rows, ...owned.rows].map(home => [home.id, home]));
  const joined = await readForIds([...new Set(occupied.rows.map(row => row.home_id))].filter(id => !homes.has(id)),
    batch => supabaseAdmin.from('Home').select(homeColumns).in('id', batch));
  joined.rows.forEach(home => homes.set(home.id, home));
  const homeIds = [...homes.keys()];
  const [rules, tasks] = await Promise.all([
    readForIds(homeIds, batch => supabaseAdmin.from('AddressCalendarRule').select('id, scope_type, scope_key, kind, source, confidence, created_by, created_at')
      .in('scope_key', batch).eq('scope_type', 'home').eq('kind', 'garbage').eq('confidence', 'official').eq('source', 'Set by your household')),
    readForIds(homeIds, batch => supabaseAdmin.from('HomeTask').select('id, home_id, task_type, status, details, created_at, created_by, visibility')
      .in('home_id', batch).eq('task_type', 'reminder').is('source_mail_id', null).contains('details', { suggestion: 'radon_test' })),
  ]);
  const summary = await summarizeActivation({ users: cohort.rows, savedPlaces: saved.rows, homes: [...homes.values()],
    occupancies: occupied.rows, rules: rules.rows, tasks: tasks.rows }, now);
  const truncated = summary.truncated || [cohort, saved, created, owned, occupied, joined, rules, tasks].some(result => result.truncated);
  return { ...summary, truncated, matured_rate: truncated ? null : summary.matured_rate };
}

async function loadFunnelSummary({ days = 30 } = {}) {
  const d = Math.min(365, Math.max(1, Number(days) || 30));
  const now = Date.now();
  const since = new Date(now - d * 86400000).toISOString();
  const [events, activation] = await Promise.all([
    readPages(() => supabaseAdmin.from('FunnelEvent').select('event_type, anon_id, meta, created_at')
      .gte('created_at', since).lte('created_at', new Date(now).toISOString())
      .order('created_at', { ascending: false }).order('id')),
    loadActivation(since, now),
  ]);
  return { days: d, since, ...summarizeFunnel(events.rows), truncated: events.truncated, activation };
}

module.exports = { summarizeFunnel, summarizeActivation, loadFunnelSummary, MAX_ROWS, NO_ROUTE };
