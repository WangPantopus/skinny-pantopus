/**
 * One model call nobody is waiting for: the morning brief, a nudge's draft or
 * judgment, lost-and-found matching (docs/product/ai-assistant-phase2-contract-2026-10-20.md
 * §2.6). It is checked against the background caps first (assistantBudget.js) and
 * logged to AIRequestLog under its own endpoint name (brief, nudge:<kind>, document,
 * lostfound), which is what those caps count.
 *
 *   const call = await backgroundCall({
 *     userId, endpoint: 'nudge:plan_weather', promptVersion: 'nudge-v1',
 *     run: (client) => complete({ client, model: DRAFT_MODEL, system, messages, effort: 'low' }),
 *   });
 *   if (!call.ok) return plainTextVersion();   // call.reason: 'off' | 'budget' | 'unavailable' | 'error'
 *   use(call.value);                           // what run resolved to
 *
 * Over a cap the job sends its plain-text version or nothing, never half of what
 * the model would have written.
 */
const { getAnthropicClient, DRAFT_MODEL } = require('../../config/anthropic');
const logger = require('../../utils/logger');
const { AIRefusalError, isTimeoutError } = require('./llm');
const { checkBackgroundBudget } = require('./assistantBudget');

/**
 * @param {object} p
 * @param {string|null} p.userId          Who it is for (the per-person cap), or null for a batch.
 * @param {string} p.endpoint             brief, nudge:<kind>, document or lostfound.
 * @param {(client: object) => Promise<object>} p.run  The call; its inputTokens and outputTokens are logged.
 * @param {string} [p.model]              Logged with the call.
 * @param {string} [p.promptVersion]
 * @param {string} [p.conversationId]
 * @returns {Promise<{ok: true, value: object}|{ok: false, reason: string, error?: Error}>}
 */
async function backgroundCall({ userId = null, endpoint, run, model = DRAFT_MODEL, promptVersion = 'v1', conversationId = null }) {
  if (typeof endpoint !== 'string' || !endpoint || typeof run !== 'function') {
    throw new TypeError('backgroundCall needs an endpoint name and a run function');
  }
  const blocked = await checkBackgroundBudget(userId);
  if (blocked) {
    logger.info('AI background call skipped', { userId, endpoint, reason: blocked.reason });
    return { ok: false, reason: blocked.reason };
  }
  const client = getAnthropicClient();
  if (!client) return { ok: false, reason: 'unavailable' };

  // Required here: agentService loads the chat's tools, which nothing above needs.
  const { logRequest } = require('./agentService');
  const started = Date.now();
  try {
    const value = await run(client);
    await logRequest({
      userId, conversationId, endpoint, model, promptVersion, status: 'ok', latencyMs: Date.now() - started,
      inputTokens: value?.inputTokens, outputTokens: value?.outputTokens,
    });
    return { ok: true, value };
  } catch (err) {
    let status = 'error';
    if (err instanceof AIRefusalError) status = 'refusal';
    else if (isTimeoutError(err)) status = 'timeout';
    logger.warn('AI background call failed', { userId, endpoint, status, error: err.message });
    await logRequest({
      userId, conversationId, endpoint, model, promptVersion, status, latencyMs: Date.now() - started, errorMessage: err.message,
    });
    return { ok: false, reason: 'error', error: err };
  }
}

module.exports = { backgroundCall };
