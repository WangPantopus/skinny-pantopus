const supabaseAdmin = require('../config/supabaseAdmin');
const { generatePostcardCode, hashPostcardCode, dispatchPostcardCode } = require('../utils/postcardDispatch');

const SAFE_COLUMNS = 'id, requested_at, expires_at, status, dispatch_status, vendor_job_id';
const unknown = card => !card.vendor_job_id && card.dispatch_status !== 'rejected';
function envelope(card, reused = false) {
  const deliveryUnknown = unknown(card);
  return {
    message: deliveryUnknown
      ? 'Your request is saved, but mail delivery is not confirmed. You can enter the code if it arrives. Check status before requesting another card.'
      : reused ? 'A verification postcard has already been requested. Enter its code when it arrives.'
        : 'Your verification postcard was accepted for mailing. Enter its code when it arrives.',
    delivery_unknown: deliveryUnknown,
    reused,
    postcard: {
      id: card.id, requested_at: card.requested_at, expires_at: card.expires_at,
      status: card.status, dispatch_status: deliveryUnknown ? 'delivery_unknown' : card.dispatch_status,
    },
  };
}
function fail(status, message, code) {
  return { status, body: { error: message, code } };
}
async function status(homeId, userId) {
  const { data: card, error } = await supabaseAdmin.from('HomePostcardCode').select(SAFE_COLUMNS)
    .eq('home_id', homeId).eq('user_id', userId).eq('status', 'pending')
    .gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) return fail(503, 'Could not check postcard status. Please retry.', 'POSTCARD_STATUS_UNAVAILABLE');
  if (!card) return fail(404, 'No pending verification code found.', 'NO_POSTCARD');
  return { status: 200, body: envelope(card, true) };
}

async function request(homeId, userId) {
  const code = generatePostcardCode();
  const { data: admission, error } = await supabaseAdmin.rpc('admit_home_postcard', {
    p_home_id: homeId, p_user_id: userId, p_code_hash: hashPostcardCode(code),
  });
  if (error || !admission) return fail(503, 'Could not save your postcard request. Please retry.', 'POSTCARD_ADMISSION_UNAVAILABLE');
  if (admission.error) {
    if (admission.error === 'HOME_NOT_FOUND') return fail(404, 'Home not found.', admission.error);
    if (admission.error === 'ADDRESS_INCOMPLETE') return fail(422, 'This home needs a complete mailing address.', admission.error);
    if (['ADDRESS_LIMIT', 'USER_LIMIT'].includes(admission.error)) {
      return fail(429, 'The postcard request limit has been reached. Please try again later.', admission.error);
    }
    return fail(503, 'Could not save your postcard request. Please retry.', 'POSTCARD_ADMISSION_UNAVAILABLE');
  }
  const card = admission.postcard;
  if (!card?.id) return fail(503, 'Could not save your postcard request. Please retry.', 'POSTCARD_ADMISSION_UNAVAILABLE');
  if (admission.reused) return { status: unknown(card) ? 202 : 200, body: envelope(card, true) };

  const { data: claimed, error: claimError } = await supabaseAdmin.from('HomePostcardCode')
    .update({ dispatch_status: 'dispatching', updated_at: new Date().toISOString() })
    .eq('id', card.id).eq('status', 'pending').eq('dispatch_status', 'pending').select('id');
  if (claimError || !claimed?.length) return { status: 202, body: envelope(card) };
  const sent = await dispatchPostcardCode(card.destination, code, card.id);
  // No later HTTP retry resends an uncertain request. Only this worker has the
  // original plaintext, and the provider retries that identical payload in memory.
  const changes = sent.success
    ? { vendor_job_id: sent.vendorJobId, dispatch_status: 'accepted' }
    : sent.deliveryUnknown ? { dispatch_status: 'delivery_unknown' }
      : { dispatch_status: 'rejected', status: 'cancelled' };
  const { data: saved, error: saveError } = await supabaseAdmin.from('HomePostcardCode')
    .update({ ...changes, updated_at: new Date().toISOString() }).eq('id', card.id)
    .eq('dispatch_status', 'dispatching').select(SAFE_COLUMNS).maybeSingle();
  if (saveError || !saved) {
    // A signed webhook may have already saved the receipt, or the write outcome
    // may be unknown. Reading is safe; never cancel proof on receipt-write error.
    const current = await status(homeId, userId);
    return current.status === 200 ? { ...current, status: current.body.delivery_unknown ? 202 : 200 }
      : { status: 202, body: envelope(card) };
  }
  if (!sent.success && !sent.deliveryUnknown) return fail(502, 'We could not send mail to this address. Please try again later.', 'POSTCARD_REJECTED');
  return { status: sent.success ? 201 : 202, body: envelope(saved) };
}

// Called only after the Lob route verifies the signature. Correlation lives in
// a distinct namespace so a native receipt cannot bind a modern mail job.
async function processWebhookEvent(vendorJobId, eventType, event) {
  const id = event?.body?.metadata?.pantopus_home_postcard_id;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)
    || event?.body?.id !== vendorJobId || event?.body?.object !== 'postcard') return { success: false };
  const { data: card, error } = await supabaseAdmin.from('HomePostcardCode')
    .select('id, vendor_job_id, dispatch_status').eq('id', id).maybeSingle();
  if (error) return { success: false, retryable: true };
  if (!card || (card.vendor_job_id && card.vendor_job_id !== vendorJobId)
    || !['dispatching', 'delivery_unknown', 'accepted'].includes(card.dispatch_status)) return { success: false };
  const { data: saved, error: saveError } = await supabaseAdmin.from('HomePostcardCode')
    .update({ vendor_job_id: vendorJobId, dispatch_status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', id).eq('dispatch_status', card.dispatch_status)
    .filter('vendor_job_id', card.vendor_job_id ? 'eq' : 'is', card.vendor_job_id || null).select('id');
  return { success: !saveError && !!saved?.length, retryable: !!saveError || !saved?.length };
}
module.exports = { request, status, processWebhookEvent };
