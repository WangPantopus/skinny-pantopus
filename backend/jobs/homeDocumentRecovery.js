const db = require('../config/supabaseAdmin');
const storage = require('../services/homeDocumentStorage');
const logger = require('../utils/logger');

// Disabled when private Home storage is not configured. SQL bounds selection
// and atomically claims only unpublished expired uploads or deleted tombstones.
// Provider deletion is idempotent; failed acknowledgements remain retryable.
module.exports = async function homeDocumentRecovery() {
  const bucket = (process.env.HOME_DOCUMENTS_BUCKET || '').trim();
  const stats = { selected: 0, removed: 0, pending: 0, skipped: 0 };
  if (!bucket) return stats;
  const candidates = await db.rpc('home_document_cleanup_candidates', { p_bucket: bucket, p_limit: 100 });
  if (candidates.error || !Array.isArray(candidates.data)) {
    throw new Error('Home document recovery selection unavailable');
  }
  stats.selected = candidates.data.length;
  for (const id of candidates.data) {
    const claimed = await db.rpc('claim_home_document_cleanup', { p_file_id: id, p_bucket: bucket });
    if (claimed.error) { stats.pending++; continue; }
    const file = claimed.data;
    if (!file) { stats.skipped++; continue; }
    let succeeded = false;
    try {
      if (file.id !== id || file.is_deleted !== true || !file.metadata?.storage_cleanup_claim
        || file.metadata.storage_contract !== 'home_document_v1'
        || file.metadata.storage_bucket !== bucket
        || file.file_path !== storage.documentKey(file.home_id, file.metadata.storage_key_id || file.id, file.metadata.upload_sha256)) {
        throw new Error('Invalid cleanup reference');
      }
      await storage.remove({ homeId: file.home_id, documentId: file.metadata.storage_key_id || file.id,
        sha256: file.metadata.upload_sha256, bucketName: bucket });
      succeeded = true;
    } catch { /* Keep the tombstone pending; never emit private paths or provider errors. */ }
    const finished = await db.rpc('finish_home_document_cleanup', {
      p_file_id: id, p_claim: file.metadata?.storage_cleanup_claim || null, p_succeeded: succeeded,
    });
    if (succeeded && !finished.error && finished.data === true) stats.removed++;
    else stats.pending++;
  }
  if (stats.selected) logger.info('Home document recovery complete', stats);
  return stats;
};
