/**
 * Sports topic lane — read-only event registry.
 *
 * Phase 1 exposes a single plural endpoint so the mobile UI can render a
 * dynamic chip label for the active event (e.g. "NBA Playoffs", "World Cup")
 * without hard-coding anything. The list shape is preserved from day one so
 * we don't have to migrate clients when a second event (NHL, WNBA,
 * Champions League) becomes active alongside NBA.
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const feedService = require('../services/feedService');
const logger = require('../utils/logger');

/**
 * GET /api/sports/active-events
 * Response:
 *   {
 *     primaryEvent: ActiveEvent | null,
 *     events: ActiveEvent[],
 *   }
 * where ActiveEvent = { event_key, display_name, short_label, league, country,
 *                       starts_at, ends_at, priority, cadence }.
 */
router.get('/active-events', verifyToken, async (_req, res) => {
  try {
    const events = await feedService.getActiveSportsEvents();
    const primaryEvent = events.length > 0 ? events[0] : null;
    return res.json({ primaryEvent, events });
  } catch (err) {
    logger.error('Failed to load active sports events', { error: err.message });
    return res.status(500).json({ error: 'Failed to load active sports events' });
  }
});

module.exports = router;
