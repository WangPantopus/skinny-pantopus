// ============================================================
// TEST: Residency claims (Wave 1 — Residency Pass)
//
// The invariants that matter are about disclosure and liveness:
//   * a coarse-scoped claim NEVER contains the street address;
//   * a claim is issued only from server-derived facts — a scope whose
//     fact can't be resolved fails closed (422), never guesses;
//   * the public check is LIVE: revoked/expired claims and issuers who
//     lost verified occupancy stop verifying as active;
//   * every public view lands in the issuer-visible audit log;
//   * claims are personal: another household member cannot see or
//     revoke them; unknown codes are a uniform { valid: false }.
// ============================================================

// The civic-district resolution is a network adapter (Census geocoder);
// claims must derive from its output, not re-implement it — so it is
// mocked per test.
jest.mock('../services/placeSectionAdapters', () => ({
  composeCivicDistricts: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

const { composeCivicDistricts } = require('../services/placeSectionAdapters');
const residencyClaimService = require('../services/residencyClaimService');
const { deriveStatement, effectiveStatus, ClaimError } = residencyClaimService;
const residencyClaimRoutes = require('../routes/residencyClaims');
const publicRoutes = require('../routes/public');

const USER = 'claim-user-1';
const OTHER_MEMBER = 'claim-user-2';
const HOME_ID = 'home-claim-1';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', residencyClaimRoutes);
  app.use('/api/public', publicRoutes);
  return app;
}

const HOME_ROW = {
  id: HOME_ID,
  owner_id: USER,
  address: '1421 SE Oak St, Portland, OR 97214',
  address2: 'Unit B',
  city: 'Portland',
  state: 'OR',
  zipcode: '97214',
  map_center_lat: 45.51,
  map_center_lng: -122.65,
};

function seedVerifiedResident({ verificationStatus = 'verified' } = {}) {
  seedTable('Home', [HOME_ROW]);
  seedTable('User', [
    { id: USER, first_name: 'Dana', last_name: 'Whitfield', username: 'dana' },
    { id: OTHER_MEMBER, first_name: 'Sam', last_name: 'Whitfield', username: 'sam' },
  ]);
  seedTable('HomeOccupancy', [
    {
      id: 'occ-1',
      home_id: HOME_ID,
      user_id: USER,
      is_active: true,
      role: 'owner',
      role_base: 'owner',
      verification_status: verificationStatus,
    },
    {
      id: 'occ-2',
      home_id: HOME_ID,
      user_id: OTHER_MEMBER,
      is_active: true,
      role: 'member',
      role_base: 'member',
      verification_status: 'verified',
    },
  ]);
  // The verification TIMESTAMP lives on the postcard row, not on
  // HomeOccupancy — seeding a phantom occupancy.verified_at is exactly
  // the kind of test that hides a wrong column read.
  seedTable('HomePostcardCode', [
    { id: 'pc-1', home_id: HOME_ID, user_id: USER, status: 'verified', verified_at: '2026-08-01T00:00:00.000Z' },
  ]);
}

const DISTRICTS_SECTION = [{
  status: 'ready',
  data: {
    districts: [
      { level: 'federal', office_label: 'U.S. House', name: "Oregon's 3rd District" },
      { level: 'county', office_label: 'County', name: 'Multnomah County' },
      { level: 'school', office_label: 'School district', name: 'Portland SD 1J' },
    ],
  },
}];

function issue(app, body, userId = USER) {
  return request(app)
    .post(`/api/homes/${HOME_ID}/residency-claims`)
    .set('x-test-user-id', userId)
    .send(body);
}

// The audit-log insert is deliberately fire-and-forget in the service;
// drain the microtask/immediate queue before asserting on it.
function flushAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  resetTables();
  composeCivicDistricts.mockResolvedValue(DISTRICTS_SECTION);
});

// ── Statement derivation (pure) ──────────────────────────────

describe('deriveStatement', () => {
  const home = HOME_ROW;
  const districts = DISTRICTS_SECTION[0].data.districts;
  const holderName = 'Dana Whitfield';

  test('address scope prints the full address, unit included', () => {
    const { statement } = deriveStatement({ scope: 'address', holderName, home, districts });
    expect(statement).toBe('Dana Whitfield is a verified resident of 1421 SE Oak St Unit B, Portland, OR, 97214.');
  });

  test('coarse scopes never contain the street address', () => {
    for (const scope of ['city', 'county', 'state', 'school_district', 'congressional_district']) {
      const { statement } = deriveStatement({ scope, holderName, home, districts });
      expect(statement).not.toContain('Oak St');
      expect(statement).not.toContain('Unit B');
      expect(statement).not.toContain('97214');
    }
  });

  test('state scope expands the abbreviation', () => {
    const { statement } = deriveStatement({ scope: 'state', holderName, home, districts });
    expect(statement).toBe('Dana Whitfield is a verified resident of the state of Oregon.');
  });

  test('DC is not called a state', () => {
    const { statement } = deriveStatement({ scope: 'state', holderName, home: { ...home, state: 'DC' }, districts });
    expect(statement).toBe('Dana Whitfield is a verified resident of the District of Columbia.');
  });

  test('district scopes read from the civic resolution', () => {
    expect(deriveStatement({ scope: 'school_district', holderName, home, districts }).statement)
      .toContain('Portland SD 1J');
    expect(deriveStatement({ scope: 'congressional_district', holderName, home, districts }).statement)
      .toContain("Oregon's 3rd District");
    expect(deriveStatement({ scope: 'county', holderName, home, districts }).statement)
      .toContain('Multnomah County, OR');
  });

  test('an unresolvable fact fails closed, never guesses', () => {
    expect(() => deriveStatement({ scope: 'school_district', holderName, home, districts: [] }))
      .toThrow(ClaimError);
    expect(() => deriveStatement({ scope: 'city', holderName, home: { ...home, city: null }, districts }))
      .toThrow(ClaimError);
  });
});

describe('effectiveStatus', () => {
  const base = { status: 'active', expires_at: '2026-09-01T00:00:00.000Z' };
  const now = new Date('2026-08-20T00:00:00.000Z');

  test('active until the expiry instant, expired from it', () => {
    expect(effectiveStatus(base, now)).toBe('active');
    expect(effectiveStatus(base, new Date('2026-09-01T00:00:00.000Z'))).toBe('expired');
  });

  test('revoked wins over everything', () => {
    expect(effectiveStatus({ ...base, status: 'revoked' }, now)).toBe('revoked');
  });
});

// ── Issue gates ──────────────────────────────────────────────

describe('issuing', () => {
  test('an unverified occupant cannot issue (T4 gate)', async () => {
    seedVerifiedResident({ verificationStatus: 'pending' });
    const res = await issue(buildApp(), { scope: 'city' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('VERIFICATION_REQUIRED');
    expect(getTable('ResidencyClaim')).toHaveLength(0);
  });

  test('a verified resident issues a city claim with server-derived facts', async () => {
    seedVerifiedResident();
    const res = await issue(buildApp(), { scope: 'city', expires_in_days: 7 });
    expect(res.status).toBe(201);
    const { claim } = res.body;
    expect(claim.statement).toBe('Dana Whitfield is a verified resident of Portland, OR.');
    expect(claim.status).toBe('active');
    expect(claim.claim_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(claim.verify_url).toContain(`/verify-claim/${claim.claim_code}`);
    expect(claim.residency_verified_at).toBe('2026-08-01T00:00:00.000Z');
    const expiresMs = new Date(claim.expires_at) - new Date(claim.issued_at);
    expect(expiresMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test('a district scope that cannot resolve returns 422, not a guess', async () => {
    seedVerifiedResident();
    composeCivicDistricts.mockResolvedValue([{ status: 'unavailable' }]);
    const res = await issue(buildApp(), { scope: 'school_district' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SCOPE_UNAVAILABLE');
    expect(getTable('ResidencyClaim')).toHaveLength(0);
  });

  test('non-menu expiry and unknown scope are 400s', async () => {
    seedVerifiedResident();
    const app = buildApp();
    expect((await issue(app, { scope: 'city', expires_in_days: 5 })).status).toBe(400);
    expect((await issue(app, { scope: 'zipcode' })).status).toBe(400);
  });
});

// ── The public live check ────────────────────────────────────

describe('public verification', () => {
  async function issuedClaim(app, body = { scope: 'city' }) {
    const res = await issue(app, body);
    expect(res.status).toBe(201);
    return res.body.claim;
  }

  test('an active claim verifies with the frozen statement and is audit-logged', async () => {
    seedVerifiedResident();
    const app = buildApp();
    const claim = await issuedClaim(app);

    const res = await request(app)
      .get(`/api/public/residency-claims/${claim.claim_code}`)
      .set('user-agent', 'Mozilla/5.0 (VerifierBrowser)');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      valid: true,
      status: 'active',
      scope: 'city',
      statement: 'Dana Whitfield is a verified resident of Portland, OR.',
      holder_name: 'Dana Whitfield',
    });
    // No address fields beyond the statement, ever.
    expect(JSON.stringify(res.body)).not.toContain('Oak St');

    await flushAsync();
    const log = getTable('ResidencyClaimAccess');
    expect(log).toHaveLength(1);
    expect(log[0].claim_id).toBe(claim.id);
    expect(log[0].user_agent).toContain('VerifierBrowser');
  });

  test('codes are forgiving on case and separators', async () => {
    seedVerifiedResident();
    const app = buildApp();
    const claim = await issuedClaim(app);
    const sloppy = claim.claim_code.toLowerCase().replace(/-/g, ' ');
    const res = await request(app).get(`/api/public/residency-claims/${encodeURIComponent(sloppy)}`);
    expect(res.body.valid).toBe(true);
  });

  test('unknown codes are a uniform { valid: false } and are not logged', async () => {
    seedVerifiedResident();
    const res = await request(buildApp()).get('/api/public/residency-claims/AAAA-BBBB-CCCC-DDDD');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: false });
    await flushAsync();
    expect(getTable('ResidencyClaimAccess')).toHaveLength(0);
  });

  test('losing verified occupancy flips the LIVE status, without touching the row', async () => {
    seedVerifiedResident();
    const app = buildApp();
    const claim = await issuedClaim(app);

    // The issuer's occupancy verification is later reset (moved out, re-review…).
    const occ = getTable('HomeOccupancy').find((o) => o.user_id === USER);
    occ.verification_status = 'pending';

    const res = await request(app).get(`/api/public/residency-claims/${claim.claim_code}`);
    expect(res.body.valid).toBe(true);
    expect(res.body.status).toBe('no_longer_verified');
  });

  test('an expired claim reports expired', async () => {
    seedVerifiedResident();
    const app = buildApp();
    const claim = await issuedClaim(app, { scope: 'city', expires_in_days: 1 });
    getTable('ResidencyClaim').find((c) => c.id === claim.id).expires_at = '2020-01-01T00:00:00.000Z';

    const res = await request(app).get(`/api/public/residency-claims/${claim.claim_code}`);
    expect(res.body.status).toBe('expired');
    // Expiry pulls the content, not just the badge.
    expect(res.body.statement).toBeUndefined();
    expect(res.body.holder_name).toBeUndefined();
  });

  test('revocation kills the public check immediately — and withdraws the statement', async () => {
    seedVerifiedResident();
    const app = buildApp();
    const claim = await issuedClaim(app);

    const revoke = await request(app)
      .post(`/api/homes/${HOME_ID}/residency-claims/${claim.id}/revoke`)
      .set('x-test-user-id', USER);
    expect(revoke.status).toBe(200);
    expect(revoke.body.claim.status).toBe('revoked');

    const res = await request(app).get(`/api/public/residency-claims/${claim.claim_code}`);
    expect(res.body.status).toBe('revoked');
    // The FridgeCard rule: a code that sat in chat history must not keep
    // disclosing the holder's name and address after the resident hit
    // revoke. Status yes, PII no.
    expect(res.body.statement).toBeUndefined();
    expect(res.body.holder_name).toBeUndefined();
    expect(res.body.residency_verified_at).toBeUndefined();
  });
});

// ── Personal-document boundary ───────────────────────────────

describe('claims are personal', () => {
  test('another household member sees an empty list and cannot revoke or read views', async () => {
    seedVerifiedResident();
    const app = buildApp();
    const res = await issue(app, { scope: 'city' });
    const claim = res.body.claim;

    const list = await request(app)
      .get(`/api/homes/${HOME_ID}/residency-claims`)
      .set('x-test-user-id', OTHER_MEMBER);
    expect(list.status).toBe(200);
    expect(list.body.claims).toHaveLength(0);

    const revoke = await request(app)
      .post(`/api/homes/${HOME_ID}/residency-claims/${claim.id}/revoke`)
      .set('x-test-user-id', OTHER_MEMBER);
    expect(revoke.status).toBe(404);

    const views = await request(app)
      .get(`/api/homes/${HOME_ID}/residency-claims/${claim.id}/views`)
      .set('x-test-user-id', OTHER_MEMBER);
    expect(views.status).toBe(404);
  });

  test('the issuer reads every logged view', async () => {
    seedVerifiedResident();
    const app = buildApp();
    const res = await issue(app, { scope: 'state' });
    const claim = res.body.claim;

    await request(app).get(`/api/public/residency-claims/${claim.claim_code}`).set('user-agent', 'first');
    await request(app).get(`/api/public/residency-claims/${claim.claim_code}`).set('user-agent', 'second');
    await flushAsync();

    const views = await request(app)
      .get(`/api/homes/${HOME_ID}/residency-claims/${claim.id}/views`)
      .set('x-test-user-id', USER);
    expect(views.status).toBe(200);
    expect(views.body.views).toHaveLength(2);
    // The mock's order() is a no-op, so assert membership, not order —
    // production ordering is the SQL `order by viewed_at desc`.
    expect(new Set(views.body.views.map((v) => v.user_agent))).toEqual(new Set(['first', 'second']));
  });
});

// ── Cross-platform constant tripwire ─────────────────────────
// The expiry menu exists in FIVE hand-synced copies: this backend
// service (the validator — the only one that can reject), the web api
// package's RESIDENCY_CLAIM_EXPIRY_DAYS, the web test mock, iOS's
// duration picker, and Android's DURATION_CHOICES. Until the choices
// ride the serializer contract, this pin makes any backend change fail
// loudly here — the reminder to update all five, not a silent 400 for
// every mobile user on a now-invalid option.
describe('expiry choices contract', () => {
  test('the menu is [1, 7, 30, 90] — change all five copies together', () => {
    expect(residencyClaimService.EXPIRY_DAYS_CHOICES).toEqual([1, 7, 30, 90]);
  });
});
