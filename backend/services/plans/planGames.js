'use strict';

/**
 * GET /api/plans/games: upcoming games from the checked list in data/planGames.js.
 * Only games that haven't ended and start within the next 14 days. Empty is fine:
 * the composer then shows only "Another game".
 */

const { GAMES } = require('../../data/planGames');

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function upcomingGames(now = Date.now()) {
  return GAMES
    .filter((game) => {
      const start = Date.parse(game.starts_at);
      const end = Date.parse(game.ends_at);
      return Number.isFinite(start) && Number.isFinite(end) && end > now && start <= now + WINDOW_MS;
    })
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

module.exports = { upcomingGames };
