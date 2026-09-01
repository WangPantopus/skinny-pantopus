/**
 * Legacy Expo sender — kept alive behind a flag during the dual-write
 * migration window so we can roll back to Expo while native APNs/FCM
 * delivery is validated (docs/push-native-migration.md §4).
 *
 * `expo-server-sdk` is required lazily so importing this module has no
 * side effects (no ESM load, no network), which keeps it cheap to pull
 * into unit tests. Set `PUSH_EXPO_ENABLED=false` to disable the Expo leg
 * once the cutover completes.
 */

const { isExpoToken } = require('./tokenRouting');
const logger = require('../../utils/logger');

const RECEIPT_BATCH_SIZE = 300; // Expo recommends max ~300 per request
const _pendingReceiptIds = [];

let _expo = null;
function getExpo() {
  if (_expo) return _expo;
  const { Expo } = require('expo-server-sdk');
  _expo = new Expo();
  return _expo;
}

/** Expo delivery is on unless explicitly disabled for the cutover. */
function isConfigured() {
  return String(process.env.PUSH_EXPO_ENABLED).toLowerCase() !== 'false';
}

/** Build Expo message objects for valid Expo tokens. Pure — exported for tests. */
function buildMessages(tokens, { title, body, data } = {}) {
  return (tokens || [])
    .filter((token) => isExpoToken(token))
    .map((token) => ({
      to: token,
      sound: 'default',
      title: title || '',
      body: body || '',
      data: data || {},
    }));
}

/**
 * Send to many Expo tokens. Returns tokens Expo rejected outright
 * (DeviceNotRegistered / InvalidCredentials); ok tickets are queued for
 * optional later receipt inspection via {@link checkReceipts}.
 */
async function sendMany(tokens, message) {
  if (!isConfigured()) return { invalidTokens: [] };

  const messages = buildMessages(tokens, message);
  if (messages.length === 0) return { invalidTokens: [] };

  const expo = getExpo();
  const chunks = expo.chunkPushNotifications(messages);
  const invalidTokens = [];

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'ok' && ticket.id) {
          _pendingReceiptIds.push(ticket.id);
        } else if (ticket.status === 'error') {
          const detail = ticket.details && ticket.details.error;
          logger.warn('Expo ticket error', { error: ticket.message, detail, token: chunk[i].to });
          if (detail === 'DeviceNotRegistered' || detail === 'InvalidCredentials') {
            invalidTokens.push(chunk[i].to);
          }
        }
      });
    } catch (err) {
      logger.error('Expo chunk send failed', { error: err.message });
    }
  }

  return { invalidTokens };
}

/** Drain queued Expo receipt ids and log any delivery errors. Best-effort. */
async function checkReceipts() {
  if (_pendingReceiptIds.length === 0 || !isConfigured()) return;
  const batch = _pendingReceiptIds.splice(0, RECEIPT_BATCH_SIZE);
  try {
    const expo = getExpo();
    const receipts = await expo.getPushNotificationReceiptsAsync(batch);
    for (const [receiptId, receipt] of Object.entries(receipts)) {
      if (receipt.status === 'error') {
        logger.warn('Expo receipt error (APNs/FCM rejected)', {
          receiptId,
          error: receipt.message,
          detail: receipt.details && receipt.details.error,
        });
      }
    }
  } catch (err) {
    _pendingReceiptIds.unshift(...batch);
    logger.error('Failed to check Expo receipts', { error: err.message });
  }
}

module.exports = { isConfigured, buildMessages, sendMany, checkReceipts };
