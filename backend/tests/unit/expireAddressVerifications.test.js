/**
 * REL — before this job existed, no job in the repository touched any mail
 * table. A mail-verification attempt sat at 'sent' indefinitely: no sweeper,
 * no alert, no ops queue, and it kept holding a slot in the per-address budget.
 */

const { resetTables, getTable, seedTable } = require('../__mocks__/supabaseAdmin');
const expireAddressVerifications = require('../../jobs/expireAddressVerifications');

const PAST = new Date(Date.now() - 86400000).toISOString();
const FUTURE = new Date(Date.now() + 86400000).toISOString();

beforeEach(() => resetTables());

describe('stale verification attempts', () => {
  test('expires attempts past expires_at', async () => {
    seedTable('AddressVerificationAttempt', [
      { id: 'a1', status: 'sent', expires_at: PAST },
      { id: 'a2', status: 'created', expires_at: PAST },
      { id: 'a3', status: 'delivered_unknown', expires_at: PAST },
    ]);

    const res = await expireAddressVerifications();

    expect(res.attempts_expired).toBe(3);
    for (const row of getTable('AddressVerificationAttempt')) {
      expect(row.status).toBe('expired');
    }
  });

  test('leaves live attempts alone', async () => {
    seedTable('AddressVerificationAttempt', [
      { id: 'a1', status: 'sent', expires_at: FUTURE },
    ]);

    const res = await expireAddressVerifications();

    expect(res.attempts_expired).toBe(0);
    expect(getTable('AddressVerificationAttempt')[0].status).toBe('sent');
  });

  test('does not resurrect terminal attempts', async () => {
    seedTable('AddressVerificationAttempt', [
      { id: 'a1', status: 'verified', expires_at: PAST },
      { id: 'a2', status: 'locked', expires_at: PAST },
    ]);

    const res = await expireAddressVerifications();

    expect(res.attempts_expired).toBe(0);
    expect(getTable('AddressVerificationAttempt').map((r) => r.status))
      .toEqual(['verified', 'locked']);
  });
});

describe('stale postcard codes', () => {
  test('expires pending codes past expires_at', async () => {
    seedTable('HomePostcardCode', [
      { id: 'p1', status: 'pending', expires_at: PAST },
      { id: 'p2', status: 'pending', expires_at: FUTURE },
    ]);

    const res = await expireAddressVerifications();

    expect(res.postcards_expired).toBe(1);
    const rows = getTable('HomePostcardCode');
    expect(rows.find((r) => r.id === 'p1').status).toBe('expired');
    expect(rows.find((r) => r.id === 'p2').status).toBe('pending');
  });
});

describe('dry run', () => {
  test('reports what it would do without writing', async () => {
    seedTable('AddressVerificationAttempt', [{ id: 'a1', status: 'sent', expires_at: PAST }]);

    const res = await expireAddressVerifications({ dryRun: true });

    expect(res.dry_run).toBe(true);
    expect(res.attempts_expired).toBe(1);
    expect(getTable('AddressVerificationAttempt')[0].status).toBe('sent');
  });
});
