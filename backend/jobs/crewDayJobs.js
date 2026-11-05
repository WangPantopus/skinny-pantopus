'use strict';

// Crew Day jobs (docs/product/crew-day-build/02-contract.md §7). Each skips while the `crew_day` key is unlisted.

const money = require('../services/crewDay/money');
const schedule = require('../services/crewDay/schedule');

async function crewDayCharges() {
  return money.runCharges();
}

async function crewDayReminders() {
  return schedule.runReminders();
}

async function crewDayDeadlines() {
  return schedule.runDeadlines();
}

module.exports = { crewDayCharges, crewDayReminders, crewDayDeadlines };
