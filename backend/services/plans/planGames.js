'use strict';

/**
 * GET /api/plans/games: upcoming games from the checked list in data/planGames.js.
 * Games that start within the next 14 days and still have at least 30 minutes to go
 * (a game already on can still get a watch party; one about to end can't), for teams
 * whose home venue is within FAN_RADIUS of one of the viewer's places. The list holds
 * Seattle, Portland, Eugene and Pullman teams, so someone in Miami — or with no place
 * at all — gets none. Empty is fine: the composer then shows only "Another game".
 */

const { GAMES, TEAMS } = require('../../data/planGames');
const { haversineMeters } = require('../../utils/geo');

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MIN_LEFT_MS = 30 * 60 * 1000;
// About a regional fan market: Camas to Pullman is ~270 miles, Boise to Seattle ~400.
const FAN_RADIUS_METERS = 300 * 1609.344;

function nearTeam(team, places) {
  const venue = TEAMS[team];
  if (!venue) return false;
  return places.some((place) => {
    const lat = Number(place && place.latitude);
    const lng = Number(place && place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return haversineMeters(lat, lng, venue.latitude, venue.longitude) <= FAN_RADIUS_METERS;
  });
}

/**
 * @param {number} [now]
 * @param {{ near?: Array<{ latitude: number, longitude: number }> }} [opts] the viewer's
 *   places. Without `near` (the weekly list check) every upcoming game is returned.
 */
function upcomingGames(now = Date.now(), { near } = {}) {
  const places = Array.isArray(near) ? near : null;
  return GAMES
    .filter((game) => {
      const start = Date.parse(game.starts_at);
      const end = Date.parse(game.ends_at);
      return Number.isFinite(start) && Number.isFinite(end) && end - MIN_LEFT_MS > now && start <= now + WINDOW_MS;
    })
    .filter((game) => !places || nearTeam(game.team, places))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .map((game) => ({
      id: game.id,
      label: game.label,
      team: game.team,
      opponent: game.opponent || null,
      home: Boolean(game.home),
      preseason: Boolean(game.preseason),
      starts_at: new Date(game.starts_at).toISOString(),
      ends_at: new Date(game.ends_at).toISOString(),
      source: game.source,
    }));
}

module.exports = { upcomingGames, FAN_RADIUS_METERS };
