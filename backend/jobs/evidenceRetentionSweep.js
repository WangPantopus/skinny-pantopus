// ============================================================
// EVIDENCE RETENTION SWEEP — the safety net under the promise
// "verification documents are deleted once your claim is decided".
//
// routes/admin.js and routes/homeOwnership.js purge a claim's documents
// the moment it is approved, rejected, or withdrawn (services/evidencePurge).
// This job catches what that path can miss: an S3 delete that failed and
// was left unstamped, a claim decided by any other code path (revoked,
// expired by a job, migrated), or a decision made before the purge
// existed. Every evidence row that still points at an object whose claim
// is decided gets purged; undecided claims are left alone.
//
// Only rows are visible here — an object whose row was cascade-deleted
// with its claim cannot be found without listing the bucket, which is a
// separate, manual clean-up.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { purgeClaimEvidence, isS3Key } = require('../services/evidencePurge');

// A claim is "decided" when nothing further will read its documents.
const DECIDED_STATES = new Set(['approved', 'rejected', 'revoked']);
const DECIDED_PHASES = new Set(['verified', 'rejected', 'expired', 'withdrawn']);

function isDecided(claim) {
  if (!claim) return true; // no claim row left to serve → nothing may keep the object
  return DECIDED_STATES.has(claim.state) || DECIDED_PHASES.has(claim.claim_phase_v2);
}

async function evidenceRetentionSweep(options = {}) {
  const { dryRun = false, limit = 500 } = options;
  const { data: rows, error } = await supabaseAdmin
    .from('HomeVerificationEvidence')
    .select('id, claim_id, storage_ref, metadata')
    .not('storage_ref', 'is', null)
    .limit(limit);
  if (error) {
    logger.error('[evidenceRetentionSweep] evidence read failed', { error: error.message });
    throw error;
  }
  const live = (rows || []).filter((r) => isS3Key(r.storage_ref) && !(r.metadata && r.metadata.purged_at));
  const claimIds = [...new Set(live.map((r) => r.claim_id).filter(Boolean))];
  const out = { scanned: (rows || []).length, live_objects: live.length, claims_checked: claimIds.length, claims_purged: 0, objects_purged: 0, failed: 0, dry_run: dryRun };
  if (!claimIds.length) return out;

  const { data: claims, error: cErr } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id, state, claim_phase_v2')
    .in('id', claimIds);
  if (cErr) {
    logger.error('[evidenceRetentionSweep] claim read failed', { error: cErr.message });
    throw cErr;
  }
  const byId = new Map((claims || []).map((c) => [c.id, c]));
  const decided = claimIds.filter((id) => isDecided(byId.get(id)));

  for (const claimId of decided) {
    if (dryRun) { out.claims_purged += 1; continue; }
    const r = await purgeClaimEvidence(claimId, 'retention');
    out.claims_purged += 1;
    out.objects_purged += r.purged;
    out.failed += r.failed;
  }
  logger.info('[evidenceRetentionSweep] done', out);
  return out;
}

module.exports = evidenceRetentionSweep;
module.exports.isDecided = isDecided;
