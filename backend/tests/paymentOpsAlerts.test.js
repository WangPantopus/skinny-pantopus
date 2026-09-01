const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');
const supabaseAdmin = require('../config/supabaseAdmin');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');

jest.mock('../services/alertingService', () => ({
  sendAlert: jest.fn().mockResolvedValue(undefined),
  SEVERITY: { CRITICAL: 'critical', WARNING: 'warning', INFO: 'info' },
}));
const { sendAlert } = require('../services/alertingService');
const { checkAndAlertStuckPayments } = require('../routes/paymentOps');

const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString();

describe('paymentOps transfer_pending alerting', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
  });

  test('sends CRITICAL alert when transfer_pending is stuck >30m', async () => {
    seedTable('Payment', [{
      id: 'pay-pending-critical-1',
      payment_status: PAYMENT_STATES.TRANSFER_PENDING,
      updated_at: minutesAgo(45),
      dispute_id: null,
    }]);
    seedTable('Gig', []);

    const alerts = await checkAndAlertStuckPayments();

    expect(alerts.length).toBeGreaterThan(0);
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'critical',
      title: expect.stringContaining('>30m'),
      dedup_key: 'pantopus-stuck-transfer-pending',
    }));
  });

  test('sends query-failure alert when transfer_pending query errors', async () => {
    seedTable('Payment', []);
    seedTable('Gig', []);

    const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);
    const fromSpy = jest.spyOn(supabaseAdmin, 'from').mockImplementation((tableName) => {
      const builder = originalFrom(tableName);
      if (tableName !== 'Payment') return builder;

      let isPendingStatusQuery = false;
      const originalEq = builder.eq.bind(builder);
      builder.eq = (field, value) => {
        if (field === 'payment_status' && value === PAYMENT_STATES.TRANSFER_PENDING) {
          isPendingStatusQuery = true;
        }
        return originalEq(field, value);
      };

      const originalThen = builder.then.bind(builder);
      builder.then = (resolve, reject) => {
        if (isPendingStatusQuery) {
          return Promise.resolve({
            data: null,
            error: { message: 'mock pending query failed' },
            count: 0,
          }).then(resolve, reject);
        }
        return originalThen(resolve, reject);
      };

      return builder;
    });

    try {
      await checkAndAlertStuckPayments();
    } finally {
      fromSpy.mockRestore();
    }

    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'critical',
      title: 'Payment health query failed',
      dedup_key: 'pantopus-health-query-failure-pending',
      metadata: expect.objectContaining({ query: 'transfer_pending' }),
    }));
  });
});
