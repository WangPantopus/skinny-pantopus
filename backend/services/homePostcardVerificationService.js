const db = require('../config/supabaseAdmin');
const { hashPostcardCode } = require('../utils/postcardDispatch');
const { validityDays } = require('../utils/verificationAge');
const { MESSAGES, STATUS_CODES, failure } = require('../utils/homePostcardErrors');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
function identity({ homeId, actorId, postcardId, requestId }) {
  if (![homeId, actorId, postcardId, requestId].every(value => typeof value === 'string' && UUID.test(value))) throw failure('POSTCARD_VERIFICATION_INVALID', 400);
  return { p_home_id: homeId.toLowerCase(), p_actor_id: actorId.toLowerCase(),
    p_postcard_id: postcardId.toLowerCase(), p_request_id: requestId.toLowerCase() };
}
async function rpc(name, args) {
  let result;
  try { result = await db.rpc(name, args); } catch (_) { throw failure(); }
  if (!result || result.error || !result.data) throw failure();
  const r = result.data;
  if (r.ok === false && Object.hasOwn(MESSAGES, r.code) && STATUS_CODES.includes(r.status)) throw failure(r.code, r.status);
  if (r.ok !== true || !['pending', 'completed', 'rejected', 'cancelled'].includes(r.state)
    || r.home_id !== args.p_home_id || r.postcard_id !== args.p_postcard_id
    || r.command?.actor_id !== args.p_actor_id || r.command?.request_id !== args.p_request_id
    || !date(r.command.created_at) || !date(r.command.updated_at)) throw failure();
  if (r.state === 'completed') {
    if (!['verified', 'provisional'].includes(r.verification_status) || !date(r.recorded_at)
      || (r.challenge_window_ends_at !== null && (r.verification_status !== 'provisional' || !date(r.challenge_window_ends_at)))
      || r.code !== null || r.status !== null || r.attempts_remaining !== null) throw failure();
  } else if (r.verification_status !== null || r.recorded_at !== null || r.challenge_window_ends_at !== null) throw failure();
  if (r.state === 'rejected') {
    if (!Object.hasOwn(MESSAGES, r.code) || !STATUS_CODES.includes(r.status)
      || (r.code === 'POSTCARD_WRONG_CODE' ? !Number.isInteger(r.attempts_remaining) || r.attempts_remaining < 0 || r.attempts_remaining > 4
        : r.attempts_remaining !== null)) throw failure();
  } else if (r.code !== null || r.status !== null || r.attempts_remaining !== null) throw failure();
  return { state: r.state, home_id: r.home_id, postcard_id: r.postcard_id, replayed: r.replayed,
    command: { actor_id: r.command.actor_id, request_id: r.command.request_id, created_at: r.command.created_at, updated_at: r.command.updated_at },
    ...(r.state === 'completed' ? { verification_status: r.verification_status, recorded_at: r.recorded_at,
      challenge_window_ends_at: r.challenge_window_ends_at, current_access: 'not_checked' } : {}),
    ...(r.state === 'rejected' ? { code: r.code, status: r.status, error: MESSAGES[r.code],
      ...(r.code === 'POSTCARD_WRONG_CODE' ? { attempts_remaining: r.attempts_remaining } : {}) } : {}),
  };
}
async function submit(input) {
  const args = identity(input);
  if (typeof input.code !== 'string' || !/^[a-z0-9]{6,8}$/i.test(input.code)) throw failure('POSTCARD_VERIFICATION_INVALID', 400);
  const result = await rpc('verify_home_postcard_current', { ...args, p_submitted_hash: hashPostcardCode(input.code), p_validity_days: validityDays() });
  if (result.replayed === false && result.code === 'POSTCARD_DISPUTE_RECORDED') alertDispute(args.p_home_id, args.p_actor_id);
  delete result.replayed;
  return result;
}
async function read(input) { const result = await rpc('get_home_postcard_verification', identity(input)); delete result.replayed; return result; }
async function cancel(input) { const result = await rpc('cancel_home_postcard_verification', identity(input)); delete result.replayed; return result; }

// Home claims PR 4: a probationer the household said no to proved the address, so a dispute waits in the Pantopus
// review queue (verify_home_postcard_current). The admins are emailed once per new dispute: the queue has no screen.
function alertDispute(homeId, actorId) {
  (async () => {
    const { data, error } = await db.from('AddressReviewCase').select('id').eq('home_id', homeId).eq('user_id', actorId)
      .eq('trigger', 'probation_dispute').in('status', ['open', 'in_review']).order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (error || !data?.id) return;
    const home = await db.from('Home').select('city, state').eq('id', homeId).maybeSingle();
    await require('./adminAlerts').notifyProbationDisputeToReview({ caseId: data.id, home: home?.data || null });
  })().catch(() => { /* The case is in the queue either way. */ });
}

// Pantopus decides a probation dispute from the review queue (routes/adminAddressReview.js; founder decision
// 2026-10-26): approved restores the membership as a resident verified by mail, rejected keeps the household's no for
// good, dismissed closes it without a decision (resolve_home_probation_dispute). The person is told a restore or a
// rejection, and the household's reviewers a restore. Returns null for any other case, which the generic resolver
// handles; otherwise { success, status?, error? }.
async function resolveDisputeCase({ caseId, reviewerId, outcome, note = null }) {
  if (!UUID.test(String(caseId)) || !UUID.test(String(reviewerId))) return null;
  const { data, error } = await db.rpc('resolve_home_probation_dispute', { p_case_id: caseId.toLowerCase(),
    p_reviewer_id: reviewerId.toLowerCase(), p_outcome: outcome, p_note: note, p_validity_days: validityDays() });
  if (error || !data || typeof data !== 'object') throw new Error('Probation dispute could not be resolved');
  if (data.ok === true && data.handled === false) return null;
  if (data.ok !== true) {
    if (data.code === 'REVIEW_CASE_RESOLVED') return { success: false, error: 'Case not found or already resolved' };
    if (data.code === 'PROBATION_DISPUTE_CHANGED') {
      return { success: false, status: 409, error: 'Their membership, this Home or their proof changed, so it can\'t be restored. Reject or dismiss the case instead.' };
    }
    return { success: false, status: 400, error: 'Invalid outcome' };
  }
  if (!UUID.test(data.home_id || '') || !UUID.test(data.user_id || '')) return { success: true };
  const notify = async (notice) => {
    try { await require('./notificationService').createNotification(notice); } catch (_) { /* The decision stands. */ }
  };
  if (data.outcome === 'declined') {
    await notify({ userId: data.user_id, type: 'residency_rejected', title: 'Pantopus reviewed your proof', icon: '📬',
      body: `Pantopus kept the household's answer for ${data.home_label}. To join, ask someone in the household to invite you.`,
      link: `/homes/${data.home_id}/residency`, metadata: { home_id: data.home_id } });
  } else if (data.outcome === 'restored') {
    await notify({ userId: data.user_id, type: 'residency_approved', title: 'Welcome back', icon: '🏡',
      body: `Pantopus reviewed your proof of address and restored your membership at ${data.home_label}.`,
      link: `/homes/${data.home_id}/dashboard`, metadata: { home_id: data.home_id } });
    let name = 'Someone';
    try { name = (await require('./chatPeople').loadChatPeople([data.user_id])).get(String(data.user_id))?.displayName || name; }
    catch (_) { /* The notice still goes out. */ }
    for (const userId of Array.isArray(data.reviewer_ids) ? data.reviewer_ids : []) {
      if (!UUID.test(String(userId)) || userId === data.user_id) continue;
      await notify({ userId, type: 'residency_probation_household', title: 'A member was restored',
        body: `Pantopus reviewed ${name}'s proof of address and restored their membership at ${data.home_label}.`,
        link: `/homes/${data.home_id}/members`, metadata: { home_id: data.home_id, member_id: data.user_id } });
    }
  }
  return { success: true };
}
function send(res, result) {
  res.set('Cache-Control', 'private, no-store');
  if (result.state === 'rejected') return res.status(result.status).json(result);
  const message = result.state === 'completed'
    ? 'Your code verification is recorded. Check your residency status for the review outcome and current Home access.'
    : result.state === 'cancelled' ? 'This code attempt was cancelled. It cannot verify a postcard or consume an attempt.'
      : 'This code attempt is still being resolved. Check its status.';
  return res.status(result.state === 'pending' ? 202 : 200).json({ ...result, message });
}
async function challenge({ homeId, actorId, occupancyId }) {
  if (![homeId, actorId, occupancyId].every(value => typeof value === 'string' && UUID.test(value))) throw failure('POSTCARD_REVIEW_INVALID', 400);
  let response;
  try { response = await db.rpc('challenge_home_postcard_review', { p_home_id: homeId.toLowerCase(), p_actor_id: actorId.toLowerCase(), p_occupancy_id: occupancyId.toLowerCase() }); }
  catch (_) { throw failure(); }
  if (!response || response.error || !response.data) throw failure();
  const r = response.data;
  if (r.ok === false && Object.hasOwn(MESSAGES, r.code) && STATUS_CODES.includes(r.status)) throw failure(r.code, r.status);
  if (r.ok !== true || typeof r.challenged !== 'boolean' || r.home_id !== homeId.toLowerCase()
    || r.occupancy_id !== occupancyId.toLowerCase() || typeof r.target_id !== 'string' || !UUID.test(r.target_id) || r.target_id === actorId.toLowerCase()) throw failure();
  if (r.challenged) {
    if (!Array.isArray(r.notify_user_ids) || r.notify_user_ids.some(id => typeof id !== 'string' || !UUID.test(id)
      || id === r.target_id || id === actorId.toLowerCase()) || new Set(r.notify_user_ids).size !== r.notify_user_ids.length) throw failure();
    for (const userId of [r.target_id, ...r.notify_user_ids]) {
      try {
        await require('./notificationService').createNotification({ userId,
          type: userId === r.target_id ? 'access_challenged' : 'member_challenged', title: 'Residency review changed',
          body: userId === r.target_id ? 'Your residency was challenged. Check your Home status for the next step.'
            : 'A residency review was challenged. Open household reviews for details.',
          link: `/homes/${r.home_id}/${userId === r.target_id ? 'residency' : 'members?tab=requests'}`, metadata: { home_id: r.home_id },
        });
      } catch (_) { /* A failed notification cannot undo the recorded challenge. */ }
    }
  }
  return { message: 'Member access has been suspended pending review' };
}
module.exports = { submit, read, cancel, send, challenge, resolveDisputeCase, sendError: require('./homePostcardRequestService').sendError };
