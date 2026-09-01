const express = require('express');
const request = require('supertest');

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../utils/homePermissions', () => ({
  checkHomePermission: jest.fn(async () => ({ hasAccess: true })),
  writeAuditLog: jest.fn(async () => {}),
  applyOccupancyTemplate: jest.fn(async () => ({ occupancy: { id: 'occ-1' } })),
  mapLegacyRole: jest.fn((role) => role),
}));
jest.mock('../../utils/homeSecurityPolicy', () => ({
  canSubmitOwnerClaim: jest.fn(async () => ({ allowed: true, errors: [], blockCode: null })),
  evaluateRentalFirewall: jest.fn(() => ({ blocked: false })),
  getClaimRiskScore: jest.fn(async () => 0),
  isClaimWindowActive: jest.fn(() => false),
  recalculateTier: jest.fn(async () => 'weak'),
  shouldTriggerDispute: jest.fn(() => false),
  getClaimWindowEndsAt: jest.fn(() => new Date('2026-04-30T00:00:00.000Z')),
}));
jest.mock('../../services/propertyDataService', () => ({
  isAvailable: jest.fn(() => false),
}));
jest.mock('../../middleware/rateLimiter', () => ({
  ownershipClaimLimiter: (_req, _res, next) => next(),
  postcardLimiter: (_req, _res, next) => next(),
  verificationAttemptLimiter: (_req, _res, next) => next(),
}));
jest.mock('../../services/occupancyAttachService', () => ({
  attach: jest.fn(async () => ({ success: true, occupancy: { id: 'occ-1' } })),
}));

const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');
const homePermissions = require('../../utils/homePermissions');
const householdClaimConfig = require('../../config/householdClaims');
const router = require('../../routes/homeOwnership');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', router);
  return app;
}

describe('GET /:id/ownership-claims/compare', () => {
  const app = createApp();

  beforeEach(() => {
    resetTables();
    homePermissions.checkHomePermission.mockResolvedValue({ hasAccess: true });
    householdClaimConfig.flags.adminCompare = true;
    seedTable('Home', [{
      id: 'home-1',
      name: 'Test Home',
      address: '123 Test St',
      city: 'Testville',
      state: 'CA',
      zipcode: '90210',
      security_state: 'normal',
      household_resolution_state: 'contested',
      household_resolution_updated_at: '2026-04-04T00:00:00.000Z',
    }]);
    seedTable('HomeOwner', [{
      id: 'owner-1',
      home_id: 'home-1',
      subject_id: 'owner-user',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      claimant_user_id: 'claimant-user',
      claim_type: 'owner',
      state: 'submitted',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      claim_strength: 'owner_legal',
      routing_classification: 'standalone_claim',
      identity_status: 'not_started',
      merged_into_claim_id: null,
      method: 'doc_upload',
      risk_score: 0,
      created_at: '2026-04-04T00:00:00.000Z',
      updated_at: '2026-04-04T00:00:00.000Z',
    }]);
    seedTable('HomeVerificationEvidence', [{
      id: 'evidence-1',
      claim_id: 'claim-1',
      evidence_type: 'deed',
      provider: 'manual',
      status: 'verified',
      confidence_level: 'high',
      metadata: {},
      created_at: '2026-04-04T00:00:00.000Z',
      updated_at: '2026-04-04T00:00:00.000Z',
    }]);
    seedTable('User', [
      { id: 'owner-user', username: 'owner', name: 'Owner User' },
      { id: 'claimant-user', username: 'claimant', name: 'Claimant User' },
    ]);
  });

  test('returns side-by-side comparison payload', async () => {
    const res = await request(app)
      .get('/api/homes/home-1/ownership-claims/compare')
      .set('x-test-user-id', 'owner-user');

    expect(res.status).toBe(200);
    expect(res.body.home_id).toBe('home-1');
    expect(res.body.incumbent.owners).toHaveLength(1);
    expect(res.body.claims).toHaveLength(1);
    expect(res.body.claims[0].evidence).toHaveLength(1);
  });

  test('requires explicit authorization for non-admin users', async () => {
    homePermissions.checkHomePermission.mockResolvedValueOnce({ hasAccess: false });

    const res = await request(app)
      .get('/api/homes/home-1/ownership-claims/compare')
      .set('x-test-user-id', 'random-user');

    expect(res.status).toBe(403);
  });

  test('returns 404 when the compare feature flag is disabled', async () => {
    householdClaimConfig.flags.adminCompare = false;

    const res = await request(app)
      .get('/api/homes/home-1/ownership-claims/compare')
      .set('x-test-user-id', 'owner-user');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Claim comparison not enabled');
  });
});
