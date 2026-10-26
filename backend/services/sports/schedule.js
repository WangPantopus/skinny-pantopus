'use strict';

const { TEAMS } = require('../../data/sportsTeams');
const { teamById } = require('../plans/planTeams');
const cache = require('../placeSectionCache');
const tsdb = require('./theSportsDb');
const cfbd = require('./collegeFootballData');
const logger = require('../../utils/logger');

const TTL_MS = 6 * 60 * 60 * 1000;
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MINUTES = Object.freeze({ nfl: 195, nba: 150, wnba: 150, mlb: 180, nhl: 165, mls: 120, nwsl: 120, ncaaf: 210 });
const ATTRIBUTION = 'Game times: TheSportsDB';
const inFlight = new Map();
const unmatched = new Set();
const normalizeName = (name) => String(name || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function matchTeam(league, providerId, name) {
  const teams = TEAMS.filter((team) => team.league === league);
  const token = normalizeName(name);
  const match = teams.find((team) => providerId && team.tsdb && String(team.tsdb) === String(providerId))
    || teams.find((team) => token && [team.name, team.label, team.cfbd, ...(team.aliases || [])].some((alias) => normalizeName(alias) === token));
  if (!match && name && !unmatched.has(`${league}:${token}`)) {
    unmatched.add(`${league}:${token}`);
    // Public team names only, bounded; never log a provider response or credential.
    logger.warn('Sports schedule team unmatched', { league, team: String(name).replace(/[\r\n]/g, ' ').slice(0, 100) });
  }
  return match || null;
}

function gameStatus(value, completed = false) {
  const text = String(value || '').toLowerCase();
  if (/cancel|abandon/.test(text)) return 'cancelled';
  if (/postpon|suspend/.test(text)) return 'postponed';
  if (completed || /^(ft|aet|ap|finished|final|completed)$/.test(text)) return 'completed';
  return 'scheduled';
}

// Provider dates without a timezone are UTC in TheSportsDB, never server-local time.
function utcTime(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = /(?:z|[+-]\d\d:\d\d)$/i.test(value) ? value : `${value}Z`;
  const millis = Date.parse(time);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

function perspectives(league, event) {
  const home = matchTeam(league, event.homeId, event.homeName);
  const away = matchTeam(league, event.awayId, event.awayName);
  return [[home, away, event.awayName, true], [away, home, event.homeName, false]].flatMap(([team, opponent, otherName, isHome]) => {
    if (!team) return [];
    return [{
      id: event.id, team: team.id, label: team.label, opponent: opponent?.label || String(otherName || '').slice(0, 100),
      home: isHome, neutral: event.neutral, starts_at: event.start,
      ends_at: event.start ? new Date(Date.parse(event.start) + MINUTES[league] * 60000).toISOString() : null,
      time_tbd: event.tbd || !event.start, status: event.status, source: team.schedule_url,
      league, postseason: event.postseason, preseason: event.preseason || false,
    }];
  });
}

function normalizeSportsDb(league, events) {
  return events.flatMap((event) => {
    if (!/^\d+$/.test(String(event.idEvent || ''))) return [];
    const explicitTbd = /^(yes|true|1)$/i.test(String(event.strTimeTBD || ''));
    const start = utcTime(event.strTimestamp) || (event.dateEvent && event.strTime ? utcTime(`${event.dateEvent}T${event.strTime}`) : null);
    const round = [event.strSeasonType, event.strRound, event.strEvent].filter(Boolean).join(' ');
    return perspectives(league, {
      id: `tsdb:${event.idEvent}`, homeId: event.idHomeTeam, awayId: event.idAwayTeam,
      homeName: event.strHomeTeam, awayName: event.strAwayTeam, start,
      tbd: explicitTbd || !start, neutral: /^(yes|true|1)$/i.test(String(event.strNeutral || '')),
      status: gameStatus(event.strStatus), preseason: /pre.?season|friendly/i.test(round),
      postseason: /post.?season|play.?off|championship|super bowl|world series|stanley cup|(?:^|\s)finals?(?:\s|$)/i.test(round),
    });
  });
}

function normalizeCollege(events) {
  return events.flatMap((event) => {
    if (!/^\d+$/.test(String(event.id || ''))) return [];
    return perspectives('ncaaf', {
      id: `cfbd:${event.id}`, homeName: event.homeTeam, awayName: event.awayTeam,
      start: utcTime(event.startDate), tbd: event.startTimeTBD !== false, neutral: event.neutralSite === true,
      status: gameStatus(event.status || event.notes, event.completed),
      postseason: event.seasonType === 'postseason' || event.playoff === true,
    });
  });
}

function seasonsFor(league, now) {
  const dates = [new Date(now), new Date(now + WINDOW_MS)];
  return [...new Set(dates.map((date) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    if (league === 'nba' || league === 'nhl') {
      const start = month < 7 ? year - 1 : year;
      return `${start}-${start + 1}`;
    }
    if (league === 'nfl' || league === 'ncaaf') return String(month < 3 ? year - 1 : year);
    return String(year);
  }))];
}

async function leagueSeason(league, season) {
  if (!MINUTES[league]) throw new Error('Unknown sports league');
  const cacheKey = `league:${league}:${season}`;
  if (!inFlight.has(cacheKey)) {
    const request = cache.readThrough({ cacheKey, sectionId: 'sports_schedule', ttlMs: TTL_MS, fetch: async () => {
      const games = league === 'ncaaf'
        ? normalizeCollege(await cfbd.seasonGames(season))
        : normalizeSportsDb(league, await tsdb.seasonGames(league, season));
      return { games };
    } }).then(({ payload }) => {
      if (!Array.isArray(payload?.games)) throw new Error('Sports schedule unavailable');
      return payload.games;
    }).finally(() => inFlight.delete(cacheKey));
    inFlight.set(cacheKey, request);
  }
  return inFlight.get(cacheKey);
}

function isAvailable(game, now = Date.now()) {
  return !game.time_tbd && game.status === 'scheduled' && Date.parse(game.ends_at) - 30 * 60000 > now
    && Date.parse(game.starts_at) <= now + WINDOW_MS;
}

/** Retain moved/cancelled records for host checks, but never offer them as chips. */
async function gamesForTeams(teamIds, now = Date.now()) {
  const teams = [...new Set(teamIds)].map(teamById).filter(Boolean);
  const leagues = [...new Set(teams.map((team) => team.league))];
  const results = await Promise.all(leagues.map(async (league) => {
    const seasons = await Promise.all(seasonsFor(league, now).map(async (season) => {
      try { return { games: await leagueSeason(league, season), available: true }; }
      catch { return { games: [], available: false }; }
    }));
    return { league, games: seasons.flatMap((item) => item.games), available: seasons.every((item) => item.available) };
  }));
  const ids = new Set(teams.map((team) => team.id));
  return { games: results.flatMap((result) => result.games).filter((game) => ids.has(game.team)),
    unavailableLeagues: results.filter((result) => !result.available).map((result) => result.league) };
}

module.exports = { gamesForTeams, leagueSeason, seasonsFor, isAvailable, ATTRIBUTION };
