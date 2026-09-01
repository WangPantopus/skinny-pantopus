/**
 * Provider-agnostic push dispatch (pure orchestration).
 *
 * Groups a user's stored token rows by transport provider and hands each
 * group to its sender. Senders are injected so this stays free of network
 * and credential concerns and is unit-testable in isolation.
 *
 * Each sender implements:
 *   - `isConfigured(): boolean`
 *   - `sendMany(tokens: string[], message): Promise<{ invalidTokens: string[] }>`
 *
 * One provider failing (or being unconfigured) never blocks the others —
 * we collect the invalid tokens that each provider reported so the caller
 * can prune them in a single delete.
 *
 * See docs/push-native-migration.md.
 */

const { classifyProvider } = require('./tokenRouting');
const logger = require('../../utils/logger');

const SEND_ORDER = ['apns', 'fcm', 'expo'];

/**
 * @param {Array<{token:string,platform?:string,provider?:string}>} rows
 * @param {{apns:object,fcm:object,expo:object}} senders
 * @param {{title?:string,body?:string,data?:object}} message
 * @returns {Promise<{invalidTokens:string[], counts:Record<string,number>}>}
 */
async function dispatchToTokens(rows, senders, message) {
  const groups = { apns: [], fcm: [], expo: [] };
  for (const row of rows || []) {
    if (!row || !row.token) continue;
    const provider = classifyProvider(row);
    if (groups[provider]) groups[provider].push(row.token);
  }

  const invalidTokens = [];
  const counts = { apns: 0, fcm: 0, expo: 0 };

  for (const provider of SEND_ORDER) {
    const tokens = groups[provider];
    if (tokens.length === 0) continue;

    const sender = senders[provider];
    if (!sender || typeof sender.sendMany !== 'function') continue;

    if (!sender.isConfigured()) {
      logger.debug('Push provider not configured — skipping', {
        provider,
        skipped: tokens.length,
      });
      continue;
    }

    counts[provider] = tokens.length;
    try {
      const result = await sender.sendMany(tokens, message);
      if (result && Array.isArray(result.invalidTokens)) {
        invalidTokens.push(...result.invalidTokens);
      }
    } catch (err) {
      // A transport-level failure shouldn't drop the other providers.
      logger.error('Push provider send failed', {
        provider,
        error: err.message,
      });
    }
  }

  return { invalidTokens, counts };
}

module.exports = { dispatchToTokens, SEND_ORDER };
