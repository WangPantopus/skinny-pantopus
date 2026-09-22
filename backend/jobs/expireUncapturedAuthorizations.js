// Expiry cancellation uses current provider Charge proof and durable receipts.
// The scheduling booking sweep below retains its existing independent policy.
const supabaseAdmin = require('../config/supabaseAdmin');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');
const logger = require('../utils/logger');
const bookingService = require('../services/scheduling/bookingService');

// ─── Part 0: abandoned / auth-expiring BOOKING payments ───
//
// A priced booking inserts its 'pending' row BEFORE the PaymentIntent is confirmed, and a
// pending row occupies the slot (Booking_no_overlap counts pending+confirmed). An invitee
// who abandons checkout therefore blocks the slot indefinitely. Two cases:
//   (a) intent never completed (authorize_pending past a 30-min TTL) — dead checkout;
//   (b) authorized but the host never approved and the card hold is about to lapse.
// Both cancel via bookingService.cancelBooking(system): its guarded CAS loses cleanly to a
// concurrent approval, and its refund path releases/refunds the hold.
// NOTE: authorized + pending is NORMAL for approval-gated bookings — case (b) deliberately
// waits for authorization_expires_at rather than a short TTL.
async function sweepAbandonedBookingPayments(now, twentyFourHoursFromNow) {
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const candidates = [];
  const { data: dead } = await supabaseAdmin
    .from('Payment')
    .select('id, booking_id, payment_status')
    .eq('payment_type', 'booking_payment')
    .eq('payment_status', PAYMENT_STATES.AUTHORIZE_PENDING)
    .lt('created_at', thirtyMinAgo)
    .not('booking_id', 'is', null);
  const { data: lapsing } = await supabaseAdmin
    .from('Payment')
    .select('id, booking_id, payment_status')
    .eq('payment_type', 'booking_payment')
    .eq('payment_status', PAYMENT_STATES.AUTHORIZED)
    .lte('authorization_expires_at', twentyFourHoursFromNow.toISOString())
    .not('booking_id', 'is', null);
  candidates.push(...(dead || []), ...(lapsing || []));
  let released = 0;
  for (const payment of candidates) {
    try {
      const { data: booking } = await supabaseAdmin.from('Booking').select('id, status').eq('id', payment.booking_id).maybeSingle();
      if (!booking || booking.status !== 'pending') continue;
      await bookingService.cancelBooking(booking.id, null, 'Payment was not completed in time.', 'system');
      released += 1;
    } catch (err) {
      if (err && err.code === 'BAD_STATE') continue; // lost the race to a real approval — fine
      logger.error('expireUncapturedAuths: booking sweep item failed', { paymentId: payment.id, error: err.message });
    }
  }
  if (released > 0) logger.info('expireUncapturedAuths: released abandoned booking slots', { count: released });
}

async function expireUncapturedAuthorizations() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  try { await sweepAbandonedBookingPayments(now, tomorrow); }
  catch (_) { logger.error('expireUncapturedAuths: booking sweep failed'); }
  return { sweptBookings: true };
}
module.exports = expireUncapturedAuthorizations;
