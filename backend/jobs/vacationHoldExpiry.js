// Reconcile due vacation dates and User summaries atomically per user, then
// keep everyone's held mail in line with their holds (services/mailVacation:
// a sync that failed after a change is made good here).
// Stored delivery preferences do not execute postal/carrier handling.
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { personTimeZone, FALLBACK_TIME_ZONE } = require('../services/mailDelivery');
const { syncHeldMailSafe } = require('../services/mailVacation');

async function vacationHoldExpiry() {
  // Include tomorrow in UTC: it may already be the local day east of the date line.
  // The per-person transaction decides whether a transition is actually due.
  const today = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
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
        const { error } = await supabaseAdmin.rpc('vacation_hold_transition_in_zone', {
          p_user_id: userId, p_action: 'status', p_time_zone: (await personTimeZone(userId)) || FALLBACK_TIME_ZONE,
        });
        if (error) throw error;
      } catch (error) {
        failedUsers += 1;
        logger.error('[VacationHold] User reconciliation failed', { userId, error: error.message });
      }
    }
    // Everyone with a hold in effect or coming: their waiting mail matches it.
    const holders = new Set();
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseAdmin.from('VacationHold').select('user_id')
        .in('status', ['scheduled', 'active']).order('id').range(offset, offset + 499);
      if (error) throw error;
      for (const hold of data || []) holders.add(hold.user_id);
      if ((data || []).length < 500) break;
    }
    for (const userId of [...new Set([...holders, ...userIds])]) await syncHeldMailSafe(userId);
    if (failedUsers > 0) throw new Error(`Vacation reconciliation failed for ${failedUsers} user(s)`);
    logger.info('[VacationHold] Complete', { users: userIds.size, holders: holders.size });
  } catch (error) {
    logger.error('[VacationHold] Reconciliation failed', { error: error.message });
    throw error;
  }
}

module.exports = vacationHoldExpiry;
