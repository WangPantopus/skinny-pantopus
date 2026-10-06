// ============================================================
// TEST: Mailbox Reality Check (Wave 1, #3)
//
// The invariants:
//   * the diagnostic reads ONLY stored claim-time validation — no
//     vendor call, and "nothing on file" is said plainly (unknown),
//     never dressed up as a pass;
//   * DPV interpretation maps to honest severities (N = problem,
//     S/D = attention, Y = ok);
//   * the physical leg requires the caller's recorded postcard proof
//     for the current address; household access is not postal proof;
//   * access requires home membership.
// ============================================================

const express = require('express');
const request = require('supertest');
const db = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable } = db;

const { getMailboxCheck, dpvFinding } = require('../services/mailboxCheckService');
const mailboxCheckRoutes = require('../routes/mailboxCheck');

const OWNER = 'mc-owner-1';
const MEMBER = 'mc-member-1';
const STRANGER = 'mc-stranger-1';
const HOME_ID = 'home-mc-1';
const ADDR_ID = 'addr-mc-1';
const DESTINATION = {
  address: '1421 SE Oak St, Portland, OR 97214', address2: null,
  city: 'Portland', state: 'OR', zipcode: '97214',
};

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

function seedPostcard(overrides = {}) {
  seedTable('HomePostcardCode', [{
    id: 'mc-card-1', home_id: HOME_ID, user_id: OWNER,
    destination: DESTINATION, status: 'verified',
    requested_at: '2026-08-01T00:00:00Z', verified_at: '2026-08-03T00:00:00Z',
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    dispatch_status: 'accepted', vendor_job_id: 'private-provider-receipt',
    code_hash: 'private-proof-hash',
    ...overrides,
  }]);
}

beforeEach(() => { resetTables(); jest.restoreAllMocks(); });

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
  test('a clean confirmed address looks good, with recorded postcard proof for this caller', async () => {
    seedHome({ addressRow: { dpv_match_code: 'Y', rdi_type: 'residential', last_validated_at: '2026-08-01T00:00:00.000Z', validation_raw_response: {} } });
    seedPostcard();
    const res = await check(buildApp());
    expect(res.status).toBe(200);
    expect(res.body.check.verdict).toBe('looks_good');
    expect(res.body.check.physical.status).toBe('proven');
    expect(res.body.check.checked_at).toBe('2026-08-01T00:00:00.000Z');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(JSON.stringify(res.body)).not.toMatch(/private-provider-receipt|private-proof-hash|destination|vendor_job_id|code_hash/);
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
    seedPostcard();
    const app = buildApp();
    expect((await check(app, OWNER)).body.check.physical.status).toBe('proven');
    expect((await check(app, MEMBER)).body.check.physical.status).toBe('not_run');
  });

  test.each(['household', 'legacy', 'address', null])('verified %s access without a postcard is not physical proof', async source => {
    seedHome();
    Object.assign(db.getTable('HomeOccupancy')[1], { verification_status: 'verified', verification_source: source });
    const before = JSON.stringify(['Home', 'HomeOccupancy', 'HomeAddress', 'HomePostcardCode'].map(db.getTable));
    const res = await check(buildApp(), MEMBER);
    expect(res.status).toBe(200);
    expect(res.body.check.physical.status).toBe('not_run');
    expect(res.body.check.physical.title).toBe('No postcard verification on file');
    expect(res.body.check.verdict).toBe('unknown');
    expect(res.body.check.findings[0].title).toBe('No postal check on file');
    expect(JSON.stringify(['Home', 'HomeOccupancy', 'HomeAddress', 'HomePostcardCode'].map(db.getTable))).toBe(before);
  });

  test('generic pending occupancy does not establish that a postcard was mailed', async () => {
    seedHome();
    const result = await getMailboxCheck({ homeId: HOME_ID, userId: OWNER, occupancy: { verification_status: 'pending' } });
    expect(result.physical.status).toBe('not_run');
  });

  test.each([
    { user_id: MEMBER }, { home_id: 'another-home' },
    { destination: { ...DESTINATION, address2: 'Unit 2' } },
    { destination: null }, { verified_at: null },
    { status: 'cancelled' }, { status: 'expired' },
  ])('unmatched or incomplete postcard evidence does not prove this mailbox: %j', async overrides => {
    seedHome(); seedPostcard(overrides);
    const res = await check(buildApp());
    expect(res.body.check.physical.status).toBe('not_run');
  });

  test('postal proof for an older Home address does not attest the current address', async () => {
    seedHome(); seedPostcard();
    db.getTable('Home')[0].address = 'A different address';
    expect((await check(buildApp())).body.check.physical.status).toBe('not_run');
  });

  test('recorded postcard proof remains distinct from missing postal database validation', async () => {
    seedHome(); seedPostcard();
    const res = await check(buildApp());
    expect(res.body.check.verdict).toBe('unknown');
    expect(res.body.check.physical.status).toBe('proven');
  });

  test.each([
    ['accepted', 'receipt', 'Verification postcard accepted for mailing'],
    ['delivery_unknown', null, 'Postcard delivery is unconfirmed'],
    ['dispatching', null, 'Postcard delivery is unconfirmed'],
    ['accepted', null, 'Postcard delivery is unconfirmed'],
    ['pending', null, 'Your postcard request is saved'],
  ])('pending postcard %s projects only recorded delivery evidence', async (dispatch, receipt, title) => {
    seedHome(); seedPostcard({ status: 'pending', verified_at: null, dispatch_status: dispatch, vendor_job_id: receipt });
    const res = await check(buildApp());
    expect(res.body.check.physical.status).toBe('in_progress');
    expect(res.body.check.physical.title).toBe(title);
    expect(res.body.check.physical.detail).not.toContain('was delivered');
  });

  test.each([
    { expires_at: '2000-01-01T00:00:00Z' }, { dispatch_status: 'rejected' },
  ])('an expired or rejected postcard is not in progress: %j', async overrides => {
    seedHome(); seedPostcard({ status: 'pending', verified_at: null, ...overrides });
    expect((await check(buildApp())).body.check.physical.status).toBe('not_run');
  });

  test('an unreadable postcard record is an error, not invented proof or missing evidence', async () => {
    seedHome(); seedPostcard();
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table);
      if (table === 'HomePostcardCode') query.maybeSingle = async () => ({ data: null, error: { message: 'unavailable' } });
      return query;
    });
    const res = await check(buildApp());
    expect(res.status).toBe(500);
    expect(res.body.check).toBeUndefined();
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  test('a stranger has no access; a missing home is 404', async () => {
    seedHome({});
    const app = buildApp();
    expect((await check(app, STRANGER)).status).toBe(403);

    const res = await request(app).get('/api/homes/nope/mailbox-check').set('x-test-user-id', OWNER);
    expect([403, 404]).toContain(res.status);
  });

  test('service returns null for a nonexistent home', async () => {
    expect(await getMailboxCheck({ homeId: 'nope', userId: OWNER })).toBeNull();
  });
});
