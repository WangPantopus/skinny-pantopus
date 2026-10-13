'use strict';

/**
 * Games for the watch-party composer (board H2): the Seahawks, Trail Blazers,
 * Timbers, Huskies, Ducks and Cougars, kept by hand from each team's official
 * schedule. A game is listed only once its start time is set on the official
 * schedule (TBD/TBA games stay out). `ends_at` is an estimate for a watch party:
 * NFL 3 h 15 min, NBA 2 h 30 min, MLS 2 h, college football 3 h 30 min.
 *
 * Checked 2026-10-13 against:
 *   Seahawks       https://www.seahawks.com/schedule/
 *   Trail Blazers  https://www.nba.com/blazers/schedule
 *   Timbers        https://www.timbers.com/schedule/
 *   Huskies        https://gohuskies.com/sports/football/schedule
 *   Ducks          https://goducks.com/sports/football/schedule
 *                  (Oct 17 time: https://goducks.com/news/2026/10/11/football-oregon-vs-nebraska-set-for-8-pm-on-fox)
 *   Cougars        https://wsucougars.com/sports/football/schedule
 * Not listed for lack of a set time: Ducks at Illinois (Oct 24, TBD).
 *
 * To add games: append rows with the official page as `source`, times in UTC.
 * GET /api/plans/games serves the ones that haven't ended and start within 14 days.
 */

const CHECKED_AT = '2026-10-13';

const GAMES = [
  { id: 'blazers-2026-10-13-sac', team: 'trail_blazers', label: 'Blazers', opponent: 'Kings', home: false, preseason: true,
    starts_at: '2026-10-14T02:00:00Z', ends_at: '2026-10-14T04:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'timbers-2026-10-14-lag', team: 'timbers', label: 'Timbers', opponent: 'LA Galaxy', home: false,
    starts_at: '2026-10-15T02:30:00Z', ends_at: '2026-10-15T04:30:00Z', source: 'https://www.timbers.com/schedule/' },
  { id: 'seahawks-2026-10-15-den', team: 'seahawks', label: 'Seahawks', opponent: 'Broncos', home: false,
    starts_at: '2026-10-16T00:15:00Z', ends_at: '2026-10-16T03:30:00Z', source: 'https://www.seahawks.com/schedule/' },
  { id: 'huskies-2026-10-16-pur', team: 'huskies', label: 'Huskies', opponent: 'Purdue', home: false,
    starts_at: '2026-10-17T00:00:00Z', ends_at: '2026-10-17T03:30:00Z', source: 'https://gohuskies.com/sports/football/schedule' },
  { id: 'blazers-2026-10-16-gsw', team: 'trail_blazers', label: 'Blazers', opponent: 'Warriors', home: false, preseason: true,
    starts_at: '2026-10-17T02:00:00Z', ends_at: '2026-10-17T04:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'cougars-2026-10-17-osu', team: 'cougars', label: 'Cougars', opponent: 'Oregon State', home: false,
    starts_at: '2026-10-17T22:00:00Z', ends_at: '2026-10-18T01:30:00Z', source: 'https://wsucougars.com/sports/football/schedule' },
  { id: 'timbers-2026-10-17-col', team: 'timbers', label: 'Timbers', opponent: 'Rapids', home: true,
    starts_at: '2026-10-18T02:30:00Z', ends_at: '2026-10-18T04:30:00Z', source: 'https://www.timbers.com/schedule/' },
  { id: 'ducks-2026-10-17-neb', team: 'ducks', label: 'Ducks', opponent: 'Nebraska', home: true,
    starts_at: '2026-10-18T03:00:00Z', ends_at: '2026-10-18T06:30:00Z', source: 'https://goducks.com/news/2026/10/11/football-oregon-vs-nebraska-set-for-8-pm-on-fox' },
  { id: 'blazers-2026-10-21-phx', team: 'trail_blazers', label: 'Blazers', opponent: 'Suns', home: true,
    starts_at: '2026-10-22T02:00:00Z', ends_at: '2026-10-22T04:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-10-23-sac', team: 'trail_blazers', label: 'Blazers', opponent: 'Kings', home: false,
    starts_at: '2026-10-24T02:00:00Z', ends_at: '2026-10-24T04:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'cougars-2026-10-24-bsu', team: 'cougars', label: 'Cougars', opponent: 'Boise State', home: true,
    starts_at: '2026-10-24T22:00:00Z', ends_at: '2026-10-25T01:30:00Z', source: 'https://wsucougars.com/sports/football/schedule' },
  { id: 'timbers-2026-10-24-clt', team: 'timbers', label: 'Timbers', opponent: 'Charlotte FC', home: true,
    starts_at: '2026-10-25T02:30:00Z', ends_at: '2026-10-25T04:30:00Z', source: 'https://www.timbers.com/schedule/' },
  { id: 'seahawks-2026-10-25-kc', team: 'seahawks', label: 'Seahawks', opponent: 'Chiefs', home: true,
    starts_at: '2026-10-26T00:20:00Z', ends_at: '2026-10-26T03:35:00Z', source: 'https://www.seahawks.com/schedule/' },
  { id: 'blazers-2026-10-27-lal', team: 'trail_blazers', label: 'Blazers', opponent: 'Lakers', home: false,
    starts_at: '2026-10-28T03:00:00Z', ends_at: '2026-10-28T05:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
];

module.exports = { CHECKED_AT, GAMES };
