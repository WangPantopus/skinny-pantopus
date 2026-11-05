'use strict';

/**
 * Crew Day money (02-contract.md §3): the charge 24 hours after a home is done (the crewDayCharges job) or at once on
 * "Everything looks good", paid off-session with the card saved at booking through the shared invoice payment path
 * (services/invoicePayments.js); a declined card leaves the invoice for the household to pay in Pantopus, which marks
 * the booking paid. Payouts, the 48-hour review and refunds are the existing machinery's.
 */

const crypto = require('crypto');

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { skipForLaunchCut } = require('../../utils/featureFlags');
const store = require('./store');
const notices = require('./notices');
const rules = require('./rules');

const { CrewDayError } = rules;
// A claim older than this belongs to a run that died; the next run may take the booking again.
const CLAIM_STALE_MS = 15 * 60 * 1000;

function invoicePayments() {
  return require('../invoicePayments');
}

async function claim(booking) {
  const staleBefore = new Date(Date.now() - CLAIM_STALE_MS).toISOString();
  const { data, error } = await supabaseAdmin.from('CrewDayBooking')
    .update({ charge_claimed_at: new Date().toISOString(), charge_attempts: (booking.charge_attempts || 0) + 1 })
    .eq('id', booking.id).eq('status', 'done')
    .or(`charge_claimed_at.is.null,charge_claimed_at.lt.${staleBefore}`)
    .select('*').maybeSingle();
  if (error) throw store.unavailable('charge_claim', error);
  return data || null;
}

async function release(booking, fields = {}) {
  await supabaseAdmin.from('CrewDayBooking').update({ charge_claimed_at: null, updated_at: new Date().toISOString(), ...fields })
    .eq('id', booking.id);
}

function cardFailure(err) {
  if (!err) return null;
  if (err.code === 'authentication_required' || err.raw?.code === 'authentication_required') return 'authentication_required';
  if (err.type === 'StripeCardError' || err.rawType === 'card_error') return err.decline_code || err.code || 'card_declined';
  return null;
}

/**
 * Charges one done home now: claims it, pays its invoice off-session with the saved card and captures it. Answers
 * the booking as it is after (paid, payment_failed, or still done when Stripe or a problem stopped it).
 */
async function chargeBooking(bookingRow, { reason = 'due' } = {}) {
  const booking = await claim(bookingRow);
  if (!booking) return bookingRow;
  if (booking.problem_status === 'open') {
    await release(booking);
    return booking;
  }
  const day = await store.getDay(booking.crew_day_id);
  const { data: invoice, error } = await supabaseAdmin.from('BusinessInvoice').select('*').eq('id', booking.invoice_id).maybeSingle();
  if (error || !invoice) {
    logger.error('crewDay.charge.invoice_missing', { bookingId: booking.id, error: error?.message });
    await release(booking);
    return booking;
  }
  const payments = invoicePayments();
  try {
    if (invoice.status !== 'paid') {
      let paymentId = invoice.payment_id;
      if (!paymentId) {
        const started = await payments.startInvoicePayment(invoice, booking.household_user_id, {
          paymentMethodId: booking.payment_method_id,
          offSession: true,
          idempotencyKey: `crew-day-charge:${booking.id}:${booking.charge_attempts}`,
          metadata: { crew_day_booking_id: booking.id },
        });
        if (started.refused) throw new Error(`charge refused: ${started.refused}`);
        paymentId = started.result.paymentId;
      }
      const status = await payments.captureInvoicePayment(paymentId);
      if (!payments.INVOICE_PAID_PAYMENT_STATES.has(status)) {
        // Still settling: the next run looks again.
        await release(booking);
        return booking;
      }
      await payments.markInvoicePaid(invoice.id); // → onInvoicePaid below marks the booking paid
    } else {
      await onInvoicePaid(invoice);
    }
  } catch (err) {
    const failure = cardFailure(err);
    if (!failure) {
      logger.error('crewDay.charge.failed', { bookingId: booking.id, error: err.message });
      await release(booking);
      return booking;
    }
    const { data: failed } = await supabaseAdmin.from('CrewDayBooking').update({ status: 'payment_failed',
      charge_failure: failure, charge_claimed_at: null, updated_at: new Date().toISOString() })
      .eq('id', booking.id).eq('status', 'done').select('*').maybeSingle();
    if (failed) {
      await store.addEvent({ day, booking: failed, actorRole: 'system', kind: 'charge_failed', data: { failure, reason },
        visibleTo: 'both' });
      await notices.chargeFailed(day, failed, await require('./bookings').crewFor(day)).catch(() => {});
    }
    return failed || booking;
  }
  const { data: after } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('id', booking.id).maybeSingle();
  return after || booking;
}

/** The invoice was paid (by the charge, or by the household in Pantopus after a failed charge): the booking is paid. */
async function onInvoicePaid(invoice) {
  const { data: booking } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('invoice_id', invoice.id)
    .in('status', ['done', 'payment_failed']).maybeSingle();
  if (!booking) return null;
  const byHousehold = booking.status === 'payment_failed';
  const { data: paid } = await supabaseAdmin.from('CrewDayBooking').update({ status: 'paid',
    paid_at: invoice.paid_at || new Date().toISOString(), charge_claimed_at: null, updated_at: new Date().toISOString() })
    .eq('id', booking.id).in('status', ['done', 'payment_failed']).select('*').maybeSingle();
  if (!paid) return null;
  const day = await store.getDay(paid.crew_day_id);
  await store.addEvent({ day, booking: paid, actorRole: byHousehold ? 'household' : 'system',
    actorUserId: byHousehold ? paid.household_user_id : null, kind: byHousehold ? 'paid_by_household' : 'charged',
    data: { invoice_id: invoice.id, amount_cents: invoice.total_cents }, visibleTo: 'both' });
  await notices.charged(day, paid, await require('./bookings').crewFor(day)).catch(() => {});
  return paid;
}

/** "Everything looks good": the household confirms and the charge runs at once. */
async function confirm(bookingId, userId) {
  const { booking } = await require('./bookings').householdBooking(bookingId, userId);
  if (booking.status === 'paid') return booking;
  if (booking.status !== 'done') throw new CrewDayError(409, 'NOT_DONE', "The crew hasn't finished your home yet.");
  if (booking.problem_status === 'open') {
    throw new CrewDayError(409, 'PROBLEM_OPEN', 'Pantopus support has your report. The charge waits until it is sorted.');
  }
  const day = await store.getDay(booking.crew_day_id);
  let confirmed = booking;
  if (!booking.household_confirmed_at) {
    const { data } = await supabaseAdmin.from('CrewDayBooking').update({ household_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString() }).eq('id', booking.id).select('*').maybeSingle();
    confirmed = data || booking;
    await store.addEvent({ day, booking: confirmed, actorUserId: userId, actorRole: 'household', kind: 'household_confirmed',
      visibleTo: 'both' });
  }
  return chargeBooking(confirmed, { reason: 'confirmed' });
}

/** The crewDayCharges job: done homes whose 24 hours passed (or that the household confirmed), with no open problem. */
async function runCharges({ now = new Date(), limit = 50 } = {}) {
  if (skipForLaunchCut('crew_day', 'crewDayCharges')) return { skipped: true };
  const { data, error } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('status', 'done')
    .or(`charge_due_at.lte.${now.toISOString()},household_confirmed_at.not.is.null`)
    .order('charge_due_at', { ascending: true }).limit(limit);
  if (error) throw store.unavailable('charges_due', error);
  const due = (data || []).filter((b) => b.problem_status !== 'open');
  const results = { due: due.length, paid: 0, failed: 0, waiting: 0 };
  for (const booking of due) {
    const after = await chargeBooking(booking, { reason: 'due' });
    if (after.status === 'paid') results.paid += 1;
    else if (after.status === 'payment_failed') results.failed += 1;
    else results.waiting += 1;
  }
  logger.info('[crewDayCharges] run', results);
  return results;
}

/** A Crew Day invoice made for the rest after Pantopus support took an amount off before the charge. */
async function reinvoiceRemainder(day, booking, offCents) {
  const remainder = booking.price_cents - offCents;
  const { data: old } = await supabaseAdmin.from('BusinessInvoice').select('*').eq('id', booking.invoice_id).maybeSingle();
  if (!old || old.status === 'paid') throw new CrewDayError(409, 'CHANGED', 'This charge just went through. Refresh and try again.');
  const stripeService = require('../../stripe/stripeService');
  const fees = stripeService.calculateFees(remainder, await stripeService.getEffectiveFeeRate(day.business_user_id));
  const { data: fresh, error } = await supabaseAdmin.from('BusinessInvoice').insert({
    business_user_id: old.business_user_id, recipient_user_id: old.recipient_user_id,
    line_items: [{ description: `${old.memo || day.title}, less ${rules.formatReceipt(offCents)} from Pantopus support`,
      amount_cents: remainder, quantity: 1 }],
    subtotal_cents: remainder, fee_cents: fees.platformFee, total_cents: remainder, currency: 'usd', status: 'sent',
    due_date: new Date().toISOString(), memo: old.memo,
  }).select('*').single();
  if (error) throw store.unavailable('reinvoice', error);
  await supabaseAdmin.from('BusinessInvoice').update({ status: 'void' }).eq('id', old.id).neq('status', 'paid');
  return fresh;
}

function newRequestId() {
  return crypto.randomUUID();
}

module.exports = { chargeBooking, onInvoicePaid, confirm, runCharges, reinvoiceRemainder, cardFailure, newRequestId };
