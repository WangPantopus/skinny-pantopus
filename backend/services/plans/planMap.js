'use strict';

/**
 * The `plans` layer of GET /api/posts/map (build brief §5): one pin per plan in
 * the box, while the `plans` flag is on for the viewer.
 *
 * Everyone sees a plan at its public area point (playdates at the neighborhood
 * point); the host and people who are in see it at the exact place. The box is
 * matched against the point the viewer is shown, never the exact place, so a
 * tight box can't find where a plan really is. Playdates only for viewers with a
 * verified address and plans_playdates on; pins go away at the end.
 */

const { isFeatureEnabled } = require('../featureFlagService');
const rules = require('./planRules');
const planService = require('./planService');
const { loadViewer } = require('./planViewer');

const MAX_PINS = 200;

function num(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function inBox(point, box) {
  return point && point.latitude >= box.south && point.latitude <= box.north
    && point.longitude >= box.west && point.longitude <= box.east;
}

/**
 * @param {{ id: string, role?: string }} user
 * @param {{ south: number, west: number, north: number, east: number }} box
 * @param {object} query  the request's query: kinds, window, latitude/longitude (where the viewer is),
 *                        gps_latitude/gps_longitude/gps_timestamp
 */
async function planPins(user, box, query = {}) {
  if (!(await isFeatureEnabled('plans', user))) return [];
  const lat = num(query.latitude);
  const lng = num(query.longitude);
  const point = lat != null && lng != null ? { latitude: lat, longitude: lng } : null;
  const gpsLat = num(query.gps_latitude);
  const gpsLng = num(query.gps_longitude);
  const gps = gpsLat != null && gpsLng != null && query.gps_timestamp
    ? { latitude: gpsLat, longitude: gpsLng, timestamp: String(query.gps_timestamp) }
    : null;
  const viewer = await loadViewer(user, { point, gps });

  const asked = String(query.kinds || '').split(',').map((k) => k.trim()).filter((k) => rules.KINDS.includes(k));
  let kinds = asked.length ? asked : rules.KINDS;
  if (!viewer.seesPlaydates) kinds = kinds.filter((k) => k !== 'playdate');
  // Only kinds this viewer can't see (kinds=playdate without a verified address): no pins, not every pin.
  if (kinds.length === 0) return [];
  const window = rules.WINDOWS.includes(query.window) ? query.window : 'week';

  // A little wider than the box: a plan the viewer is in shows at its exact place.
  const pad = 0.02;
  const rows = await planService.queryOpenPlansInBox({
    south: box.south - pad, north: box.north + pad, west: box.west - pad, east: box.east + pad,
  }, { kinds, scopeAccess: viewer.scopeAccess });
  const candidates = rows
    .filter((plan) => planService.isVisibleTo(plan, viewer))
    .filter((plan) => planService.windowMatches(plan, window));
  const ctx = await planService.loadCardContext(candidates, viewer);

  const pins = [];
  for (const plan of candidates) {
    const card = planService.buildCard(plan, viewer, ctx);
    const isIn = card.viewer.role === 'host' || card.viewer.role === 'guest';
    const shown = isIn ? planService.exactPoint(plan) : planService.areaPoint(plan);
    if (!inBox(shown, box)) continue;
    pins.push({
      layer_type: 'plan',
      id: card.id,
      kind: card.kind,
      latitude: shown.latitude,
      longitude: shown.longitude,
      precision: isIn ? 'exact' : card.area.precision,
      title: card.title,
      starts_at: card.starts_at,
      ends_at: card.ends_at,
      starts_on: card.starts_on,
      day_part: card.day_part,
      timezone: card.timezone,
      area_label: card.area.label,
      distance_band: card.distance_band,
      going_count: card.going_count,
      spots: card.spots,
      spots_left: card.spots_left,
      is_full: card.is_full,
      state: card.state,
      viewer_role: card.viewer.role,
      viewer_request_status: card.viewer.request_status,
    });
  }
  pins.sort((a, b) => String(a.starts_on).localeCompare(String(b.starts_on)) || String(a.id).localeCompare(String(b.id)));
  return pins.slice(0, MAX_PINS);
}

module.exports = { planPins };
