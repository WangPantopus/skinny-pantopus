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
const REPEAT_WINDOW_MS = 3 * 60 * 60 * 1000;

/** Public game facts persisted with a watch party, always taken from our schedule. */
function gameDetails(game) {
  return {
    id: game.id,
    label: game.label,
    team: game.team,
    opponent: game.opponent || null,
    home: Boolean(game.home),
    starts_at: new Date(game.starts_at).toISOString(),
    ends_at: new Date(game.ends_at).toISOString(),
  };
}

function findGame(id) {
  if (typeof id !== 'string' || id.length > 80) return null;
  const game = GAMES.find((candidate) => candidate.id === id);
  return game ? gameDetails(game) : null;
}

function nextGameForTeam(team, aroundMillis, windowMillis = REPEAT_WINDOW_MS) {
  if (!team || !Number.isFinite(aroundMillis) || !Number.isFinite(windowMillis) || windowMillis < 0) return null;
  const game = GAMES.filter((candidate) => candidate.team === team
    && Math.abs(Date.parse(candidate.starts_at) - aroundMillis) <= windowMillis)
    .sort((a, b) => Math.abs(Date.parse(a.starts_at) - aroundMillis) - Math.abs(Date.parse(b.starts_at) - aroundMillis))[0];
  return game ? gameDetails(game) : null;
}

/** Repeating a party never invents a fixture or carries last week's game forward. */
function repeatDetails(kind, details, startsAtMillis) {
  const out = { ...(details || {}) };
  if (kind === 'watch_party' && out.game) {
    const team = findGame(out.game.id)?.team || out.game.team;
    const next = nextGameForTeam(team, startsAtMillis);
    if (next) out.game = next;
    else delete out.game;
  }
  return out;
}

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

module.exports = { upcomingGames, findGame, nextGameForTeam, repeatDetails, FAN_RADIUS_METERS };
