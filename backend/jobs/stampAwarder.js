// ============================================================
// STAMP AWARDER JOB
// Checks milestone conditions and awards stamps.
// Runs every 6 hours.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const MILESTONES = [
  { stamp_type: 'first_mail', name: 'First Mail', rarity: 'common', check: (counts) => counts.totalMail >= 1 },
  { stamp_type: 'ten_items', name: 'Mail Regular', rarity: 'common', check: (counts) => counts.totalMail >= 10 },
  { stamp_type: 'fifty_items', name: 'Mail Enthusiast', rarity: 'uncommon', check: (counts) => counts.totalMail >= 50 },
  { stamp_type: 'hundred_items', name: 'Mail Centurion', rarity: 'rare', check: (counts) => counts.totalMail >= 100 },
  { stamp_type: 'first_package', name: 'Package Day', rarity: 'common', check: (counts) => counts.packages >= 1 },
  { stamp_type: 'vault_organizer', name: 'Organized', rarity: 'common', check: (counts) => counts.vaultFiled >= 10 },
];

async function stampAwarder() {
  logger.info('[StampAwarder] Starting stamp award check');

  // Get all users
  const { data: users, error: userErr } = await supabaseAdmin
    .from('User')
    .select('id')
    .limit(500);

  if (userErr) {
    logger.error('[StampAwarder] Failed to query users', { error: userErr.message });
    return;
  }

  let awarded = 0;

  for (const user of (users || [])) {
    try {
      // Get existing stamps
      const { data: existing } = await supabaseAdmin
        .from('Stamp')
        .select('stamp_type')
        .eq('user_id', user.id);
      const earnedTypes = new Set((existing || []).map(s => s.stamp_type));

      // Get counts
      const { count: totalMail } = await supabaseAdmin
        .from('Mail')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id);

      const { count: packages } = await supabaseAdmin
        .from('MailPackage')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id);

      const { count: vaultFiled } = await supabaseAdmin
        .from('Mail')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .not('vault_folder_id', 'is', null);

      const counts = {
        totalMail: totalMail || 0,
        packages: packages || 0,
        vaultFiled: vaultFiled || 0,
      };

      // Check each milestone
      for (const milestone of MILESTONES) {
        if (earnedTypes.has(milestone.stamp_type)) continue;
        if (!milestone.check(counts)) continue;

        await supabaseAdmin.from('Stamp').insert({
          user_id: user.id,
          stamp_type: milestone.stamp_type,
          name: milestone.name,
          rarity: milestone.rarity,
          earned_by: 'milestone',
          displayed_in_gallery: true,
          color_palette: ['#7C3AED', '#F59E0B', '#10B981'],
        });
        awarded++;
        logger.info(`[StampAwarder] Awarded ${milestone.stamp_type} to user ${user.id}`);
      }
    } catch (err) {
      logger.error('[StampAwarder] Error processing user', { userId: user.id, error: err.message });
    }
  }

  logger.info(`[StampAwarder] Complete: ${awarded} stamps awarded`);
}

module.exports = stampAwarder;
