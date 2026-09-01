// ============================================================
// VACATION HOLD EXPIRY JOB
// Expires completed vacation holds and releases held mail.
// Activates scheduled holds that have reached their start date.
// Runs hourly.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function vacationHoldExpiry() {
  const now = new Date().toISOString();
  logger.info('[VacationHold] Starting vacation hold expiry check');

  // ── Expire completed holds ──
  const { data: expired, error: expErr } = await supabaseAdmin
    .from('VacationHold')
    .update({ status: 'completed' })
    .eq('status', 'active')
    .lt('end_date', now)
    .select('id, user_id');

  if (expErr) {
    logger.error('[VacationHold] Failed to expire holds', { error: expErr.message });
  } else if (expired && expired.length > 0) {
    logger.info(`[VacationHold] Expired ${expired.length} holds`);
    // Clear user vacation mode
    const userIds = expired.map(h => h.user_id);
    await supabaseAdmin
      .from('User')
      .update({ vacation_mode: false, vacation_start: null, vacation_end: null })
      .in('id', userIds);
  }

  // ── Activate scheduled holds ──
  const { data: activated, error: actErr } = await supabaseAdmin
    .from('VacationHold')
    .update({ status: 'active' })
    .eq('status', 'scheduled')
    .lte('start_date', now)
    .select('id, user_id');

  if (actErr) {
    logger.error('[VacationHold] Failed to activate holds', { error: actErr.message });
  } else if (activated && activated.length > 0) {
    logger.info(`[VacationHold] Activated ${activated.length} scheduled holds`);
    for (const hold of activated) {
      await supabaseAdmin
        .from('User')
        .update({ vacation_mode: true })
        .eq('id', hold.user_id);
    }
  }

  logger.info('[VacationHold] Complete', {
    expired: expired?.length || 0,
    activated: activated?.length || 0,
  });
}

module.exports = vacationHoldExpiry;
