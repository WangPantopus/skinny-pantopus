/**
 * Crew Day API (docs/product/crew-day-build/02-contract.md §4): the public invitation, households' bookings and the
 * crew's street days. Every route answers 403 CREW_DAY_UNAVAILABLE while the `crew_day` key is unlisted. Errors are
 * `{ error: <sentence for people>, code: <CODE> }`.
 */

const express = require('express');

const { requireCrewDay } = require('../services/crewDay/gate');

const router = express.Router();
router.use(requireCrewDay);

module.exports = router;
