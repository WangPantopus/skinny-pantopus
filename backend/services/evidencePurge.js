// ============================================================
// EVIDENCE PURGE — the document is for the reviewer, then it is gone.
//
// A verification document (utility bill, lease, ID, deed) is seen by one
// reviewer and never by neighbors; once the claim is decided — approved,
// rejected, or withdrawn by the claimant — the file has no further job.
// This removes the S3 object and stamps the evidence row (the row stays
// for the audit trail: type, status, hash, decision — never the file).
//
// Only refs that are S3 keys are deleted (the metadata-only evidence
// route accepts caller-supplied refs which may be URLs we do not own).
// Best-effort per object; a failure is logged and the row is left
// unstamped so a retention sweep can retry.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const s3 = require('./s3Service');
const logger = require('../utils/logger');

function isS3Key(ref) {
  if (typeof ref !== 'string' || !ref.trim()) return false;
  if (/^https?:\/\//i.test(ref)) return false;
  return true;
}

/**
 * Delete every stored document attached to a claim.
 * @param {string} claimId
 * @param {string} reason 'approved' | 'rejected' | 'withdrawn' | 'retention'
 * @returns {Promise<{purged: number, skipped: number, failed: number}>}
 */
async function purgeClaimEvidence(claimId, reason = 'decided') {
  const out = { purged: 0, skipped: 0, failed: 0 };
  if (!claimId) return out;
  const { data: rows, error } = await supabaseAdmin
    .from('HomeVerificationEvidence')
    .select('id, storage_ref, metadata')
    .eq('claim_id', claimId);
  if (error) {
    logger.warn('evidencePurge: could not list evidence', { claimId, error: error.message });
    return out;
  }
  for (const row of rows || []) {
    const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {};
    if (meta.purged_at) { out.skipped += 1; continue; }
    if (!isS3Key(row.storage_ref)) { out.skipped += 1; continue; }
    try {
      await s3.deleteFromS3(row.storage_ref);
      const { error: updErr } = await supabaseAdmin
        .from('HomeVerificationEvidence')
        .update({ storage_ref: null, metadata: { ...meta, file_url: null, purged_at: new Date().toISOString(), purge_reason: reason } })
        .eq('id', row.id);
      if (updErr) throw new Error(updErr.message);
      out.purged += 1;
    } catch (err) {
      out.failed += 1;
      logger.warn('evidencePurge: object not purged (will retry on sweep)', { claimId, evidenceId: row.id, error: err.message });
    }
  }
  if (out.purged || out.failed) logger.info('evidencePurge: claim evidence purged', { claimId, reason, ...out });
  return out;
}

module.exports = { purgeClaimEvidence, isS3Key };
