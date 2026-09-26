// ============================================================
// MAIL DELETED PURGE JOB
// A deleted letter stays restorable for MAIL_RESTORE_DAYS (30 days); this
// job then removes the row, which is what DELETE /api/mailbox/:id did at
// once before letters became recoverable. The same foreign keys apply: the
// letter's own rows (pages, actions, links, packages, party and read
// sessions, routing and delivery records) go with it, and tasks, map pins,
// Mail Day pieces, earnings, community items and mail events keep their
// rows with the letter link cleared.
// Runs daily at 4:40 AM UTC.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { MAIL_RESTORE_DAYS } = require('../utils/homeMailAccess');

const BATCH_SIZE = 200;
const MAX_BATCHES = 50;

async function mailDeletedPurge() {
  const cutoff = new Date(Date.now() - MAIL_RESTORE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let purged = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data: due, error } = await supabaseAdmin
      .from('Mail')
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff)
      .limit(BATCH_SIZE);

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
