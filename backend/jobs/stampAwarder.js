// ============================================================
// STAMP AWARDER JOB
// Checks milestone conditions and awards stamps.
// Runs every 6 hours.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { isLaunchFeatureEnabled } = require('../utils/featureFlags');

const ALL_MILESTONES = [
  { stamp_type: 'first_mail', name: 'First Mail', rarity: 'common', check: (counts) => counts.totalMail >= 1 },
  { stamp_type: 'ten_items', name: 'Mail Regular', rarity: 'common', check: (counts) => counts.totalMail >= 10 },
  { stamp_type: 'fifty_items', name: 'Mail Enthusiast', rarity: 'uncommon', check: (counts) => counts.totalMail >= 50 },
  { stamp_type: 'hundred_items', name: 'Mail Centurion', rarity: 'rare', check: (counts) => counts.totalMail >= 100 },
  // Package tracking is cut for the first launch (household_extras): a package reads as plain mail, so
  // this stamp is neither awarded nor listed until the feature is back.
  { stamp_type: 'first_package', name: 'Package Day', rarity: 'common', requires: 'household_extras', check: (counts) => counts.packages >= 1 },
  { stamp_type: 'vault_organizer', name: 'Organized', rarity: 'common', check: (counts) => counts.vaultFiled >= 10 },
];
const MILESTONES = ALL_MILESTONES.filter((m) => !m.requires || isLaunchFeatureEnabled(m.requires));

// Accounts are read in pages by id, so every account is reached however many there are.
const USER_PAGE_SIZE = 500;

async function countOf(query, what) {
  const { count, error } = await query;
  if (error) throw new Error(`${what} count failed: ${error.message}`);
  return count || 0;
}

/** Awards what one account has earned and returns how many stamps that was. */
async function awardForUser(userId) {
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('Stamp')
    .select('stamp_type')
    .eq('user_id', userId);
  if (existingErr) throw new Error(`stamp lookup failed: ${existingErr.message}`);
  const earnedTypes = new Set((existing || []).map((s) => s.stamp_type));
  if (MILESTONES.every((m) => earnedTypes.has(m.stamp_type))) return 0;

  const totalMail = await countOf(
    supabaseAdmin.from('Mail').select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', userId).is('deleted_at', null),
    'mail',
  );
  // Every other milestone counts mail the person received, so none can be met without any.
  if (totalMail === 0) return 0;

  const counts = { totalMail, packages: 0, vaultFiled: 0 };
  if (MILESTONES.some((m) => m.stamp_type === 'first_package' && !earnedTypes.has(m.stamp_type))) {
    // A package belongs to a person through the mail it came with.
    counts.packages = await countOf(
      supabaseAdmin.from('MailPackage').select('id, mail:Mail!inner(recipient_user_id)', { count: 'exact', head: true })
        .eq('mail.recipient_user_id', userId),
      'package',
    );
  }
  counts.vaultFiled = await countOf(
    supabaseAdmin.from('Mail').select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', userId).not('vault_folder_id', 'is', null).is('deleted_at', null),
    'vault',
  );

  let awarded = 0;
  for (const milestone of MILESTONES) {
    if (earnedTypes.has(milestone.stamp_type)) continue;
    if (!milestone.check(counts)) continue;

    const { error } = await supabaseAdmin.from('Stamp').insert({
      user_id: userId,
      stamp_type: milestone.stamp_type,
      name: milestone.name,
      rarity: milestone.rarity,
      earned_by: 'milestone',
      displayed_in_gallery: true,
      color_palette: ['#7C3AED', '#F59E0B', '#10B981'],
    });
    if (error) {
      logger.error('[StampAwarder] Failed to award stamp', { userId, stampType: milestone.stamp_type, error: error.message });
      continue;
    }
    awarded++;
    logger.info(`[StampAwarder] Awarded ${milestone.stamp_type} to user ${userId}`);
  }
  return awarded;
}

/**
 * @param {{ userIds?: string[] }} [options] A targeted run for those accounts only (a manual check);
 *   the scheduled run passes nothing and covers everyone.
 */
async function stampAwarder(options = {}) {
  logger.info('[StampAwarder] Starting stamp award check');
  const only = Array.isArray(options?.userIds) ? options.userIds : null;

  let awarded = 0;
  let scanned = 0;
  let lastId = null;
  for (;;) {
    let query = supabaseAdmin.from('User').select('id').order('id', { ascending: true }).limit(USER_PAGE_SIZE);
    if (only) query = query.in('id', only);
    if (lastId) query = query.gt('id', lastId);
    // eslint-disable-next-line no-await-in-loop
    const { data: users, error: userErr } = await query;

    if (userErr) {
      logger.error('[StampAwarder] Failed to query users', { error: userErr.message });
      return;
    }
    if (!users || users.length === 0) break;

    for (const user of users) {
      try {
        // eslint-disable-next-line no-await-in-loop
        awarded += await awardForUser(user.id);
      } catch (err) {
        logger.error('[StampAwarder] Error processing user', { userId: user.id, error: err.message });
      }
    }
    scanned += users.length;
    lastId = users[users.length - 1].id;
    if (users.length < USER_PAGE_SIZE) break;
  }

  logger.info(`[StampAwarder] Complete: ${awarded} stamps awarded across ${scanned} accounts`);
}

module.exports = stampAwarder;
// The stamps this job can award; the gallery lists only these (plus any already earned).
module.exports.AWARDED_STAMP_TYPES = new Set(MILESTONES.map((m) => m.stamp_type));
