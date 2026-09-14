// Review-window promotion uses the same locked current policy as code entry.
// Candidate reads are paginated so an earlier blocked Home cannot starve later
// eligible rows. A saved result still requires a fresh client access check.
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { validityDays } = require('../utils/verificationAge');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

async function processExpiredClaimWindows() {
  const cutoff = new Date().toISOString();
  let cursor = null, promoted = 0, checked = 0, unavailable = 0;
  for (;;) {
    let query = supabaseAdmin.from('HomeOccupancy').select('id, home_id, user_id')
      .eq('verification_status', 'provisional').eq('is_active', true)
      .not('challenge_window_ends_at', 'is', null).lt('challenge_window_ends_at', cutoff)
      .order('id', { ascending: true }).limit(200);
    if (cursor) query = query.gt('id', cursor);
    let response;
    try { response = await query; } catch (_) { response = null; }
    const rows = response?.data;
    if (response?.error || !Array.isArray(rows) || rows.length > 200
      || rows.some((row, index) => ![row?.id, row?.home_id, row?.user_id].every(v => typeof v === 'string' && UUID.test(v))
        || (index > 0 ? row.id <= rows[index - 1].id : cursor && row.id <= cursor))) {
      logger.error('[processClaimWindows] Candidate read unavailable'); return;
    }
    if (!rows.length) break;
    cursor = rows.at(-1).id;
    for (const row of rows) {
      checked++;
      let result;
      try {
        const response = await supabaseAdmin.rpc('promote_home_postcard_review', {
          p_home_id: row.home_id, p_actor_id: row.user_id, p_occupancy_id: row.id, p_validity_days: validityDays(),
        });
        if (response?.error || !response?.data) { unavailable++; continue; }
        result = response.data;
      } catch (_) { unavailable++; continue; }
      if (result.ok === false || (result.ok === true && result.promoted === false)) continue;
      if (result.ok !== true || result.promoted !== true || result.home_id !== row.home_id
        || result.user_id !== row.user_id || result.occupancy_id !== row.id) { unavailable++; continue; }
      promoted++;
      try {
        await require('../services/notificationService').createNotification({
          userId: row.user_id, type: 'challenge_window_passed', title: 'Residency review recorded',
          body: 'Your mail review window is complete. Check your Home status for current access.',
          link: `/homes/${row.home_id}/residency`, metadata: { home_id: row.home_id },
        });
      } catch (_) { logger.warn('[processClaimWindows] Status notification unavailable'); }
    }
    if (rows.length < 200) break;
  }
  if (checked) logger.info('[processClaimWindows] Completed', { promoted, checked, unavailable });
}
module.exports = processExpiredClaimWindows;
