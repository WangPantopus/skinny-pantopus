// ============================================================
// WHAT CHANGED AT A HOME SINCE A TIME (Place "Worth a look")
//
// GET /api/homes/:id/changes?since=<ISO-8601> answers with the real, dated
// records that changed after the viewer's last look at this Home's Place:
//   weather_alert       an active weather alert for the address issued after `since`
//   pickup_schedule     the household's pickup schedule was set or changed
//   document_added      a Home document this viewer may see was added
//   systems_updated     a system's install year was recorded or changed
//   household_activity  Home activity log rows (members.manage only, as the
//                       Home timeline; narrower: no task, document, pickup or
//                       system rows, which have their own visibility)
// Nothing is derived or padded: no `since` (a first visit) answers no items,
// and the viewer's own changes aren't news to them, so they're left out.
// Guests, someone whose claim is in review and a private setup's creator get
// weather alerts only: their Place is the address's public view.
// No new table: every item is read from the record that changed.
// ============================================================

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { excludeHiddenHomeActivity } = require('../../utils/featureFlags');
const { describeHomeActivity } = require('../../utils/homeActivityLabels');
const { homeDocumentVisibilities } = require('../../utils/homeDocumentAccess');
const { NON_RESIDENT_ROLES, resolveHomeRole } = require('../../utils/homeAccessPolicy');
const { loadChatPeople } = require('../chatPeople');
const { SYSTEM_DEFS } = require('../homeSystemsService');

const MAX_ITEMS = 20;
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
// Records that keep their own visibility; their activity rows would say they exist.
const OWN_ITEM_TARGETS = ['HomeTask', 'HomeDocument', 'AddressCalendarRule', 'HomeSystem'];
const PICKUP_KINDS = ['garbage', 'recycling', 'yard_waste', 'bulk_pickup'];
const SYSTEM_LABELS = Object.fromEntries(SYSTEM_DEFS.map((def) => [def.key, def.label]));
const SYSTEM_SOURCE_ORIGINS = { resident: 'Your household', permit: 'A permit record', marketplace: 'A completed job' };

const iso = (value) => {
  const at = Date.parse(value || '');
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
};

// `since` as the window's start: missing, unreadable or in the future is no
// window at all; older than 30 days is clamped to 30 days.
function windowStart(raw, now) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const at = Date.parse(raw);
  if (!Number.isFinite(at) || at > now) return null;
  return new Date(Math.max(at, now - MAX_WINDOW_MS)).toISOString();
}

function homePoint(home) {
  const lat = Number(home && home.map_center_lat);
  const lng = Number(home && home.map_center_lng);
  if (home?.map_center_lat == null || home?.map_center_lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function weatherAlerts(home, since) {
  const point = homePoint(home);
  if (!point) return [];
  // The same provider and cache the Today sections read.
  const { fetchAlerts } = require('../context/alertsProvider');
  const result = await fetchAlerts(point.lat, point.lng);
  if (!result || result.source === 'error') throw new Error('alerts unavailable');
  return (result.alerts || [])
    .map((alert) => ({ alert, issued: iso(alert.sent) }))
    // Only an alert with a stated issue time after `since`; one without a time isn't dated.
    .filter(({ issued }) => issued && issued > since)
    .map(({ alert, issued }) => ({
      id: `weather_alert:${alert.id}`,
      kind: 'weather_alert',
      title: `${alert.event || 'Weather alert'} issued`,
      detail: null,
      occurred_at: issued,
      origin: alert.sender_name || alert.source || (result.provider === 'NOAA' ? 'National Weather Service' : 'Weather alerts'),
      route: { screen: 'today', section: 'alerts' },
    }));
}

async function pickupSchedule(homeId, userId, since, showNames) {
  const { data, error } = await supabaseAdmin
    .from('AddressCalendarRule')
    .select('id, kind, created_by, updated_at')
    .eq('scope_type', 'home')
    .eq('scope_key', String(homeId))
    .in('kind', PICKUP_KINDS)
    .gt('updated_at', since)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  const others = (data || []).filter((rule) => rule.created_by !== userId);
  if (!others.length) return [];
  // One save writes every collection at once: one item for the schedule. Who saved it is named only to
  // someone who may see who lives here (members.view); the pickup card itself never names anyone.
  const newest = others[0];
  const people = showNames ? await loadChatPeople([newest.created_by]) : new Map();
  return [{
    id: `pickup_schedule:${iso(newest.updated_at)}`,
    kind: 'pickup_schedule',
    title: 'Pickup schedule updated',
    detail: null,
    occurred_at: iso(newest.updated_at),
    origin: people.get(String(newest.created_by))?.displayName || 'Your household',
    route: { screen: 'today', section: 'address_calendar' },
  }];
}

async function documentsAdded(homeId, userId, access, since) {
  const visibility = await homeDocumentVisibilities(homeId, userId, access);
  if (visibility.readFailed) throw new Error('document visibility unavailable');
  const { data, error } = await supabaseAdmin
    .from('HomeDocument')
    .select('id, title, created_by, created_at')
    .eq('home_id', homeId)
    .in('visibility', visibility.allowed)
    .gt('created_at', since)
    .order('created_at', { ascending: false })
    .limit(MAX_ITEMS);
  if (error) throw new Error(error.message);
  const rows = (data || []).filter((doc) => doc.created_by !== userId);
  const people = await loadChatPeople(rows.map((doc) => doc.created_by));
  return rows.map((doc) => ({
    id: `document_added:${doc.id}`,
    kind: 'document_added',
    title: `New document: ${doc.title}`,
    detail: null,
    occurred_at: iso(doc.created_at),
    origin: people.get(String(doc.created_by))?.displayName || 'Your household',
    route: { screen: 'documents', id: doc.id },
  }));
}

async function systemsUpdated(homeId, userId, since) {
  const { data, error } = await supabaseAdmin
    .from('HomeSystem')
    .select('id, system_key, installed_year, source, updated_by, updated_at')
    .eq('home_id', homeId)
    .gt('updated_at', since)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || [])
    .filter((row) => row.updated_by !== userId && SYSTEM_LABELS[row.system_key])
    .map((row) => ({
      id: `systems_updated:${row.id}:${iso(row.updated_at)}`,
      kind: 'systems_updated',
      title: row.installed_year != null
        ? `${SYSTEM_LABELS[row.system_key]}: installed ${row.installed_year}`
        : `${SYSTEM_LABELS[row.system_key]}: install year cleared`,
      detail: null,
      occurred_at: iso(row.updated_at),
      origin: SYSTEM_SOURCE_ORIGINS[row.source] || 'Your household',
      route: { screen: 'place_detail', group: 'your_home', section: 'home_systems' },
    }));
}

async function householdActivity(homeId, userId, since) {
  const { data, error } = await excludeHiddenHomeActivity(supabaseAdmin
    .from('HomeAuditLog')
    .select('id, action, actor_user_id, target_type, metadata, created_at')
    .eq('home_id', homeId)
    .gt('created_at', since))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MAX_ITEMS * 2);
  if (error) throw new Error(error.message);
  const rows = (data || []).filter((row) => row.actor_user_id !== userId && !OWN_ITEM_TARGETS.includes(row.target_type));
  const people = await loadChatPeople(rows.map((row) => row.actor_user_id));
  return rows.map((row) => ({
    id: `household_activity:${row.id}`,
    kind: 'household_activity',
    title: describeHomeActivity(row),
    detail: null,
    occurred_at: iso(row.created_at),
    origin: (row.actor_user_id && people.get(String(row.actor_user_id))?.displayName) || 'Your household',
    route: { screen: 'home_activity' },
  }));
}

/**
 * @param {object} args
 * @param {object} args.home     The Home row (id, map_center_lat, map_center_lng).
 * @param {string} args.userId   The viewer.
 * @param {object} args.reader   placeIntelligenceService.readAccess's answer for this viewer.
 * @param {string} [args.since]  The viewer's last look (ISO 8601).
 */
async function changesSince({ home, userId, reader, since: raw, now = Date.now() }) {
  const until = new Date(now).toISOString();
  const since = windowStart(raw, now);
  if (!since) return { since: null, until, total: 0, items: [] };

  const access = reader && reader.access;
  const household = Boolean(access && access.hasAccess)
    && !NON_RESIDENT_ROLES.has(resolveHomeRole(access.occupancy));
  const permissions = new Set((household && access.permissions) || []);
  const sources = [weatherAlerts(home, since)];
  if (household) {
    sources.push(pickupSchedule(home.id, userId, since, permissions.has('members.view')), systemsUpdated(home.id, userId, since));
    if (permissions.has('docs.view')) sources.push(documentsAdded(home.id, userId, access, since));
    if (permissions.has('members.manage')) sources.push(householdActivity(home.id, userId, since));
  }

  const settled = await Promise.allSettled(sources);
  const failed = settled.filter((result) => result.status === 'rejected');
  for (const result of failed) {
    logger.warn('homeChanges: a source failed', { homeId: home.id, error: result.reason && result.reason.message });
  }
  const items = settled
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value)
    .filter((item) => item.occurred_at)
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0));

  return {
    since,
    until,
    total: items.length,
    items: items.slice(0, MAX_ITEMS),
    // A source that couldn't be read: the list may be missing items.
    ...(failed.length ? { incomplete: true } : {}),
  };
}

module.exports = { changesSince, windowStart };
