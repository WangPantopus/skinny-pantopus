// Reconcile due vacation dates and User summaries atomically per user.
// Stored delivery preferences do not execute postal/carrier handling.
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function vacationHoldExpiry() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const userIds = new Set();
    // Read every due row before transitions change the result set. Explicit
    // bounded pages avoid PostgREST's default row cap starving later users.
    for (const [status, dateColumn] of [['active', 'end_date'], ['scheduled', 'start_date']]) {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabaseAdmin.from('VacationHold').select('id,user_id')
          .eq('status', status).lte(dateColumn, today).order('id').range(offset, offset + 499);
        if (error) throw error;
        for (const hold of data || []) userIds.add(hold.user_id);
        if ((data || []).length < 500) break;
      }
    }
    let failedUsers = 0;
    for (const userId of [...userIds].sort()) {
      try {
        const { error } = await supabaseAdmin.rpc('vacation_hold_transition', {
          p_user_id: userId, p_action: 'status',
        });
        if (error) throw error;
      } catch (error) {
        failedUsers += 1;
        logger.error('[VacationHold] User reconciliation failed', { userId, error: error.message });
      }
    }
    if (failedUsers > 0) throw new Error(`Vacation reconciliation failed for ${failedUsers} user(s)`);
    logger.info('[VacationHold] Complete', { users: userIds.size });
  } catch (error) {
    logger.error('[VacationHold] Reconciliation failed', { error: error.message });
    throw error;
  }
}

module.exports = vacationHoldExpiry;
