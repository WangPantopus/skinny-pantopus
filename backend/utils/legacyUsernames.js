/**
 * Until October 7, 2026 a new account's made-up username was the first part of its email address plus six hex
 * characters (jane.doe@… became janedoe_ab12cd). Accounts made then still have one unless they chose a new one, and
 * it shows the start of their email address. Only each account's own email tells it apart from a chosen username,
 * and other people's rows rarely carry an email address, so this loads the list of those still in use into
 * utils/personalUsername.js, where every name and handle check treats them like user_…. No new ones are ever made, so
 * the list only shrinks; a refresh every ten minutes keeps each server instance close enough.
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('./logger');
const { isEmailDerivedUsername, setLegacyMadeUpUsernames } = require('./personalUsername');

const PAGE_SIZE = 1000;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

let refreshTimer = null;

async function refreshLegacyMadeUpUsernames() {
  const found = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    // Only rows ending in _ plus six hex characters can be one; the email check decides.
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await supabaseAdmin
      .from('User')
      .select('id, username, email')
      .filter('username', 'match', '_[0-9a-f]{6}$')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message || 'legacy username read failed');
    for (const row of data || []) {
      if (isEmailDerivedUsername(row.username, row.email)) found.push(row.username);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  setLegacyMadeUpUsernames(found);
  return found.length;
}

function startLegacyUsernameRefresh(intervalMs = REFRESH_INTERVAL_MS) {
  if (refreshTimer) return refreshTimer;

  refreshLegacyMadeUpUsernames().catch((err) => {
    logger.warn('legacyUsernames: initial refresh failed', { error: err.message });
  });

  refreshTimer = setInterval(() => {
    refreshLegacyMadeUpUsernames().catch((err) => {
      logger.warn('legacyUsernames: refresh failed', { error: err.message });
    });
  }, intervalMs);

  // Never hold the process open for this.
  if (typeof refreshTimer.unref === 'function') refreshTimer.unref();

  return refreshTimer;
}

function stopLegacyUsernameRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

module.exports = {
  refreshLegacyMadeUpUsernames,
  startLegacyUsernameRefresh,
  stopLegacyUsernameRefresh,
};
