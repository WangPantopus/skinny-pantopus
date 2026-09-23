/**
 * Residency letter regression tests (audit 2026-08-22, SEC-10 / LIF-06).
 *
 * A residency letter is a server-attested credential consumed OUTSIDE our
 * trust boundary — by landlords, schools, the DMV — and it carries the
 * resident's legal name and full street address. It must stop being valid the
 * moment it is revoked or lapses.
 */

const { resetTables, getTable, seedTable } = require('../__mocks__/supabaseAdmin');
const service = require('../../services/residencyLetterService');

const CODE = 'ABCD-EFGH-JKLM-NPQR'; // 16 chars: the format normalizeLetterCode requires

function seedLetter(overrides = {}) {
  seedTable('ResidencyLetter', [{
    id: 'letter-1',
    home_id: 'home-1',
    user_id: 'user-1',
    letter_code: service.normalizeLetterCode(CODE),
    status: 'issued',
    resident_name: 'Dana Reyes',
    address_line1: '123 Main St',
    city: 'Portland',
    state: 'OR',
    zipcode: '97201',
    purpose: 'Proof of residence',
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    verify_count: 0,
    ...overrides,
  }]);
}

beforeEach(() => resetTables());

describe('a revoked letter is not valid', () => {
  test('reports invalid and discloses no name or address', async () => {
    seedLetter({ status: 'revoked', revoked_at: new Date().toISOString() });

    const res = await service.verifyByCode(CODE);

    expect(res.valid).toBe(false);
    expect(res.status).toBe('revoked');
    expect(res.resident_name).toBeUndefined();
    expect(res.address).toBeUndefined();
    expect(JSON.stringify(res)).not.toContain('Dana Reyes');
    expect(JSON.stringify(res)).not.toContain('123 Main St');
  });
});

describe('an expired letter is not valid', () => {
  test('the issuer list shows expiry without needing someone to verify the public code first', async () => {
    const expiry = new Date(Date.now() - 86400000).toISOString();
    seedLetter({ expires_at: expiry, pdf_base64: 'preserved-issued-pdf' });
    const [letter] = await service.listLetters({ homeId: 'home-1', userId: 'user-1' });
    expect(letter.status).toBe('expired');
    expect(letter.expires_at).toBe(expiry);
    expect(getTable('ResidencyLetter')[0].pdf_base64).toBe('preserved-issued-pdf');
  });

  test('expiry does not relabel an explicitly revoked letter', async () => {
    seedLetter({ status: 'revoked', expires_at: new Date(Date.now() - 86400000).toISOString() });
    const [letter] = await service.listLetters({ homeId: 'home-1', userId: 'user-1' });
    expect(letter.status).toBe('revoked');
  });

  test('reports invalid once past expires_at', async () => {
    seedLetter({ expires_at: new Date(Date.now() - 86400000).toISOString() });

    const res = await service.verifyByCode(CODE);

    expect(res.valid).toBe(false);
    expect(res.status).toBe('expired');
    expect(res.resident_name).toBeUndefined();
  });

  test('the lapsed letter is retired so listings reflect reality', async () => {
    seedLetter({ expires_at: new Date(Date.now() - 86400000).toISOString() });

    await service.verifyByCode(CODE);

    const row = getTable('ResidencyLetter').find((l) => l.id === 'letter-1');
    expect(row.status).toBe('expired');
  });
});

describe('a live letter still verifies', () => {
  test('returns exactly what is printed on the paper', async () => {
    seedLetter();
    seedTable('HomeOccupancy', [{ home_id: 'home-1', user_id: 'user-1', is_active: true, verification_status: 'verified' }]);

    const res = await service.verifyByCode(CODE);

    expect(res.valid).toBe(true);
    expect(res.resident_name).toBe('Dana Reyes');
    expect(res.address.line1).toBe('123 Main St');
    expect(res.expires_at).toBeTruthy();
  });

  test('an unknown code is a uniform invalid, with no existence oracle', async () => {
    seedLetter();
    const res = await service.verifyByCode('ZZZZ-ZZZZ-ZZZZ-ZZZZ');
    expect(res).toEqual({ valid: false });
  });
});

describe('ending residency retires outstanding letters', () => {
  test('issued letters for that home and user are revoked', async () => {
    seedLetter();

    const res = await service.revokeLettersForResidency('home-1', 'user-1', 'residency_move_out');
    expect(res.success).toBe(true);
    expect(res.revoked).toBe(1);

    const row = getTable('ResidencyLetter').find((l) => l.id === 'letter-1');
    expect(row.status).toBe('revoked');
    expect(row.revoked_at).toBeTruthy();

    // and it no longer verifies
    await expect(service.verifyByCode(CODE)).resolves.toMatchObject({ valid: false });
  });

  test('another resident’s letters are untouched', async () => {
    seedLetter();
    const res = await service.revokeLettersForResidency('home-1', 'someone-else');
    expect(res.revoked).toBe(0);
    expect(getTable('ResidencyLetter')[0].status).toBe('issued');
  });
});

describe('a stale verification cannot mint a fresh letter (flag-gated)', () => {
  // The issue route's gate, tested through the same helper it uses.
  const express = require('express');
  const request = require('supertest');
  const flags = require('../../utils/addressRolloutFlags');
  const verificationAge = require('../../utils/verificationAge');
  const { checkHomePermission } = require('../../utils/homePermissions');

  jest.mock('../../utils/homePermissions', () => ({
    checkHomePermission: jest.fn(),
    // The stale-aware resident check is shared from the real module (it is
    // the behaviour under test); only the permission lookup is stubbed.
    isVerifiedResident: jest.requireActual('../../utils/homePermissions').isVerifiedResident,
    isVerifiedOwner: jest.fn().mockResolvedValue({ isOwner: false }),
    mapLegacyRole: jest.fn((r) => r),
    writeAuditLog: jest.fn().mockResolvedValue(undefined),
  }));

  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

  function appWithRoutes() {
    const app = express();
    app.use(express.json());
    app.use('/api/homes', require('../../routes/residencyLetters'));
    return app;
  }

  afterEach(() => flags.__setOverrides(null));
  afterAll(() => flags.stopRolloutFlagRefresh());

  function occupancyVerifiedAt(verifiedAt) {
    checkHomePermission.mockResolvedValue({
      hasAccess: true,
      isOwner: false,
      occupancy: { verification_status: 'verified', verified_at: verifiedAt },
    });
  }

  test('stale + flag on → VERIFICATION_REQUIRED, no letter row', async () => {
    flags.__setOverrides({ enforceVerificationExpiry: true });
    occupancyVerifiedAt(daysAgo(verificationAge.validityDays() + 10));

    const res = await request(appWithRoutes())
      .post('/api/homes/home-lttr-1/residency-letters')
      .send({ purpose: 'lease' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('VERIFICATION_REQUIRED');
  });

  test('stale + flag off → still issues (measurement without policy)', async () => {
    flags.__setOverrides({ enforceVerificationExpiry: false });
    occupancyVerifiedAt(daysAgo(verificationAge.validityDays() + 10));

    const res = await request(appWithRoutes())
      .post('/api/homes/home-lttr-1/residency-letters')
      .send({ purpose: 'lease' });

    expect(res.status).not.toBe(403);
  });

  test('fresh + flag on → issues', async () => {
    flags.__setOverrides({ enforceVerificationExpiry: true });
    occupancyVerifiedAt(daysAgo(2));

    const res = await request(appWithRoutes())
      .post('/api/homes/home-lttr-1/residency-letters')
      .send({ purpose: 'lease' });

    expect(res.status).not.toBe(403);
  });
});
