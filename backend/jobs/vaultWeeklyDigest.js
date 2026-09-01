// ============================================================
// VAULT WEEKLY DIGEST JOB
// Sends a weekly summary of Vault activity:
// - Items auto-filed this week
// - Unfiled items needing attention
// - Vault storage stats per drawer
// Runs every Monday at 9:00 AM UTC.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function vaultWeeklyDigest() {
  logger.info('[VaultDigest] Starting weekly vault digest job');

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get all users who have vault folders (meaning they use the vault)
  const { data: vaultUsers, error: vaultError } = await supabaseAdmin
    .from('VaultFolder')
    .select('user_id')
    .not('user_id', 'is', null);

  if (vaultError) {
    logger.error('[VaultDigest] Failed to query vault users', { error: vaultError.message });
    return;
  }

  const userIds = [...new Set((vaultUsers || []).map(v => v.user_id))];
  logger.info(`[VaultDigest] Found ${userIds.length} vault users`);

  let digested = 0;

  for (const userId of userIds) {
    try {
      // Count auto-filed items this week
      const { data: autoFiledEvents } = await supabaseAdmin
        .from('MailEvent')
        .select('id', { count: 'exact', head: false })
        .eq('user_id', userId)
        .eq('event_type', 'auto_filed')
        .gte('created_at', oneWeekAgo);

      const autoFiledCount = autoFiledEvents?.length || 0;

      // Count unfiled items in vault tab
      const { count: unfiledCount } = await supabaseAdmin
        .from('Mail')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', userId)
        .is('vault_folder_id', null)
        .eq('archived', true)  // archived but not in a folder
        .in('lifecycle', ['delivered', 'opened', 'expired']);

      // Count total vault items
      const { count: totalItems } = await supabaseAdmin
        .from('Mail')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', userId)
        .not('vault_folder_id', 'is', null);

      // Count folders
      const { count: folderCount } = await supabaseAdmin
        .from('VaultFolder')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Skip if nothing interesting happened
      if (autoFiledCount === 0 && (unfiledCount || 0) === 0) {
        continue;
      }

      // Log digest event
      await supabaseAdmin
        .from('MailEvent')
        .insert({
          event_type: 'vault_weekly_digest',
          user_id: userId,
          metadata: {
            auto_filed_this_week: autoFiledCount,
            unfiled_items: unfiledCount || 0,
            total_vault_items: totalItems || 0,
            folder_count: folderCount || 0,
            period_start: oneWeekAgo,
            period_end: new Date().toISOString(),
          },
        });

      digested++;
    } catch (err) {
      logger.error('[VaultDigest] Error processing user', {
        userId,
        error: err.message,
      });
    }
  }

  logger.info(`[VaultDigest] Complete: ${digested} digests generated`);
}

module.exports = vaultWeeklyDigest;
