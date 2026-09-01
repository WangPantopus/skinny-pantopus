// ============================================================
// TEST: authorityResolution utility
// - resolveVerifiedAuthorityForActor (direct, seat-based, legacy)
// - assertCallerOwnsLease (primary, co-resident, authority, denied)
// ============================================================

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  resolveVerifiedAuthorityForActor,
  assertCallerOwnsLease,
} = require('../../utils/authorityResolution');

const { seedTable, resetTables } = require('../__mocks__/supabaseAdmin');

// ── Test IDs ────────────────────────────────────────────────

const USER_A = 'user-aaa-111';
const USER_B = 'user-bbb-222';
const USER_UNRELATED = 'user-zzz-999';
const HOME_1 = 'home-001';
const BIZ_1 = 'biz-001';
const SEAT_1 = 'seat-001';
const AUTHORITY_DIRECT = 'auth-direct-001';
const AUTHORITY_BIZ = 'auth-biz-001';
const AUTHORITY_REVOKED = 'auth-revoked-001';
const LEASE_1 = 'lease-001';

// ── resolveVerifiedAuthorityForActor ────────────────────────

describe('resolveVerifiedAuthorityForActor', () => {
  beforeEach(() => {
    resetTables();
  });

  test('user with direct verified authority resolves successfully', async () => {
    seedTable('HomeAuthority', [
      {
        id: AUTHORITY_DIRECT,
        home_id: HOME_1,
        subject_type: 'user',
        subject_id: USER_A,
        status: 'verified',
        role: 'owner',
      },
    ]);

    const result = await resolveVerifiedAuthorityForActor({ userId: USER_A, homeId: HOME_1 });
    expect(result.found).toBe(true);
    expect(result.authority.id).toBe(AUTHORITY_DIRECT);
    expect(result.authority.subject_type).toBe('user');
  });

  test('user with business-backed authority (via BusinessTeam) resolves successfully', async () => {
    seedTable('HomeAuthority', [
      {
        id: AUTHORITY_BIZ,
        home_id: HOME_1,
        subject_type: 'business',
        subject_id: BIZ_1,
        status: 'verified',
        role: 'owner',
      },
    ]);
    // No seat bindings — should fall through to BusinessTeam path
    seedTable('SeatBinding', []);
    seedTable('BusinessTeam', [
      { business_user_id: BIZ_1, user_id: USER_A, is_active: true },
    ]);

    const result = await resolveVerifiedAuthorityForActor({ userId: USER_A, homeId: HOME_1 });
    expect(result.found).toBe(true);
    expect(result.authority.id).toBe(AUTHORITY_BIZ);
    expect(result.authority.subject_type).toBe('business');
  });

  test('user with seat-backed authority (via SeatBinding + BusinessSeat) resolves successfully', async () => {
    seedTable('HomeAuthority', [
      {
        id: AUTHORITY_BIZ,
        home_id: HOME_1,
        subject_type: 'business',
        subject_id: BIZ_1,
        status: 'verified',
        role: 'owner',
      },
    ]);
    seedTable('SeatBinding', [
      { seat_id: SEAT_1, user_id: USER_A },
    ]);
    seedTable('BusinessSeat', [
      { id: SEAT_1, business_user_id: BIZ_1, is_active: true, role_base: 'admin' },
    ]);

    const result = await resolveVerifiedAuthorityForActor({ userId: USER_A, homeId: HOME_1 });
    expect(result.found).toBe(true);
    expect(result.authority.id).toBe(AUTHORITY_BIZ);
    expect(result.authority.subject_type).toBe('business');
  });

  test('unrelated user with no authority returns found: false', async () => {
    seedTable('HomeAuthority', [
      {
        id: AUTHORITY_DIRECT,
        home_id: HOME_1,
        subject_type: 'user',
        subject_id: USER_A,
        status: 'verified',
        role: 'owner',
      },
    ]);

    const result = await resolveVerifiedAuthorityForActor({ userId: USER_UNRELATED, homeId: HOME_1 });
    expect(result.found).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test('user with revoked authority returns found: false', async () => {
    seedTable('HomeAuthority', [
      {
        id: AUTHORITY_REVOKED,
        home_id: HOME_1,
        subject_type: 'user',
        subject_id: USER_A,
        status: 'revoked',
        role: 'owner',
      },
    ]);

    const result = await resolveVerifiedAuthorityForActor({ userId: USER_A, homeId: HOME_1 });
    expect(result.found).toBe(false);
  });

  test('missing userId returns found: false with reason', async () => {
    const result = await resolveVerifiedAuthorityForActor({ userId: null, homeId: HOME_1 });
    expect(result.found).toBe(false);
    expect(result.reason).toMatch(/required/);
  });

  test('missing homeId returns found: false with reason', async () => {
    const result = await resolveVerifiedAuthorityForActor({ userId: USER_A, homeId: '' });
    expect(result.found).toBe(false);
    expect(result.reason).toMatch(/required/);
  });

  test('user at business with inactive seat does not resolve', async () => {
    seedTable('HomeAuthority', [
      {
        id: AUTHORITY_BIZ,
        home_id: HOME_1,
        subject_type: 'business',
        subject_id: BIZ_1,
        status: 'verified',
        role: 'owner',
      },
    ]);
    seedTable('SeatBinding', [
      { seat_id: SEAT_1, user_id: USER_A },
    ]);
    seedTable('BusinessSeat', [
      { id: SEAT_1, business_user_id: BIZ_1, is_active: false, role_base: 'admin' },
    ]);
    // No BusinessTeam membership either
    seedTable('BusinessTeam', []);

    const result = await resolveVerifiedAuthorityForActor({ userId: USER_A, homeId: HOME_1 });
    expect(result.found).toBe(false);
  });
});

// ── assertCallerOwnsLease ───────────────────────────────────

describe('assertCallerOwnsLease', () => {
  beforeEach(() => {
    resetTables();
    seedTable('HomeLease', [
      {
        id: LEASE_1,
        home_id: HOME_1,
        primary_resident_user_id: USER_A,
        state: 'active',
      },
    ]);
  });

  test('primary resident is allowed', async () => {
    const result = await assertCallerOwnsLease({ userId: USER_A, leaseId: LEASE_1 });
    expect(result.allowed).toBe(true);
    expect(result.lease).toBeDefined();
    expect(result.lease.id).toBe(LEASE_1);
  });

  test('co-resident is allowed', async () => {
    seedTable('HomeLeaseResident', [
      { id: 'hlr-001', lease_id: LEASE_1, user_id: USER_B },
    ]);

    const result = await assertCallerOwnsLease({ userId: USER_B, leaseId: LEASE_1 });
    expect(result.allowed).toBe(true);
    expect(result.lease.id).toBe(LEASE_1);
  });

  test('authority holder is allowed', async () => {
    seedTable('HomeAuthority', [
      {
        id: AUTHORITY_DIRECT,
        home_id: HOME_1,
        subject_type: 'user',
        subject_id: USER_B,
        status: 'verified',
        role: 'owner',
      },
    ]);

    const result = await assertCallerOwnsLease({ userId: USER_B, leaseId: LEASE_1 });
    expect(result.allowed).toBe(true);
    expect(result.lease.id).toBe(LEASE_1);
    expect(result.authority).toBeDefined();
    expect(result.authority.id).toBe(AUTHORITY_DIRECT);
  });

  test('unrelated user is denied', async () => {
    const result = await assertCallerOwnsLease({ userId: USER_UNRELATED, leaseId: LEASE_1 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test('non-existent lease returns denied', async () => {
    const result = await assertCallerOwnsLease({ userId: USER_A, leaseId: 'lease-nonexistent' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  test('missing params returns denied', async () => {
    const result = await assertCallerOwnsLease({ userId: null, leaseId: LEASE_1 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/required/);
  });
});
