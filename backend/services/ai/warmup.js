/**
 * Keeps Claude's compiled response schemas warm.
 *
 * The API compiles a response schema into a grammar the first time it sees it,
 * which costs about three extra seconds on that one request, and forgets the
 * compiled grammar after 24 hours without use. A rarely used draft (a Support
 * Train draft, say) would pay that nearly every time. A one-token request per
 * schema compiles it ahead of time, so the first person to ask after a quiet
 * day doesn't wait for it. (The schema alone decides this: the warm-up's prompt
 * can be a throwaway.)
 *
 * On by default where NODE_ENV=production (staging and production);
 * AI_WARMUP=on or off overrides. Runs at startup and every 20 hours. A round
 * costs well under a cent, and a failed round only means the next draft is a
 * little slower.
 */
const { getAnthropicClient, DRAFT_MODEL } = require('../../config/anthropic');
const logger = require('../../utils/logger');
const { claudeSchemas } = require('./schemas');

const WARMUP_INTERVAL_MS = 20 * 60 * 60 * 1000;

function warmupEnabled() {
  const setting = String(process.env.AI_WARMUP || '').trim().toLowerCase();
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return process.env.NODE_ENV === 'production';
}

/** One one-token request per schema, at once. Resolves to how many succeeded. */
async function warmSchemas(client = getAnthropicClient()) {
  if (!client) return 0;
  const results = await Promise.allSettled(Object.entries(claudeSchemas).map(async ([name, schema]) => {
    try {
      await client.messages.create({
        model: DRAFT_MODEL,
        max_tokens: 1,
        system: 'Return JSON.',
        messages: [{ role: 'user', content: 'x' }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      }, { timeout: 30_000 });
    } catch (err) {
      logger.warn('AI schema warm-up failed', { schema: name, error: err.message });
      throw err;
    }
  }));
  return results.filter((result) => result.status === 'fulfilled').length;
}

/** Warm now and every 20 hours. Returns the timer (unref'd), or null when warm-up is off or AI isn't configured. */
function startSchemaWarmup() {
  if (!warmupEnabled() || !getAnthropicClient()) return null;
  const run = () => warmSchemas()
    .then((count) => logger.info('AI response schemas warmed', { warmed: count, of: Object.keys(claudeSchemas).length }))
    .catch((err) => logger.warn('AI schema warm-up error', { error: err.message }));
  run();
  const timer = setInterval(run, WARMUP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startSchemaWarmup, warmSchemas, warmupEnabled };
