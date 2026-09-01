/**
 * Push Service
 *
 * Delivers push notifications to iOS/Android devices via the platform
 * transports directly — APNs (HTTP/2, token-based .p8 auth) for iOS and
 * FCM (HTTP v1) for Android — with the legacy Expo path kept alive behind
 * `PUSH_EXPO_ENABLED` during the dual-write migration window.
 *
 * The public surface is unchanged from the Expo-only implementation
 * (saveToken / removeToken / removeAllTokens / sendToUser / sendToUsers /
 * checkReceipts) so every existing trigger point keeps the same
 * `{ title, body, data }` payload contract — only the transport changed.
 *
 * Provider selection lives in ./push/* (tokenRouting + per-provider
 * clients + dispatch); this file is the thin DB-bound orchestrator.
 *
 * See docs/push-native-migration.md.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { resolveRegistration } = require('./push/tokenRouting');
const { dispatchToTokens } = require('./push/dispatch');
const apnsClient = require('./push/apnsClient');
const fcmClient = require('./push/fcmClient');
const expoClient = require('./push/expoClient');

const senders = { apns: apnsClient, fcm: fcmClient, expo: expoClient };

/**
 * Save or update a device push token, tagged with its platform + provider.
 * The token column is globally unique — upserting on it reassigns ownership
 * to the current user, preventing cross-account push leaks on shared
 * devices. `opts` carries the client-declared `{ platform, provider }`;
 * Expo tokens are auto-detected from their format.
 */
async function saveToken(userId, token, opts = {}) {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    logger.warn('Empty push token rejected', { userId });
    return null;
  }

  const { platform, provider } = resolveRegistration({ token, ...opts });

  const { data, error } = await supabaseAdmin
    .from('PushToken')
    .upsert(
      { user_id: userId, token, platform, provider, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    )
    .select()
    .single();

  if (error) {
    logger.error('Failed to save push token', { error: error.message, userId });
    return null;
  }
  return data;
}

/** Remove a specific push token (e.g. on logout). */
async function removeToken(userId, token) {
  const { error } = await supabaseAdmin
    .from('PushToken')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);

  if (error) {
    logger.error('Failed to remove push token', { error: error.message, userId });
  }
}

/** Remove all push tokens for a user (e.g. on account deletion). */
async function removeAllTokens(userId) {
  const { error } = await supabaseAdmin
    .from('PushToken')
    .delete()
    .eq('user_id', userId);

  if (error) {
    logger.error('Failed to remove all push tokens', { error: error.message, userId });
  }
}

/** Dispatch one payload to a set of token rows and prune dead tokens. */
async function deliver(rows, message) {
  if (!rows || rows.length === 0) return;

  const { invalidTokens } = await dispatchToTokens(rows, senders, message);

  if (invalidTokens.length > 0) {
    const { error } = await supabaseAdmin
      .from('PushToken')
      .delete()
      .in('token', invalidTokens);
    if (error) {
      logger.warn('Failed to prune invalid push tokens', { error: error.message, count: invalidTokens.length });
    }
  }
}

/** Send a push notification to every device registered to one user. */
async function sendToUser(userId, { title, body, data }) {
  const { data: rows, error } = await supabaseAdmin
    .from('PushToken')
    .select('token, platform, provider')
    .eq('user_id', userId);

  if (error || !rows || rows.length === 0) return;
  await deliver(rows, { title, body, data });
}

/** Send a push notification to every device of many users at once. */
async function sendToUsers(userIds, { title, body, data }) {
  if (!userIds || userIds.length === 0) return;

  const { data: rows, error } = await supabaseAdmin
    .from('PushToken')
    .select('token, platform, provider')
    .in('user_id', userIds);

  if (error || !rows || rows.length === 0) return;
  await deliver(rows, { title, body, data });
}

/** Best-effort Expo receipt drain, retained for the dual-write window. */
function checkReceipts() {
  return expoClient.checkReceipts();
}

module.exports = {
  saveToken,
  removeToken,
  removeAllTokens,
  sendToUser,
  sendToUsers,
  checkReceipts, // exported for testing / scheduled drain
};
