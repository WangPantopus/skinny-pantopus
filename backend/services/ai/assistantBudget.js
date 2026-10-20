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

/** For tests: forget the cached global count. */
function resetBudgetMemo() {
  globalMemo = { count: 0, until: 0 };
}

module.exports = { checkChatBudget, resetBudgetMemo };
