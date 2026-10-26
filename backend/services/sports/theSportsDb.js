'use strict';

// Documented v1 season endpoint: https://www.thesportsdb.com/documentation
const LEAGUE_IDS = Object.freeze({ nfl: 4391, nba: 4387, wnba: 4516, mlb: 4424, nhl: 4380, mls: 4346, nwsl: 4521 });

async function seasonGames(league, season) {
  const key = process.env.THESPORTSDB_API_KEY;
  if (!key || !LEAGUE_IDS[league]) throw new Error('Sports schedule unavailable');
  const url = new URL(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key)}/eventsseason.php`);
  url.searchParams.set('id', LEAGUE_IDS[league]);
  url.searchParams.set('s', season);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Pantopus/1.0 (sports schedules)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Provider request failed');
    const data = await response.json();
    if (!Object.hasOwn(data, 'events') || (data.events !== null && !Array.isArray(data.events))) throw new Error('Invalid schedule');
    return data.events || [];
  } catch (error) {
    // URLs contain the credential. Never propagate fetch errors, bodies or URLs.
    const safe = new Error('TheSportsDB schedule unavailable');
    if (error.name === 'TimeoutError' || error.name === 'AbortError') safe.name = error.name;
    throw safe;
  }
}

module.exports = { seasonGames, LEAGUE_IDS };
