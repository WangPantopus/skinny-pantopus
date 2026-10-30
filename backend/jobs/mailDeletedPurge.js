// ============================================================
// MAIL DELETED PURGE JOB
// A deleted letter stays restorable for MAIL_RESTORE_DAYS (30 days); this
// job then removes the row, which is what DELETE /api/mailbox/:id did at
// once before letters became recoverable. The same foreign keys apply: the
// letter's own rows (pages, actions, links, packages, party and read
// sessions, routing and delivery records) go with it, and tasks, map pins,
// Mail Day pieces, earnings, community items and mail events keep their
// rows with the letter link cleared.
// A Christmas card a person sent stays: it stays in its sender's Sent after
// the other person shreds it (founder decision 2026-10-30). For them it's gone
// all the same: Recently shredded and restore stop at 30 days, and it no
// longer opens (homeMailAccess.restoreWindowOver). A deleted account's mail
// still goes with the account.
// Runs daily at 4:40 AM UTC.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { MAIL_RESTORE_DAYS } = require('../utils/homeMailAccess');
const { CARD_TAG } = require('../services/holidayCards');

const BATCH_SIZE = 200;
const MAX_BATCHES = 50;
// Everything but a card a person sent (sender_user_id set and the card tag).
const NOT_A_SENT_CARD = `sender_user_id.is.null,tags.is.null,tags.not.cs.{${CARD_TAG}}`;

/** The deleted letters the job erases: deleted before `cutoff`, except the cards people sent. */
function duePurge(cutoff) {
  return supabaseAdmin
    .from('Mail')
    .select('id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
    .or(NOT_A_SENT_CARD);
}

async function mailDeletedPurge() {
  const cutoff = new Date(Date.now() - MAIL_RESTORE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let purged = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data: due, error } = await duePurge(cutoff).limit(BATCH_SIZE);

    if (error) {
      logger.error('[MailDeletedPurge] Failed to find deleted letters', { error: error.message });
      return;
    }
    if (!due || due.length === 0) break;

    // The cutoff is checked again on delete, so a letter restored meanwhile stays.
    const { data: removed, error: deleteError } = await supabaseAdmin
      .from('Mail')
      .delete()
      .in('id', due.map((m) => m.id))
      .lt('deleted_at', cutoff)
      .or(NOT_A_SENT_CARD)
      .select('id');

    if (deleteError) {
      logger.error('[MailDeletedPurge] Failed to purge deleted letters', { error: deleteError.message, count: due.length });
      return;
    }
    purged += (removed || []).length;
    if (due.length < BATCH_SIZE) break;
  }

  if (purged > 0) {
    logger.info(`[MailDeletedPurge] Purged ${purged} letters deleted more than ${MAIL_RESTORE_DAYS} days ago`);
  }
}

module.exports = mailDeletedPurge;
// Its selection alone, to check what it would erase without erasing anything.
module.exports.duePurge = duePurge;
