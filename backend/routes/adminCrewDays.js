/**
 * Crew Day operator API (docs/product/crew-day-build/02-contract.md §4, "Operator"): approving street days, problems
 * and street requests. Mounted before /api/admin so the `crew_day` gate answers first: every route answers 403
 * CREW_DAY_UNAVAILABLE while the key is unlisted, and needs a platform admin otherwise.
 */

const express = require('express');

const { requireCrewDay } = require('../services/crewDay/gate');

const router = express.Router();
router.use(requireCrewDay);

module.exports = router;
