#!/usr/bin/env node
/**
 * P0.2 — Send the one-time display-name-changed notification email.
 *
 * Consumes the LocalProfileDisplayNameMigrationP02 snapshot table populated
 * by migration 133 and sends one email per row that has not yet been
 * notified (email_sent_at IS NULL).
 *
 * Idempotent: rows with email_sent_at set are skipped, so re-runs after a
 * partial failure pick up where they left off. Rows that fail to send mark
 * email_failed_at so the operator can investigate without blocking the
 * happy path.
 *
 * Privacy: the email NEVER contains the previous legal-name value. Only the
 * username (new public display name) and the previous display name (which
 * may have been a legal name — that's why we're rotating it) are sent. The
 * audit log retains the previous value internally; this script also reads it
 * to populate the email body.
 *
 * Usage:
 *   node backend/scripts/p0-2-send-display-name-migration-emails.js
 *   node backend/scripts/p0-2-send-display-name-migration-emails.js --dry-run
 *   node backend/scripts/p0-2-send-display-name-migration-emails.js --limit 100
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const { sendDisplayNameMigrationEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const SNAPSHOT_TABLE = 'LocalProfileDisplayNameMigrationP02';

function parseArgs(argv = process.argv.slice(2)) {
  const args = { dryRun: false, limit: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run' || a === '-n') args.dryRun = true;
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`P0.2 — display-name migration email sender

Usage:
  node backend/scripts/p0-2-send-display-name-migration-emails.js [--dry-run] [--limit N]

Options:
  --dry-run, -n    log what would be sent, do not call the email transport
  --limit N        cap the number of rows processed (useful for staged rollouts)
  --help, -h       show this message
`);
}

async function loadPendingRows(limit) {
  let query = supabaseAdmin
    .from(SNAPSHOT_TABLE)
    .select('id, local_profile_id, user_id, previous_display_name, new_display_name, user_email, user_username')
    .is('email_sent_at', null)
    .is('email_failed_at', null)
    .order('migrated_at', { ascending: true });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to read ${SNAPSHOT_TABLE}: ${error.message}`);
  return data || [];
}

async function markSent(id) {
  const { error } = await supabaseAdmin
    .from(SNAPSHOT_TABLE)
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    logger.warn('p0_2.email.mark_sent_failed', { id, error: error.message });
  }
}

async function markFailed(id, reason) {
  const { error } = await supabaseAdmin
    .from(SNAPSHOT_TABLE)
    .update({
      email_failed_at: new Date().toISOString(),
      email_failure_reason: reason,
    })
    .eq('id', id);
  if (error) {
    logger.warn('p0_2.email.mark_failed_failed', { id, reason, error: error.message });
  }
}

async function processRow(row, { dryRun }) {
  if (!row.user_email) {
    await markFailed(row.id, 'missing_user_email');
    return { id: row.id, status: 'skipped', reason: 'missing_user_email' };
  }
  if (!row.user_username) {
    await markFailed(row.id, 'missing_user_username');
    return { id: row.id, status: 'skipped', reason: 'missing_user_username' };
  }

  if (dryRun) {
    logger.info('p0_2.email.dry_run', {
      to: row.user_email,
      username: row.user_username,
      // previous_display_name is logged because we already log it in the audit
      // log on every migration; logger output stays internal.
      previous_display_name: row.previous_display_name,
    });
    return { id: row.id, status: 'dry_run' };
  }

  try {
    const result = await sendDisplayNameMigrationEmail({
      toEmail: row.user_email,
      username: row.user_username,
      previousDisplayName: row.previous_display_name,
    });
    if (!result?.success) {
      await markFailed(row.id, result?.error || 'email_send_returned_failure');
      return { id: row.id, status: 'failed', reason: result?.error };
    }
    await markSent(row.id);
    return { id: row.id, status: 'sent' };
  } catch (err) {
    await markFailed(row.id, err.message);
    return { id: row.id, status: 'failed', reason: err.message };
  }
}

async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }
  const rows = await loadPendingRows(args.limit);
  logger.info('p0_2.email.start', { pending: rows.length, dryRun: args.dryRun });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    const outcome = await processRow(row, { dryRun: args.dryRun });
    if (outcome.status === 'sent' || outcome.status === 'dry_run') sent++;
    else if (outcome.status === 'skipped') skipped++;
    else failed++;
  }

  logger.info('p0_2.email.done', { sent, skipped, failed, total: rows.length });
  return failed > 0 ? 1 : 0;
}

if (require.main === module) {
  run()
    .then((code) => process.exit(code))
    .catch((err) => {
      logger.error('p0_2.email.fatal', { error: err.message, stack: err.stack });
      process.exit(2);
    });
}

module.exports = { parseArgs, loadPendingRows, processRow, run };
