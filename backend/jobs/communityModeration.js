// ============================================================
// COMMUNITY MODERATION JOB
// Flags community items with multiple "concerned" reactions.
// Runs every 30 minutes.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const FLAG_THRESHOLD = 3; // 3+ concerned reactions triggers review

async function communityModeration() {
  logger.info('[CommunityMod] Starting community moderation check');

  // Find items with 3+ concerned reactions
  const { data: flagged, error } = await supabaseAdmin
    .from('CommunityReaction')
    .select('community_item_id')
    .eq('reaction_type', 'concerned');

  if (error) {
    logger.error('[CommunityMod] Failed to query reactions', { error: error.message });
    return;
  }

  // Count per item
  const counts = {};
  (flagged || []).forEach(r => {
    counts[r.community_item_id] = (counts[r.community_item_id] || 0) + 1;
  });

  const flaggedItems = Object.entries(counts)
    .filter(([, count]) => count >= FLAG_THRESHOLD)
    .map(([id]) => id);

  if (flaggedItems.length === 0) {
    logger.info('[CommunityMod] No items flagged for review');
    return;
  }

  // Log moderation events
  for (const itemId of flaggedItems) {
    // Check if already flagged
    const { data: existing } = await supabaseAdmin
      .from('MailEvent')
      .select('id')
      .eq('event_type', 'community_auto_flagged')
      .eq('metadata->>community_item_id', itemId)
      .limit(1);

    if (existing && existing.length > 0) continue;

    await supabaseAdmin.from('MailEvent').insert({
      event_type: 'community_auto_flagged',
      metadata: {
        community_item_id: itemId,
        concerned_count: counts[itemId],
        flagged_at: new Date().toISOString(),
      },
    });
  }

  logger.info(`[CommunityMod] Complete: ${flaggedItems.length} items flagged`);
}

module.exports = communityModeration;
