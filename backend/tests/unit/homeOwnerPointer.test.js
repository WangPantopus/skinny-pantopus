/**
 * Home.owner_id must never be granted by the create request.
 *
 * checkHomePermission treats Home.owner_id === userId as full ownership —
 * every permission, including 'ownership.manage', which is what reviews
 * ownership claims. POST /api/homes used to write the pointer straight from
 * the request's `is_owner` boolean, so anyone could hold verified-owner
 * powers (and approve their own claim) at any address they typed. The
 * pointer now arrives only when a claim verifies.
 */

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

jest.setTimeout(15000);

// verifyToken is globally mapped to tests/__mocks__/verifyToken.js, which
// reads x-test-user-id and defaults to TEST_USER below.
jest.mock('../../services/addressValidation', () => ({
  pipelineService: {
    buildStoredDecisionInputs: jest.fn(),
    runValidationPipeline: jest.fn(),
  },
  AddressVerdictStatus: {
    OK: 'OK',
    MIXED_USE: 'MIXED_USE',
    SERVICE_ERROR: 'SERVICE_ERROR',
    MISSING_UNIT: 'MISSING_UNIT',
    BUSINESS: 'BUSINESS',
    UNDELIVERABLE: 'UNDELIVERABLE',
    CONFLICT: 'CONFLICT',
    LOW_CONFIDENCE: 'LOW_CONFIDENCE',
    MULTIPLE_MATCHES: 'MULTIPLE_MATCHES',
  },
  addressDecisionEngine: { classify: jest.fn() },
  googleProvider: { isAvailable: jest.fn(() => true) },
  smartyProvider: { isAvailable: jest.fn(() => true) },
}));

jest.mock('../../services/addressValidation/addressVerificationObservability', () => ({
  recordCreateHomeOutcome: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/homePermissions', () => ({
  checkHomePermission: jest.fn(),
  isVerifiedOwner: jest.fn().mockResolvedValue({ isOwner: false }),
  mapLegacyRole: jest.fn((r) => r),
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
  applyOccupancyTemplate: jest.fn().mockResolvedValue({ occupancy: null, template: {} }),
}));

const { applyOccupancyTemplate } = require('../../utils/homePermissions');

jest.mock('../../utils/homeSecurityPolicy', () => ({
  getClaimRiskScore: jest.fn(async () => 0),
}));

jest.mock('../../utils/verifiedCoordinateGuard', () => ({
  shouldBlockCoordinateOverwrite: jest.fn(() => false),
  stripCoordinateFields: jest.fn((payload) => payload),
}));

jest.mock('../../utils/columns', () => ({
  HOME_DETAIL: '*',
  HOME_TASK_LIST: '*',
  HOME_ISSUE_LIST: '*',
  HOME_BILL_LIST: '*',
  HOME_PACKAGE_LIST: '*',
  HOME_EVENT_LIST: '*',
}));

const { pipelineService } = require('../../services/addressValidation');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', require('../../routes/home'));
  return app;
}

const TEST_USER = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';

const CREATE_BODY = {
  address: '123 Verification Ln',
  city: 'Portland',
  state: 'OR',
  zipcode: '97201',
  latitude: 45.5152,
  longitude: -122.6784,
  is_owner: true,
  role: 'owner',
};

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  pipelineService.runValidationPipeline.mockResolvedValue({
    verdict: { status: 'OK', confidence: 1.0, reasons: [] },
    canonical_address: null,
    address_id: null,
  });
});

describe('POST /api/homes with is_owner', () => {
  test('creates the home but never writes the owner pointer', async () => {
    const app = createApp();
    const res = await request(app).post('/api/homes').send(CREATE_BODY);

    expect(res.status).toBe(201);

    const home = getTable('Home').find((h) => h.created_by_user_id === TEST_USER);
    expect(home).toBeTruthy();
    // The pointer is what checkHomePermission's isLegacyOwner branch reads.
    // It must only ever be written by claim approval.
    expect(home.owner_id).toBeNull();
  });

  test('still records the pending claim and the pending_doc occupancy', async () => {
    const app = createApp();
    const res = await request(app).post('/api/homes').send(CREATE_BODY);

    expect(res.status).toBe(201);
    expect(res.body.requires_verification).toBe(true);
    expect(res.body.verification_type).toBe('ownership');

    const ownerRow = getTable('HomeOwner').find((o) => o.subject_id === TEST_USER);
    expect(ownerRow).toBeTruthy();
    expect(ownerRow.owner_status).toBe('pending');

    expect(applyOccupancyTemplate).toHaveBeenCalledWith(
      expect.anything(), TEST_USER, 'admin', 'pending_doc',
    );
  });
});

describe('DELETE /api/homes/:id after the pointer change', () => {
  function seedCreatedHome(extraMembers = []) {
    seedTable('Home', [{
      id: 'home-del-1',
      owner_id: null,
      created_by_user_id: TEST_USER,
      name: 'Mistake Home',
    }]);
    seedTable('HomeOccupancy', [
      {
        id: 'occ-creator',
        home_id: 'home-del-1',
        user_id: TEST_USER,
        is_active: true,
        role_base: 'admin',
        verification_status: 'pending_doc',
      },
      ...extraMembers,
    ]);
    seedTable('Payment', []);
    seedTable('HomeOwner', []);
  }

  test('the sole creator can still delete a home they created by mistake', async () => {
    seedCreatedHome();
    const app = createApp();

    const res = await request(app).delete('/api/homes/home-del-1');
    expect(res.status).toBe(200);
    expect(getTable('Home').find((h) => h.id === 'home-del-1')).toBeUndefined();
  });

  test('a creator with other household members cannot delete without verifying ownership', async () => {
    seedCreatedHome([{
      id: 'occ-roommate',
      home_id: 'home-del-1',
      user_id: 'user-roommate',
      is_active: true,
      role_base: 'member',
      verification_status: 'verified',
    }]);
    const app = createApp();

    const res = await request(app).delete('/api/homes/home-del-1');
    expect(res.status).toBe(403);
    expect(getTable('Home').find((h) => h.id === 'home-del-1')).toBeTruthy();
  });

  test('a stranger cannot delete someone else\'s home', async () => {
    seedCreatedHome();
    const app = createApp();

    const res = await request(app)
      .delete('/api/homes/home-del-1')
      .set('x-test-user-id', 'user-stranger');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/homes/:id/detach goes through the chokepoint', () => {
  const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const ADMIN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const { checkHomePermission } = require('../../utils/homePermissions');

  function seedOwnerAndAdmin() {
    seedTable('Home', [{ id: 'home-det-1', owner_id: OWNER_ID, name: 'Detach Home' }]);
    seedTable('HomeOwner', []);
    seedTable('HomeOccupancy', [
      {
        id: 'occ-owner',
        home_id: 'home-det-1',
        user_id: OWNER_ID,
        is_active: true,
        role_base: 'owner',
        verification_status: 'verified',
      },
      {
        id: 'occ-admin',
        home_id: 'home-det-1',
        user_id: ADMIN_ID,
        is_active: true,
        role_base: 'admin',
        verification_status: 'verified',
      },
    ]);
  }

  test('an admin cannot remove the owner', async () => {
    seedOwnerAndAdmin();
    checkHomePermission.mockResolvedValue({ hasAccess: true, isOwner: false, occupancy: null });
    const app = createApp();

    const res = await request(app)
      .post('/api/homes/home-det-1/detach')
      .set('x-test-user-id', ADMIN_ID)
      .send({ userId: OWNER_ID });

    expect(res.status).toBe(403);
    const occ = getTable('HomeOccupancy').find((o) => o.id === 'occ-owner');
    expect(occ.is_active).toBe(true);
    expect(getTable('Home').find((h) => h.id === 'home-det-1').owner_id).toBe(OWNER_ID);
  });

  test('detaching the pointer-owner deactivates the row and clears the pointer', async () => {
    seedOwnerAndAdmin();
    checkHomePermission.mockResolvedValue({ hasAccess: true, isOwner: true, occupancy: null });
    const app = createApp();

    const res = await request(app)
      .post('/api/homes/home-det-1/detach')
      .set('x-test-user-id', OWNER_ID)
      .send({ userId: OWNER_ID });

    expect(res.status).toBe(200);
    // Deactivated, not hard-deleted: history and audit trail survive.
    const occ = getTable('HomeOccupancy').find((o) => o.id === 'occ-owner');
    expect(occ).toBeTruthy();
    expect(occ.is_active).toBe(false);
    // The pointer goes with the occupancy, exactly as move-out does it.
    expect(getTable('Home').find((h) => h.id === 'home-det-1').owner_id).toBeNull();
  });
});

describe('MISSING_UNIT with the no-unit attestation', () => {
  const { recordCreateHomeOutcome } = require('../../services/addressValidation/addressVerificationObservability');

  beforeEach(() => {
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: { status: 'MISSING_UNIT', confidence: 0.3, reasons: ['missing_secondary'] },
      canonical_address: null,
      address_id: null,
    });
  });

  test('without the attestation the refusal stands', async () => {
    const app = createApp();
    const res = await request(app).post('/api/homes').send(CREATE_BODY);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_MISSING_UNIT');
    expect(getTable('Home')).toHaveLength(0);
  });

  test('the attestation clears exactly this rung and is recorded', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({ ...CREATE_BODY, no_unit_attestation: true });

    expect(res.status).toBe(201);
    expect(getTable('Home')).toHaveLength(1);

    const created = recordCreateHomeOutcome.mock.calls
      .map(([o]) => o)
      .find((o) => o.outcome === 'created');
    expect(created).toBeTruthy();
    expect(created.reasons).toContain('no_unit_attestation');
  });

  test('the attestation does not clear any other refusal', async () => {
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: { status: 'UNDELIVERABLE', confidence: 0.1, reasons: [] },
      canonical_address: null,
      address_id: null,
    });
    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({ ...CREATE_BODY, no_unit_attestation: true });

    expect(res.status).toBe(422);
    expect(getTable('Home')).toHaveLength(0);
  });
});

describe('coordinate provenance at create', () => {
  test('client-supplied coordinates are stamped user_asserted, never verified', async () => {
    // canonical_address is null, so `coords` falls back to the body's pin.
    const app = createApp();
    const res = await request(app).post('/api/homes').send(CREATE_BODY);
    expect(res.status).toBe(201);

    const home = getTable('Home').find((h) => h.created_by_user_id === TEST_USER);
    // A fake 'verified' stamp here would make shouldBlockCoordinateOverwrite
    // protect the attacker's pin from later correction.
    expect(home.geocode_mode).toBe('user_asserted');
    expect(home.geocode_provider).toBe('client');
  });

  test('the request body cannot name its own geocode provenance', async () => {
    const app = createApp();
    const res = await request(app).post('/api/homes').send({
      ...CREATE_BODY,
      geocode_provider: 'google_validation',
      geocode_accuracy: 'rooftop',
    });
    expect(res.status).toBe(201);

    const home = getTable('Home').find((h) => h.created_by_user_id === TEST_USER);
    expect(home.geocode_mode).toBe('user_asserted');
    expect(home.geocode_provider).toBe('client');
    expect(home.geocode_accuracy).toBeNull();
  });

  test('pipeline-produced coordinates are stamped verified', async () => {
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: { status: 'OK', confidence: 1.0, reasons: [] },
      canonical_address: {
        id: '77777777-7777-4777-8777-777777777777',
        geocode_lat: 45.52,
        geocode_lng: -122.68,
        address_hash: 'canonicalhash',
      },
      address_id: '77777777-7777-4777-8777-777777777777',
    });
    const app = createApp();
    const res = await request(app).post('/api/homes').send(CREATE_BODY);
    expect(res.status).toBe(201);

    const home = getTable('Home').find((h) => h.created_by_user_id === TEST_USER);
    expect(home.geocode_mode).toBe('verified');
    expect(home.geocode_provider).toBe('google_validation');
    expect(home.map_center_lat).toBe(45.52);
  });
});
