'use strict';

// Crew Day jobs (docs/product/crew-day-build/02-contract.md §7). Each skips while the `crew_day` key is unlisted.

const money = require('../services/crewDay/money');

async function crewDayCharges() {
  return money.runCharges();
}

module.exports = { crewDayCharges };
