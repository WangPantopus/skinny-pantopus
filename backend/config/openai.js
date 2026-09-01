/**
 * OpenAI configuration — centralised client for AI features.
 * Reads OPENAI_API_KEY from environment.
 */
const OpenAI = require('openai');
const logger = require('../utils/logger');

let client = null;

function getOpenAIClient() {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set — AI features will use fallback mode');
    return null;
  }

  client = new OpenAI({ apiKey });
  return client;
}

module.exports = { getOpenAIClient };
