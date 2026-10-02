// Wiring + pure-logic tests for the Calendarly backend (no live DB/Stripe).
// errorHandler.js -> ./utils/logger -> winston via a path the jest config doesn't remap; winston
// fails to construct under jest's module environment, so stub winston itself.
jest.mock('winston', () => {
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, http: () => {}, add: () => {} };
  const fmt = () => ({});
  return {
    createLogger: () => logger,
    addColors: () => {},
    // `format` has to be callable as well as indexable: utils/logger.js builds a
    // custom format with `winston.format(fn)` (the PRV-09 log redaction) and
    // then invokes the result, so a Proxy over a plain object threw
    // "winston.format is not a function". Proxy a function instead and give it
    // an apply trap.
    format: new Proxy(function format() {}, { get: () => fmt, apply: () => fmt }),
    transports: { Console: function Console() {}, File: function File() {} },
  };
});
// Mock the Stripe service so requiring bookingService/payments doesn't need Stripe env.
jest.mock('../../stripe/stripeService', () => ({
  createPaymentIntentForGig: jest.fn(),
  capturePayment: jest.fn(),
  createSmartRefund: jest.fn(),
  calculateFees: jest.fn(),
  getEffectiveFeeRate: jest.fn(),
}));

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

describe('invoice send retry identity', () => {
  const express = require('express');
  const request = require('supertest');
  const notifications = require('../../services/notificationService');
  const app = express();
  app.use(express.json());
  app.use('/api/scheduling', require('../../routes/scheduling'));
  const owner = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
  const recipient = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const send = (id, key = requestId, actor = owner) => request(app)
    .post(`/api/scheduling/invoices/${id}/send`)
    .set('x-test-user-id', actor)
    .send({ owner_type: 'business', owner_id: owner, ...(key === undefined ? {} : { client_request_id: key }) });

  beforeEach(() => {
    resetTables();
    notifications.createNotification.mockClear();
    seedTable('BusinessInvoice', ['invoice-1', 'invoice-2'].map(id => ({
      id, business_user_id: owner, recipient_user_id: recipient, total_cents: 2500, currency: 'usd', status: 'sent',
    })));
  });

  it('keeps one notification identity through a retry, including UUID letter case', async () => {
    expect((await send('invoice-1')).status).toBe(200);
    expect((await send('invoice-1', requestId.toUpperCase())).status).toBe(200);
    const calls = notifications.createNotification.mock.calls.map(([input]) => input);
    expect(calls).toHaveLength(2);
    expect(calls[0].idempotencyKey).toBe(calls[1].idempotencyKey);
    expect(calls[0]).toMatchObject({ userId: recipient, type: 'invoice_sent', link: '/app/invoice/invoice-1' });
    expect(getTable('BusinessInvoice')[0]).toMatchObject({ total_cents: 2500, status: 'sent' });
  });

  it('allows a deliberate resend and scopes a reused key to its invoice', async () => {
    await send('invoice-1');
    await send('invoice-1', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    await send('invoice-2');
    expect(new Set(notifications.createNotification.mock.calls.map(([input]) => input.idempotencyKey)).size).toBe(3);
  });

  it('retains unkeyed client compatibility', async () => {
    const response = await request(app).post('/api/scheduling/invoices/invoice-1/send')
      .send({ owner_type: 'business', owner_id: owner });
    expect(response.status).toBe(200);
    expect(notifications.createNotification.mock.calls[0][0]).not.toHaveProperty('idempotencyKey');
  });

  it.each(['invalid', '', null])('rejects an invalid request identity %p before delivery', async key => {
    expect((await send('invoice-1', key)).status).toBe(400);
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('does not let an outsider replay the owner command', async () => {
    expect((await send('invoice-1', requestId, recipient)).status).toBe(403);
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });
});

describe('module wiring (require without error)', () => {
  it('loads all scheduling services + routers', () => {
    expect(typeof require('../../services/scheduling/availabilityService').computeSlots).toBe('function');
    expect(typeof require('../../services/scheduling/bookingService').createBooking).toBe('function');
    expect(typeof require('../../services/scheduling/schedulingPaymentsService').computeRefundCents).toBe('function');
    expect(typeof require('../../services/scheduling/bookingNotifyService').notifyBookingEvent).toBe('function');
    expect(typeof require('../../services/scheduling/icsService').buildIcs).toBe('function');
    expect(typeof require('../../services/scheduling/schedulingShared').ownerColumns).toBe('function');
    expect(typeof require('../../services/scheduling/bookingMetricsService').getSummary).toBe('function');
    expect(typeof require('../../services/scheduling/bookingMetricsService').getTeamPerformance).toBe('function');
    expect(typeof require('../../services/scheduling/schedulingNotifyPrefs').hostWants).toBe('function');
    expect(typeof require('../../services/scheduling/packageService').purchasePackage).toBe('function');
    expect(typeof require('../../services/scheduling/bookingService').createRecurringBookings).toBe('function');
    expect(typeof require('../../services/scheduling/bookingService').proposeReschedule).toBe('function');
    expect(typeof require('../../routes/scheduling')).toBe('function'); // express router
    expect(typeof require('../../routes/schedulingPublic')).toBe('function');
    expect(typeof require('../../jobs/bookingReminders').runBookingReminders).toBe('function');
  });
});

describe('schedulingShared.ownerColumns', () => {
  const { ownerColumns } = require('../../services/scheduling/schedulingShared');
  it('maps user/business to owner_user_id and home to home_id (consistent with owner_id)', () => {
    expect(ownerColumns('user', 'u1')).toEqual({ owner_type: 'user', owner_id: 'u1', owner_user_id: 'u1', home_id: null });
    expect(ownerColumns('business', 'b1')).toEqual({ owner_type: 'business', owner_id: 'b1', owner_user_id: 'b1', home_id: null });
    expect(ownerColumns('home', 'h1')).toEqual({ owner_type: 'home', owner_id: 'h1', owner_user_id: null, home_id: 'h1' });
  });
});

describe('schedulingPaymentsService.computeRefundCents', () => {
  const { computeRefundCents } = require('../../services/scheduling/schedulingPaymentsService');
  const start = Date.parse('2026-07-10T15:00:00Z');
  const base = { amountTotal: 10000, startAtMs: start };

  it('full refund when cancelled within the free window', () => {
    const policy = { cancellation_window_min: 1440, refund_policy: 'none' }; // 24h free window
    // now is 25h before start -> within free window -> full
    expect(computeRefundCents({ ...base, policy, nowMs: start - 25 * 60 * 60 * 1000 })).toBe(10000);
  });
  it('refund_policy none -> 0 outside the free window', () => {
    const policy = { cancellation_window_min: 60, refund_policy: 'none' };
    expect(computeRefundCents({ ...base, policy, nowMs: start - 30 * 60 * 1000 })).toBe(0);
  });
  it('deposit_only with non-refundable deposit forfeits the deposit (outside free window)', () => {
    const policy = { cancellation_window_min: 60, refund_policy: 'deposit_only', deposit_cents: 2500, deposit_refundable: false };
    expect(computeRefundCents({ ...base, policy, nowMs: start - 30 * 60 * 1000 })).toBe(7500);
  });
  it('partial -> half (outside free window)', () => {
    const policy = { cancellation_window_min: 60, refund_policy: 'partial' };
    expect(computeRefundCents({ ...base, policy, nowMs: start - 30 * 60 * 1000 })).toBe(5000);
  });
  it('no-show forfeits up to the no_show_fee', () => {
    const policy = { no_show_fee_cents: 3000 };
    expect(computeRefundCents({ ...base, policy, nowMs: start, noShow: true })).toBe(7000);
  });
});

describe('icsService.buildIcs', () => {
  const { buildIcs } = require('../../services/scheduling/icsService');
  it('emits a valid REQUEST VEVENT with stable UID and escaped text', () => {
    const ics = buildIcs({
      uid: 'abc-123',
      start: '2026-07-06T09:00:00Z',
      end: '2026-07-06T09:30:00Z',
      summary: 'Chat, with me; really',
      method: 'REQUEST',
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('UID:abc-123@pantopus.com');
    expect(ics).toContain('DTSTART:20260706T090000Z');
    expect(ics).toContain('DTEND:20260706T093000Z');
    expect(ics).toContain('SUMMARY:Chat\\, with me\\; really'); // escaped comma + semicolon
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics.endsWith('\r\n')).toBe(true);
  });
  it('CANCEL method marks the event cancelled', () => {
    const ics = buildIcs({ uid: 'x', start: '2026-07-06T09:00:00Z', end: '2026-07-06T09:30:00Z', summary: 'x', method: 'CANCEL' });
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('STATUS:CANCELLED');
  });
});

describe('bookingService.pickRoundRobinHost (fair rotation)', () => {
  const bookingService = require('../../services/scheduling/bookingService');
  beforeEach(() => resetTables());

  it('picks the eligible host with the lowest assigned_count', async () => {
    seedTable('EventTypeAssignee', [
      { id: 'a1', event_type_id: 'et1', subject_id: 'm1', assigned_count: 5, priority: 0, last_assigned_at: null, is_active: true },
      { id: 'a2', event_type_id: 'et1', subject_id: 'm2', assigned_count: 1, priority: 0, last_assigned_at: null, is_active: true },
    ]);
    const host = await bookingService._internal.pickRoundRobinHost('et1', ['m1', 'm2']);
    expect(host).toBe('m2');
  });

  it('returns the single eligible host without a query', async () => {
    const host = await bookingService._internal.pickRoundRobinHost('et1', ['only']);
    expect(host).toBe('only');
  });
});

describe('bookingService.createResourceBooking guards', () => {
  const bookingService = require('../../services/scheduling/bookingService');
  beforeEach(() => resetTables());

  it('rejects a duration exceeding the resource max', async () => {
    const resource = { id: 'r1', home_id: 'h1', max_duration_min: 30, buffer_min: 0, requires_approval: false };
    await expect(
      bookingService.createResourceBooking({ resource, startIso: '2026-07-02T10:00:00Z', durationMin: 60, booker: { id: 'u1' } })
    ).rejects.toMatchObject({ code: 'DURATION_TOO_LONG', statusCode: 400 });
  });

  it('rejects an invalid start time', async () => {
    const resource = { id: 'r1', home_id: 'h1', buffer_min: 0 };
    await expect(
      bookingService.createResourceBooking({ resource, startIso: 'not-a-date', booker: { id: 'u1' } })
    ).rejects.toMatchObject({ code: 'BAD_START' });
  });
});

describe('bookingService.rescheduleBooking policy guards', () => {
  const bookingService = require('../../services/scheduling/bookingService');
  const availabilityService = require('../../services/scheduling/availabilityService');
  beforeEach(() => resetTables());
  afterEach(() => jest.restoreAllMocks());

  const seedBooking = (over) => seedTable('Booking', [{
    id: 'b', event_type_id: 'et', status: 'confirmed',
    start_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    end_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    policy_snapshot: {}, owner_type: 'user', owner_id: 'u1', host_user_id: 'u1',
    ...over,
  }]);
  const farFuture = () => new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();

  it('rejects an invitee reschedule past the reschedule cutoff (server-side, not just UI)', async () => {
    seedBooking({ policy_snapshot: { reschedule_cutoff_min: 120 } }); // start is 30 min out, cutoff 2h
    seedTable('EventType', [{ id: 'et', assignment_mode: 'one_on_one', allow_invitee_reschedule: true, reschedule_cutoff_min: 120 }]);
    await expect(
      bookingService.rescheduleBooking('b', 'inv1', farFuture(), 'invitee')
    ).rejects.toMatchObject({ code: 'RESCHEDULE_CUTOFF_PASSED', statusCode: 409 });
  });

  it('lets the host reschedule inside the cutoff window (cutoff gates guests only)', async () => {
    seedBooking({ policy_snapshot: { reschedule_cutoff_min: 120 } });
    seedTable('EventType', [{ id: 'et', assignment_mode: 'one_on_one', reschedule_cutoff_min: 120 }]);
    jest.spyOn(availabilityService, 'isSlotAvailable').mockResolvedValue({ available: true, eligibleHosts: ['u1'] });
    const newStart = farFuture();
    const updated = await bookingService.rescheduleBooking('b', 'u1', newStart, 'host');
    expect(updated.start_at).toBe(newStart);
  });

  it('rejects a round-robin reschedule when no host is free at the new time', async () => {
    seedBooking({ owner_type: 'business', owner_id: 'biz1', host_user_id: 'h1', event_type_id: 'etrr' });
    seedTable('EventType', [{ id: 'etrr', assignment_mode: 'round_robin' }]);
    jest.spyOn(availabilityService, 'isSlotAvailable').mockResolvedValue({ available: false, eligibleHosts: [] });
    await expect(
      bookingService.rescheduleBooking('b', 'biz1', farFuture(), 'host')
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE', statusCode: 409 });
  });
});

describe('bookingService.isOverlapViolation', () => {
  const bookingService = require('../../services/scheduling/bookingService');
  it('detects the exclusion-constraint SQLSTATE and constraint name', () => {
    expect(bookingService._internal.isOverlapViolation({ code: '23P01' })).toBe(true);
    expect(bookingService._internal.isOverlapViolation({ message: 'conflicting key value violates exclusion constraint "Booking_no_overlap"' })).toBe(true);
    expect(bookingService._internal.isOverlapViolation({ code: '23505' })).toBe(false);
    expect(bookingService._internal.isOverlapViolation(null)).toBe(false);
  });
});

// Regression for PUT /api/scheduling/booking-page → 500
// "Cannot read properties of null (reading 'id')": ensurePage could return null
// (swallowed insert error / lost create race), and every caller dereferences
// page.id. It must now always resolve a page or throw.
describe('ensurePage (booking-page get-or-create) — never returns null', () => {
  const { _internal: { ensurePage } } = require('../../routes/scheduling');
  const { ownerColumns } = require('../../services/scheduling/schedulingShared');
  const supabaseAdmin = require('../__mocks__/supabaseAdmin');
  const { getTable } = supabaseAdmin;

  const ctx = (ownerId = 'u1') => ({ ownerType: 'user', ownerId, oc: ownerColumns('user', ownerId) });
  const seedPage = (over) => ({
    owner_type: 'user', owner_id: 'u1', owner_user_id: 'u1', home_id: null,
    slug: 'user-u1', is_live: false, created_by: 'u1', created_at: '2026-01-01T00:00:00Z', ...over,
  });

  beforeEach(() => resetTables());
  afterEach(() => jest.restoreAllMocks());

  it('returns the existing page without creating a duplicate', async () => {
    seedTable('BookingPage', [seedPage({ id: 'p1' })]);
    const page = await ensurePage(ctx(), 'u1');
    expect(page.id).toBe('p1');
    expect(getTable('BookingPage')).toHaveLength(1);
  });

  it('auto-creates the page when none exists (mirrors the GET path)', async () => {
    const page = await ensurePage(ctx(), 'u1');
    expect(page).toBeTruthy();
    expect(page.owner_id).toBe('u1');
    expect(page.slug).toBe('user-u1');
    expect(getTable('BookingPage')).toHaveLength(1);
  });

  it('tolerates accidental duplicate rows instead of erroring on maybeSingle', async () => {
    seedTable('BookingPage', [
      seedPage({ id: 'p1', created_at: '2026-01-01T00:00:00Z' }),
      seedPage({ id: 'p2', slug: 'user-u1-dup', created_at: '2026-02-01T00:00:00Z' }),
    ]);
    const page = await ensurePage(ctx(), 'u1');
    expect(page).toBeTruthy();
    expect(['p1', 'p2']).toContain(page.id);
    expect(getTable('BookingPage')).toHaveLength(2); // no third row created
  });

  it('retries with a suffixed slug when the auto base slug collides with another owner', async () => {
    seedTable('BookingPage', [{
      id: 'other', owner_type: 'business', owner_id: 'biz9', owner_user_id: 'biz9', home_id: null,
      slug: 'user-u1', is_live: false, created_by: 'biz9', created_at: '2026-01-01T00:00:00Z',
    }]);
    const page = await ensurePage(ctx(), 'u1');
    expect(page).toBeTruthy();
    expect(page.owner_id).toBe('u1');
    expect(page.slug).not.toBe('user-u1');
    expect(page.slug).toMatch(/^user-u1-/);
    expect(getTable('BookingPage')).toHaveLength(2);
  });

  it('re-reads the owner page instead of returning null when the create loses a slug race', async () => {
    // The page exists, but the initial lookup misses it (the GET/PUT create
    // race the iOS client triggers). The insert then loses the slug-unique
    // race; ensurePage must re-read the row rather than return null.
    seedTable('BookingPage', [seedPage({ id: 'p1' })]);
    const realFrom = supabaseAdmin.from.bind(supabaseAdmin);
    let firstLookup = true;
    jest.spyOn(supabaseAdmin, 'from').mockImplementation((table) => {
      const builder = realFrom(table);
      if (table === 'BookingPage' && firstLookup) {
        builder.maybeSingle = () => { firstLookup = false; return Promise.resolve({ data: null, error: null }); };
      }
      return builder;
    });
    const page = await ensurePage(ctx(), 'u1');
    expect(page.id).toBe('p1');
    expect(getTable('BookingPage')).toHaveLength(1); // no duplicate created
  });

  it('throws (never returns null) when the insert fails for a non-collision reason', async () => {
    // The original bug: a transient/schema-cache insert error was swallowed and
    // ensurePage returned null, so callers null-deref'd page.id into an opaque
    // 500. It must surface the error loudly instead.
    const hardError = { code: '42P01', message: "Could not find the table 'public.BookingPage' in the schema cache" };
    jest.spyOn(supabaseAdmin, 'from').mockImplementation(() => {
      let writing = false;
      const builder = {
        insert() { writing = true; return builder; },
        select() { return builder; },
        eq() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        single() { return builder; },
        maybeSingle() { return builder; },
        then(resolve, reject) {
          return Promise.resolve(writing ? { data: null, error: hardError } : { data: null, error: null }).then(resolve, reject);
        },
      };
      return builder;
    });
    await expect(ensurePage(ctx(), 'u1')).rejects.toMatchObject({ code: '42P01' });
  });
});


describe('N05 booking reminder delivery failures', () => {
  const notifications = require('../../services/notificationService');
  const email = require('../../services/emailService');
  const { sendBookingReminder } = require('../../services/scheduling/bookingNotifyService');
  const booking = {
    id: 'reminder-fixture', owner_type: 'user', owner_id: 'host',
    start_at: '2026-09-16T12:00:00Z', end_at: '2026-09-16T12:30:00Z',
  };
  beforeEach(() => resetTables());
  afterEach(() => jest.restoreAllMocks());

  it('does not report success when the email service reports unavailable', async () => {
    jest.spyOn(email, 'sendEmail').mockResolvedValue({ success: false, error: 'EMAIL_UNAVAILABLE' });
    await expect(sendBookingReminder({
      booking: { ...booking, invitee_email: 'reminder@example.invalid' }, kind: 'reminder_60m', offsetMinutes: 60,
    })).rejects.toThrow();
  });

  it('does not report success when the personal notification insert fails', async () => {
    jest.spyOn(notifications, 'createNotification').mockResolvedValue(null);
    await expect(sendBookingReminder({
      booking: { ...booking, invitee_user_id: 'invitee' }, kind: 'reminder_60m', offsetMinutes: 60,
    })).rejects.toThrow();
  });
});


describe('N05 booking worker retries delivery failures', () => {
  const { runBookingReminders } = require('../../jobs/bookingReminders');
  const email = require('../../services/emailService');
  beforeEach(() => {
    resetTables();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-16T11:00:00Z'));
    seedTable('Booking', [{
      id: 'reminder-fixture', owner_type: 'user', owner_id: 'host', status: 'confirmed',
      invitee_email: 'reminder@example.invalid', start_at: '2026-09-16T12:00:00Z', end_at: '2026-09-16T12:30:00Z',
    }]);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
  it('releases a failed email claim, retries, then deduplicates a successful receipt', async () => {
    const send = jest.spyOn(email, 'sendEmail')
      .mockResolvedValueOnce({ success: false, error: 'EMAIL_UNAVAILABLE' })
      .mockResolvedValue({ success: true, messageId: 'synthetic-receipt' });
    await runBookingReminders();
    expect(getTable('BookingReminderLog')).toHaveLength(0);
    await runBookingReminders();
    expect(getTable('BookingReminderLog')).toHaveLength(1);
    await runBookingReminders();
    expect(send).toHaveBeenCalledTimes(2);
  });
});
