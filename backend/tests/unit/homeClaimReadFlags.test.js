const express = require('express');
const request = require('supertest');

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = { id: req.headers['x-test-user-id'] || 'ddc23700-0000-4000-8000-000000000001', role: 'user' };
  next();
});
jest.mock('../../utils/homePermissions', () => ({
  checkHomePermission: jest.fn(async () => ({ hasAccess: true, isOwner: false, occupancy: null })),
  isVerifiedOwner: jest.fn(),
  mapLegacyRole: jest.fn((role) => role),
  writeAuditLog: jest.fn(),
  applyOccupancyTemplate: jest.fn(),
}));
// These tests isolate legacy/v2 claim selection after current Home admission.
// Production admission and held-query denial are exercised against actual SQL.
jest.mock('../../services/homeDashboardService', () => ({
  withCurrentAccess: jest.fn(async (_context, read) => read({ hasAccess: true, isOwner: false, occupancy: null, permissions: ['home.view'] })),
}));
jest.mock('../../utils/homeSecurityPolicy', () => ({
  getClaimRiskScore: jest.fn(async () => 0),
}));
jest.mock('../../services/addressValidation', () => ({
  pipelineService: {},
  AddressVerdictStatus: {},
  addressDecisionEngine: {},
  googleProvider: { isAvailable: jest.fn(() => false) },
  smartyProvider: { isAvailable: jest.fn(() => false) },
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

const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');
const householdClaimConfig = require('../../config/householdClaims');
const homePermissions = require('../../utils/homePermissions');
const router = require('../../routes/home');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', router);
  return app;
}

describe('home claim read path flags', () => {
  const app = createApp();

  beforeEach(() => {
    resetTables();
    homePermissions.checkHomePermission.mockResolvedValue({ hasAccess: true, isOwner: false, occupancy: null });
    Object.assign(householdClaimConfig.flags, {
      v2ReadPaths: false,
      parallelSubmission: false,
      inviteMerge: false,
      challengeFlow: false,
      adminCompare: false,
    });

    seedTable('Home', [{
      id: 'ddc23700-0000-4000-8000-000000000100',
      name: null, address2: null, country: 'US', is_owner: false, home_type: null, description: null,
      visibility: 'private', bedrooms: null, bathrooms: null, sq_ft: null, lot_sq_ft: null,
      year_built: null, move_in_date: null, primary_photo_url: null, cover_photo_url: null,
      updated_at: null, home_status: 'active', security_state: 'normal',
      claim_window_ends_at: null, tenure_mode: null,
      address: '123 Test St',
      city: 'Testville',
      state: 'CA',
      zipcode: '90210',
      location: null,
      created_at: '2026-04-04T00:00:00.000Z',
    }]);
    seedTable('HomeOwner', [{
      id: 'ddc23700-0000-4000-8000-000000000201',
      home_id: 'ddc23700-0000-4000-8000-000000000100',
      subject_type: 'user',
      subject_id: 'ddc23700-0000-4000-8000-000000000001',
      owner_status: 'pending',
      is_primary_owner: false,
      verification_tier: 'standard',
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'ddc23700-0000-4000-8000-000000000301',
      home_id: 'ddc23700-0000-4000-8000-000000000100',
      claimant_user_id: 'ddc23700-0000-4000-8000-000000000001',
      state: 'approved',
      claim_phase_v2: 'challenged',
      merged_into_claim_id: null,
      created_at: '2026-04-04T00:00:00.000Z',
      updated_at: '2026-04-04T00:00:00.000Z',
    }]);
  });

  test('flag-off home detail lookup stays on legacy pending-claim states', async () => {
    const res = await request(app)
      .get('/api/homes/ddc23700-0000-4000-8000-000000000100')
      .set('x-test-user-id', 'ddc23700-0000-4000-8000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.home.isPendingOwner).toBe(true);
    expect(res.body.home.pendingClaimId).toBeNull();
  });

  test('flag-on home detail lookup uses v2 active claim phases', async () => {
    householdClaimConfig.flags.v2ReadPaths = true;

    const res = await request(app)
      .get('/api/homes/ddc23700-0000-4000-8000-000000000100')
      .set('x-test-user-id', 'ddc23700-0000-4000-8000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.home.isPendingOwner).toBe(true);
    expect(res.body.home.pendingClaimId).toBe('ddc23700-0000-4000-8000-000000000301');
  });
});
