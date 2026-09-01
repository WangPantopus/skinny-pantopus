// ============================================================
// TEST: MailVerificationService
//
// Comprehensive tests for startVerification, resendCode, and
// confirmCode — covering success flows, expiry, lockout, rate
// limiting, household conflict prevention, and edge cases.
// ============================================================

const crypto = require('crypto');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

// Mock the centralized occupancy attach service (tested separately)
const mockAttach = jest.fn().mockResolvedValue({
  success: true,
  occupancy: { id: 'mock-occ-from-service', home_id: 'home-1', user_id: 'user-1' },
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
    occupancy: { id: 'mock-occ-from-service', home_id: 'home-1', user_id: 'user-1' },
    status: 'attached',
  });
});

// ── Helpers ─────────────────────────────────────────────────

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function seedAddress(overrides = {}) {
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
    cooldown_until: new Date(Date.now() - 1000).toISOString(), // cooldown already passed
    created_at: new Date().toISOString(),
    ...overrides,
  }]);
}

// ============================================================
// startVerification
// ============================================================

describe('startVerification', () => {
  test('succeeds with valid address and no conflicts', async () => {
    seedAddress();

    const result = await service.startVerification('user-1', 'addr-1');

    expect(result.success).toBe(true);
    expect(result.attempt_id).toBeTruthy();
    expect(result.expires_at).toBeTruthy();
    expect(result.cooldown_until).toBeTruthy();
  });

  test('creates AddressVerificationAttempt record', async () => {
    seedAddress();

    await service.startVerification('user-1', 'addr-1');

    const attempts = getTable('AddressVerificationAttempt');
    expect(attempts).toHaveLength(1);
    expect(attempts[0].user_id).toBe('user-1');
    expect(attempts[0].address_id).toBe('addr-1');
    expect(attempts[0].method).toBe('mail_code');
    expect(attempts[0].status).toBe('created');
  });

  test('creates AddressVerificationToken with hashed code', async () => {
    seedAddress();

    await service.startVerification('user-1', 'addr-1');

    const tokens = getTable('AddressVerificationToken');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].code_hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    expect(tokens[0].max_attempts).toBe(5);
    expect(tokens[0].attempt_count).toBe(0);
    expect(tokens[0].resend_count).toBe(0);
  });

  test('creates MailVerificationJob with pending status', async () => {
    seedAddress();

    await service.startVerification('user-1', 'addr-1');

    const jobs = getTable('MailVerificationJob');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].vendor_status).toBe('pending');
    expect(jobs[0].metadata.code).toMatch(/^\d{6}$/);
  });

  test('dispatches the postcard immediately after job creation', async () => {
    seedAddress();

    await service.startVerification('user-1', 'addr-1');

    const jobs = getTable('MailVerificationJob');
    expect(mockDispatchPostcard).toHaveBeenCalledWith(jobs[0].id);
  });

  test('fails fast and rolls back created records when postcard dispatch fails', async () => {
    seedAddress();
    mockDispatchPostcard.mockResolvedValueOnce({
      success: false,
      error: 'provider unavailable',
    });

    const result = await service.startVerification('user-1', 'addr-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to send verification mail');
    expect(getTable('AddressVerificationAttempt')).toHaveLength(0);
    expect(getTable('AddressVerificationToken')).toHaveLength(0);
    expect(getTable('MailVerificationJob')).toHaveLength(0);
  });

  test('expiry is ~30 days in the future', async () => {
    seedAddress();

    const result = await service.startVerification('user-1', 'addr-1');
    const expiresAt = new Date(result.expires_at);
    const expectedMin = Date.now() + 29 * 24 * 60 * 60 * 1000;
    const expectedMax = Date.now() + 31 * 24 * 60 * 60 * 1000;

    expect(expiresAt.getTime()).toBeGreaterThan(expectedMin);
    expect(expiresAt.getTime()).toBeLessThan(expectedMax);
  });

  // ── Address not found ─────────────────────────────────────

  test('fails when address not found', async () => {
    const result = await service.startVerification('user-1', 'nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  // ── Address not deliverable ───────────────────────────────

  test('fails when address is undeliverable (DPV N)', async () => {
    seedAddress({
      validation_raw_response: {
        dpv_match_code: 'N',
        missing_secondary: false,
      },
    });

    const result = await service.startVerification('user-1', 'addr-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not deliverable');
  });

  // ── Missing unit ──────────────────────────────────────────

  test('fails when address needs unit but none provided', async () => {
    seedAddress({
      validation_raw_response: {
        dpv_match_code: 'S',
        missing_secondary: true,
      },
    });

    const result = await service.startVerification('user-1', 'addr-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('unit number');
  });

  test('succeeds when address needs unit and unit is provided', async () => {
    seedAddress({
      validation_raw_response: {
        dpv_match_code: 'S',
        missing_secondary: true,
      },
    });

    const result = await service.startVerification('user-1', 'addr-1', 'Apt 4A');
    expect(result.success).toBe(true);
  });

  // ── Household conflict ────────────────────────────────────

  test('fails when address has verified household admin', async () => {
    seedAddress();
    seedHome();
    seedTable('HomeAuthority', [{
      id: 'auth-1',
      home_id: 'home-1',
      subject_type: 'user',
      subject_id: 'other-user',
      role: 'owner',
      status: 'verified',
    }]);
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'other-user',
      is_active: true,
      role_base: 'owner',
      role: 'owner',
    }]);

    const result = await service.startVerification('user-1', 'addr-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('verified household admin');
  });

  test('succeeds when authority exists but is not verified', async () => {
    seedAddress();
    seedHome();
    seedTable('HomeAuthority', [{
      id: 'auth-1',
      home_id: 'home-1',
      subject_type: 'user',
      subject_id: 'other-user',
      role: 'owner',
      status: 'pending',
    }]);

    const result = await service.startVerification('user-1', 'addr-1');
    expect(result.success).toBe(true);
  });

  test('succeeds when no Home exists for address', async () => {
    seedAddress();
    // No Home record seeded

    const result = await service.startVerification('user-1', 'addr-1');
    expect(result.success).toBe(true);
  });

  // ── User rate limit ───────────────────────────────────────

  test('fails when user exceeds 2 starts per 24 hours', async () => {
    seedAddress();

    // Seed 2 recent attempts for this user
    seedTable('AddressVerificationAttempt', [
      {
        id: 'existing-1',
        user_id: 'user-1',
        address_id: 'addr-1',
        method: 'mail_code',
        status: 'created',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'existing-2',
        user_id: 'user-1',
        address_id: 'addr-1',
        method: 'mail_code',
        status: 'sent',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    const result = await service.startVerification('user-1', 'addr-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limit');
  });

  test('succeeds when user has 1 recent attempt (under limit)', async () => {
    seedAddress();

    seedTable('AddressVerificationAttempt', [{
      id: 'existing-1',
      user_id: 'user-1',
      address_id: 'addr-1',
      method: 'mail_code',
      status: 'created',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]);

    const result = await service.startVerification('user-1', 'addr-1');
    expect(result.success).toBe(true);
  });

  // ── Address rate limit ────────────────────────────────────

  test('fails when address exceeds 5 attempts per 7 days', async () => {
    seedAddress();

    const attempts = [];
    for (let i = 0; i < 5; i++) {
      attempts.push({
        id: `addr-attempt-${i}`,
        user_id: `user-${i}`, // different users
        address_id: 'addr-1',
        method: 'mail_code',
        status: 'created',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    seedTable('AddressVerificationAttempt', attempts);

    const result = await service.startVerification('user-new', 'addr-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('too many verification attempts');
  });
});

// ============================================================
// resendCode
// ============================================================

describe('resendCode', () => {
  test('succeeds when within limits and after cooldown', async () => {
    seedActiveAttempt();
    seedToken(); // cooldown already passed

    const result = await service.resendCode('attempt-1', 'user-1');

    expect(result.success).toBe(true);
    expect(result.new_expires_at).toBeTruthy();
    expect(result.cooldown_until).toBeTruthy();
  });

  test('generates new code hash and resets attempt_count', async () => {
    seedActiveAttempt();
    const originalHash = hashCode('123456');
    seedToken({ code_hash: originalHash, attempt_count: 3 });

    await service.resendCode('attempt-1', 'user-1');

    const tokens = getTable('AddressVerificationToken');
    expect(tokens[0].code_hash).not.toBe(originalHash);
    expect(tokens[0].attempt_count).toBe(0);
    expect(tokens[0].resend_count).toBe(1);
  });

  test('creates new MailVerificationJob', async () => {
    seedActiveAttempt();
    seedToken();

    await service.resendCode('attempt-1', 'user-1');

    const jobs = getTable('MailVerificationJob');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].metadata.code).toMatch(/^\d{6}$/);
  });

  test('dispatches the new postcard immediately on resend', async () => {
    seedActiveAttempt();
    seedToken();

    await service.resendCode('attempt-1', 'user-1');

    const jobs = getTable('MailVerificationJob');
    expect(mockDispatchPostcard).toHaveBeenCalledWith(jobs[0].id);
  });

  test('fails when attempt not found', async () => {
    const result = await service.resendCode('nonexistent', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('fails when attempt belongs to different user', async () => {
    seedActiveAttempt({ user_id: 'other-user' });
    seedToken();

    const result = await service.resendCode('attempt-1', 'user-1');
    expect(result.success).toBe(false);
  });

  test('fails when attempt is in terminal status', async () => {
    seedActiveAttempt({ status: 'verified' });
    seedToken();

    const result = await service.resendCode('attempt-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('verified');
  });

  test('fails when cooldown has not passed', async () => {
    seedActiveAttempt();
    seedToken({
      cooldown_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });

    const result = await service.resendCode('attempt-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cooldown');
  });

  test('fails when max resends reached', async () => {
    seedActiveAttempt();
    seedToken({ resend_count: 3 });

    const result = await service.resendCode('attempt-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum resend');
  });

  test('increments resend_count', async () => {
    seedActiveAttempt();
    seedToken({ resend_count: 1 });

    await service.resendCode('attempt-1', 'user-1');

    const tokens = getTable('AddressVerificationToken');
    expect(tokens[0].resend_count).toBe(2);
  });

  test('allows recovery resend for expired attempts and refreshes the attempt', async () => {
    seedActiveAttempt({
      status: 'expired',
      expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
    });
    seedToken({ resend_count: 1, attempt_count: 3 });

    const result = await service.resendCode('attempt-1', 'user-1');

    expect(result.success).toBe(true);
    expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now());

    const attempts = getTable('AddressVerificationAttempt');
    const tokens = getTable('AddressVerificationToken');
    expect(attempts[0].status).toBe('created');
    expect(new Date(attempts[0].expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(tokens[0].attempt_count).toBe(0);
    expect(tokens[0].resend_count).toBe(2);
  });

  test('reverts token state when resend dispatch fails', async () => {
    seedActiveAttempt();
    seedToken({ resend_count: 1, attempt_count: 2, code_hash: hashCode('123456') });
    mockDispatchPostcard.mockResolvedValueOnce({
      success: false,
      error: 'provider unavailable',
    });

    const result = await service.resendCode('attempt-1', 'user-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to send verification mail');
    const tokens = getTable('AddressVerificationToken');
    expect(tokens[0].code_hash).toBe(hashCode('123456'));
    expect(tokens[0].resend_count).toBe(1);
    expect(tokens[0].attempt_count).toBe(2);
    expect(getTable('MailVerificationJob')).toHaveLength(0);
  });
});

// ============================================================
// getVerificationStatus
// ============================================================

describe('getVerificationStatus', () => {
  test('returns pending status with resend metadata for active attempts', async () => {
    seedActiveAttempt();
    seedToken({ resend_count: 1, cooldown_until: '2026-04-02T01:00:00.000Z' });

    const result = await service.getVerificationStatus('attempt-1', 'user-1');

    expect(result).toEqual(expect.objectContaining({
      success: true,
      verification_id: 'attempt-1',
      address_id: 'addr-1',
      status: 'pending',
      cooldown_until: '2026-04-02T01:00:00.000Z',
      max_resends: 3,
      resends_remaining: 2,
    }));
  });

  test('returns confirmed for verified attempts', async () => {
    seedActiveAttempt({ status: 'verified' });
    seedToken();

    const result = await service.getVerificationStatus('attempt-1', 'user-1');

    expect(result.success).toBe(true);
    expect(result.status).toBe('confirmed');
  });

  test('marks overdue active attempts as expired on status read', async () => {
    seedActiveAttempt({
      expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
    });
    seedToken();

    const result = await service.getVerificationStatus('attempt-1', 'user-1');

    expect(result.success).toBe(true);
    expect(result.status).toBe('expired');
    expect(getTable('AddressVerificationAttempt')[0].status).toBe('expired');
  });

  test('fails when the attempt does not exist', async () => {
    const result = await service.getVerificationStatus('missing-attempt', 'user-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ============================================================
// confirmCode
// ============================================================

describe('confirmCode', () => {
  // ── Successful verification ───────────────────────────────

  test('succeeds with correct code', async () => {
    seedAddress();
    seedHome();
    seedActiveAttempt();
    seedToken({ code_hash: hashCode('123456') });

    const result = await service.confirmCode('attempt-1', '123456', 'user-1');

    expect(result.verified).toBe(true);
  });

  test('marks attempt as verified on success', async () => {
    seedAddress();
    seedActiveAttempt();
    seedToken({ code_hash: hashCode('123456') });

    await service.confirmCode('attempt-1', '123456', 'user-1');

    const attempts = getTable('AddressVerificationAttempt');
    expect(attempts[0].status).toBe('verified');
  });

  test('sets used_at on token on success', async () => {
    seedAddress();
    seedActiveAttempt();
    seedToken({ code_hash: hashCode('123456') });

    await service.confirmCode('attempt-1', '123456', 'user-1');

    const tokens = getTable('AddressVerificationToken');
    expect(tokens[0].used_at).toBeTruthy();
  });

  test('creates HomeOccupancy after successful verification', async () => {
    seedAddress();
    seedHome();
    seedActiveAttempt();
    seedToken({ code_hash: hashCode('123456') });

    const result = await service.confirmCode('attempt-1', '123456', 'user-1');

    expect(result.occupancy_id).toBeTruthy();

    // Verify delegation to occupancyAttachService
    expect(mockAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      }),
    );
  });

  test('updates existing occupancy verification_status', async () => {
    seedAddress();
    seedHome();
    seedActiveAttempt();
    seedToken({ code_hash: hashCode('123456') });
    seedTable('HomeOccupancy', [{
      id: 'occ-existing',
      home_id: 'home-1',
      user_id: 'user-1',
      is_active: true,
      verification_status: 'pending_postcard',
      role: 'member',
    }]);

    // Mock to return the existing occupancy's id (simulating upgrade)
    mockAttach.mockResolvedValueOnce({
      success: true,
      occupancy: { id: 'occ-existing', home_id: 'home-1', user_id: 'user-1' },
      status: 'upgraded',
    });

    const result = await service.confirmCode('attempt-1', '123456', 'user-1');

    expect(result.occupancy_id).toBe('occ-existing');
    expect(mockAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
      }),
    );
  });

  // ── Wrong code ────────────────────────────────────────────

  test('fails with wrong code', async () => {
    seedActiveAttempt();
    seedToken({ code_hash: hashCode('123456') });

    const result = await service.confirmCode('attempt-1', '999999', 'user-1');

    expect(result.verified).toBe(false);
    expect(result.attempts_remaining).toBe(4);
  });

  test('increments attempt_count on wrong code', async () => {
    seedActiveAttempt();
    seedToken({ code_hash: hashCode('123456'), attempt_count: 2 });

    await service.confirmCode('attempt-1', '999999', 'user-1');

    const tokens = getTable('AddressVerificationToken');
    expect(tokens[0].attempt_count).toBe(3);
  });

  // ── Lockout ───────────────────────────────────────────────

  test('locks attempt after max_attempts reached', async () => {
    seedActiveAttempt();
    seedToken({ code_hash: hashCode('123456'), attempt_count: 4 }); // one more makes 5

    const result = await service.confirmCode('attempt-1', '999999', 'user-1');

    expect(result.verified).toBe(false);
    expect(result.locked).toBe(true);

    const attempts = getTable('AddressVerificationAttempt');
    expect(attempts[0].status).toBe('locked');
  });

  test('returns locked when already at max attempts (before comparison)', async () => {
    seedActiveAttempt();
    seedToken({ code_hash: hashCode('123456'), attempt_count: 5 });

    const result = await service.confirmCode('attempt-1', '123456', 'user-1');

    expect(result.verified).toBe(false);
    expect(result.locked).toBe(true);
  });

  // ── Expired code ──────────────────────────────────────────

  test('fails when attempt has expired', async () => {
    seedActiveAttempt({
      expires_at: new Date(Date.now() - 1000).toISOString(), // expired
    });
    seedToken({ code_hash: hashCode('123456') });

    const result = await service.confirmCode('attempt-1', '123456', 'user-1');

    expect(result.verified).toBe(false);
    expect(result.error).toContain('expired');

    const attempts = getTable('AddressVerificationAttempt');
    expect(attempts[0].status).toBe('expired');
  });

  // ── Attempt not found / wrong user ────────────────────────

  test('fails when attempt not found', async () => {
    const result = await service.confirmCode('nonexistent', '123456', 'user-1');
    expect(result.verified).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('fails when attempt belongs to different user', async () => {
    seedActiveAttempt({ user_id: 'other-user' });
    seedToken({ code_hash: hashCode('123456') });

    const result = await service.confirmCode('attempt-1', '123456', 'user-1');
    expect(result.verified).toBe(false);
  });

  // ── Terminal status ───────────────────────────────────────

  test('fails when attempt is already verified', async () => {
    seedActiveAttempt({ status: 'verified' });
    seedToken({ code_hash: hashCode('123456') });

    const result = await service.confirmCode('attempt-1', '123456', 'user-1');
    expect(result.verified).toBe(false);
    expect(result.error).toContain('verified');
  });

  test('fails when attempt is locked', async () => {
    seedActiveAttempt({ status: 'locked' });
    seedToken({ code_hash: hashCode('123456') });

    const result = await service.confirmCode('attempt-1', '123456', 'user-1');
    expect(result.verified).toBe(false);
    expect(result.error).toContain('locked');
  });

  test('fails when attempt is canceled', async () => {
    seedActiveAttempt({ status: 'canceled' });
    seedToken({ code_hash: hashCode('123456') });

    const result = await service.confirmCode('attempt-1', '123456', 'user-1');
    expect(result.verified).toBe(false);
  });
});

// ============================================================
// Full flow: start → confirm
// ============================================================

describe('Full flow: start → confirm', () => {
  test('start then confirm with code from job metadata', async () => {
    seedAddress();
    seedHome();

    const startResult = await service.startVerification('user-1', 'addr-1');
    expect(startResult.success).toBe(true);

    // Extract code from the MailVerificationJob metadata
    const jobs = getTable('MailVerificationJob');
    const code = jobs[0].metadata.code;

    const confirmResult = await service.confirmCode(startResult.attempt_id, code, 'user-1');
    expect(confirmResult.verified).toBe(true);
    expect(confirmResult.occupancy_id).toBeTruthy();
    expect(mockAttach).toHaveBeenCalled();
  });

  test('start then resend then confirm with new code', async () => {
    seedAddress();

    const startResult = await service.startVerification('user-1', 'addr-1');
    expect(startResult.success).toBe(true);

    // Manually clear cooldown so resend works
    const tokens = getTable('AddressVerificationToken');
    tokens[0].cooldown_until = new Date(Date.now() - 1000).toISOString();

    const resendResult = await service.resendCode(startResult.attempt_id, 'user-1');
    expect(resendResult.success).toBe(true);

    // The old code from first job should no longer work
    const jobs = getTable('MailVerificationJob');
    const oldCode = jobs[0].metadata.code;
    const newCode = jobs[1].metadata.code;
    expect(oldCode).not.toBe(newCode);

    // Old code fails
    const oldConfirm = await service.confirmCode(startResult.attempt_id, oldCode, 'user-1');
    expect(oldConfirm.verified).toBe(false);

    // New code succeeds
    const newConfirm = await service.confirmCode(startResult.attempt_id, newCode, 'user-1');
    expect(newConfirm.verified).toBe(true);
  });
});

// ============================================================
// Code generation and hashing
// ============================================================

describe('Code generation', () => {
  test('generates 6-digit codes', () => {
    for (let i = 0; i < 20; i++) {
      const code = service._generateCode();
      expect(code).toMatch(/^\d{6}$/);
      const num = parseInt(code, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    }
  });

  test('hash is a 64-char hex string (SHA-256)', () => {
    const hash = service._hashCode('123456');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('same code produces same hash', () => {
    expect(service._hashCode('123456')).toBe(service._hashCode('123456'));
  });

  test('different codes produce different hashes', () => {
    expect(service._hashCode('123456')).not.toBe(service._hashCode('654321'));
  });

  test('timing-safe compare returns true for matching strings', () => {
    const hash = service._hashCode('123456');
    expect(service._timingSafeCompare(hash, hash)).toBe(true);
  });

  test('timing-safe compare returns false for different strings', () => {
    const hash1 = service._hashCode('123456');
    const hash2 = service._hashCode('654321');
    expect(service._timingSafeCompare(hash1, hash2)).toBe(false);
  });

  test('timing-safe compare returns false for different lengths', () => {
    expect(service._timingSafeCompare('abc', 'abcd')).toBe(false);
  });
});
