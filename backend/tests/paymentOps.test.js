// ============================================================
// TEST: Payment Ops — checkAndAlertStuckPayments + route handlers
// Tests the real paymentOps code paths against the mock Supabase
// layer, including threshold semantics and status output.
// ============================================================

const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');

// Mock express with a minimal Router that captures route handlers
const routeHandlers = {};
jest.mock('express', () => {
  const Router = () => {
    const router = {
      stack: [],
      use: jest.fn(),
      get: jest.fn((path, ...handlers) => {
        routeHandlers[`GET ${path}`] = handlers[handlers.length - 1];
      }),
      post: jest.fn((path, ...handlers) => {
        routeHandlers[`POST ${path}`] = handlers[handlers.length - 1];
      }),
    };
    return router;
  };
  return { Router };
});

jest.mock('../middleware/verifyToken', () => {
  const mw = (req, _res, next) => {
    req.user = { id: 'admin-user-1', role: 'admin' };
    next();
  };
  mw.requireAdmin = (_req, _res, next) => next();
  return mw;
});

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../services/alertingService', () => ({
  sendAlert: jest.fn().mockResolvedValue(undefined),
  SEVERITY: { CRITICAL: 'critical', WARNING: 'warning', INFO: 'info' },
}));

jest.mock('../jobs/processPendingTransfers', () =>
  jest.fn().mockResolvedValue(undefined),
);

const { sendAlert, SEVERITY } = require('../services/alertingService');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');

// Import after mocks are set up — this will register route handlers
const paymentOpsRouter = require('../routes/paymentOps');
const { checkAndAlertStuckPayments } = paymentOpsRouter;

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString();

function makePayment(overrides = {}) {
  return {
    id: overrides.id || `pay-${Math.random().toString(36).slice(2, 8)}`,
    gig_id: overrides.gig_id || 'gig-1',
    payer_id: overrides.payer_id || 'user-payer',
    payee_id: overrides.payee_id || 'user-payee',
    amount_total: overrides.amount_total || 5000,
    amount_to_payee: overrides.amount_to_payee || 4500,
    payment_status: overrides.payment_status || PAYMENT_STATES.AUTHORIZED,
    payment_type: overrides.payment_type || 'gig',
    dispute_id: overrides.dispute_id ?? null,
    cooling_off_ends_at: overrides.cooling_off_ends_at || null,
    updated_at: overrides.updated_at || new Date().toISOString(),
    created_at: overrides.created_at || new Date().toISOString(),
    ...overrides,
  };
}

function mockRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) { res._status = code; return res; },
    json(body) { res._body = body; return res; },
  };
  return res;
}

function mockReq() {
  return { user: { id: 'admin-user-1', role: 'admin' } };
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

// ============================================================
// 1. /health route handler
// ============================================================

describe('/health route handler', () => {
  const handler = routeHandlers['GET /health'];

  test('handler is registered', () => {
    expect(handler).toBeDefined();
  });

  test('returns healthy when no stuck payments', async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._status).toBe(200);
    expect(res._body.status).toBe('healthy');
    expect(res._body.stuck_captured_hold_gt_2h).toBe(0);
    expect(res._body.stuck_transfer_pending_gt_10m).toBe(0);
    expect(res._body.stuck_transfer_pending_gt_30m).toBe(0);
  });

  test('returns degraded for transfer_pending >10m but <30m', async () => {
    seedTable('Payment', [
      makePayment({
        payment_status: PAYMENT_STATES.TRANSFER_PENDING,
        updated_at: minutesAgo(15),
      }),
    ]);

    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._body.status).toBe('degraded');
    expect(res._body.stuck_transfer_pending_gt_10m).toBe(1);
    expect(res._body.stuck_transfer_pending_gt_30m).toBe(0);
  });

  test('returns critical for transfer_pending >30m', async () => {
    seedTable('Payment', [
      makePayment({
        payment_status: PAYMENT_STATES.TRANSFER_PENDING,
        updated_at: minutesAgo(45),
      }),
    ]);

    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._body.status).toBe('critical');
    expect(res._body.stuck_transfer_pending_gt_10m).toBe(1);
    expect(res._body.stuck_transfer_pending_gt_30m).toBe(1);
  });

  test('returns degraded for captured_hold >2h past cooling', async () => {
    seedTable('Payment', [
      makePayment({
        payment_status: PAYMENT_STATES.CAPTURED_HOLD,
        cooling_off_ends_at: hoursAgo(3),
        dispute_id: null,
      }),
    ]);

    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._body.status).toBe('degraded');
    expect(res._body.stuck_captured_hold_gt_2h).toBe(1);
  });

  test('excludes disputed payments from captured_hold count', async () => {
    seedTable('Payment', [
      makePayment({
        payment_status: PAYMENT_STATES.CAPTURED_HOLD,
        cooling_off_ends_at: hoursAgo(5),
        dispute_id: 'dispute-123',
      }),
    ]);

    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._body.status).toBe('healthy');
    expect(res._body.stuck_captured_hold_gt_2h).toBe(0);
  });

  test('returns critical for >5 captured_hold stuck', async () => {
    seedTable('Payment', Array.from({ length: 6 }, (_, i) =>
      makePayment({
        id: `pay-stuck-${i}`,
        payment_status: PAYMENT_STATES.CAPTURED_HOLD,
        cooling_off_ends_at: hoursAgo(3),
        dispute_id: null,
      })
    ));

    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._body.status).toBe('critical');
    expect(res._body.stuck_captured_hold_gt_2h).toBe(6);
  });
});

// ============================================================
// 2. /stuck route handler
// ============================================================

describe('/stuck route handler', () => {
  const handler = routeHandlers['GET /stuck'];

  test('handler is registered', () => {
    expect(handler).toBeDefined();
  });

  test('returns stuck payments matching thresholds', async () => {
    seedTable('Payment', [
      makePayment({
        id: 'pay-hold-stuck',
        payment_status: PAYMENT_STATES.CAPTURED_HOLD,
        cooling_off_ends_at: hoursAgo(3),
        dispute_id: null,
      }),
      makePayment({
        id: 'pay-sched-stuck',
        payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
        updated_at: minutesAgo(45),
      }),
      makePayment({
        id: 'pay-pending-stuck',
        payment_status: PAYMENT_STATES.TRANSFER_PENDING,
        updated_at: minutesAgo(15),
      }),
      makePayment({
        id: 'pay-pending-ok',
        payment_status: PAYMENT_STATES.TRANSFER_PENDING,
        updated_at: minutesAgo(5), // Not yet stuck
      }),
    ]);

    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._status).toBe(200);
    expect(res._body.captured_hold_stuck).toHaveLength(1);
    expect(res._body.transfer_scheduled_stuck).toHaveLength(1);
    expect(res._body.transfer_pending_stuck).toHaveLength(1);
    expect(res._body.transfer_pending_stuck[0].id).toBe('pay-pending-stuck');
    expect(res._body.total_stuck).toBe(3);
  });

  test('returns empty when nothing stuck', async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._status).toBe(200);
    expect(res._body.total_stuck).toBe(0);
  });
});

// ============================================================
// 3. checkAndAlertStuckPayments — direct function
// ============================================================

describe('checkAndAlertStuckPayments', () => {
  test('sends no alerts when nothing stuck', async () => {
    const alerts = await checkAndAlertStuckPayments();
    expect(alerts).toHaveLength(0);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  test('sends WARNING for transfer_pending >10m but <30m', async () => {
    seedTable('Payment', [
      makePayment({
        payment_status: PAYMENT_STATES.TRANSFER_PENDING,
        updated_at: minutesAgo(15),
      }),
    ]);

    const alerts = await checkAndAlertStuckPayments();
    const pendingAlerts = alerts.filter(a => a.title.match(/transfer_pending/));
    expect(pendingAlerts).toHaveLength(1);
    expect(pendingAlerts[0].severity).toBe(SEVERITY.WARNING);
    expect(pendingAlerts[0].title).toMatch(/>10m/);
  });

  test('sends CRITICAL for single transfer_pending >30m (time-based)', async () => {
    // Single payment — count=1 but stuck >30m should still be CRITICAL
    seedTable('Payment', [
      makePayment({
        payment_status: PAYMENT_STATES.TRANSFER_PENDING,
        updated_at: minutesAgo(45),
      }),
    ]);

    const alerts = await checkAndAlertStuckPayments();
    const pendingAlerts = alerts.filter(a => a.title.match(/transfer_pending/));
    expect(pendingAlerts).toHaveLength(1);
    expect(pendingAlerts[0].severity).toBe(SEVERITY.CRITICAL);
    expect(pendingAlerts[0].title).toMatch(/>30m/);
    expect(pendingAlerts[0].metadata.count_gt_30m).toBe(1);
  });

  test('prefers 30m critical over 10m warning (no double alert)', async () => {
    seedTable('Payment', [
      makePayment({
        id: 'pay-45m',
        payment_status: PAYMENT_STATES.TRANSFER_PENDING,
        updated_at: minutesAgo(45),
      }),
      makePayment({
        id: 'pay-15m',
        payment_status: PAYMENT_STATES.TRANSFER_PENDING,
        updated_at: minutesAgo(15),
      }),
    ]);

    const alerts = await checkAndAlertStuckPayments();
    const pendingAlerts = alerts.filter(a => a.title.match(/transfer_pending/));
    // Only the >30m critical, not also a >10m warning
    expect(pendingAlerts).toHaveLength(1);
    expect(pendingAlerts[0].severity).toBe(SEVERITY.CRITICAL);
    expect(pendingAlerts[0].metadata.count_gt_10m).toBe(2);
    expect(pendingAlerts[0].metadata.count_gt_30m).toBe(1);
  });

  test('sends WARNING for captured_hold >2h', async () => {
    seedTable('Payment', [
      makePayment({
        payment_status: PAYMENT_STATES.CAPTURED_HOLD,
        cooling_off_ends_at: hoursAgo(3),
        dispute_id: null,
      }),
    ]);

    const alerts = await checkAndAlertStuckPayments();
    const holdAlerts = alerts.filter(a => a.title.match(/captured_hold/));
    expect(holdAlerts).toHaveLength(1);
    expect(holdAlerts[0].severity).toBe(SEVERITY.WARNING);
  });

  test('sends CRITICAL for >5 captured_hold stuck', async () => {
    seedTable('Payment', Array.from({ length: 6 }, (_, i) =>
      makePayment({
        id: `pay-stuck-${i}`,
        payment_status: PAYMENT_STATES.CAPTURED_HOLD,
        cooling_off_ends_at: hoursAgo(3),
        dispute_id: null,
      })
    ));

    const alerts = await checkAndAlertStuckPayments();
    const holdAlerts = alerts.filter(a => a.title.match(/captured_hold/));
    expect(holdAlerts).toHaveLength(1);
    expect(holdAlerts[0].severity).toBe(SEVERITY.CRITICAL);
  });

  test('sends WARNING for transfer_scheduled >30m', async () => {
    seedTable('Payment', [
      makePayment({
        payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
        updated_at: minutesAgo(45),
      }),
    ]);

    const alerts = await checkAndAlertStuckPayments();
    const schedAlerts = alerts.filter(a => a.title.match(/transfer_scheduled/));
    expect(schedAlerts).toHaveLength(1);
    expect(schedAlerts[0].severity).toBe(SEVERITY.WARNING);
  });

  test('fires alerts for multiple stuck categories simultaneously', async () => {
    seedTable('Payment', [
      makePayment({
        payment_status: PAYMENT_STATES.CAPTURED_HOLD,
        cooling_off_ends_at: hoursAgo(3),
        dispute_id: null,
      }),
      makePayment({
        payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
        updated_at: minutesAgo(45),
      }),
      makePayment({
        payment_status: PAYMENT_STATES.TRANSFER_PENDING,
        updated_at: minutesAgo(15),
      }),
    ]);

    const alerts = await checkAndAlertStuckPayments();
    // Should have at least one alert per stuck category
    expect(alerts.filter(a => a.title.match(/captured_hold/))).toHaveLength(1);
    expect(alerts.filter(a => a.title.match(/transfer_scheduled/))).toHaveLength(1);
    expect(alerts.filter(a => a.title.match(/transfer_pending/))).toHaveLength(1);
    expect(sendAlert).toHaveBeenCalledTimes(alerts.length);
  });
});

// ============================================================
// 4. POST /trigger-transfers route handler
// ============================================================

const processPendingTransfers = require('../jobs/processPendingTransfers');

describe('POST /trigger-transfers', () => {
  const handler = routeHandlers['POST /trigger-transfers'];

  test('handler is registered', () => {
    expect(handler).toBeDefined();
  });

  test('happy path: triggers transfer processing and returns success', async () => {
    processPendingTransfers.mockResolvedValueOnce(undefined);

    const req = { ...mockReq(), body: { reason: 'test run' } };
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.message).toMatch(/completed successfully/i);
    expect(res._body.audit).toBeDefined();
    expect(res._body.audit.action).toBe('manual_trigger_transfers');
    expect(processPendingTransfers).toHaveBeenCalledTimes(1);
  });

  test('returns 500 and sends critical alert when processPendingTransfers throws', async () => {
    processPendingTransfers.mockRejectedValueOnce(new Error('DB connection lost'));

    const req = { ...mockReq(), body: {} };
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(500);
    expect(res._body.error).toMatch(/failed/i);
    expect(res._body.message).toMatch(/DB connection lost/);
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: SEVERITY.CRITICAL,
        title: 'Manual transfer trigger failed',
      })
    );
  });

  test('audit log records admin user and reason', async () => {
    processPendingTransfers.mockResolvedValueOnce(undefined);

    const req = { ...mockReq(), body: { reason: 'post-deploy reconciliation' } };
    const res = mockRes();
    await handler(req, res);

    expect(res._body.audit.admin_user_id).toBe('admin-user-1');
    expect(res._body.audit.reason).toBe('post-deploy reconciliation');
  });
});

// ============================================================
// 5. POST /run-alerts route handler
// ============================================================

describe('POST /run-alerts', () => {
  const handler = routeHandlers['POST /run-alerts'];

  test('handler is registered', () => {
    expect(handler).toBeDefined();
  });

  test('happy path: returns zero alerts when nothing stuck', async () => {
    const res = mockRes();
    await handler(mockReq(), res);

    expect(res._status).toBe(200);
    expect(res._body.message).toMatch(/alert check completed/i);
    expect(res._body.alerts_sent).toBe(0);
    expect(res._body.alerts).toHaveLength(0);
  });

  test('returns alerts when stuck payments exist', async () => {
    seedTable('Payment', [
      makePayment({
        payment_status: PAYMENT_STATES.CAPTURED_HOLD,
        cooling_off_ends_at: hoursAgo(4),
        dispute_id: null,
      }),
      makePayment({
        id: 'pay-sched-stuck',
        payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
        updated_at: minutesAgo(45),
      }),
    ]);

    const res = mockRes();
    await handler(mockReq(), res);

    expect(res._status).toBe(200);
    expect(res._body.alerts_sent).toBeGreaterThan(0);
    expect(res._body.alerts.length).toBe(res._body.alerts_sent);
    expect(sendAlert).toHaveBeenCalledTimes(res._body.alerts_sent);
  });
});
