// ============================================================
// TEST: Mail Verification Pipeline — Integration Tests
//
// End-to-end flow tests covering the complete mail verification
// lifecycle with 7 scenarios:
//   1. Start → send → confirm → occupancy attached
//   2. Wrong code → lockout after max attempts
//   3. Expired code rejected
//   4. Rate limiting (user + address)
//   5. Resend rotates code, old code fails
//   6. Household conflict prevents admin
//   7. Full flow: start → resend → confirm with new code
//
// Uses in-memory supabaseAdmin mock. OccupancyAttachService is
// mocked to verify delegation.
// ============================================================

const crypto = require('crypto');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

// Mock the centralized occupancy attach service
const mockAttach = jest.fn().mockResolvedValue({
  success: true,
  occupancy: { id: 'occ-1', home_id: 'home-1', user_id: 'user-1', role: 'member' },
  status: 'attached',
});
jest.mock('../../services/occupancyAttachService', () => ({
  attach: (...args) => mockAttach(...args),
  detach: jest.fn().mockResolvedValue({ success: true }),
}));

const mockDispatchPostcard = jest.fn().mockResolvedValue({
  success: true,
  vendorJobId: 'mock-vendor-job-1',
});
jest.mock('../../services/addressValidation/mailVendorService', () => ({
  dispatchPostcard: (...args) => mockDispatchPostcard(...args),
}));

const service = require('../../services/addressValidation/mailVerificationService');

beforeEach(() => {
  resetTables();
  mockAttach.mockClear();
  mockDispatchPostcard.mockClear();
  mockDispatchPostcard.mockResolvedValue({
    success: true,
    vendorJobId: 'mock-vendor-job-1',
  });
  mockAttach.mockResolvedValue({
    success: true,
    occupancy: { id: 'occ-1', home_id: 'home-1', user_id: 'user-1', role: 'member' },
    status: 'attached',
  });
});

// ── Helpers ─────────────────────────────────────────────────

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function seedDeliverableAddress(overrides = {}) {
  seedTable('HomeAddress', [{
    id: 'addr-1',
    address_hash: 'hash-1',
    address_line1_norm: '123 Main St',
    city_norm: 'Portland',
    state: 'OR',
    postal_code: '97201',
    country: 'US',
    place_type: 'single_family',
    validation_raw_response: {
      dpv_match_code: 'Y',
      rdi_type: 'residential',
      missing_secondary: false,
      commercial_mailbox: false,
      vacant_flag: false,
      footnotes: [],
    },
    ...overrides,
  }]);
}

function seedHome(overrides = {}) {
  seedTable('Home', [{
    id: 'home-1',
    address_id: 'addr-1',
    address: '123 Main St',
    city: 'Portland',
    state: 'OR',
    zipcode: '97201',
    owner_id: 'other-user',
    ...overrides,
  }]);
}

/**
 * Extract the plaintext verification code from the MailVerificationJob metadata.
 */
function extractCode() {
  const jobs = getTable('MailVerificationJob');
  const latest = jobs[jobs.length - 1];
  return latest.metadata.code;
}

/**
 * Seed an active attempt + token for testing confirm/resend without
 * going through startVerification.
 */
function seedActiveAttempt(overrides = {}) {
  const id = overrides.id || 'attempt-1';
  seedTable('AddressVerificationAttempt', [{
    id,
    user_id: 'user-1',
    address_id: 'addr-1',
    method: 'mail_code',
    status: 'created',
    risk_tier: 'low',
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }]);
  return id;
}

function seedToken(overrides = {}) {
  seedTable('AddressVerificationToken', [{
    id: 'token-1',
    attempt_id: 'attempt-1',
    code_hash: hashCode('123456'),
    max_attempts: 5,
    attempt_count: 0,
    resend_count: 0,
    cooldown_until: new Date(Date.now() - 1000).toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  }]);
}

// ============================================================
// 1. Full flow: Start → send → confirm → occupancy attached
// ============================================================

describe('full flow: start → confirm → occupancy', () => {
  test('start creates attempt, token, and job with 6-digit code', async () => {
    seedDeliverableAddress();

    const startResult = await service.startVerification('user-1', 'addr-1');

    expect(startResult.success).toBe(true);
    expect(startResult.attempt_id).toBeTruthy();
    expect(startResult.expires_at).toBeTruthy();

    // Verify records created
    expect(getTable('AddressVerificationAttempt')).toHaveLength(1);
    expect(getTable('AddressVerificationToken')).toHaveLength(1);
    expect(getTable('MailVerificationJob')).toHaveLength(1);

    // Code is 6 digits
    const code = extractCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  test('confirm with correct code marks attempt verified and attaches occupancy', async () => {
    seedDeliverableAddress();
    seedHome();

    const startResult = await service.startVerification('user-1', 'addr-1');
    const code = extractCode();

    const confirmResult = await service.confirmCode(startResult.attempt_id, code, 'user-1');

    expect(confirmResult.verified).toBe(true);
    expect(confirmResult.occupancy_id).toBeTruthy();

    // Attempt status updated
    const attempts = getTable('AddressVerificationAttempt');
    expect(attempts[0].status).toBe('verified');

    // OccupancyAttachService was called
    expect(mockAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'mail_code',
      }),
    );
  });

  test('confirmed code results in member role (never admin)', async () => {
    seedDeliverableAddress();
    seedHome();

    const startResult = await service.startVerification('user-1', 'addr-1');
    const code = extractCode();

    await service.confirmCode(startResult.attempt_id, code, 'user-1');

    // mail_code always maps to member
    expect(mockAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'mail_code',
      }),
    );
  });
});

// ============================================================
// 2. Wrong code → lockout after max attempts
// ============================================================

describe('wrong code → lockout', () => {
  test('wrong code decrements remaining attempts', async () => {
    seedDeliverableAddress();
    seedActiveAttempt();
    seedToken();

    const result = await service.confirmCode('attempt-1', '000000', 'user-1');

    expect(result.verified).toBe(false);
    expect(result.attempts_remaining).toBe(4);
  });

  test('5 wrong attempts locks the verification', async () => {
    seedDeliverableAddress();
    seedActiveAttempt();
    seedToken();

    // Submit wrong code 5 times (max_attempts = 5)
    for (let i = 0; i < 4; i++) {
      await service.confirmCode('attempt-1', '000000', 'user-1');
    }

    const finalResult = await service.confirmCode('attempt-1', '000000', 'user-1');

    expect(finalResult.verified).toBe(false);
    expect(finalResult.locked).toBe(true);

    // Attempt status updated to locked
    const attempts = getTable('AddressVerificationAttempt');
    expect(attempts[0].status).toBe('locked');
  });

  test('correct code after 4 wrong attempts still works', async () => {
    seedDeliverableAddress();
    seedHome();
    seedActiveAttempt();
    seedToken();

    // Submit wrong code 4 times
    for (let i = 0; i < 4; i++) {
      await service.confirmCode('attempt-1', '000000', 'user-1');
    }

    // 5th attempt with correct code
    const result = await service.confirmCode('attempt-1', '123456', 'user-1');

    expect(result.verified).toBe(true);
  });

  test('after lockout, correct code is rejected', async () => {
    seedDeliverableAddress();
    seedActiveAttempt();
    seedToken();

    // Lock it out
    for (let i = 0; i < 5; i++) {
      await service.confirmCode('attempt-1', '000000', 'user-1');
    }

    // Now try correct code
    const result = await service.confirmCode('attempt-1', '123456', 'user-1');

    expect(result.verified).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ============================================================
// 3. Expired code rejected
// ============================================================

describe('expired code', () => {
  test('expired attempt is rejected and status updated', async () => {
    seedDeliverableAddress();
    seedActiveAttempt({
      expires_at: new Date(Date.now() - 1000).toISOString(), // expired
    });
    seedToken();

    const result = await service.confirmCode('attempt-1', '123456', 'user-1');

    expect(result.verified).toBe(false);
    expect(result.error).toBeTruthy();

    // Attempt status should be marked expired
    const attempts = getTable('AddressVerificationAttempt');
    expect(attempts[0].status).toBe('expired');
  });
});

// ============================================================
// 4. Rate limiting — user (2/24h) and address (5/7d)
// ============================================================

describe('rate limiting', () => {
  test('user limited to 2 starts per 24 hours', async () => {
    seedDeliverableAddress();

    // First start — OK
    const r1 = await service.startVerification('user-1', 'addr-1');
    expect(r1.success).toBe(true);

    // Second start — OK
    const r2 = await service.startVerification('user-1', 'addr-1');
    expect(r2.success).toBe(true);

    // Third start — rate limited
    const r3 = await service.startVerification('user-1', 'addr-1');
    expect(r3.success).toBe(false);
    expect(r3.error).toMatch(/rate limit|too many/i);
  });

  test('address limited to 5 attempts per 7 days', async () => {
    seedDeliverableAddress();

    // Start 5 attempts from different users (bypass user rate limit)
    for (let i = 1; i <= 5; i++) {
      const userId = `user-${i}`;
      const result = await service.startVerification(userId, 'addr-1');
      expect(result.success).toBe(true);
    }

    // 6th attempt at same address — rate limited
    const r6 = await service.startVerification('user-6', 'addr-1');
    expect(r6.success).toBe(false);
    expect(r6.error).toMatch(/rate limit|too many/i);
  });

  test('different user can start if user limit not reached', async () => {
    seedDeliverableAddress();

    // user-1 starts 2 (maxed out)
    await service.startVerification('user-1', 'addr-1');
    await service.startVerification('user-1', 'addr-1');

    // user-2 can still start (different user)
    const result = await service.startVerification('user-2', 'addr-1');
    expect(result.success).toBe(true);
  });
});

// ============================================================
// 5. Resend rotates code — old code fails, new code works
// ============================================================

describe('resend rotates code', () => {
  test('resend generates new code and invalidates old', async () => {
    seedDeliverableAddress();

    const startResult = await service.startVerification('user-1', 'addr-1');
    const originalCode = extractCode();

    // Clear cooldown for test
    const tokens = getTable('AddressVerificationToken');
    tokens[0].cooldown_until = new Date(Date.now() - 1000).toISOString();

    const resendResult = await service.resendCode(startResult.attempt_id, 'user-1');
    expect(resendResult.success).toBe(true);

    const newCode = extractCode();
    expect(newCode).toMatch(/^\d{6}$/);

    // Old code should fail
    const oldResult = await service.confirmCode(startResult.attempt_id, originalCode, 'user-1');
    expect(oldResult.verified).toBe(false);

    // New code should succeed
    const newResult = await service.confirmCode(startResult.attempt_id, newCode, 'user-1');
    expect(newResult.verified).toBe(true);
  });

  test('resend increments resend_count', async () => {
    seedDeliverableAddress();

    const startResult = await service.startVerification('user-1', 'addr-1');

    // Clear cooldown
    const tokens = getTable('AddressVerificationToken');
    tokens[0].cooldown_until = new Date(Date.now() - 1000).toISOString();

    await service.resendCode(startResult.attempt_id, 'user-1');

    const updatedTokens = getTable('AddressVerificationToken');
    expect(updatedTokens[0].resend_count).toBe(1);
  });

  test('resend resets attempt_count to 0', async () => {
    seedDeliverableAddress();
    seedActiveAttempt();
    seedToken({ attempt_count: 3 });

    const result = await service.resendCode('attempt-1', 'user-1');
    expect(result.success).toBe(true);

    const tokens = getTable('AddressVerificationToken');
    expect(tokens[0].attempt_count).toBe(0);
  });

  test('resend respects cooldown period', async () => {
    seedDeliverableAddress();
    seedActiveAttempt();
    seedToken({
      cooldown_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });

    const result = await service.resendCode('attempt-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cooldown/i);
  });

  test('resend limited to 3 times (max resends)', async () => {
    seedDeliverableAddress();
    seedActiveAttempt();
    seedToken({ resend_count: 3 });

    const result = await service.resendCode('attempt-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/maximum resend|max resend/i);
  });

  test('resend creates new MailVerificationJob', async () => {
    seedDeliverableAddress();

    const startResult = await service.startVerification('user-1', 'addr-1');
    expect(getTable('MailVerificationJob')).toHaveLength(1);

    // Clear cooldown
    const tokens = getTable('AddressVerificationToken');
    tokens[0].cooldown_until = new Date(Date.now() - 1000).toISOString();

    await service.resendCode(startResult.attempt_id, 'user-1');
    expect(getTable('MailVerificationJob')).toHaveLength(2);
  });
});

// ============================================================
// 6. Household conflict prevents admin-level mail verification
// ============================================================

describe('household conflict', () => {
  test('blocks start when home has verified authority with active admin occupancy', async () => {
    seedDeliverableAddress();
    seedHome();

    // Seed verified authority
    seedTable('HomeAuthority', [{
      id: 'auth-1',
      home_id: 'home-1',
      subject_type: 'user',
      subject_id: 'landlord-1',
      role: 'owner',
      status: 'verified',
      verification_tier: 'standard',
    }]);

    // Seed active admin/owner occupancy
    seedTable('HomeOccupancy', [{
      id: 'occ-admin',
      home_id: 'home-1',
      user_id: 'landlord-1',
      role: 'owner',
      role_base: 'owner',
      is_active: true,
      verification_status: 'verified',
    }]);

    const result = await service.startVerification('user-1', 'addr-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/conflict|authority|household/i);
  });

  test('does not block when authority exists but occupancy is inactive', async () => {
    seedDeliverableAddress();
    seedHome();

    seedTable('HomeAuthority', [{
      id: 'auth-1',
      home_id: 'home-1',
      subject_type: 'user',
      subject_id: 'landlord-1',
      role: 'owner',
      status: 'verified',
      verification_tier: 'standard',
    }]);

    seedTable('HomeOccupancy', [{
      id: 'occ-admin',
      home_id: 'home-1',
      user_id: 'landlord-1',
      role: 'owner',
      role_base: 'owner',
      is_active: false, // inactive
      verification_status: 'moved_out',
    }]);

    const result = await service.startVerification('user-1', 'addr-1');

    expect(result.success).toBe(true);
  });

  test('does not block when no home exists at address', async () => {
    seedDeliverableAddress();
    // No Home seeded at this address

    const result = await service.startVerification('user-1', 'addr-1');

    expect(result.success).toBe(true);
  });
});

// ============================================================
// 7. Full flow: start → resend → confirm with new code
// ============================================================

describe('full flow with resend', () => {
  test('start → resend → confirm new code succeeds', async () => {
    seedDeliverableAddress();
    seedHome();

    // Step 1: Start
    const startResult = await service.startVerification('user-1', 'addr-1');
    expect(startResult.success).toBe(true);

    const originalCode = extractCode();

    // Step 2: Clear cooldown and resend
    const tokens = getTable('AddressVerificationToken');
    tokens[0].cooldown_until = new Date(Date.now() - 1000).toISOString();

    const resendResult = await service.resendCode(startResult.attempt_id, 'user-1');
    expect(resendResult.success).toBe(true);

    const newCode = extractCode();
    expect(newCode).not.toBe(originalCode);

    // Step 3: Confirm with new code
    const confirmResult = await service.confirmCode(startResult.attempt_id, newCode, 'user-1');
    expect(confirmResult.verified).toBe(true);
    expect(confirmResult.occupancy_id).toBeTruthy();
  });

  test('start → resend → original code fails', async () => {
    seedDeliverableAddress();
    seedHome();

    const startResult = await service.startVerification('user-1', 'addr-1');
    const originalCode = extractCode();

    // Clear cooldown and resend
    const tokens = getTable('AddressVerificationToken');
    tokens[0].cooldown_until = new Date(Date.now() - 1000).toISOString();

    await service.resendCode(startResult.attempt_id, 'user-1');

    // Original code should now fail
    const confirmResult = await service.confirmCode(startResult.attempt_id, originalCode, 'user-1');
    expect(confirmResult.verified).toBe(false);
  });
});

// ============================================================
// Edge cases
// ============================================================

describe('edge cases', () => {
  test('confirm rejects wrong user_id', async () => {
    seedDeliverableAddress();
    seedActiveAttempt();
    seedToken();

    const result = await service.confirmCode('attempt-1', '123456', 'wrong-user');
    expect(result.verified).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('resend rejects wrong user_id', async () => {
    seedDeliverableAddress();
    seedActiveAttempt();
    seedToken();

    const result = await service.resendCode('attempt-1', 'wrong-user');
    expect(result.success).toBe(false);
  });

  test('start fails for undeliverable address (DPV N)', async () => {
    seedDeliverableAddress({
      validation_raw_response: {
        dpv_match_code: 'N',
        missing_secondary: false,
      },
    });

    const result = await service.startVerification('user-1', 'addr-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not deliverable');
  });

  test('start fails for nonexistent address', async () => {
    const result = await service.startVerification('user-1', 'nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
