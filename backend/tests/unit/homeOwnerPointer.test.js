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
const createBoundary = require('../__mocks__/homeCreateBoundary');
const { resetTables, seedTable, getTable, setRpcMock } = require('../__mocks__/supabaseAdmin');

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
  createBoundary.install();
  require('../../utils/homePermissions').applyOccupancyTemplate.mockImplementation(
    jest.requireActual('../../utils/homePermissions').applyOccupancyTemplate);
  pipelineService.runValidationPipeline.mockResolvedValue({
    verdict: { status: 'OK', confidence: 1.0, reasons: [] },
    canonical_address: { id: '77777777-7777-4777-8777-777777777777', address_line1_norm: '123 Verification Ln', city_norm: 'Portland', state: 'OR', postal_code: '97201', country: 'US', address_hash: 'canonicalhash' },
    address_id: null,
  });
});

describe('POST /api/homes with is_owner', () => {
  test('creates the home but never writes the owner pointer', async () => {
    const app = createApp();
    const res = await request(app).post('/api/homes').send(CREATE_BODY);

    expect(res.status).toBe(201);

    const home = createBoundary.preparedHome();
    expect(home).toBeTruthy();
    // The pointer is what checkHomePermission's isLegacyOwner branch reads.
    // It must only ever be written by claim approval.
    expect(home.owner_id).toBeNull();
  });

  test('delegates the pending ownership setup with capped occupancy templates', async () => {
    const app = createApp();
    const res = await request(app).post('/api/homes').send(CREATE_BODY);

    expect(res.status).toBe(201);
    expect(res.body.requires_verification).toBe(true);
    expect(res.body.verification_type).toBe('ownership');

    expect(createBoundary.commits()).toHaveLength(1);
    expect(createBoundary.commits()[0].p_intent).toMatchObject({ is_owner: true, role: 'owner' });
    for (const ageBand of ['adult', 'teen', 'child']) {
      expect(applyOccupancyTemplate).toHaveBeenCalledWith(null, TEST_USER, 'admin', 'pending_doc', { ageBand, dryRun: true });
      expect(createBoundary.commits()[0].p_templates[ageBand]).toMatchObject({ role_base: 'restricted_member',
        verification_status: 'pending_doc', can_manage_home: false, can_manage_access: false, can_manage_finance: false });
    }
    expect(getTable('HomeOwner')).toHaveLength(0); // The route makes no independent writes.
  });
});

describe('DELETE /api/homes/:id after the pointer change', () => {
  function seedCreatedHome(extraMembers = []) {
    seedTable('Home', [{
      id: 'ddf10001-0000-4000-8000-000000000100',
      owner_id: null,
      created_by_user_id: TEST_USER,
      name: 'Mistake Home',
    }]);
    seedTable('HomeOccupancy', [
      {
        id: 'occ-creator',
        home_id: 'ddf10001-0000-4000-8000-000000000100',
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

  test('the sole creator deletion uses the exact atomic transaction without route-level partial writes', async () => {
    seedCreatedHome();
    const rpc = jest.fn(async name => ({ data: name === 'prepare_home_task_media_home_delete'
      ? { allowed: true, deleted: false, home_id: 'ddf10001-0000-4000-8000-000000000100', cleanup: [] }
      : { allowed: true, deleted: true, code: 'HOME_DELETED' }, error: null }));
    setRpcMock(rpc);
    const app = createApp();

    const res = await request(app).delete('/api/homes/ddf10001-0000-4000-8000-000000000100');
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('delete_home_authorized', { p_home_id: 'ddf10001-0000-4000-8000-000000000100', p_user_id: TEST_USER });
    // The real SQL contract proves deletion/cascades. This HTTP transport test
    // proves the route itself does not unlink payments or delete independently.
    expect(getTable('Home').find((h) => h.id === 'ddf10001-0000-4000-8000-000000000100')).toBeTruthy();
  });

  test('a creator with other household members cannot delete without verifying ownership', async () => {
    setRpcMock(async () => ({ data: { allowed: false, deleted: false, code: 'DELETE_HOME_NOT_PRIMARY' }, error: null }));
    seedCreatedHome([{
      id: 'occ-roommate',
      home_id: 'ddf10001-0000-4000-8000-000000000100',
      user_id: 'user-roommate',
      is_active: true,
      role_base: 'member',
      verification_status: 'verified',
    }]);
    const app = createApp();

    const res = await request(app).delete('/api/homes/ddf10001-0000-4000-8000-000000000100');
    expect(res.status).toBe(403);
    expect(getTable('Home').find((h) => h.id === 'ddf10001-0000-4000-8000-000000000100')).toBeTruthy();
  });

  test('a stranger cannot delete someone else\'s home', async () => {
    seedCreatedHome();
    setRpcMock(async () => ({ data: { allowed: false, deleted: false, code: 'HOME_DELETE_ACCESS_DENIED' }, error: null }));
    const app = createApp();

    const res = await request(app)
      .delete('/api/homes/ddf10001-0000-4000-8000-000000000100')
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
    setRpcMock(async () => ({ data: { ok: false, code: 'TARGET_RANK_FORBIDDEN', status: 403 }, error: null }));
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

  test('detaching the primary pointer-owner requires ownership transfer and changes nothing', async () => {
    seedOwnerAndAdmin();
    setRpcMock(async () => ({ data: { ok: false, code: 'TRANSFER_REQUIRED', status: 409 }, error: null }));
    checkHomePermission.mockResolvedValue({ hasAccess: true, isOwner: true, occupancy: null });
    const app = createApp();

    const res = await request(app)
      .post('/api/homes/home-det-1/detach')
      .set('x-test-user-id', OWNER_ID)
      .send({ userId: OWNER_ID });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRANSFER_REQUIRED');
    const occ = getTable('HomeOccupancy').find((o) => o.id === 'occ-owner');
    expect(occ).toBeTruthy();
    expect(occ.is_active).toBe(true);
    expect(getTable('Home').find((h) => h.id === 'home-det-1').owner_id).toBe(OWNER_ID);
  });
});

describe('MISSING_UNIT with the no-unit attestation', () => {
  const { recordCreateHomeOutcome } = require('../../services/addressValidation/addressVerificationObservability');

  beforeEach(() => {
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: { status: 'MISSING_UNIT', confidence: 0.3, reasons: ['missing_secondary'] },
      canonical_address: { id: '77777777-7777-4777-8777-777777777777', address_line1_norm: '123 Verification Ln', city_norm: 'Portland', state: 'OR', postal_code: '97201', country: 'US', address_hash: 'canonicalhash' },
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
    expect(createBoundary.commits()).toHaveLength(1);

    const created = recordCreateHomeOutcome.mock.calls
      .map(([o]) => o)
      .find((o) => o.outcome === 'created');
    expect(created).toBeTruthy();
    expect(created.reasons).toContain('no_unit_attestation');
  });

  test('the attestation does not clear any other refusal', async () => {
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: { status: 'UNDELIVERABLE', confidence: 0.1, reasons: [] },
      canonical_address: { id: '77777777-7777-4777-8777-777777777777', address_line1_norm: '123 Verification Ln', city_norm: 'Portland', state: 'OR', postal_code: '97201', country: 'US', address_hash: 'canonicalhash' },
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

    const home = createBoundary.preparedHome();
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

    const home = createBoundary.preparedHome();
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

    const home = createBoundary.preparedHome();
    expect(home.geocode_mode).toBe('verified');
    expect(home.geocode_provider).toBe('google_validation');
    expect(home.map_center_lat).toBe(45.52);
  });
});

describe('existing building unit tools reuse private Home creation', () => {
  const parentId = 'ddf10001-0000-4000-8000-000000000500', batchId = 'ddf10001-0000-4000-8000-000000000501';
  const body = () => ({ request_id: batchId, expected_actor_id: TEST_USER, units: [{ label: 'Apt 103' }, { label: 'Apt 104' }] });
  beforeEach(() => {
    seedTable('Home', [{ id: parentId, address: CREATE_BODY.address, city: CREATE_BODY.city, state: CREATE_BODY.state,
      zipcode: CREATE_BODY.zipcode, country: 'US', address_id: 'ddf10001-0000-4000-8000-000000000502',
      home_type: 'multi_unit', home_status: 'active', security_state: 'normal' }]);
    seedTable('HomeAuthority', [{ id: 'ddf10001-0000-4000-8000-000000000503', home_id: parentId,
      subject_type: 'user', subject_id: TEST_USER, status: 'verified' }]);
    pipelineService.runValidationPipeline.mockImplementation(async input => ({ verdict: { status: 'OK', confidence: 1, reasons: [] },
      canonical_address: { id: '77777777-7777-4777-8777-777777777777', address_line1_norm: input.line1,
        address_line2_norm: input.line2, city_norm: input.city, state: input.state, postal_code: input.zip,
        country: 'US', address_hash: 'canonicalhash' }, address_id: null }));
  });
  test('the client address-ID gate does not prevent server-selected live unit validation and provisional setup', async () => {
    const config = require('../../config/addressVerification'), previous = config.rollout.requireAddressIdForHomeCreate;
    config.rollout.requireAddressIdForHomeCreate = true;
    try {
      const res = await request(createApp()).post(`/api/homes/${parentId}/units/import`).send(body());
      expect(res.status).toBe(200); expect(res.body.state).toBe('completed'); expect(res.body.requires_verification).toBe(true);
      expect(createBoundary.commits()).toHaveLength(2);
      expect(new Set(createBoundary.commits().map(c => c.p_request_id)).size).toBe(2);
      for (const [index, commit] of createBoundary.commits().entries()) {
        expect(commit.p_intent).toMatchObject({ bulk_parent_home_id: parentId, bulk_request_id: batchId,
          unit_number: body().units[index].label, role: 'property_manager', is_owner: false });
        expect(commit.p_home).toMatchObject({ owner_id: null, home_type: 'apartment', address2: body().units[index].label });
        expect(commit.p_templates.adult).toMatchObject({ verification_status: 'provisional_bootstrap', can_manage_home: false,
          can_manage_access: false, can_view_sensitive: false });
      }
      expect(pipelineService.runValidationPipeline).toHaveBeenCalledTimes(2);
      expect(pipelineService.runValidationPipeline.mock.calls[0][1]).toMatchObject({ includeHousehold: false });
      expect(getTable('Home')).toHaveLength(1);
    } finally { config.rollout.requireAddressIdForHomeCreate = previous; }
  });
  test('generation preserves prefix spacing and inclusive whole-number labels', async () => {
    const res = await request(createApp()).post(`/api/homes/${parentId}/units/generate`).send({
      request_id: batchId, expected_actor_id: TEST_USER, prefix: 'Apt ', start: 105, end: 106 });
    expect(res.status).toBe(200); expect(res.body.results.map(row => row.label)).toEqual(['Apt 105', 'Apt 106']);
  });
  test.each([
    ['missing recovery identity', { units: [{ label: 'Apt 103' }] }],
    ['duplicate label', { ...body(), units: [{ label: 'Apt 103' }, { label: 'apt 103' }] }],
    ['oversized batch', { ...body(), units: Array.from({ length: 51 }, (_, i) => ({ label: `Apt ${i}` })) }],
  ])('%s is rejected before provider work or creation', async (_name, input) => {
    const res = await request(createApp()).post(`/api/homes/${parentId}/units/import`).send(input);
    expect(res.status).toBe(400); expect(createBoundary.commits()).toHaveLength(0);
    expect(pipelineService.runValidationPipeline).not.toHaveBeenCalled();
  });
  test('unknown client fields cannot override the selected building or grant ownership', async () => {
    const res = await request(createApp()).post(`/api/homes/${parentId}/units/import`).send({
      ...body(), is_owner: true, role: 'owner', address: 'Some other building' });
    expect(res.status).toBe(200);
    for (const commit of createBoundary.commits()) {
      expect(commit.p_intent).toMatchObject({ role: 'property_manager', is_owner: false, bulk_parent_home_id: parentId });
      expect(commit.p_home).toMatchObject({ address: CREATE_BODY.address, owner_id: null });
    }
  });
  test.each([['fractional', 1.5, 3], ['reversed', 4, 3], ['oversized', 1, 51], ['negative', -1, 3]])(
    '%s range cannot be truncated or expanded silently', async (_name, start, end) => {
      const res = await request(createApp()).post(`/api/homes/${parentId}/units/generate`).send({
        request_id: batchId, expected_actor_id: TEST_USER, prefix: 'Apt ', start, end });
      expect(res.status).toBe(400); expect(pipelineService.runValidationPipeline).not.toHaveBeenCalled();
    });
  test('changed observed account cannot create under another actor', async () => {
    const res = await request(createApp()).post(`/api/homes/${parentId}/units/import`).send({ ...body(), expected_actor_id: parentId });
    expect(res.status).toBe(409); expect(createBoundary.commits()).toHaveLength(0);
  });
  test.each(['frozen', 'house', 'unit'])('a %s parent cannot create units', async kind => {
    const parent = getTable('Home')[0];
    if (kind === 'frozen') parent.security_state = 'frozen'; else if (kind === 'house') parent.home_type = 'house'; else parent.address2 = 'Apt 1';
    const res = await request(createApp()).post(`/api/homes/${parentId}/units/import`).send(body());
    expect(res.status).toBe(409); expect(pipelineService.runValidationPipeline).not.toHaveBeenCalled();
  });
  test('revoked authority cannot invoke the provider or create commands', async () => {
    getTable('HomeAuthority')[0].status = 'revoked';
    const res = await request(createApp()).post(`/api/homes/${parentId}/units/import`).send(body());
    expect(res.status).toBe(403); expect(pipelineService.runValidationPipeline).not.toHaveBeenCalled();
  });
});
