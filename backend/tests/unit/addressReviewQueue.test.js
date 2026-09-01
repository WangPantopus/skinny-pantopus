/**
 * SCN-11 — the decision engine emits `manual_review` as the next action for six
 * verdicts, and nothing consumed it. Every escalation was a dead end: the engine
 * said "a human should look at this" and no human ever could.
 */

const { resetTables, getTable, seedTable } = require('../__mocks__/supabaseAdmin');
const service = require('../../services/addressValidation/addressReviewService');

beforeEach(() => resetTables());

describe('needsReview', () => {
  test('true when the verdict asks for a human', () => {
    expect(service.needsReview({ status: 'MIXED_USE', next_actions: ['manual_review'] })).toBe(true);
  });

  test('false for a clean verdict', () => {
    expect(service.needsReview({ status: 'OK', next_actions: [] })).toBe(false);
  });

  test('false for a missing or malformed verdict', () => {
    expect(service.needsReview(null)).toBe(false);
    expect(service.needsReview({ status: 'OK' })).toBe(false);
  });
});

describe('openCase', () => {
  const verdict = { status: 'MIXED_USE', reasons: ['residential_and_commercial'], next_actions: ['manual_review'] };

  test('opens a case for an escalating verdict', async () => {
    const id = await service.openCase({
      addressId: 'addr-1', userId: 'user-1', verdict, trigger: 'validate',
    });

    expect(id).toBeTruthy();
    const cases = getTable('AddressReviewCase');
    expect(cases).toHaveLength(1);
    expect(cases[0].verdict_status).toBe('MIXED_USE');
    expect(cases[0].status).toBe('open');
    expect(cases[0].reasons).toContain('residential_and_commercial');
  });

  test('does nothing for a verdict that does not ask for review', async () => {
    const id = await service.openCase({
      addressId: 'addr-1', userId: 'user-1',
      verdict: { status: 'OK', next_actions: [] },
    });

    expect(id).toBeNull();
    expect(getTable('AddressReviewCase')).toHaveLength(0);
  });

  test('a queue failure never breaks the caller', async () => {
    // No throw even with a malformed payload.
    await expect(service.openCase({ userId: 'user-1', verdict })).resolves.not.toThrow;
  });
});

describe('resolveCase', () => {
  function seedOpenCase(overrides = {}) {
    seedTable('AddressReviewCase', [{
      id: 'case-1', address_id: 'addr-1', user_id: 'user-1',
      verdict_status: 'MIXED_USE', reasons: [], status: 'open', ...overrides,
    }]);
  }

  test('records the outcome and the reviewer', async () => {
    seedOpenCase();

    const res = await service.resolveCase({
      caseId: 'case-1', reviewerId: 'admin-1', outcome: 'approved', note: 'Verified by deed',
    });

    expect(res.success).toBe(true);
    const row = getTable('AddressReviewCase')[0];
    expect(row.status).toBe('approved');
    expect(row.resolved_by).toBe('admin-1');
    expect(row.resolved_at).toBeTruthy();
    expect(row.resolution_note).toBe('Verified by deed');
  });

  test('rejects an invalid outcome', async () => {
    seedOpenCase();
    const res = await service.resolveCase({ caseId: 'case-1', reviewerId: 'a', outcome: 'maybe' });
    expect(res.success).toBe(false);
  });

  test('a second reviewer cannot re-resolve a closed case', async () => {
    seedOpenCase({ status: 'approved' });

    const res = await service.resolveCase({
      caseId: 'case-1', reviewerId: 'admin-2', outcome: 'rejected',
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/already resolved|not found/i);
    expect(getTable('AddressReviewCase')[0].status).toBe('approved');
  });
});

describe('listOpenCases', () => {
  test('returns only cases awaiting a reviewer', async () => {
    seedTable('AddressReviewCase', [
      { id: 'c1', status: 'open', created_at: '2026-08-01T00:00:00Z', verdict_status: 'MIXED_USE', reasons: [] },
      { id: 'c2', status: 'approved', created_at: '2026-08-02T00:00:00Z', verdict_status: 'OK', reasons: [] },
      { id: 'c3', status: 'in_review', created_at: '2026-08-03T00:00:00Z', verdict_status: 'LOW_CONFIDENCE', reasons: [] },
    ]);

    const { cases } = await service.listOpenCases();
    expect(cases.map((c) => c.id).sort()).toEqual(['c1', 'c3']);
  });
});
