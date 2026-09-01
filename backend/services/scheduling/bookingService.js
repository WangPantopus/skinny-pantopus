// ============================================================
// Calendarly — booking lifecycle service.
//   create -> (pending|confirmed) -> approve/decline | cancel | reschedule | no-show | reassign
// Double-booking is prevented atomically by the DB exclusion constraint (Booking_no_overlap);
// we surface its violation as a 409. The availability engine is used as a fast pre-check.
// Round-robin host assignment is a CREATE-time decision (fair rotation via assignee counters).
// ============================================================

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const crypto = require('crypto');
const availabilityService = require('./availabilityService');
const notify = require('./bookingNotifyService');
const payments = require('./schedulingPaymentsService');
const packages = require('./packageService');
const { ownerColumns, generateToken, normalizeEmail } = require('./schedulingShared');

const MIN_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MIN_MS;

class BookingError extends Error {
  constructor(message, statusCode = 400, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function isOverlapViolation(error) {
  if (!error) return false;
  return error.code === '23P01' || /Booking_no_overlap|exclusion/i.test(error.message || '');
}

function buildPolicySnapshot(et) {
  return {
    refund_policy: et.refund_policy,
    cancellation_window_min: et.cancellation_window_min,
    reschedule_cutoff_min: et.reschedule_cutoff_min,
    deposit_cents: et.deposit_cents,
    deposit_refundable: et.deposit_refundable,
    no_show_fee_cents: et.no_show_fee_cents,
    price_cents: et.price_cents,
    currency: et.currency,
  };
}

async function getEventTypeById(id) {
  const { data } = await supabaseAdmin.from('EventType').select('*').eq('id', id).maybeSingle();
  return data || null;
}

async function getPageById(id) {
  if (!id) return null;
  const { data } = await supabaseAdmin.from('BookingPage').select('*').eq('id', id).maybeSingle();
  return data || null;
}

/** Load a booking plus its event type + page (for notifications / policy). */
async function getBookingContext(bookingId) {
  const { data: booking } = await supabaseAdmin.from('Booking').select('*').eq('id', bookingId).maybeSingle();
  if (!booking) return null;
  const [eventType, page] = await Promise.all([getEventTypeById(booking.event_type_id), getPageById(booking.page_id)]);
  return { booking, eventType, page };
}

/**
 * Who may legitimately host this booking: the owner themselves (personal pages, and the
 * owning user of a home/business page) plus the event type's active assignees — the same set
 * the availability engine draws from in `resolveMembers`.
 * @returns {Promise<Set<string>>}
 */
async function eligibleHostIds(booking, eventType) {
  const ids = new Set();
  if (booking.owner_user_id) ids.add(booking.owner_user_id);
  if (booking.owner_type === 'user' && booking.owner_id) ids.add(booking.owner_id);
  if (eventType && eventType.id) {
    const { data: assignees } = await supabaseAdmin
      .from('EventTypeAssignee')
      .select('subject_id')
      .eq('event_type_id', eventType.id)
      .eq('is_active', true);
    for (const a of assignees || []) if (a.subject_id) ids.add(a.subject_id);
  }
  return ids;
}

/** Fair round-robin pick among eligible hosts: lowest assigned_count, then highest priority, then oldest last_assigned_at. */
async function pickRoundRobinHost(eventTypeId, eligibleHosts) {
  if (!eligibleHosts.length) return null;
  if (eligibleHosts.length === 1) return eligibleHosts[0];
  const { data: assignees } = await supabaseAdmin
    .from('EventTypeAssignee')
    .select('subject_id, assigned_count, priority, last_assigned_at')
    .eq('event_type_id', eventTypeId)
    .in('subject_id', eligibleHosts)
    .eq('is_active', true);
  const byId = new Map((assignees || []).map((a) => [a.subject_id, a]));
  const ranked = eligibleHosts
    .map((id) => byId.get(id) || { subject_id: id, assigned_count: 0, priority: 0, last_assigned_at: null })
    .sort((a, b) => {
      if (a.assigned_count !== b.assigned_count) return a.assigned_count - b.assigned_count;
      if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
      const la = a.last_assigned_at ? Date.parse(a.last_assigned_at) : 0;
      const lb = b.last_assigned_at ? Date.parse(b.last_assigned_at) : 0;
      return la - lb;
    });
  return ranked[0].subject_id;
}

async function bumpAssigneeRotation(eventTypeId, hostId) {
  if (!hostId || !eventTypeId) return;
  // Atomic single-statement increment (no read-then-write race).
  const { error } = await supabaseAdmin.rpc('bump_assignee_rotation', { p_event_type_id: eventTypeId, p_subject_id: hostId });
  if (error) logger.warn('[bookingService] bump_assignee_rotation failed', { eventTypeId, hostId, error: error.message });
}

/**
 * Create a booking.
 * @param {Object} args
 * @param {Object} args.eventType
 * @param {Object} [args.page]
 * @param {string} args.startIso
 * @param {number} [args.durationMin]  must be one of eventType.durations (defaults to default_duration)
 * @param {Object} args.invitee   { user_id, name, email, phone, timezone }
 * @param {Object} [args.intakeAnswers]
 * @param {string} args.createdVia  public_link | in_app | manual | one_off
 * @param {string} [args.actorUserId]
 * @param {string} [args.requestedHostId]  (round-robin: a specific eligible host)
 * @returns {Promise<{ booking, manageToken, clientSecret }>}
 */
/**
 * Booking-limit gate (EventType.daily_cap / per_booker_cap). Friendly 409s; the
 * booking_daily_cap_trg trigger (migration 167) is the atomic backstop for daily_cap.
 * Cap-day = UTC date of start_at, matching the trigger and the slot grid.
 */
async function assertBookingLimits(eventType, startMs, invitee = {}) {
  const dailyCap = eventType.daily_cap || 0;
  const bookerCap = eventType.per_booker_cap || 0;
  if (dailyCap <= 0 && bookerCap <= 0) return;
  const dayStartIso = new Date(Math.floor(startMs / DAY_MS) * DAY_MS).toISOString();
  const dayEndIso = new Date(Math.floor(startMs / DAY_MS) * DAY_MS + DAY_MS).toISOString();
  if (dailyCap > 0) {
    const { count } = await supabaseAdmin
      .from('Booking')
      .select('id', { count: 'exact', head: true })
      .eq('event_type_id', eventType.id)
      .in('status', ['pending', 'confirmed'])
      .is('cohost_of_booking_id', null) // co-host shadows are the same meeting, not extra bookings
      .gte('start_at', dayStartIso)
      .lt('start_at', dayEndIso);
    if ((count || 0) >= dailyCap) {
      throw new BookingError('This day is fully booked for this event type.', 409, 'DAILY_CAP_REACHED');
    }
  }
  if (bookerCap > 0) {
    let q = supabaseAdmin
      .from('Booking')
      .select('id', { count: 'exact', head: true })
      .eq('event_type_id', eventType.id)
      .in('status', ['pending', 'confirmed'])
      .is('cohost_of_booking_id', null);
    if (invitee.user_id) q = q.eq('invitee_user_id', invitee.user_id);
    else if (invitee.email) q = q.eq('invitee_email', normalizeEmail(invitee.email));
    else return; // anonymous with no identity to count against
    const { count } = await q;
    if ((count || 0) >= bookerCap) {
      throw new BookingError('You already have the maximum number of active bookings for this event.', 409, 'PER_BOOKER_CAP_REACHED');
    }
  }
}

async function createBooking({ eventType, page, startIso, durationMin, invitee = {}, intakeAnswers = {}, createdVia = 'public_link', actorUserId = null, requestedHostId = null, recurrenceGroupId = null }) {
  if (!eventType || !eventType.is_active) throw new BookingError('Event type is not available.', 404, 'EVENT_TYPE_UNAVAILABLE');
  const duration = durationMin || eventType.default_duration;
  if (!(eventType.durations || [eventType.default_duration]).includes(duration)) {
    throw new BookingError('Unsupported duration.', 400, 'BAD_DURATION');
  }
  const startMs = new Date(startIso).getTime();
  if (!Number.isFinite(startMs)) throw new BookingError('Invalid start time.', 400, 'BAD_START');
  const endMs = startMs + duration * MIN_MS;
  const endIso = new Date(endMs).toISOString();

  // Paid bookings require a signed-in invitee (a Stripe customer can't be created for an
  // anonymous email). Reject up front — before any DB writes — so we never create a phantom row.
  if (payments.isPriced(eventType) && !invitee.user_id) {
    throw new BookingError('Paid bookings require you to sign in first.', 403, 'PAYMENT_REQUIRES_SIGNIN');
  }

  const oc = ownerColumns(eventType.owner_type, eventType.owner_id);

  // Fast pre-check against the engine (the DB constraint is the atomic source of truth).
  const avail = await availabilityService.isSlotAvailable({
    ownerType: eventType.owner_type,
    ownerId: eventType.owner_id,
    eventType,
    startIso,
    endIso,
    viewerTimezone: invitee.timezone,
  });
  if (!avail.available) {
    throw new BookingError('That time is no longer available.', 409, 'SLOT_UNAVAILABLE');
  }

  await assertBookingLimits(eventType, startMs, invitee);

  // Resolve host + attendees by assignment mode.
  const mode = eventType.assignment_mode || 'one_on_one';
  let hostUserId = null;
  let enforceExclusive = true;
  let attendees = [];
  if (mode === 'group') {
    hostUserId = oc.owner_user_id || avail.eligibleHosts[0] || null;
    // Only opt out of the exclusion constraint when the slot genuinely holds more than one
    // seat. A group event left at the default seat_cap=1 would otherwise fall through BOTH
    // guards — the constraint skips enforce_exclusive=false rows, and the
    // booking_enforce_group_cap trigger returns early for cap<=1 on the assumption that the
    // constraint covers it — leaving concurrent bookings completely unguarded.
    enforceExclusive = Math.max(1, eventType.seat_cap || 1) <= 1;
  } else if (mode === 'collective') {
    hostUserId = avail.eligibleHosts[0] || oc.owner_user_id || null;
    attendees = avail.eligibleHosts; // all required members
  } else if (mode === 'round_robin') {
    const eligible = requestedHostId && avail.eligibleHosts.includes(requestedHostId) ? [requestedHostId] : avail.eligibleHosts;
    hostUserId = await pickRoundRobinHost(eventType.id, eligible);
    if (!hostUserId) throw new BookingError('No host is available for that time.', 409, 'NO_HOST');
  } else {
    // one_on_one
    hostUserId = oc.owner_user_id || avail.eligibleHosts[0] || null;
  }

  // Group seat-cap is enforced atomically by the booking_enforce_group_cap DB trigger
  // (a non-atomic app-level pre-check here would give false confidence and races); a full
  // slot surfaces as GROUP_SLOT_FULL on insert below, mapped to 409 SLOT_FULL.

  const priced = payments.isPriced(eventType);
  // Paid bookings always start pending (hold until captured); free bookings honor requires_approval.
  const status = priced || eventType.requires_approval ? 'pending' : 'confirmed';

  const row = {
    event_type_id: eventType.id,
    ...oc,
    page_id: eventType.page_id,
    host_user_id: hostUserId,
    invitee_user_id: invitee.user_id || null,
    invitee_name: invitee.name || null,
    invitee_email: invitee.email || null,
    invitee_phone: invitee.phone || null,
    invitee_timezone: invitee.timezone || null,
    start_at: startIso,
    end_at: endIso,
    status,
    location_mode: eventType.location_mode,
    location_detail: eventType.location_detail || null,
    intake_answers: intakeAnswers || {},
    policy_snapshot: buildPolicySnapshot(eventType),
    buffer_before_min: eventType.buffer_before_min || 0,
    buffer_after_min: eventType.buffer_after_min || 0,
    enforce_exclusive: enforceExclusive,
    recurrence_group_id: recurrenceGroupId,
    created_via: createdVia,
    created_by: actorUserId,
  };

  const { data: booking, error } = await supabaseAdmin.from('Booking').insert(row).select('*').single();
  if (error) {
    if (isOverlapViolation(error)) {
      throw new BookingError('That time was just taken. Please pick another.', 409, 'SLOT_TAKEN');
    }
    if (/GROUP_SLOT_FULL/.test(error.message || '')) {
      throw new BookingError('This time is fully booked.', 409, 'SLOT_FULL');
    }
    logger.error('[bookingService] insert failed', { error: error.message, code: error.code });
    throw new BookingError('Could not create the booking.', 500, 'CREATE_FAILED');
  }

  // Collective events: every required co-host must hold a DB-visible reservation. Both overlap
  // guards key on host_user_id (the Booking_no_overlap constraint and the busy engine), and
  // neither sees BookingAttendee rows — so without sibling rows the co-hosts' time stayed
  // bookable everywhere else. One sibling Booking per non-primary required member, linked via
  // cohost_of_booking_id (FK ON DELETE CASCADE: siblings die with the primary, including the
  // payment-failure rollback delete below). NOT best-effort: a co-host who lost their slot in
  // the pre-check race means the meeting cannot be held, so the whole booking aborts.
  if (mode === 'collective') {
    const coHosts = [...new Set(attendees)].filter((uid) => uid && uid !== hostUserId);
    if (coHosts.length) {
      const { error: sibErr } = await supabaseAdmin.from('Booking').insert(
        coHosts.map((uid) => ({
          ...row,
          host_user_id: uid,
          cohost_of_booking_id: booking.id,
          // Reservation shadows keep the meeting facts but no invitee identity/contact —
          // notify + reminder fan-outs key on these and would double-send to the invitee.
          invitee_user_id: null,
          invitee_email: null,
          invitee_phone: null,
        }))
      );
      if (sibErr) {
        await supabaseAdmin.from('Booking').delete().eq('id', booking.id); // cascades to any siblings
        if (isOverlapViolation(sibErr)) {
          throw new BookingError('That time was just taken. Please pick another.', 409, 'SLOT_TAKEN');
        }
        logger.error('[bookingService] co-host reservation insert failed', { bookingId: booking.id, error: sibErr.message });
        throw new BookingError('Could not create the booking.', 500, 'CREATE_FAILED');
      }
    }
  }

  // Post-insert side effects (best-effort — never undo a committed booking).
  if (mode === 'round_robin') await bumpAssigneeRotation(eventType.id, hostUserId);
  if (attendees.length) {
    const { error: attErr } = await supabaseAdmin.from('BookingAttendee').insert(
      attendees.map((uid) => ({ booking_id: booking.id, user_id: uid, is_required: true, rsvp_status: 'pending' }))
    );
    if (attErr) logger.warn('[bookingService] attendee insert failed (booking still created)', { bookingId: booking.id, error: attErr.message });
  }

  // Manage token for the invitee (raw token returned once). Expires a generous window after the
  // booking so a leaked link can't manage the booking indefinitely (covers reasonable reschedules).
  const { token, hash } = generateToken();
  const tokenExpiresMs = Math.max(startMs, Date.now()) + 90 * 24 * 60 * 60 * 1000;
  await supabaseAdmin.from('BookingToken').insert({
    booking_id: booking.id,
    token_hash: hash,
    kind: 'manage',
    single_use: false,
    expires_at: new Date(tokenExpiresMs).toISOString(),
  });

  // Payment (priced only). Roll back the booking on any failure so a doomed booking never leaves
  // a phantom hold on the slot.
  let clientSecret = null;
  if (priced) {
    let pay;
    try {
      pay = await payments.createPaymentForBooking({ booking, eventType });
    } catch (payErr) {
      await supabaseAdmin.from('Booking').delete().eq('id', booking.id);
      logger.error('[bookingService] payment setup threw; booking rolled back', { bookingId: booking.id, error: payErr.message });
      throw new BookingError('Payment could not be started.', 400, 'PAYMENT_FAILED');
    }
    if (!pay.success) {
      await supabaseAdmin.from('Booking').delete().eq('id', booking.id);
      throw new BookingError(pay.message || 'Payment could not be started.', 400, pay.error || 'PAYMENT_FAILED');
    }
    clientSecret = pay.clientSecret;
    booking.payment_id = pay.paymentId;
  }

  await notify.notifyBookingEvent({
    booking,
    eventType,
    page,
    kind: status === 'pending' ? 'request' : 'confirmed',
    manageToken: token,
  });

  return { booking, manageToken: token, clientSecret };
}

/**
 * Book a household resource (room/vehicle/tool). Resource bookings have no event type; the
 * resource overlap is guarded atomically by the Booking_resource_no_overlap exclusion constraint.
 * @param {Object} args
 * @param {Object} args.resource   HomeResource row
 * @param {string} args.startIso
 * @param {number} [args.durationMin]
 * @param {Object} args.booker     { id, name, email }
 */
async function createResourceBooking({ resource, startIso, durationMin, booker = {} }) {
  const startMs = new Date(startIso).getTime();
  if (!Number.isFinite(startMs)) throw new BookingError('Invalid start time.', 400, 'BAD_START');
  const duration = durationMin || resource.max_duration_min || 60;
  if (resource.max_duration_min && duration > resource.max_duration_min) {
    throw new BookingError(`This resource can be booked for at most ${resource.max_duration_min} minutes.`, 400, 'DURATION_TOO_LONG');
  }
  const endIso = new Date(startMs + duration * MIN_MS).toISOString();
  const oc = ownerColumns('home', resource.home_id);
  const status = resource.requires_approval ? 'pending' : 'confirmed';

  const row = {
    event_type_id: null,
    ...oc,
    resource_id: resource.id,
    host_user_id: null, // resources block the resource, not a person; guarded by resource exclusion
    invitee_user_id: booker.id || null,
    invitee_name: booker.name || null,
    invitee_email: booker.email || null,
    start_at: startIso,
    end_at: endIso,
    status,
    buffer_before_min: resource.buffer_min || 0,
    buffer_after_min: resource.buffer_min || 0,
    enforce_exclusive: false,
    created_via: 'in_app',
    created_by: booker.id || null,
  };

  const { data, error } = await supabaseAdmin.from('Booking').insert(row).select('*').single();
  if (error) {
    if (isOverlapViolation(error)) throw new BookingError('That resource is already booked for an overlapping time.', 409, 'RESOURCE_TAKEN');
    logger.error('[bookingService] resource booking insert failed', { error: error.message, code: error.code });
    throw new BookingError('Could not book the resource.', 500, 'CREATE_FAILED');
  }
  return data;
}

function assertTransition(booking, allowedFrom, action) {
  if (!allowedFrom.includes(booking.status)) {
    throw new BookingError(`Cannot ${action} a booking that is ${booking.status}.`, 409, 'BAD_STATE');
  }
}

/**
 * Atomically flip a booking's status, succeeding only while the row is still in one of
 * `allowedFrom`. Returns the updated row, or null when a concurrent actor already moved it.
 *
 * This guarded UPDATE is the single serialization point for transition side effects
 * (refunds, credit restores, captures): assertTransition alone is a read-then-act race —
 * two concurrent cancels both read 'confirmed', both pass, and both issue a refund. Only
 * the caller that gets a row back here may run side effects.
 */
async function transitionBooking(bookingId, allowedFrom, patch) {
  const { data } = await supabaseAdmin
    .from('Booking')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .in('status', allowedFrom)
    .select('*')
    .maybeSingle();
  return data || null;
}

/**
 * Collective co-host reservation rows (cohost_of_booking_id) mirror their primary booking.
 * Keep them in lockstep after a status transition so a cancelled/declined meeting releases
 * every co-host's time (the exclusion predicate only covers pending/confirmed rows).
 * Zero-row for non-collective bookings; failures are logged loudly, never unwound — a stale
 * sibling blocks time (annoying) rather than double-booking it (unsafe).
 */
async function syncCohostSiblings(bookingId, patch) {
  const { error } = await supabaseAdmin
    .from('Booking')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('cohost_of_booking_id', bookingId);
  if (error) {
    logger.error('[bookingService] co-host sibling sync failed', { bookingId, error: error.message });
  }
  return error || null;
}

async function approveBooking(bookingId, actorUserId) {
  const ctx = await getBookingContext(bookingId);
  if (!ctx) throw new BookingError('Booking not found.', 404, 'NOT_FOUND');
  assertTransition(ctx.booking, ['pending'], 'approve');
  // Capture the held payment FIRST; if capture fails, leave the booking pending rather than
  // confirming a booking we couldn't charge for.
  if (ctx.booking.payment_id) {
    const cap = await payments.captureForBooking(ctx.booking.payment_id);
    if (cap && cap.success === false) {
      throw new BookingError('Could not capture payment; booking left pending.', 402, 'CAPTURE_FAILED');
    }
  }
  const updated = await transitionBooking(bookingId, ['pending'], { status: 'confirmed' });
  if (!updated) {
    // Someone declined/cancelled between our capture and the flip — release the funds we
    // just took so the terminal state (declined/cancelled) keeps its refund invariant.
    if (ctx.booking.payment_id) {
      await payments.refundForBooking({ booking: ctx.booking, initiatedBy: actorUserId, reason: 'booking_declined' });
    }
    throw new BookingError('Cannot approve: the booking is no longer pending.', 409, 'BAD_STATE');
  }
  await syncCohostSiblings(bookingId, { status: 'confirmed' });
  await notify.notifyBookingEvent({ booking: updated, eventType: ctx.eventType, page: ctx.page, kind: 'confirmed' });
  return updated;
}

async function declineBooking(bookingId, actorUserId, reason) {
  const ctx = await getBookingContext(bookingId);
  if (!ctx) throw new BookingError('Booking not found.', 404, 'NOT_FOUND');
  assertTransition(ctx.booking, ['pending'], 'decline');
  const updated = await transitionBooking(bookingId, ['pending'], {
    status: 'declined', cancel_reason: reason || null, cancelled_by: actorUserId || null,
    ics_sequence: (ctx.booking.ics_sequence || 0) + 1, // iTIP CANCEL must outrank prior REQUESTs
  });
  if (!updated) throw new BookingError('Cannot decline: the booking is no longer pending.', 409, 'BAD_STATE');
  await syncCohostSiblings(bookingId, { status: 'declined' });
  // Side effects only for the transition winner; refundForBooking never throws (logs and
  // returns {refunded:false} on gateway failure), so ordering after the flip loses nothing.
  if (ctx.booking.payment_id) await payments.refundForBooking({ booking: ctx.booking, initiatedBy: actorUserId, reason: 'booking_declined' });
  if (ctx.booking.package_credit_id) await packages.restoreForBooking(ctx.booking);
  await notify.notifyBookingEvent({ booking: updated, eventType: ctx.eventType, page: ctx.page, kind: 'declined' });
  return updated;
}

/**
 * Cancel a booking.
 * @param {string} actorRole  'host' | 'invitee' | 'system' — gates invitee-side rules.
 */
async function cancelBooking(bookingId, actorUserId, reason, actorRole = 'host') {
  const ctx = await getBookingContext(bookingId);
  if (!ctx) throw new BookingError('Booking not found.', 404, 'NOT_FOUND');
  assertTransition(ctx.booking, ['pending', 'confirmed'], 'cancel');
  if (actorRole === 'invitee' && ctx.eventType && ctx.eventType.allow_invitee_cancel === false) {
    throw new BookingError('This booking cannot be cancelled by the guest.', 403, 'INVITEE_CANCEL_DISABLED');
  }
  const updated = await transitionBooking(bookingId, ['pending', 'confirmed'], {
    status: 'cancelled', cancel_reason: reason || null, cancelled_by: actorUserId || null,
    ics_sequence: (ctx.booking.ics_sequence || 0) + 1, // iTIP CANCEL must outrank prior REQUESTs
  });
  if (!updated) throw new BookingError('Cannot cancel: the booking already reached a terminal state.', 409, 'BAD_STATE');
  await syncCohostSiblings(bookingId, { status: 'cancelled' });
  // Winner-only side effects — a concurrent cancel/decline can no longer refund twice.
  if (ctx.booking.payment_id) await payments.refundForBooking({ booking: ctx.booking, initiatedBy: actorUserId, reason: 'booking_cancelled' });
  if (ctx.booking.package_credit_id) await packages.restoreForBooking(ctx.booking);
  await notify.notifyBookingEvent({ booking: updated, eventType: ctx.eventType, page: ctx.page, kind: 'cancelled' });
  return updated;
}

/**
 * Reschedule a booking to a new start (same duration). Re-checks availability; the exclusion
 * constraint guarantees atomicity (the booking's own row releases its old range on UPDATE).
 */
async function rescheduleBooking(bookingId, actorUserId, newStartIso, actorRole = 'host', requestedHostId = null) {
  const ctx = await getBookingContext(bookingId);
  if (!ctx) throw new BookingError('Booking not found.', 404, 'NOT_FOUND');
  assertTransition(ctx.booking, ['pending', 'confirmed'], 'reschedule');
  const { booking, eventType, page } = ctx;
  const mode = (eventType && eventType.assignment_mode) || 'one_on_one';
  if (actorRole === 'invitee' && eventType && eventType.allow_invitee_reschedule === false) {
    throw new BookingError('This booking cannot be rescheduled by the guest.', 403, 'INVITEE_RESCHEDULE_DISABLED');
  }
  // Enforce the reschedule cutoff for guest-initiated moves (the policy the invitee was shown).
  // Host/system reschedules are not gated. Uses the frozen policy snapshot to match the UI deadline.
  if (actorRole === 'invitee') {
    const policy = booking.policy_snapshot || {};
    const cutoffMin = policy.reschedule_cutoff_min != null ? policy.reschedule_cutoff_min : (eventType && eventType.reschedule_cutoff_min) || 0;
    if (cutoffMin > 0 && Date.now() > Date.parse(booking.start_at) - cutoffMin * MIN_MS) {
      throw new BookingError('It is too late to reschedule this booking.', 409, 'RESCHEDULE_CUTOFF_PASSED');
    }
  }
  const durationMs = Date.parse(booking.end_at) - Date.parse(booking.start_at);
  const newStartMs = new Date(newStartIso).getTime();
  if (!Number.isFinite(newStartMs)) throw new BookingError('Invalid start time.', 400, 'BAD_START');
  const newEndIso = new Date(newStartMs + durationMs).toISOString();

  // Availability pre-check excluding this booking's own host range (handled because the engine
  // reads active bookings; the existing row at the old time won't block the new time unless they
  // truly overlap, and the UPDATE atomically moves the guarded range).
  const avail = await availabilityService.isSlotAvailable({
    ownerType: booking.owner_type,
    ownerId: booking.owner_id,
    eventType,
    startIso: newStartIso,
    endIso: newEndIso,
    hostUserId: booking.host_user_id,
    viewerTimezone: booking.invitee_timezone,
    excludeBookingId: booking.id, // don't let the booking block its own new (possibly overlapping) time
  });
  if (!avail.available) {
    // Round-robin may switch to a different eligible host below, but only if SOME host is free;
    // for every other mode (and round-robin with no eligible host) the slot must be free.
    if (mode !== 'round_robin' || !avail.eligibleHosts.length) {
      throw new BookingError('That time is not available.', 409, 'SLOT_UNAVAILABLE');
    }
  }

  let nextHost = booking.host_user_id;
  if (mode === 'round_robin') {
    const eligible = requestedHostId && avail.eligibleHosts.includes(requestedHostId) ? [requestedHostId] : avail.eligibleHosts;
    nextHost = (await pickRoundRobinHost(eventType.id, eligible)) || booking.host_user_id;
  }

  // Moving into a different day must respect that day's cap (the trigger backstops this).
  await assertBookingLimits(eventType, newStartMs, {});

  const { data: updated, error } = await supabaseAdmin
    .from('Booking')
    .update({
      start_at: newStartIso,
      end_at: newEndIso,
      previous_start_at: booking.start_at,
      host_user_id: nextHost,
      // iTIP revision: strictly increasing, so calendar clients apply the update. The old
      // boolean (`previous_start_at ? 1 : 0`) re-issued SEQUENCE:1 on every later move.
      ics_sequence: (booking.ics_sequence || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select('*')
    .single();
  if (error) {
    if (/GROUP_SLOT_FULL/.test(error.message || '')) throw new BookingError('This time is fully booked.', 409, 'SLOT_FULL');
    if (/DAILY_CAP_REACHED/.test(error.message || '')) throw new BookingError('This day is fully booked for this event type.', 409, 'DAILY_CAP_REACHED');
    if (isOverlapViolation(error)) throw new BookingError('That time was just taken.', 409, 'SLOT_TAKEN');
    throw new BookingError('Could not reschedule.', 500, 'RESCHEDULE_FAILED');
  }

  // Move collective co-host reservations with the primary (single statement — all-or-nothing).
  // If a co-host's new time was taken between the pre-check and now, the meeting cannot move:
  // revert the primary so the reservation never splits across two times, then 409.
  const { error: sibMoveErr } = await supabaseAdmin
    .from('Booking')
    .update({ start_at: newStartIso, end_at: newEndIso, updated_at: new Date().toISOString() })
    .eq('cohost_of_booking_id', bookingId);
  if (sibMoveErr) {
    const { error: revertErr } = await supabaseAdmin
      .from('Booking')
      .update({
        start_at: booking.start_at,
        end_at: booking.end_at,
        previous_start_at: booking.previous_start_at,
        host_user_id: booking.host_user_id,
        ics_sequence: booking.ics_sequence || 0, // nothing was mailed for the failed move
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);
    if (revertErr) {
      // Should be unreachable (our own old slot); log loudly — primary and siblings disagree.
      logger.error('[bookingService] reschedule revert failed after sibling move error', { bookingId, error: revertErr.message });
    }
    if (isOverlapViolation(sibMoveErr)) throw new BookingError('That time was just taken.', 409, 'SLOT_TAKEN');
    logger.error('[bookingService] co-host sibling move failed', { bookingId, error: sibMoveErr.message });
    throw new BookingError('Could not reschedule.', 500, 'RESCHEDULE_FAILED');
  }

  // Round-robin fairness: count the rotation against the newly-assigned host.
  if (mode === 'round_robin' && nextHost && nextHost !== booking.host_user_id) {
    await bumpAssigneeRotation(eventType.id, nextHost);
  }
  await notify.notifyBookingEvent({ booking: updated, eventType, page, kind: 'rescheduled' });
  return updated;
}

async function markNoShow(bookingId, actorUserId) {
  const ctx = await getBookingContext(bookingId);
  if (!ctx) throw new BookingError('Booking not found.', 404, 'NOT_FOUND');
  assertTransition(ctx.booking, ['confirmed', 'completed'], 'mark no-show');
  const updated = await transitionBooking(bookingId, ['confirmed', 'completed'], { status: 'no_show' });
  if (!updated) throw new BookingError('Cannot mark no-show: the booking already reached a terminal state.', 409, 'BAD_STATE');
  await syncCohostSiblings(bookingId, { status: 'no_show' });
  // Winner-only, so a double-tap can't issue the no-show fee/refund adjustment twice.
  if (ctx.booking.payment_id) await payments.refundForBooking({ booking: ctx.booking, initiatedBy: actorUserId, reason: 'no_show', noShow: true });
  return updated;
}

async function reassignBooking(bookingId, actorUserId, newHostId) {
  const ctx = await getBookingContext(bookingId);
  if (!ctx) throw new BookingError('Booking not found.', 404, 'NOT_FOUND');
  assertTransition(ctx.booking, ['pending', 'confirmed'], 'reassign');
  if (!newHostId) throw new BookingError('A new host is required.', 400, 'HOST_REQUIRED');
  // The caller is authorized to manage this booking, but that says nothing about WHO they may
  // hand it to. Without this check any manageable booking could be assigned to an arbitrary
  // user id — someone outside the home/business entirely — putting a stranger's id on the
  // booking and onto the host's calendar surfaces.
  const eligible = await eligibleHostIds(ctx.booking, ctx.eventType);
  if (!eligible.has(newHostId)) {
    throw new BookingError('That person is not an eligible host for this booking.', 403, 'HOST_NOT_ELIGIBLE');
  }
  const { data: updated, error } = await supabaseAdmin
    .from('Booking')
    .update({ host_user_id: newHostId, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select('*')
    .single();
  if (error) {
    if (isOverlapViolation(error)) throw new BookingError('That host is busy at this time.', 409, 'HOST_BUSY');
    throw new BookingError('Could not reassign.', 500, 'REASSIGN_FAILED');
  }
  return updated;
}

/**
 * Create a recurring / multi-session series — one booking per session, linked by a shared
 * recurrence_group_id. Sessions that conflict are skipped (returned in `failed`).
 * @returns {Promise<{ recurrenceGroupId, created: object[], failed: Array<{start, error}> }>}
 */
async function createRecurringBookings({ eventType, page, sessions, invitee = {}, intakeAnswers = {}, createdVia = 'in_app', actorUserId = null }) {
  if (!Array.isArray(sessions) || !sessions.length) throw new BookingError('No sessions provided.', 400, 'NO_SESSIONS');
  if (sessions.length > 52) throw new BookingError('Too many sessions (max 52).', 400, 'TOO_MANY_SESSIONS');
  const recurrenceGroupId = crypto.randomUUID();
  const created = [];
  const failed = [];
  for (const startIso of sessions) {
    try {
      const result = await createBooking({ eventType, page, startIso, invitee, intakeAnswers, createdVia, actorUserId, recurrenceGroupId });
      created.push(result.booking);
    } catch (err) {
      failed.push({ start: startIso, error: err.code || 'ERROR', message: err.message });
    }
  }
  if (!created.length) throw new BookingError('None of the requested times were available.', 409, 'ALL_SESSIONS_UNAVAILABLE');
  return { recurrenceGroupId, created, failed };
}

/** Host proposes a new time (invitee must accept). Stores the proposal without moving the booking. */
async function proposeReschedule(bookingId, actorUserId, newStartIso, hostId) {
  const ctx = await getBookingContext(bookingId);
  if (!ctx) throw new BookingError('Booking not found.', 404, 'NOT_FOUND');
  assertTransition(ctx.booking, ['pending', 'confirmed'], 'propose reschedule');
  if (!Number.isFinite(new Date(newStartIso).getTime())) throw new BookingError('Invalid start time.', 400, 'BAD_START');
  const { data: updated } = await supabaseAdmin
    .from('Booking')
    .update({ proposed_start_at: newStartIso, proposed_host_id: hostId || null, proposed_by: actorUserId || null, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select('*')
    .single();
  await notify.notifyBookingEvent({ booking: updated, eventType: ctx.eventType, page: ctx.page, kind: 'reschedule_proposed' });
  return updated;
}

/** Invitee accepts a pending proposal — applies it as a reschedule and clears the proposal. */
async function acceptProposedReschedule(bookingId, actorUserId) {
  const ctx = await getBookingContext(bookingId);
  if (!ctx) throw new BookingError('Booking not found.', 404, 'NOT_FOUND');
  if (!ctx.booking.proposed_start_at) throw new BookingError('No pending reschedule proposal.', 409, 'NO_PROPOSAL');
  const updated = await rescheduleBooking(bookingId, actorUserId, ctx.booking.proposed_start_at, 'system', ctx.booking.proposed_host_id);
  const { error: clearErr } = await supabaseAdmin
    .from('Booking')
    .update({ proposed_start_at: null, proposed_host_id: null, proposed_by: null })
    .eq('id', bookingId);
  if (clearErr) logger.warn('[bookingService] failed to clear reschedule proposal after accept', { bookingId, error: clearErr.message });
  return { ...updated, proposed_start_at: null, proposed_host_id: null, proposed_by: null };
}

/** Clear a pending reschedule proposal (host cancels, or invitee declines). */
async function declineProposedReschedule(bookingId) {
  const { data: updated } = await supabaseAdmin
    .from('Booking')
    .update({ proposed_start_at: null, proposed_host_id: null, proposed_by: null, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select('*')
    .single();
  return updated;
}

module.exports = {
  BookingError,
  createBooking,
  createRecurringBookings,
  createResourceBooking,
  approveBooking,
  declineBooking,
  cancelBooking,
  rescheduleBooking,
  proposeReschedule,
  acceptProposedReschedule,
  declineProposedReschedule,
  markNoShow,
  reassignBooking,
  getBookingContext,
  getEventTypeById,
  // exported for tests
  _internal: { isOverlapViolation, buildPolicySnapshot, pickRoundRobinHost },
};
