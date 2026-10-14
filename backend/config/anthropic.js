/**
 * Anthropic configuration — centralised Claude client for AI features.
 * Reads ANTHROPIC_API_KEY from the environment.
 *
 * Every AI feature runs on Claude Sonnet 5.5. ANTHROPIC_CHAT_MODEL and
 * ANTHROPIC_DRAFT_MODEL can point a tier at another Claude model; a name that
 * doesn't start with "claude-" is ignored, so a leftover value from the old
 * provider can never send a request for a model Anthropic doesn't serve.
 */
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

const DEFAULT_MODEL = 'claude-sonnet-5-5';
const EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

let client = null;
let warnedMissingKey = false;

/** A Claude model name from the environment, or `fallback` when it is unset or isn't one. */
function resolveModel(configured, fallback = DEFAULT_MODEL) {
  const name = typeof configured === 'string' ? configured.trim() : '';
  if (!name) return fallback;
  if (/^claude-/.test(name)) return name;
  logger.warn('Ignoring a model name that is not a Claude model', { configured: name, using: fallback });
  return fallback;
}

/** An `output_config.effort` level from the environment, or `fallback`. */
function resolveEffort(configured, fallback) {
  const level = typeof configured === 'string' ? configured.trim().toLowerCase() : '';
  return EFFORT_LEVELS.has(level) ? level : fallback;
}

const CHAT_MODEL = resolveModel(process.env.ANTHROPIC_CHAT_MODEL);
const DRAFT_MODEL = resolveModel(process.env.ANTHROPIC_DRAFT_MODEL);

function getAnthropicClient() {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      logger.warn('ANTHROPIC_API_KEY not set — AI features will use fallback mode');
    }
    return null;
  }

  client = new Anthropic({
    apiKey,
    // Credentials come from the API key alone: a stray ANTHROPIC_AUTH_TOKEN in
    // the environment would make the SDK send both headers, which the API rejects.
    authToken: null,
    // Interactive calls set their own, tighter deadline with an AbortSignal;
    // this only bounds a call that doesn't. Retries (429, 5xx, dropped
    // connections) stay at the SDK default of two.
    timeout: 60_000,
  });
  return client;
}

module.exports = {
  getAnthropicClient,
  resolveModel,
  resolveEffort,
  DEFAULT_MODEL,
  CHAT_MODEL,
  DRAFT_MODEL,
};
