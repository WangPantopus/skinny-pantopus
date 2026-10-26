// Review-window promotion uses the same locked current policy as code entry.
// Candidate reads are paginated so an earlier blocked Home cannot starve later
// eligible rows. A saved result still requires a fresh client access check.
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { validityDays } = require('../utils/verificationAge');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PROBATION_WAIT_DAYS = 7;
const PROBATION_MAX_AGE_DAYS = 30;
const sameIds = (rows, cursor) => rows.some((row, index) => ![row?.id, row?.home_id, row?.user_id]
  .every(v => typeof v === 'string' && UUID.test(v)) || (index > 0 ? row.id <= rows[index - 1].id : cursor && row.id <= cursor));

// Home claims plan, PR 4 (founder approval 2026-10-25): a household-review request nobody has answered for 7 days
// is admitted on probation (admit_home_residency_probation), for residents only; ownership claims never come here.
// The address watch is read again first: a high level holds the request (a case in the admin queue) and a medium
// level gets a 14-day window instead of 7. Probation opens no household records. The newcomer and the household's
// reviewers are told; a failed notice can't undo the admission.
// Only requests saved in the last 30 days are admitted (decided 2026-10-26): the first run after the flag turns on
// would otherwise put months-old requests on probation, surprising both sides about a request nobody is watching.
// Older ones stay pending, as before the flag; the household can still answer and the person can verify by mail.
// Going forward every new request reaches 7 days inside that window.
// A request with an open address-watch case stays held until it's proven, so it's skipped before the watch (about
// ten reads) runs again; the SQL holds it too. The case is about the person, or about the home when the reasons are
// the address's (watchResidencyRequest opens them the same way for every request), and either holds it.
// The home_residency_probation flag ships off; the founder turns it on after testing. The SQL rereads the row, and
// it's read here first too (the same audience: everyone, or the listed accounts) so that while probation is off the
// pass reads nothing and the address watch opens no admin queue case.
async function admitUnansweredRequests() {
  const flag = await require('../services/featureFlagService').getFlag('home_residency_probation').catch(() => null);
  const listed = new Set(Array.isArray(flag?.beta_user_ids) ? flag.beta_user_ids : []);
  if (flag?.enabled_globally !== true && !listed.size) return;
  const cutoff = new Date(Date.now() - PROBATION_WAIT_DAYS * 86400000).toISOString();
  const oldest = new Date(Date.now() - PROBATION_MAX_AGE_DAYS * 86400000).toISOString();
  const { OPEN_STATUSES } = require('../services/addressValidation/addressReviewService');
  let cursor = null, admitted = 0, held = 0, unavailable = 0;
  for (;;) {
    let query = supabaseAdmin.from('HomeOccupancy').select('id, home_id, user_id')
      .eq('verification_status', 'pending_approval').eq('is_active', true)
      .order('id', { ascending: true }).limit(200);
    if (cursor) query = query.gt('id', cursor);
    let response;
    try { response = await query; } catch (_) { response = null; }
    const rows = response?.data;
    if (response?.error || !Array.isArray(rows) || rows.length > 200 || sameIds(rows, cursor)) {
      logger.error('[processClaimWindows] Probation candidate read unavailable'); return;
    }
    if (!rows.length) break;
    cursor = rows.at(-1).id;
    let claims;
    try {
      claims = await supabaseAdmin.from('HomeResidencyClaim').select('id, home_id, user_id')
        .in('home_id', [...new Set(rows.map(row => row.home_id))]).in('user_id', [...new Set(rows.map(row => row.user_id))])
        .eq('status', 'pending').is('cold_start_mode', null).is('reviewed_by', null).lt('updated_at', cutoff)
        .gte('updated_at', oldest);
    } catch (_) { claims = null; }
    if (claims?.error || !Array.isArray(claims?.data)) { logger.error('[processClaimWindows] Probation request read unavailable'); return; }
    let holds = { data: [] };
    const users = [...new Set(claims.data.map(claim => claim?.user_id).filter(id => UUID.test(String(id))))];
    if (users.length) {
      try {
        holds = await supabaseAdmin.from('AddressReviewCase').select('home_id, user_id').eq('trigger', 'address_watch')
          .in('status', OPEN_STATUSES).in('home_id', [...new Set(claims.data.map(claim => claim?.home_id))])
          .or(`user_id.is.null,user_id.in.(${users.join(',')})`);
      } catch (_) { holds = null; }
      if (holds?.error || !Array.isArray(holds?.data)) { logger.error('[processClaimWindows] Probation hold read unavailable'); return; }
    }
    const members = new Set(rows.map(row => `${row.home_id}:${row.user_id}`));
    const heldRequests = new Set(holds.data.map(hold => (hold?.user_id ? `${hold.home_id}:${hold.user_id}` : `${hold?.home_id}:*`)));
    for (const claim of claims.data) {
      if (![claim?.id, claim?.home_id, claim?.user_id].every(v => typeof v === 'string' && UUID.test(v))
        || !members.has(`${claim.home_id}:${claim.user_id}`)) continue;
      if (flag.enabled_globally !== true && !listed.has(claim.user_id)) continue;
      if (heldRequests.has(`${claim.home_id}:${claim.user_id}`) || heldRequests.has(`${claim.home_id}:*`)) { held++; continue; }
      const watch = await admitOnProbation(claim);
      if (watch === 'admitted') admitted++; else if (watch === 'held') held++; else if (watch === 'unavailable') unavailable++;
    }
    if (rows.length < 200) break;
  }
  if (admitted || held || unavailable) logger.info('[processClaimWindows] Probation', { admitted, held, unavailable });
}

async function admitOnProbation(claim) {
  // A high level holds it until it's proven; the watch opens the admin queue case (about the person or the home).
  const assessment = await require('../utils/homeSecurityPolicy').watchResidencyRequest({ homeId: claim.home_id,
    userId: claim.user_id, source: 'residency_probation' });
  if (assessment?.level === 'high') return 'held';
  if (!['low', 'medium'].includes(assessment?.level)) return 'unavailable';
  let result;
  try {
    const response = await supabaseAdmin.rpc('admit_home_residency_probation', { p_home_id: claim.home_id,
      p_actor_id: claim.user_id, p_claim_id: claim.id, p_wait_days: PROBATION_WAIT_DAYS,
      p_window_days: assessment.level === 'medium' ? 14 : 7, p_max_age_days: PROBATION_MAX_AGE_DAYS });
    if (response?.error || !response?.data) return 'unavailable';
    result = response.data;
  } catch (_) { return 'unavailable'; }
  if (result.ok === true && result.admitted === false) return result.held === true ? 'held' : 'skipped';
  const reviewers = result.reviewer_ids;
  if (result.ok !== true || result.admitted !== true || result.home_id !== claim.home_id || result.user_id !== claim.user_id
    || !Array.isArray(reviewers) || reviewers.some(id => typeof id !== 'string' || !UUID.test(id) || id === claim.user_id)) {
    return 'unavailable';
  }
  try {
    const notifications = require('../services/notificationService');
    const [people, home] = await Promise.all([require('../services/chatPeople').loadChatPeople([claim.user_id]),
      supabaseAdmin.from('Home').select('name, address').eq('id', claim.home_id).maybeSingle()]);
    const name = people.get(String(claim.user_id))?.displayName || 'Someone';
    const homeName = home?.data?.name || home?.data?.address || 'your home';
    // How long the request has waited, from when it was saved (it can be up to 30 days).
    const days = Math.floor((Date.now() - Date.parse(result.request_saved_at)) / 86400000);
    const waited = Number.isFinite(days) && days >= PROBATION_WAIT_DAYS ? `${days} days` : 'over a week';
    await notifications.createNotification({ userId: claim.user_id, type: 'residency_probation_started',
      title: 'Your request is on probation',
      body: `Nobody in the household has answered in ${waited}. Household records stay private until someone there says yes or you verify your address by mail.`,
      link: `/homes/${claim.home_id}/residency`, metadata: { home_id: claim.home_id, claim_id: claim.id } });
    for (const userId of reviewers) {
      await notifications.createNotification({ userId, type: 'residency_probation_household',
        title: 'A request to join is on probation',
        body: `${name} asked to join ${homeName} ${waited} ago and nobody answered, so they're on probation. They can't see household records. Approve or deny their request.`,
        link: `/homes/${claim.home_id}/owners/review-claim?tab=residency`,
        metadata: { home_id: claim.home_id, claim_id: claim.id, claimant_id: claim.user_id } });
    }
  } catch (_) { logger.warn('[processClaimWindows] Probation notification unavailable'); }
  return 'admitted';
}

async function processExpiredClaimWindows() {
  const cutoff = new Date().toISOString();
  let cursor = null, promoted = 0, checked = 0, unavailable = 0;
  for (;;) {
    let query = supabaseAdmin.from('HomeOccupancy').select('id, home_id, user_id')
      .eq('verification_status', 'provisional').eq('is_active', true)
      // Time never promotes probation (PR 4): only a reviewer's yes or a proved address ends it.
      .neq('verification_source', 'probation')
      .not('challenge_window_ends_at', 'is', null).lt('challenge_window_ends_at', cutoff)
      .order('id', { ascending: true }).limit(200);
    if (cursor) query = query.gt('id', cursor);
    let response;
    try { response = await query; } catch (_) { response = null; }
    const rows = response?.data;
    if (response?.error || !Array.isArray(rows) || rows.length > 200 || sameIds(rows, cursor)) {
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
      // A proof beats a claim: anyone whose claim now steps back, and the person who proved it, are told.
      await require('../services/homeInstantClaimService').tellProofOverClaims({ homeId: row.home_id, provenUserId: row.user_id });
    }
    if (rows.length < 200) break;
  }
  if (checked) logger.info('[processClaimWindows] Completed', { promoted, checked, unavailable });
  await admitUnansweredRequests();
}
module.exports = processExpiredClaimWindows;
