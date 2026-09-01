// ============================================================
// JOB: Expire Past-Deadline Gigs
// Cancels open gigs whose deadline has passed.
// Runs every 15 minutes.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function expireGigs() {
  const now = new Date().toISOString();

  const { data: expired, error } = await supabaseAdmin
    .from('Gig')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      updated_at: now,
    })
    .eq('status', 'open')
    .not('deadline', 'is', null)
    .lt('deadline', now)
    .select('id, user_id, title');

  if (error) {
    logger.error('[expireGigs] Failed to cancel expired gigs', { error: error.message });
    return;
  }

  const count = expired ? expired.length : 0;
  if (count === 0) return;

  logger.info('[expireGigs] Cancelled past-deadline gigs', {
    count,
    gig_ids: expired.map((g) => g.id),
  });
}

module.exports = expireGigs;
