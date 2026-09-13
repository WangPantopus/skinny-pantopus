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
  return { state: r.state, home_id: r.home_id, postcard_id: r.postcard_id,
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
  return rpc('verify_home_postcard_current', { ...args, p_submitted_hash: hashPostcardCode(input.code), p_validity_days: validityDays() });
}
async function read(input) { return rpc('get_home_postcard_verification', identity(input)); }
async function cancel(input) { return rpc('cancel_home_postcard_verification', identity(input)); }
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
          link: `/homes/${r.home_id}/${userId === r.target_id ? 'residency' : 'occupants'}`, metadata: { home_id: r.home_id },
        });
      } catch (_) { /* A failed notification cannot undo the recorded challenge. */ }
    }
  }
  return { message: 'Member access has been suspended pending review' };
}
module.exports = { submit, read, cancel, send, challenge, sendError: require('./homePostcardRequestService').sendError };
