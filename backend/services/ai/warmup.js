/**
 * Keeps two things warm on Claude's side, so the first person to ask after a quiet stretch doesn't wait for them:
 * the compiled response schemas (below), and the chat assistant's cached instructions and tools (at the end).
 *
 * Response schemas.
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

// ─── The chat assistant's instructions and tools ───────────────────────────
//
// Every chat request sends the assistant's instructions and its tools (about 19,000 tokens for the web, 35,000
// for the phones). Claude keeps them cached for an hour after each use and reads a cached copy faster than a
// fresh one: measured on November 14, 2026, the first words came about 0.3 s sooner. With a few people chatting
// at scattered hours, most conversations start after that hour has run out, so the copy is read again just before
// it would: a request that asks for no reply (`max_tokens: 0`) and is billed as a cache read, about a third of a
// cent. Without it, the next conversation pays to cache the whole prompt again, about forty times that.
//
// Only the kinds of prompt real chats used in the last day are kept warm (one per kind of app and set of features a
// person has), and only in this process: after a restart each kind is picked up again at its first chat.
//
//   AI_CHAT_KEEP_WARM=on|off   overrides the default (on where NODE_ENV=production, like the schemas)
const CHAT_KEEP_WARM_MS = 50 * 60 * 1000;      // read it again once it has gone this long unused (it lives 60)
const CHAT_CHECK_MS = 5 * 60 * 1000;           // how often the timer looks
const CHAT_IDLE_MS = 24 * 60 * 60 * 1000;      // a kind nobody has used for a day is let go
const MAX_CHAT_PROMPTS = 12;
const chatPrompts = new Map();                 // key → { model, effort, system, tools, usedAt, warmAt }

function chatKeepWarmEnabled() {
  const setting = String(process.env.AI_CHAT_KEEP_WARM || '').trim().toLowerCase();
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return process.env.NODE_ENV === 'production';
}

/**
 * A chat turn just sent this prompt: remember it, so it is kept warm from now on.
 * @param {string} key      What tells this kind of prompt from the others (the app's cards and the person's features).
 * @param {{model: string, effort: string, system: Array, tools: Array}} prompt  As the chat request sent them.
 */
function noteChatPrompt(key, prompt, now = Date.now()) {
  if (!chatKeepWarmEnabled()) return;
  chatPrompts.delete(key);
  chatPrompts.set(key, { ...prompt, usedAt: now, warmAt: now });
  // The least recently used go first; a real deployment has a handful of kinds.
  while (chatPrompts.size > MAX_CHAT_PROMPTS) chatPrompts.delete(chatPrompts.keys().next().value);
}

/**
 * Read again every remembered chat prompt that is about to go cold. Resolves to how many were read.
 * The request must match a chat turn's up to the end of the instructions (same model, effort, tools and system
 * blocks, with the system block's own cache mark), or it would warm a copy no chat reads.
 */
async function keepChatPromptsWarm(client = getAnthropicClient(), now = Date.now()) {
  if (!client) return 0;
  let warmed = 0;
  for (const [key, prompt] of [...chatPrompts]) {
    if (now - prompt.usedAt > CHAT_IDLE_MS) {
      chatPrompts.delete(key);
      continue;
    }
    if (now - prompt.warmAt < CHAT_KEEP_WARM_MS) continue;
    try {
      const message = await client.messages.create({
        model: prompt.model,
        max_tokens: 0,
        system: prompt.system,
        tools: prompt.tools,
        messages: [{ role: 'user', content: 'warm-up' }],
        output_config: { effort: prompt.effort },
      }, { timeout: 30_000 });
      prompt.warmAt = Date.now();
      warmed += 1;
      logger.info('AI chat prompt kept warm', {
        cacheReadTokens: message.usage?.cache_read_input_tokens || 0,
        // More than zero means it had gone cold (or changed) and was cached again.
        cacheWriteTokens: message.usage?.cache_creation_input_tokens || 0,
      });
    } catch (err) {
      logger.warn('AI chat prompt keep-warm failed', { error: err.message });
    }
  }
  return warmed;
}

/** Look every five minutes. Returns the timer (unref'd), or null when it is off or AI isn't configured. */
function startChatKeepWarm() {
  if (!chatKeepWarmEnabled() || !getAnthropicClient()) return null;
  const timer = setInterval(() => {
    keepChatPromptsWarm().catch((err) => logger.warn('AI chat prompt keep-warm error', { error: err.message }));
  }, CHAT_CHECK_MS);
  timer.unref();
  return timer;
}

module.exports = {
  startSchemaWarmup, warmSchemas, warmupEnabled,
  startChatKeepWarm, keepChatPromptsWarm, noteChatPrompt, chatKeepWarmEnabled,
};
