/**
 * Security regression tests for address verification.
 *
 * Each test here corresponds to a finding from the 2026-08-22 audit
 * (docs/home-address-verification-audit-2026-08-22.md). They exist to stop
 * the specific bypass from being reintroduced, so prefer asserting the
 * security property directly over asserting an implementation detail.
 */

const { resetTables, getTable, seedTable } = require('../__mocks__/supabaseAdmin');

const mockDispatchPostcard = jest.fn();
jest.mock('../../services/addressValidation/mailVendorService', () => ({
  dispatchPostcard: (...args) => mockDispatchPostcard(...args),
}));
jest.mock('../../services/occupancyAttachService', () => ({
  attachOccupancy: jest.fn().mockResolvedValue({ success: true, occupancy_id: 'occ-1' }),
}));

const mailVerificationService = require('../../services/addressValidation/mailVerificationService');

function seedAddress() {
  seedTable('HomeAddress', [{
    id: 'addr-1',
    address_line1_norm: '123 Main St',
    address_line2_norm: null,
    city_norm: 'Portland',
    state: 'OR',
    postal_code: '97201',
    validation_raw_response: { dpv_match_code: 'Y' },
  }]);
}

beforeEach(() => {
  resetTables();
  mockDispatchPostcard.mockReset();
  mockDispatchPostcard.mockResolvedValue({ success: true, vendorJobId: 'psc_1' });
  seedAddress();
});

describe('SCN-02 / PRV-03 — the verification code is never persisted', () => {
  test('startVerification stores no code on the job row', async () => {
    const res = await mailVerificationService.startVerification('user-1', 'addr-1');
    expect(res.success).toBe(true);

    for (const job of getTable('MailVerificationJob')) {
      expect(job.metadata).toBeDefined();
      expect(job.metadata.code).toBeUndefined();
      // no field of the metadata blob may hold a bare 6-digit code
      for (const value of Object.values(job.metadata)) {
        expect(String(value)).not.toMatch(/^\d{6}$/);
      }
    }
  });

  test('the code reaches the mail vendor in memory instead', async () => {
    await mailVerificationService.startVerification('user-1', 'addr-1');
    expect(mockDispatchPostcard).toHaveBeenCalledTimes(1);
    expect(mockDispatchPostcard.mock.calls[0][1]).toMatch(/^\d{6}$/);
  });

  test('resendCode also persists no code', async () => {
    const start = await mailVerificationService.startVerification('user-1', 'addr-1');
    // clear the cooldown so the resend is permitted
    const tokens = getTable('AddressVerificationToken');
    tokens[0].cooldown_until = new Date(Date.now() - 1000).toISOString();

    const res = await mailVerificationService.resendCode(start.attempt_id, 'user-1');
    expect(res.success).toBe(true);

    for (const job of getTable('MailVerificationJob')) {
      expect(job.metadata.code).toBeUndefined();
    }
    expect(mockDispatchPostcard.mock.calls[1][1]).toMatch(/^\d{6}$/);
    expect(mockDispatchPostcard.mock.calls[1][1])
      .not.toBe(mockDispatchPostcard.mock.calls[0][1]);
  });

  test('only the hash is written to AddressVerificationToken', async () => {
    await mailVerificationService.startVerification('user-1', 'addr-1');
    const code = mockDispatchPostcard.mock.calls[0][1];

    const tokens = getTable('AddressVerificationToken');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens[0].code_hash).not.toContain(code);
    expect(tokens[0].code).toBeUndefined();
  });
});

describe('SCN-03 — checkHomePermission return shape', () => {
  // Four routes tested `access.allowed`, a property checkHomePermission never
  // returns, so `!undefined` was always true and every one of them returned
  // 403 unconditionally. The household-approval flow was entirely unreachable.
  // This guards the contract so the same class of bug cannot recur silently.
  const fs = require('fs');
  const path = require('path');

  const homeRoutes = fs.readFileSync(
    path.join(__dirname, '../../routes/home.js'), 'utf8',
  );

  test('no route gates on a property checkHomePermission does not return', () => {
    // checkHomePermission returns { hasAccess, isOwner, occupancy }.
    const offenders = homeRoutes
      .split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /\baccess\.allowed\b/.test(line));

    expect(offenders).toEqual([]);
  });

  test('checkHomePermission advertises hasAccess, never allowed', () => {
    const perms = fs.readFileSync(
      path.join(__dirname, '../../utils/homePermissions.js'), 'utf8',
    );
    const fn = perms.slice(perms.indexOf('async function checkHomePermission'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));

    expect(body).toContain('hasAccess');
    // the role-comparison helpers return { allowed } — that shape must not
    // leak into checkHomePermission itself
    expect(body).not.toMatch(/return\s*\{\s*allowed/);
  });
});

describe('SCN-03 — an occupied address cannot be self-served by mail code', () => {
  // The old gate keyed on HomeAuthority.status === 'verified', a status nothing
  // in the codebase can set, so it always returned blocked:false and anyone
  // holding a mailed code joined an occupied household with no approval.
  function seedOccupiedHome(occupantId) {
    seedTable('Home', [{ id: 'home-1', address_id: 'addr-1', owner_id: occupantId }]);
    seedTable('HomeOccupancy', [{
      id: 'occ-1', home_id: 'home-1', user_id: occupantId, is_active: true,
      role_base: 'owner', verification_status: 'verified',
    }]);
  }

  test('blocked even when no HomeAuthority row exists at all', async () => {
    seedOccupiedHome('resident-1');
    // deliberately no HomeAuthority rows — this is the real-world state
    const res = await mailVerificationService.startVerification('stranger-1', 'addr-1');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/already lives at this address/i);
    expect(getTable('AddressVerificationAttempt')).toHaveLength(0);
    expect(mockDispatchPostcard).not.toHaveBeenCalled();
  });

  test('blocked when the home has several active admins', async () => {
    seedOccupiedHome('resident-1');
    seedTable('HomeOccupancy', [
      ...getTable('HomeOccupancy'),
      {
        id: 'occ-2', home_id: 'home-1', user_id: 'resident-2', is_active: true,
        role_base: 'admin', verification_status: 'verified',
      },
    ]);

    // The old implementation used .maybeSingle() here, which errors on more
    // than one row and failed open exactly on the busiest households.
    const res = await mailVerificationService.startVerification('stranger-1', 'addr-1');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/already lives at this address/i);
  });

  test('an existing occupant may still re-verify their own address', async () => {
    seedOccupiedHome('resident-1');
    const res = await mailVerificationService.startVerification('resident-1', 'addr-1');
    expect(res.success).toBe(true);
  });

  test('a genuinely unoccupied address still works (cold start)', async () => {
    const res = await mailVerificationService.startVerification('new-user', 'addr-1');
    expect(res.success).toBe(true);
  });
});

describe('PRV-09 — logs never carry codes or addresses', () => {
  const { redactLogMeta: __redact } = require('../../utils/redactLogMeta');

  test('redacts verification codes at any depth', () => {
    const out = __redact({
      code: '123456',
      job: { metadata: { code: '654321' } },
      letter_code: 'ABCD-EFGH-JKLM-NPQR',
    });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('123456');
    expect(serialized).not.toContain('654321');
    expect(serialized).not.toContain('ABCD');
  });

  test('redacts street addresses but keeps coarse, non-identifying fields', () => {
    const out = __redact({
      address: '123 Main St',
      address_line1: '123 Main St',
      city: 'Portland',
      state: 'OR',
    });
    expect(JSON.stringify(out)).not.toContain('123 Main St');
    expect(out.city).toBe('Portland');
    expect(out.state).toBe('OR');
  });

  test('survives cycles and arrays without throwing', () => {
    const cyclic = { code: 'x' };
    cyclic.self = cyclic;
    expect(() => __redact({ items: [cyclic, { token: 't' }] })).not.toThrow();
    expect(JSON.stringify(__redact({ items: [{ token: 'secret-token' }] })))
      .not.toContain('secret-token');
  });
});

describe('PRV-05 — residency is not an anonymous oracle', () => {
  const { getPublicResidencySummary } = require('../../utils/publicResidencyProfile');

  test('an anonymous viewer learns nothing about where someone lives', async () => {
    seedTable('HomeOccupancy', [{
      id: 'o1', home_id: 'h1', user_id: 'subject', is_active: true,
      verification_status: 'verified', created_at: new Date().toISOString(),
    }]);
    seedTable('Home', [{ id: 'h1', city: 'Portland', state: 'OR' }]);

    const res = await getPublicResidencySummary('subject', null);
    expect(res).toEqual({ hasHome: false, city: null, state: null, verified: false });
  });
});

describe('SCN-06 — a correct code with no occupancy is not reported as success', () => {
  test('reports failure, flags support, and does not claim verification', async () => {
    // No Home row for this address, so the occupancy attach finds nothing.
    // The old code returned { verified: true, occupancy_id: null } and the user
    // saw a success screen while holding no residency at all.
    const start = await mailVerificationService.startVerification('user-1', 'addr-1');
    const code = mockDispatchPostcard.mock.calls[0][1];

    const res = await mailVerificationService.confirmCode(start.attempt_id, code, 'user-1');

    expect(res.verified).toBe(false);
    expect(res.code_accepted).toBe(true);
    expect(res.needs_support).toBe(true);
    expect(res.error).toMatch(/contact support/i);
  });

  test('the code is still consumed, so it cannot be replayed', async () => {
    const start = await mailVerificationService.startVerification('user-1', 'addr-1');
    const code = mockDispatchPostcard.mock.calls[0][1];

    await mailVerificationService.confirmCode(start.attempt_id, code, 'user-1');

    const attempt = getTable('AddressVerificationAttempt')
      .find((a) => a.id === start.attempt_id);
    expect(attempt.status).toBe('verified');
  });
});

describe('REL — the mail lifecycle is observable, and never logs a code', () => {
  const observability = require('../../services/addressValidation/addressVerificationObservability');

  test('starting a verification emits an event', async () => {
    await mailVerificationService.startVerification('user-1', 'addr-1');

    const events = getTable('AddressVerificationEvent');
    const start = events.find((e) => e.event_type === 'mail_start');
    expect(start).toBeDefined();
    expect(start.status).toBe('ok');
  });

  test('no emitted event ever carries the verification code', async () => {
    await mailVerificationService.startVerification('user-1', 'addr-1');
    const code = mockDispatchPostcard.mock.calls[0][1];

    const serialized = JSON.stringify(getTable('AddressVerificationEvent'));
    expect(serialized).not.toContain(code);
  });

  test('a code cannot be smuggled through the detail field', async () => {
    await observability.recordMailLifecycleEvent({
      step: 'test',
      status: 'ok',
      detail: { code: '424242', unit_supplied: true },
    });

    const serialized = JSON.stringify(getTable('AddressVerificationEvent'));
    expect(serialized).not.toContain('424242');
    expect(serialized).toContain('unit_supplied');
  });
});
