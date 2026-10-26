'use strict';

// Documented /games contract: https://github.com/CFBD/cfbd-python/blob/main/docs/GamesApi.md
async function seasonGames(year) {
  const key = process.env.CFBD_API_KEY;
  if (!key) throw new Error('College football schedule unavailable');
  try {
    const seasons = await Promise.all(['fbs', 'fcs'].map(async (classification) => {
      const url = new URL('https://api.collegefootballdata.com/games');
      url.search = new URLSearchParams({ year: String(year), classification, seasonType: 'both' }).toString();
      const response = await fetch(url, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${key}`, 'User-Agent': 'Pantopus/1.0 (sports schedules)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Provider request failed');
      const games = await response.json();
      if (!Array.isArray(games)) throw new Error('Invalid schedule');
      return games;
    }));
    return [...new Map(seasons.flat()
      .filter((game) => game && typeof game === 'object')
      .map((game) => [game.id, game])).values()];
  } catch (error) {
    const safe = new Error('College football schedule unavailable');
    if (error.name === 'TimeoutError' || error.name === 'AbortError') safe.name = error.name;
    throw safe;
  }
}

module.exports = { seasonGames };
