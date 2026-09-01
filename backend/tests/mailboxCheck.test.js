// ============================================================
// TEST: Mailbox Reality Check (Wave 1, #3)
//
// The invariants:
//   * the diagnostic reads ONLY stored claim-time validation — no
//     vendor call, and "nothing on file" is said plainly (unknown),
//     never dressed up as a pass;
//   * DPV interpretation maps to honest severities (N = problem,
//     S/D = attention, Y = ok);
//   * the physical leg is per-CALLER: a verified member reads
//     "proven" while an unverified member of the same home reads the
//     verify nudge;
//   * access requires home membership.
// ============================================================

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');

const { getMailboxCheck, dpvFinding } = require('../services/mailboxCheckService');
const mailboxCheckRoutes = require('../routes/mailboxCheck');

const OWNER = 'mc-owner-1';
const MEMBER = 'mc-member-1';
const STRANGER = 'mc-stranger-1';
const HOME_ID = 'home-mc-1';
const ADDR_ID = 'addr-mc-1';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', mailboxCheckRoutes);
  return app;
}

function seedHome({ addressRow, ownerVerification = 'verified' } = {}) {
  seedTable('Home', [{
    id: HOME_ID,
    owner_id: OWNER,
    address: '1421 SE Oak St, Portland, OR 97214',
    city: 'Portland',
    state: 'OR',
    zipcode: '97214',
    address_id: addressRow ? ADDR_ID : null,
    address_hash: null,
  }]);
  if (addressRow) {
    seedTable('HomeAddress', [{ id: ADDR_ID, ...addressRow }]);
  }
  seedTable('HomeOccupancy', [
    { id: 'mc-occ-1', home_id: HOME_ID, user_id: OWNER, is_active: true, role: 'owner', role_base: 'owner', verification_status: ownerVerification },
    { id: 'mc-occ-2', home_id: HOME_ID, user_id: MEMBER, is_active: true, role: 'member', role_base: 'member', verification_status: 'none' },
  ]);
}

function check(app, userId = OWNER) {
  return request(app).get(`/api/homes/${HOME_ID}/mailbox-check`).set('x-test-user-id', userId);
}

beforeEach(() => resetTables());

describe('dpvFinding', () => {
  test('maps codes to honest severities', () => {
    expect(dpvFinding('Y').severity).toBe('ok');
    expect(dpvFinding('S').severity).toBe('attention');
    expect(dpvFinding('D').severity).toBe('attention');
    expect(dpvFinding('N').severity).toBe('problem');
    expect(dpvFinding(null).severity).toBe('info');
  });
});

describe('the diagnostic', () => {
  test('a clean confirmed address looks good, with the physical leg proven for a verified caller', async () => {
    seedHome({ addressRow: { dpv_match_code: 'Y', rdi_type: 'residential', last_validated_at: '2026-08-01T00:00:00.000Z', validation_raw_response: {} } });
    const res = await check(buildApp());
    expect(res.status).toBe(200);
    expect(res.body.check.verdict).toBe('looks_good');
    expect(res.body.check.physical.status).toBe('proven');
    expect(res.body.check.checked_at).toBe('2026-08-01T00:00:00.000Z');
  });

  test('vacancy and missing-unit flags surface as attention', async () => {
    seedHome({ addressRow: { dpv_match_code: 'D', rdi_type: 'residential', validation_raw_response: { vacant_flag: true } } });
    const res = await check(buildApp());
    expect(res.body.check.verdict).toBe('needs_attention');
    const titles = res.body.check.findings.map((f) => f.title);
    expect(titles).toEqual(expect.arrayContaining([
      'A unit number is missing',
      'USPS lists this address as vacant',
    ]));
  });

  test('an unrecognized address is a problem with register-it guidance, never a pass', async () => {
    seedHome({ addressRow: { dpv_match_code: 'N', validation_raw_response: {} } });
    const res = await check(buildApp());
    expect(res.body.check.verdict).toBe('problem');
    const dpv = res.body.check.findings[0];
    expect(dpv.detail).toContain('Address Management');
    expect(dpv.detail).toContain('can’t change USPS records');
  });

  test('no validation on file reads as unknown, not a pass', async () => {
    seedHome({});
    const res = await check(buildApp());
    expect(res.body.check.verdict).toBe('unknown');
    expect(res.body.check.findings[0].title).toBe('No postal check on file');
    expect(res.body.check.checked_at).toBeNull();
  });

  test('the physical leg is per-caller: the unverified member gets the nudge on the same home', async () => {
    seedHome({ addressRow: { dpv_match_code: 'Y', validation_raw_response: {} } });
    const app = buildApp();
    expect((await check(app, OWNER)).body.check.physical.status).toBe('proven');
    expect((await check(app, MEMBER)).body.check.physical.status).toBe('not_run');
  });

  test('a stranger has no access; a missing home is 404', async () => {
    seedHome({});
    const app = buildApp();
    expect((await check(app, STRANGER)).status).toBe(403);

    const res = await request(app).get('/api/homes/nope/mailbox-check').set('x-test-user-id', OWNER);
    expect([403, 404]).toContain(res.status);
  });

  test('service returns null for a nonexistent home', async () => {
    expect(await getMailboxCheck({ homeId: 'nope', occupancy: null })).toBeNull();
  });
});
