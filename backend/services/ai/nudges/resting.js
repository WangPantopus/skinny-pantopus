'use strict';

/**
 * Who the nudge engine just turned away, per kind: Suggestions off, "Fewer like this", the
 * day's cap or the budget. The Plans and Nearby triggers skip them for a while instead of
 * reading forecasts and drafting cards every tick only to hear no again. In memory only: a
 * restart or another server simply asks the engine again.
 */

const RESTING_MS = 30 * 60 * 1000;
const RESTING_REASONS = new Set(['off', 'muted', 'cap', 'budget']);
const resting = new Map();

function isResting(userId, kind, now = Date.now()) {
  const until = resting.get(`${userId}:${kind}`);
  if (until && until <= now) resting.delete(`${userId}:${kind}`);
  return Boolean(until && until > now);
}

/** Remember an engine answer that will be the same for a while. */
function noteResult(userId, kind, result, now = Date.now()) {
  if (result && !result.sent && RESTING_REASONS.has(result.reason)) resting.set(`${userId}:${kind}`, now + RESTING_MS);
}

module.exports = { isResting, noteResult, RESTING_MS };
