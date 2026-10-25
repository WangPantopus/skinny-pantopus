'use strict';

const { TEAMS, ALIASES, STATE_NAMES } = require('../../data/sportsTeams');
const { haversineMeters } = require('../../utils/geo');

const PRO_NEAREST_MAX_MILES = 600;
const PRO_EXTRA_MIN_MILES = 100;
const PRO_EXTRA_FACTOR = 1.25;
const COLLEGE_MILES = 150;
const METERS_PER_MILE = 1609.344;
const LEAGUES = Object.freeze(['nfl', 'nba', 'wnba', 'mlb', 'nhl', 'mls', 'nwsl', 'ncaaf']);
const byId = new Map(TEAMS.map((team) => [team.id, team]));

function teamById(id) {
  return typeof id === 'string' ? byId.get(ALIASES[id] || id) || null : null;
}

function searchable(value) {
  return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** All words match somewhere in the name, nickname, city, state or known former name. */
function searchTeams(q) {
  const words = searchable(q).split(' ').filter(Boolean);
  if (!words.length) return [];
  return TEAMS.filter((team) => {
    const haystack = searchable([team.name, team.label, team.city, team.state, STATE_NAMES[team.state], team.cfbd, ...(team.aliases || [])].join(' '));
    return words.every((word) => haystack.includes(word));
  });
}

function point(place) {
  const values = [place?.latitude, place?.longitude];
  if (!values.every((value) => typeof value === 'number' || (typeof value === 'string' && value.trim()))) return null;
  const [latitude, longitude] = values.map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** Union the approved local fan markets for every home, saved place and fresh fix. */
function suggestedTeams(places = [], states = []) {
  const points = (Array.isArray(places) ? places : []).map(point).filter(Boolean);
  const homeStates = new Set((Array.isArray(states) ? states : []).map((state) => {
    const value = String(state || '').trim();
    return Object.keys(STATE_NAMES).find((key) => STATE_NAMES[key].toLowerCase() === value.toLowerCase()) || value.toUpperCase();
  }));
  const selected = new Set(TEAMS.filter((team) => team.league === 'ncaaf' && homeStates.has(team.state)).map((team) => team.id));
  for (const place of points) {
    const distances = TEAMS.map((team) => ({ team, miles: haversineMeters(place.latitude, place.longitude, team.latitude, team.longitude) / METERS_PER_MILE }));
    for (const league of LEAGUES) {
      const nearby = distances.filter(({ team }) => team.league === league).sort((a, b) => a.miles - b.miles);
      if (league === 'ncaaf') {
        for (const { team, miles } of nearby) if (miles <= COLLEGE_MILES) selected.add(team.id);
      } else if (nearby[0]?.miles <= PRO_NEAREST_MAX_MILES) {
        const radius = Math.max(PRO_EXTRA_MIN_MILES, PRO_EXTRA_FACTOR * nearby[0].miles);
        for (const { team, miles } of nearby) if (miles <= radius) selected.add(team.id);
      }
    }
  }
  return TEAMS.filter((team) => selected.has(team.id));
}

/** Partial sports updates preserve unrelated choices. A changed list wins over the old opposite list. */
function mergeSports(current, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Sports preferences must be an object.');
  const out = { ...(current || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'watch') {
      if (!['on', 'off'].includes(value)) throw new Error('Choose on or off for sports.');
      out.watch = value;
    } else if (['teams', 'hidden', 'leagues'].includes(key)) {
      const limit = key === 'leagues' ? LEAGUES.length : 40;
      if (!Array.isArray(value) || value.length > limit || value.some((id) => typeof id !== 'string'
        || (key === 'leagues' ? !LEAGUES.includes(id) : teamById(id)?.id !== id))) {
        throw new Error(`Choose up to ${limit} known ${key === 'leagues' ? 'leagues' : 'teams'}.`);
      }
      out[key] = [...new Set(value)];
      if (key === 'teams' || key === 'hidden') {
        const opposite = key === 'teams' ? 'hidden' : 'teams';
        out[opposite] = (out[opposite] || []).filter((id) => !out[key].includes(id));
      }
    } else throw new Error('Unknown sports preference.');
  }
  return out;
}

function publicTeam(team) {
  return { id: team.id, name: team.name, label: team.label, league: team.league, city: team.city, state: team.state };
}

module.exports = { suggestedTeams, searchTeams, teamById, mergeSports, publicTeam, LEAGUES, PRO_NEAREST_MAX_MILES, PRO_EXTRA_MIN_MILES, PRO_EXTRA_FACTOR, COLLEGE_MILES };
