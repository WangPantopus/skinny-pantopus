// ============================================================
// The notice of a Christmas card that went right away (the card round of November 28, 2026; routes/mailbox storeCard):
// the special-delivery notice every time-sensitive piece gets ("Special delivery", who it is from, and nothing of the
// note), exactly one per card.
//
// One: the notice is kept under the card's own key (Notification.idempotency_key), so a repeat of the send, or two
// copies of it, never make a second. Never none: its push is written on the notice as due before it is sent, so a
// server that stops between the two leaves it for releaseHeld, which a job runs every five minutes. Never two: each
// push is claimed first with a conditional write (services/heldPushes), by whoever sends it.
//
// The push follows the quiet hours Pantopus already keeps for pushes (services/heldPushes: the person's own, else
// 9 PM to 8 AM where they live): a card that lands in them is in the box and in the bell at once, and its push goes
// when they end, unless the card was opened or removed meanwhile.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const heldPushes = require('./heldPushes');
const notificationService = require('./notificationService');
const mailDelivery = require('./mailDelivery');
const logger = require('../utils/logger');

const noticeKey = (mailId) => `card_right_away:${mailId}`;

/**
 * Tell the person a card came right away: the notice now, its push now or when their quiet hours end. Safe to call
 * again for the same card (it does nothing then). Never throws: a failed notice doesn't fail the send.
 */
async function announceRightAway({ mailId, recipientUserId, senderName }) {
  if (!mailId || !recipientUserId) return;
  try {
    // Quiet hours that can't be read hold nothing: the notice goes as every special delivery's does.
    const until = await heldPushes.pushWindow(recipientUserId, { fallbackTz: mailDelivery.FALLBACK_TIME_ZONE })
      .then((window) => window.until, () => null);
    const row = await notificationService.notifyMailDelivered({
      recipientUserId, senderName: senderName || 'Someone', mailId, mailType: 'letter', special: true,
      // Its push is this module's to send: due now, or once their quiet hours end.
      sendPush: false, idempotencyKey: noticeKey(mailId),
      metadata: { card_right_away: true, push_deferred_until: (until || new Date()).toISOString() },
    });
    // Null: this card's notice exists already (or couldn't be stored: logged there).
    if (!row || until) return;
    if (await heldPushes.claim(row, { push_sent_at: new Date().toISOString() })) await notificationService.pushStoredNotification(row);
  } catch (error) {
    logger.warn('Card notice failed (non-blocking)', { mailId, error: error.message });
  }
}

// A held push no longer applies once the card was opened, read or removed: they have seen it, or it is gone.
async function noLongerNews(row) {
  const mailId = row.metadata?.mail_id;
  if (!mailId) return true;
  const { data, error } = await supabaseAdmin.from('Mail').select('id, opened_at, viewed, deleted_at')
    .eq('id', mailId).maybeSingle();
  if (error) throw new Error(error.message);
  return !data || Boolean(data.opened_at || data.viewed || data.deleted_at);
}

/**
 * The pushes of right-away cards that are due (jobs/index.js, every five minutes): those held for quiet hours that
 * have ended, and any a server left unsent. Answers { sent, dropped }.
 */
async function releaseHeld() {
  const result = await heldPushes.releaseHeldPushes({
    types: ['mail_delivered'], send: (row) => notificationService.pushStoredNotification(row), isDropped: noLongerNews,
  });
  if (result.sent || result.dropped) logger.info('Card notices released', result);
  return result;
}

module.exports = { announceRightAway, releaseHeld };
