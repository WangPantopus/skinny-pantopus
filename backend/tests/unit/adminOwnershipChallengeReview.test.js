const express = require('express');
const request = require('supertest');

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../config/supabase', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../services/s3Service', () => ({
  getPresignedDownloadUrl: jest.fn(async () => 'https://example.com/file.pdf'),
}));
jest.mock('../../services/occupancyAttachService', () => ({
  attach: jest.fn(async () => ({ success: true, occupancy: { id: 'occ-new' } })),
  detach: jest.fn(async () => ({ success: true })),
}));
jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(async () => ({ id: 'notif-1' })),
  notifyOwnershipClaimApproved: jest.fn(async () => ({ id: 'notif-2' })),
  notifyOwnershipClaimRejected: jest.fn(async () => ({ id: 'notif-3' })),
  notifyOwnershipClaimNeedsMoreInfo: jest.fn(async () => ({ id: 'notif-4' })),
}));

const { resetTables, seedTable, getTable, setAuthMocks, setRpcMock } = require('../__mocks__/supabaseAdmin');
const occupancyAttachService = require('../../services/occupancyAttachService');
const verifyToken = require('../../middleware/verifyToken');

const router = require('../../routes/admin');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);
  return app;
}

describe('admin challenge adjudication', () => {
  const app = createApp();

  beforeEach(() => {
    resetTables();
    verifyToken._roleCache?.clear?.();
    setAuthMocks({
      getUser: async () => ({
        data: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            email_confirmed_at: '2026-04-04T00:00:00.000Z',
          },
        },
        error: null,
      }),
    });
    occupancyAttachService.attach.mockClear();
    occupancyAttachService.detach.mockClear();
    seedTable('Home', []);
    seedTable('HomeOwner', []);
    seedTable('HomeOccupancy', []);
    seedTable('HomeOwnershipClaim', []);
    seedTable('HomeVerificationEvidence', []);
    seedTable('User', [{
      id: 'admin-1',
      role: 'admin',
    }]);
  });

  test.each(['approve', 'reject'])('%s keeps disputed claims in the dedicated challenge flow', async (action) => {
    seedTable('Home', [{ id: 'home-1', owner_id: 'owner-old', security_state: 'disputed', ownership_state: 'disputed' }]);
    seedTable('HomeOwner', [{ id: 'owner-row-1', home_id: 'home-1', subject_id: 'owner-old',
      owner_status: 'verified', is_primary_owner: true, verification_tier: 'strong' }]);
    seedTable('HomeOwnershipClaim', [
      { id: 'incumbent-claim', home_id: 'home-1', claimant_user_id: 'owner-old', state: 'approved',
        claim_phase_v2: 'verified', challenge_state: 'challenged', routing_classification: 'standalone_claim' },
      { id: 'challenger-claim', home_id: 'home-1', claimant_user_id: 'owner-new', state: 'submitted',
        claim_phase_v2: 'challenged', challenge_state: 'challenged', routing_classification: 'challenge_claim' },
    ]);
    seedTable('HomeVerificationEvidence', [{ id: 'ev-1', claim_id: 'challenger-claim', evidence_type: 'deed', status: 'pending' }]);
    const protectedTables = ['Home', 'HomeOwner', 'HomeOccupancy', 'HomeOwnershipClaim', 'HomeVerificationEvidence'];
    const before = protectedTables.map((table) => JSON.parse(JSON.stringify(getTable(table))));
    const rpc = jest.fn(async () => ({ data: { ok: false, code: 'CLAIM_CHALLENGE_REVIEW_REQUIRED', status: 409 }, error: null }));
    setRpcMock(rpc);

    const res = await request(app)
      .post('/api/admin/claims/challenger-claim/review')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', 'admin-1')
      .set('x-test-role', 'admin')
      .send({ action, note: 'Current evidence requires dispute review', review_token: 'a'.repeat(64) });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLAIM_CHALLENGE_REVIEW_REQUIRED');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('mutate_home_claim_review', expect.objectContaining({
      p_home_id: null, p_claim_id: 'challenger-claim', p_actor_id: 'admin-1', p_action: action,
      p_review_token: 'a'.repeat(64), p_note: 'Current evidence requires dispute review', p_platform_admin: true,
    }));
    expect(protectedTables.map((table) => getTable(table))).toEqual(before);
    expect(occupancyAttachService.attach).not.toHaveBeenCalled();
    expect(occupancyAttachService.detach).not.toHaveBeenCalled();
    expect(require('../../services/notificationService').notifyOwnershipClaimApproved).not.toHaveBeenCalled();
    expect(require('../../services/notificationService').notifyOwnershipClaimRejected).not.toHaveBeenCalled();
    expect(require('../../services/s3Service').getPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  test('pending claims list includes disputed challenge claims for admin review', async () => {
    seedTable('Home', [{
      id: 'home-1',
      address: '123 Example St',
      city: 'Testville',
      state: 'CA',
      zipcode: '90210',
      name: 'Example Home',
    }]);
    seedTable('User', [
      { id: 'admin-1', role: 'admin', email: 'admin@example.com' },
      { id: 'owner-new', email: 'owner@example.com', name: 'Owner New' },
    ]);
    seedTable('HomeOwnershipClaim', [{
      id: 'challenger-claim',
      home_id: 'home-1',
      claimant_user_id: 'owner-new',
      claim_type: 'owner',
      state: 'disputed',
      method: 'doc_upload',
      claim_phase_v2: 'challenged',
      challenge_state: 'challenged',
      risk_score: 22,
      created_at: '2026-04-04T00:00:00.000Z',
      updated_at: '2026-04-04T00:00:00.000Z',
    }]);
    seedTable('HomeVerificationEvidence', [{
      id: 'ev-1',
      claim_id: 'challenger-claim',
      evidence_type: 'deed',
      status: 'pending',
    }]);

    const res = await request(app)
      .get('/api/admin/pending-claims')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', 'admin-1')
      .set('x-test-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.claims).toHaveLength(1);
    expect(res.body.claims[0].id).toBe('challenger-claim');
    expect(res.body.claims[0].state).toBe('disputed');
    expect(res.body.claims[0].claim_phase_v2).toBe('challenged');
  });
});
