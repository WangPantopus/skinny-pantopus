// Inventory decided claims and delegate exact evidence retirement. Legacy refs
// are quarantined; a plausible path is never authority to delete an object.

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
  const out = { scanned: (rows || []).length, live_objects: live.length, claims_checked: claimIds.length, claims_purged: 0, objects_purged: 0, quarantined: 0, candidate_claims: 0, failed: 0, dry_run: dryRun };
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
    out.candidate_claims += 1;
    if (dryRun) continue;
    const r = await purgeClaimEvidence(claimId, 'retention');
    if (r.purged > 0) out.claims_purged += 1;
    out.quarantined += r.quarantined || 0;
    out.objects_purged += r.purged;
    out.failed += r.failed;
  }
  logger.info('[evidenceRetentionSweep] done', out);
  return out;
}

module.exports = evidenceRetentionSweep;
module.exports.isDecided = isDecided;
