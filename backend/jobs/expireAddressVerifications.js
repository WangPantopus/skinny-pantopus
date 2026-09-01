/**
 * Expire stale address-verification attempts.
 *
 * REL — no job in the repository touched any mail table. An attempt that was
 * created and mailed sat at 'sent' forever: no sweeper, no alert, no ops
 * queue. It kept consuming the per-address budget, the user saw a permanent
 * "pending", and a code whose 30-day life had elapsed was only noticed lazily,
 * if the user happened to try it (audit 2026-08-22).
 *
 * This sweeps two things:
 *   - attempts past their expires_at, which become 'expired'
 *   - postcard codes past their expires_at, which become 'expired'
 *
 * Both are bounded per run and safe to re-run.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

/** Attempt statuses that can still be swept to a terminal state. */
const SWEEPABLE_STATUSES = ['created', 'sent', 'delivered_unknown'];

async function expireAddressVerifications(options = {}) {
  const {
    dryRun = false,
    now = new Date().toISOString(),
    limit = 500,
  } = options;

  const result = { scanned: 0, attempts_expired: 0, postcards_expired: 0, dry_run: dryRun };

  // ── 1. Verification attempts past expiry ────────────────────
  const { data: attempts, error: attemptErr } = await supabaseAdmin
    .from('AddressVerificationAttempt')
    .select('id, status, expires_at')
    .in('status', SWEEPABLE_STATUSES)
    .not('expires_at', 'is', null)
    .lt('expires_at', now)
    .limit(limit);

  if (attemptErr) {
    logger.error('[expireAddressVerifications] Failed to query attempts', {
      error: attemptErr.message,
    });
    throw attemptErr;
  }

  result.scanned += (attempts || []).length;

  for (const attempt of attempts || []) {
    if (dryRun) {
      result.attempts_expired += 1;
      continue;
    }

    const { error: updErr } = await supabaseAdmin
      .from('AddressVerificationAttempt')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', attempt.id)
      .in('status', SWEEPABLE_STATUSES);

    if (updErr) {
      logger.error('[expireAddressVerifications] Failed to expire attempt', {
        attemptId: attempt.id, error: updErr.message,
      });
      continue;
    }

    result.attempts_expired += 1;
  }

  // ── 2. Postcard codes past expiry ───────────────────────────
  const { data: postcards, error: postcardErr } = await supabaseAdmin
    .from('HomePostcardCode')
    .select('id, status, expires_at')
    .eq('status', 'pending')
    .not('expires_at', 'is', null)
    .lt('expires_at', now)
    .limit(limit);

  if (postcardErr) {
    logger.error('[expireAddressVerifications] Failed to query postcard codes', {
      error: postcardErr.message,
    });
    throw postcardErr;
  }

  result.scanned += (postcards || []).length;

  for (const postcard of postcards || []) {
    if (dryRun) {
      result.postcards_expired += 1;
      continue;
    }

    const { error: updErr } = await supabaseAdmin
      .from('HomePostcardCode')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', postcard.id)
      .eq('status', 'pending');

    if (updErr) {
      logger.error('[expireAddressVerifications] Failed to expire postcard code', {
        postcardId: postcard.id, error: updErr.message,
      });
      continue;
    }

    result.postcards_expired += 1;
  }

  logger.info('[expireAddressVerifications] Completed', result);
  return result;
}

module.exports = expireAddressVerifications;
