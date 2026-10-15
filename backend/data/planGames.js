'use strict';

/**
 * Games for the watch-party composer (board H2): the Seahawks, Trail Blazers,
 * Timbers, Huskies, Ducks and Cougars, kept by hand from each team's official
 * schedule. A game is listed only once its start time is set on the official
 * schedule (TBD/TBA games stay out). `ends_at` is an estimate for a watch party:
 * NFL 3 h 15 min, NBA 2 h 30 min, MLS 2 h, college football 3 h 30 min.
 *
 * Checked 2026-10-14 against:
 *   Seahawks       https://www.seahawks.com/schedule/
 *                  (and https://www.nfl.com/schedules/2026/by-team/seattle-seahawks)
 *   Trail Blazers  https://www.nba.com/blazers/schedule
 *                  (and the NBA's league schedule, https://www.nba.com/schedule)
 *   Timbers        https://www.timbers.com/schedule/
 *                  (and the MLS match data behind it, https://stats-api.mlssoccer.com)
 *   Huskies        https://gohuskies.com/sports/football/schedule
 *   Ducks          https://goducks.com/sports/football/schedule
 *                  (Oct 17 time: https://goducks.com/news/2026/10/11/football-oregon-vs-nebraska-set-for-8-pm-on-fox)
 *   Cougars        https://wsucougars.com/sports/football/schedule
 *   College times also match each opponent's official schedule page.
 * The list covers games through Dec 31; check again before Dec 17 so the 14-day window
 * stays full, and weekly until then to catch flexed NFL times and add college games as
 * their kickoffs are set (usually 6 or 12 days ahead). Not listed for lack of a set time
 * (TBD at the last check): Ducks at Illinois (Oct 24: 12:00 or 12:30 PT, set Oct 18),
 * Ducks vs Northwestern (Oct 31), Ducks at Ohio State (Nov 7), Ducks vs Michigan (Nov 14),
 * Ducks vs Huskies (Nov 28), Huskies at Nebraska (Oct 31), Huskies vs Penn State (Nov 7),
 * Huskies at Michigan State (Nov 14), Huskies vs Indiana (Nov 21), Cougars vs Oregon
 * State (Nov 28), the two Blazers games the NBA adds after NBA Cup group play, Timbers
 * playoff games (from Nov 18, if they qualify), and conference title and bowl games.
 *
 * To add games: append rows with the official page as `source`, times in UTC (Pacific is
 * UTC-7 until Nov 1, 2026, then UTC-8 until Mar 14, 2027). GET /api/plans/games serves the
 * ones that start within 14 days and have at least 30 minutes left.
 */

const CHECKED_AT = '2026-10-14';

const GAMES = [
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
  { id: 'timbers-2026-10-28-stl', team: 'timbers', label: 'Timbers', opponent: 'St. Louis City SC', home: false,
    starts_at: '2026-10-29T00:30:00Z', ends_at: '2026-10-29T02:30:00Z', source: 'https://www.timbers.com/schedule/' },
  { id: 'blazers-2026-10-29-mem', team: 'trail_blazers', label: 'Blazers', opponent: 'Grizzlies', home: true,
    starts_at: '2026-10-30T02:00:00Z', ends_at: '2026-10-30T04:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-10-31-uta', team: 'trail_blazers', label: 'Blazers', opponent: 'Jazz', home: false,
    starts_at: '2026-10-31T19:00:00Z', ends_at: '2026-10-31T21:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'cougars-2026-10-31-sdsu', team: 'cougars', label: 'Cougars', opponent: 'San Diego State', home: false,
    starts_at: '2026-10-31T23:00:00Z', ends_at: '2026-11-01T02:30:00Z', source: 'https://wsucougars.com/sports/football/schedule' },
  { id: 'timbers-2026-11-01-hou', team: 'timbers', label: 'Timbers', opponent: 'Houston Dynamo', home: true,
    starts_at: '2026-11-02T02:45:00Z', ends_at: '2026-11-02T04:45:00Z', source: 'https://www.timbers.com/schedule/' },
  { id: 'seahawks-2026-11-02-chi', team: 'seahawks', label: 'Seahawks', opponent: 'Bears', home: true,
    starts_at: '2026-11-03T01:15:00Z', ends_at: '2026-11-03T04:30:00Z', source: 'https://www.seahawks.com/schedule/' },
  { id: 'blazers-2026-11-02-den', team: 'trail_blazers', label: 'Blazers', opponent: 'Nuggets', home: false,
    starts_at: '2026-11-03T02:00:00Z', ends_at: '2026-11-03T04:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-11-04-phx', team: 'trail_blazers', label: 'Blazers', opponent: 'Suns', home: false,
    starts_at: '2026-11-05T02:00:00Z', ends_at: '2026-11-05T04:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-11-06-lal', team: 'trail_blazers', label: 'Blazers', opponent: 'Lakers', home: false,
    starts_at: '2026-11-07T03:00:00Z', ends_at: '2026-11-07T05:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'timbers-2026-11-07-atx', team: 'timbers', label: 'Timbers', opponent: 'Austin FC', home: false,
    starts_at: '2026-11-08T00:00:00Z', ends_at: '2026-11-08T02:00:00Z', source: 'https://www.timbers.com/schedule/' },
  { id: 'blazers-2026-11-07-sas', team: 'trail_blazers', label: 'Blazers', opponent: 'Spurs', home: true,
    starts_at: '2026-11-08T03:00:00Z', ends_at: '2026-11-08T05:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'seahawks-2026-11-08-ari', team: 'seahawks', label: 'Seahawks', opponent: 'Cardinals', home: true,
    starts_at: '2026-11-08T21:25:00Z', ends_at: '2026-11-09T00:40:00Z', source: 'https://www.seahawks.com/schedule/' },
  { id: 'blazers-2026-11-10-okc', team: 'trail_blazers', label: 'Blazers', opponent: 'Thunder', home: true,
    starts_at: '2026-11-11T04:00:00Z', ends_at: '2026-11-11T06:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-11-11-okc', team: 'trail_blazers', label: 'Blazers', opponent: 'Thunder', home: true,
    starts_at: '2026-11-12T03:00:00Z', ends_at: '2026-11-12T05:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-11-13-sac', team: 'trail_blazers', label: 'Blazers', opponent: 'Kings', home: false,
    starts_at: '2026-11-14T03:00:00Z', ends_at: '2026-11-14T05:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'cougars-2026-11-14-csu', team: 'cougars', label: 'Cougars', opponent: 'Colorado State', home: true,
    starts_at: '2026-11-15T03:30:00Z', ends_at: '2026-11-15T07:00:00Z', source: 'https://wsucougars.com/sports/football/schedule' },
  { id: 'seahawks-2026-11-15-lv', team: 'seahawks', label: 'Seahawks', opponent: 'Raiders', home: false,
    starts_at: '2026-11-15T21:05:00Z', ends_at: '2026-11-16T00:20:00Z', source: 'https://www.seahawks.com/schedule/' },
  { id: 'blazers-2026-11-16-min', team: 'trail_blazers', label: 'Blazers', opponent: 'Timberwolves', home: false,
    starts_at: '2026-11-17T01:00:00Z', ends_at: '2026-11-17T03:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-11-17-min', team: 'trail_blazers', label: 'Blazers', opponent: 'Timberwolves', home: false,
    starts_at: '2026-11-18T01:00:00Z', ends_at: '2026-11-18T03:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-11-19-mil', team: 'trail_blazers', label: 'Blazers', opponent: 'Bucks', home: false,
    starts_at: '2026-11-20T01:00:00Z', ends_at: '2026-11-20T03:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'ducks-2026-11-20-msu', team: 'ducks', label: 'Ducks', opponent: 'Michigan State', home: false,
    starts_at: '2026-11-21T01:00:00Z', ends_at: '2026-11-21T04:30:00Z', source: 'https://goducks.com/sports/football/schedule' },
  { id: 'cougars-2026-11-21-txst', team: 'cougars', label: 'Cougars', opponent: 'Texas State', home: false,
    starts_at: '2026-11-21T23:00:00Z', ends_at: '2026-11-22T02:30:00Z', source: 'https://wsucougars.com/sports/football/schedule' },
  { id: 'blazers-2026-11-21-nyk', team: 'trail_blazers', label: 'Blazers', opponent: 'Knicks', home: false,
    starts_at: '2026-11-22T00:30:00Z', ends_at: '2026-11-22T03:00:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-11-23-phi', team: 'trail_blazers', label: 'Blazers', opponent: '76ers', home: false,
    starts_at: '2026-11-24T00:00:00Z', ends_at: '2026-11-24T02:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-11-25-sas', team: 'trail_blazers', label: 'Blazers', opponent: 'Spurs', home: true,
    starts_at: '2026-11-26T03:00:00Z', ends_at: '2026-11-26T05:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-11-27-gsw', team: 'trail_blazers', label: 'Blazers', opponent: 'Warriors', home: true,
    starts_at: '2026-11-28T02:30:00Z', ends_at: '2026-11-28T05:00:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'seahawks-2026-11-29-sf', team: 'seahawks', label: 'Seahawks', opponent: '49ers', home: false,
    starts_at: '2026-11-29T21:25:00Z', ends_at: '2026-11-30T00:40:00Z', source: 'https://www.seahawks.com/schedule/' },
  { id: 'blazers-2026-11-29-nop', team: 'trail_blazers', label: 'Blazers', opponent: 'Pelicans', home: true,
    starts_at: '2026-11-29T23:00:00Z', ends_at: '2026-11-30T01:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-12-01-min', team: 'trail_blazers', label: 'Blazers', opponent: 'Timberwolves', home: true,
    starts_at: '2026-12-02T03:00:00Z', ends_at: '2026-12-02T05:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-12-03-uta', team: 'trail_blazers', label: 'Blazers', opponent: 'Jazz', home: true,
    starts_at: '2026-12-04T03:00:00Z', ends_at: '2026-12-04T05:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'seahawks-2026-12-07-dal', team: 'seahawks', label: 'Seahawks', opponent: 'Cowboys', home: true,
    starts_at: '2026-12-08T01:15:00Z', ends_at: '2026-12-08T04:30:00Z', source: 'https://www.seahawks.com/schedule/' },
  { id: 'blazers-2026-12-12-atl', team: 'trail_blazers', label: 'Blazers', opponent: 'Hawks', home: true,
    starts_at: '2026-12-13T03:00:00Z', ends_at: '2026-12-13T05:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'seahawks-2026-12-13-nyg', team: 'seahawks', label: 'Seahawks', opponent: 'Giants', home: true,
    starts_at: '2026-12-13T21:25:00Z', ends_at: '2026-12-14T00:40:00Z', source: 'https://www.seahawks.com/schedule/' },
  { id: 'blazers-2026-12-15-den', team: 'trail_blazers', label: 'Blazers', opponent: 'Nuggets', home: true,
    starts_at: '2026-12-16T04:00:00Z', ends_at: '2026-12-16T06:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-12-17-ind', team: 'trail_blazers', label: 'Blazers', opponent: 'Pacers', home: false,
    starts_at: '2026-12-18T00:00:00Z', ends_at: '2026-12-18T02:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'seahawks-2026-12-19-phi', team: 'seahawks', label: 'Seahawks', opponent: 'Eagles', home: false,
    starts_at: '2026-12-19T22:00:00Z', ends_at: '2026-12-20T01:15:00Z', source: 'https://www.seahawks.com/schedule/' },
  { id: 'blazers-2026-12-19-cha', team: 'trail_blazers', label: 'Blazers', opponent: 'Hornets', home: false,
    starts_at: '2026-12-19T23:00:00Z', ends_at: '2026-12-20T01:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-12-21-bkn', team: 'trail_blazers', label: 'Blazers', opponent: 'Nets', home: false,
    starts_at: '2026-12-22T00:30:00Z', ends_at: '2026-12-22T03:00:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-12-23-bos', team: 'trail_blazers', label: 'Blazers', opponent: 'Celtics', home: false,
    starts_at: '2026-12-24T00:30:00Z', ends_at: '2026-12-24T03:00:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'seahawks-2026-12-25-lar', team: 'seahawks', label: 'Seahawks', opponent: 'Rams', home: true,
    starts_at: '2026-12-26T01:15:00Z', ends_at: '2026-12-26T04:30:00Z', source: 'https://www.seahawks.com/schedule/' },
  { id: 'blazers-2026-12-26-was', team: 'trail_blazers', label: 'Blazers', opponent: 'Wizards', home: false,
    starts_at: '2026-12-26T18:00:00Z', ends_at: '2026-12-26T20:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-12-27-det', team: 'trail_blazers', label: 'Blazers', opponent: 'Pistons', home: false,
    starts_at: '2026-12-28T00:00:00Z', ends_at: '2026-12-28T02:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
  { id: 'blazers-2026-12-29-bkn', team: 'trail_blazers', label: 'Blazers', opponent: 'Nets', home: true,
    starts_at: '2026-12-30T03:00:00Z', ends_at: '2026-12-30T05:30:00Z', source: 'https://www.nba.com/blazers/schedule' },
];

module.exports = { CHECKED_AT, GAMES };
