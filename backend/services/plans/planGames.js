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

/** Facts a host reviewed when a schedule-change card was drafted. */
function scheduleRevision(game) {
  return {
    id: game.id, team: game.team, status: game.status,
    starts_at: game.starts_at, ends_at: game.ends_at, time_tbd: Boolean(game.time_tbd),
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

/** Opt-in caller only. The legacy route and hand-list helpers above stay unchanged. */
async function upcomingGamesForTeams(teamIds, now = Date.now()) {
  const schedule = require('../sports/schedule');
  const { teamById } = require('./planTeams');
  const teams = [...new Set((Array.isArray(teamIds) ? teamIds : []).map((id) => teamById(id)?.id).filter(Boolean))];
  const { games: provider, unavailableLeagues } = await schedule.gamesForTeams(teams, now);
  const fallback = upcomingGames(now).flatMap((game) => {
    const team = teamById(game.team);
    return team && teams.includes(team.id) && unavailableLeagues.includes(team.league)
      ? [{ ...game, team: team.id, opponent_team: require('../../data/sportsTeams').TEAMS.find((other) => other.league === team.league && other.label === game.opponent)?.id || null, league: team.league, neutral: false, time_tbd: false, status: 'scheduled', postseason: false }] : [];
  });
  const ranked = [...provider.filter((game) => schedule.isAvailable(game, now)), ...fallback]
    .sort((a, b) => teams.indexOf(a.team) - teams.indexOf(b.team) || Date.parse(a.starts_at) - Date.parse(b.starts_at));
  // A matchup between two selected teams appears once, in the preferred perspective.
  const seen = new Set();
  const ordered = ranked.filter((game) => !seen.has(game.id) && seen.add(game.id));
  return { games: ordered, attribution: ordered.some((game) => game.id.startsWith('tsdb:')) ? schedule.ATTRIBUTION : null };
}

function suggestedForViewer(viewer) {
  const { suggestedTeams } = require('./planTeams');
  const near = viewer.origin ? [...viewer.locations, viewer.origin] : viewer.locations;
  return suggestedTeams(near, (viewer.homes || []).map((home) => home.state));
}

/** Shared by the versioned route and opt-in AI surfaces. */
async function gamesForViewer(viewer, purpose = 'sheet', now = Date.now()) {
  const prefs = viewer.sports || {};
  const state = prefs.watch === 'off' ? 'off' : prefs.watch === 'on' ? 'on' : 'unset';
  const sports = { state, can_choose: true, attribution: null };
  if (state === 'off' || (purpose === 'sheet' && state === 'unset')) return { games: [], sports };
  const hidden = new Set(prefs.hidden || []);
  const followed = (prefs.teams || []).filter((id) => !hidden.has(id));
  const leagueTeams = purpose === 'sheet'
    ? require('../../data/sportsTeams').TEAMS.filter((team) => (prefs.leagues || []).includes(team.league)).map((team) => team.id) : [];
  const suggested = purpose === 'composer' ? suggestedForViewer(viewer).map((team) => team.id) : [];
  const ids = [...new Set([...followed, ...suggested, ...leagueTeams])].filter((id) => !hidden.has(id));
  const result = await upcomingGamesForTeams(ids, now);
  const games = result.games.filter((game) => !hidden.has(game.opponent_team))
    .filter((game) => purpose === 'composer' || followed.includes(game.team) || game.postseason)
    .map((game) => ({ ...game, followed: followed.includes(game.team) }))
    .sort((a, b) => Number(b.followed) - Number(a.followed) || Date.parse(a.starts_at) - Date.parse(b.starts_at));
  sports.attribution = games.some((game) => game.id.startsWith('tsdb:')) ? require('../sports/schedule').ATTRIBUTION : null;
  return { games, sports };
}

/** Resolve only server-held records. The caller has already checked the viewer's flag. */
async function resolveGame(id, team) {
  const manual = findGame(id);
  const { teamById } = require('./planTeams');
  if (manual) return { ...manual, team: teamById(manual.team)?.id || manual.team };
  const schedule = require('../sports/schedule');
  const game = await schedule.findCachedGame(id, team);
  if (!game || !schedule.isAvailable(game)) return null;
  return gameDetails(game);
}

async function repeatDetailsForViewer(kind, details, startsAtMillis, user) {
  if (!await require('../featureFlagService').isFeatureEnabled('plans_sports', user)) return repeatDetails(kind, details, startsAtMillis);
  const out = { ...(details || {}) };
  if (kind === 'watch_party' && out.game) {
    const team = (await resolveGame(out.game.id, out.game.team))?.team || out.game.team;
    const { games } = await upcomingGamesForTeams([team], startsAtMillis - REPEAT_WINDOW_MS);
    const next = games.filter((game) => Math.abs(Date.parse(game.starts_at) - startsAtMillis) <= REPEAT_WINDOW_MS)
      .sort((a, b) => Math.abs(Date.parse(a.starts_at) - startsAtMillis) - Math.abs(Date.parse(b.starts_at) - startsAtMillis))[0];
    if (next) out.game = gameDetails(next);
    else delete out.game;
  }
  return out;
}

module.exports = { gameDetails, scheduleRevision, upcomingGames, upcomingGamesForTeams, gamesForViewer, suggestedForViewer, resolveGame,
  findGame, nextGameForTeam, repeatDetails, repeatDetailsForViewer, FAN_RADIUS_METERS };
