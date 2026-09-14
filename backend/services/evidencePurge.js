// Historical refs came from both provider uploads and caller metadata. Their
// shape cannot prove object ownership. Retain/quarantine them until trusted
// private evidence intent and retirement records can authorize exact cleanup.
const db = require('../config/supabaseAdmin');

// Inventory only. This predicate NEVER authorizes a storage operation.
function isS3Key(ref) {
  return typeof ref === 'string' && !!ref.trim() && !/^https?:\/\//i.test(ref);
}
async function purgeClaimEvidence(claimId) {
  if (!claimId) return { purged: 0, skipped: 0, failed: 0, quarantined: 0 };
  const { data, error } = await db.from('HomeVerificationEvidence').select('id, storage_ref, metadata').eq('claim_id', claimId);
  if (error || !Array.isArray(data)) {
    throw Object.assign(new Error('Could not verify evidence retirement state. Please retry.'), { code: 'EVIDENCE_RETIREMENT_UNAVAILABLE' });
  }
  return { purged: 0, skipped: data.length, failed: 0,
    quarantined: data.filter(row => row.storage_ref || row.metadata?.file_url).length };
}
module.exports = { purgeClaimEvidence, isS3Key };
