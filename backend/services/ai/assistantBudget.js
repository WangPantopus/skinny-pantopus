/**
 * Limits on the chat assistant that hold across restarts and servers: an off
 * switch, a daily number of turns per person, and a daily number of turns for
 * everyone (the spending cap). Counts come from AIRequestLog, which every turn
 * already writes, so no new table.
 *
 *   AI_ASSISTANT=off              turns the assistant off (answers AI_DISABLED)
 *   AI_PERSON_DAILY_TURNS=120     turns one person may take in 24 hours
 *   AI_GLOBAL_DAILY_TURNS=4000    turns everyone together may take since midnight UTC
 *
 * A count that can't be read lets the turn through: the in-process rate limiter
 * still applies, and an outage of the log must not take the assistant down.
 *
 * Model calls nobody is waiting for (the morning brief, a nudge's draft or judgment,
 * lost-and-found matching) have their own caps, counted from their own endpoint
 * names (brief, nudge:<kind>, document, lostfound); see background.js:
 *
 *   AI_BACKGROUND_DAILY_CALLS=3000  background calls everyone together may make since midnight UTC
 *   6 background calls per person in 24 hours
 *
 * AI_ASSISTANT=off stops them too. A count that can't be read skips the call:
 * nobody is waiting for it, and the job sends its plain-text version or nothing.
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

const DISABLED = { error: 'AI_DISABLED', message: 'Pantopus AI is paused right now. Please try again later.' };
const PERSON_LIMIT = { error: 'AI_BUDGET', message: 'Pantopus AI has done a lot for you today. Try again tomorrow.' };
const GLOBAL_LIMIT = { error: 'AI_BUDGET', message: 'Pantopus AI has done a lot today. Try again tomorrow.' };
const GLOBAL_MEMO_MS = 60_000;

let globalMemo = { count: 0, until: 0 };

function positiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isDisabled() {
  const value = String(process.env.AI_ASSISTANT || '').trim().toLowerCase();
  return ['off', 'false', '0', 'disabled'].includes(value);
}

async function personTurns(userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin.from('AIRequestLog')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('endpoint', 'chat')
    .gte('created_at', since);
  if (error) throw new Error(error.message);
  return count || 0;
}

async function globalTurns() {
  if (globalMemo.until > Date.now()) return globalMemo.count;
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabaseAdmin.from('AIRequestLog')
    .select('id', { count: 'exact', head: true })
    .eq('endpoint', 'chat')
    .gte('created_at', midnight.toISOString());
  if (error) throw new Error(error.message);
  globalMemo = { count: count || 0, until: Date.now() + GLOBAL_MEMO_MS };
  return globalMemo.count;
}

/**
 * Whether this person may start a chat turn now.
 * @returns {Promise<null|{error: string, message: string}>} null to go ahead, else the error to send.
 */
async function checkChatBudget(userId) {
  if (isDisabled()) return DISABLED;
  try {
    const [mine, everyone] = await Promise.all([personTurns(userId), globalTurns()]);
    if (mine >= positiveInt(process.env.AI_PERSON_DAILY_TURNS, 120)) return PERSON_LIMIT;
    if (everyone >= positiveInt(process.env.AI_GLOBAL_DAILY_TURNS, 4000)) return GLOBAL_LIMIT;
  } catch (err) {
    logger.warn('AI budget check failed; letting the turn through', { userId, error: err.message });
  }
  return null;
}

// ─── Background calls ───────────────────────────────────────────────────────

const BACKGROUND_PERSON_DAILY_CALLS = 6;
// The endpoint names background calls log under; nudges log as nudge:<kind>.
const BACKGROUND_ENDPOINTS = ['brief', 'document', 'lostfound'];
const backgroundCalls = (query) => query.or(`endpoint.in.(${BACKGROUND_ENDPOINTS.join(',')}),endpoint.like."nudge:*"`);

let backgroundMemo = { count: 0, until: 0 };

async function personBackgroundCalls(userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await backgroundCalls(supabaseAdmin.from('AIRequestLog')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since));
  if (error) throw new Error(error.message);
  return count || 0;
}

async function globalBackgroundCalls() {
  if (backgroundMemo.until > Date.now()) return backgroundMemo.count;
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const { count, error } = await backgroundCalls(supabaseAdmin.from('AIRequestLog')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', midnight.toISOString()));
  if (error) throw new Error(error.message);
  backgroundMemo = { count: count || 0, until: Date.now() + GLOBAL_MEMO_MS };
  return backgroundMemo.count;
}

/**
 * Whether a background model call for this person (or for no one in particular) may run now.
 * @param {string|null} userId
 * @returns {Promise<null|{reason: 'off'|'budget'}>} null to go ahead.
 */
async function checkBackgroundBudget(userId) {
  if (isDisabled()) return { reason: 'off' };
  try {
    const [mine, everyone] = await Promise.all([userId ? personBackgroundCalls(userId) : 0, globalBackgroundCalls()]);
    if (mine >= BACKGROUND_PERSON_DAILY_CALLS) return { reason: 'budget' };
    if (everyone >= positiveInt(process.env.AI_BACKGROUND_DAILY_CALLS, 3000)) return { reason: 'budget' };
  } catch (err) {
    logger.warn('AI background budget check failed; skipping the call', { userId, error: err.message });
    return { reason: 'budget' };
  }
  return null;
}

/** For tests: forget the cached global counts. */
function resetBudgetMemo() {
  globalMemo = { count: 0, until: 0 };
  backgroundMemo = { count: 0, until: 0 };
}

module.exports = {
  checkChatBudget, checkBackgroundBudget, isAssistantOff: isDisabled, resetBudgetMemo, BACKGROUND_ENDPOINTS,
};
