'use strict';

const { isLaunchFeatureEnabled } = require('../../utils/featureFlags');

// Crew Day is behind the launch-cut key `crew_day` (docs/product/crew-day-build/02-contract.md §1). While it is
// unlisted, every Crew Day route, the public ones included, answers this before any sign-in check, so the routes
// look the same to everyone.
function requireCrewDay(_req, res, next) {
  if (isLaunchFeatureEnabled('crew_day')) return next();
  return res.status(403).json({ error: "Crew Day isn't available.", code: 'CREW_DAY_UNAVAILABLE' });
}

module.exports = { requireCrewDay };
