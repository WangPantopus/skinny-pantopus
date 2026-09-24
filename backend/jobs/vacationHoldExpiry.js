// Reconcile due vacation dates and User summaries atomically per user.
// Stored delivery preferences do not execute postal/carrier handling.
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function vacationHoldExpiry() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [ending, starting] = await Promise.all([
      supabaseAdmin.from('VacationHold').select('user_id')
        .eq('status', 'active').lte('end_date', today),
      supabaseAdmin.from('VacationHold').select('user_id')
        .eq('status', 'scheduled').lte('start_date', today),
    ]);
    if (ending.error) throw ending.error;
    if (starting.error) throw starting.error;
    const userIds = [...new Set([...(ending.data || []), ...(starting.data || [])]
      .map(hold => hold.user_id))].sort();
    for (const userId of userIds) {
      const { error } = await supabaseAdmin.rpc('vacation_hold_transition', {
        p_user_id: userId, p_action: 'status',
      });
      if (error) throw error;
    }
    logger.info('[VacationHold] Complete', { users: userIds.length });
  } catch (error) {
    logger.error('[VacationHold] Reconciliation failed', { error: error.message });
    throw error;
  }
}

module.exports = vacationHoldExpiry;
