// T5.4.3 — Backend tests for the bucket-aware admin claims queue.
//
// `GET /api/admin/claims?bucket=…` powers the Pending / Approved /
// Rejected tabs of the Review-claims admin screen, and
// `GET /api/admin/claims/counts` powers the tab-strip badges. Together
// they replace the per-tab `state` query the page used in T4.

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

const { resetTables, seedTable, setAuthMocks } = require('../__mocks__/supabaseAdmin');
const verifyToken = require('../../middleware/verifyToken');

const router = require('../../routes/admin');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);
  return app;
}

function authedGet(app, url) {
  return request(app)
    .get(url)
    .set('Authorization', 'Bearer test-token')
    .set('x-test-user-id', 'admin-1')
    .set('x-test-role', 'admin');
}

const NOW = Date.UTC(2026, 4, 15, 12, 0, 0); // 2026-05-15T12:00:00Z
const ONE_DAY_MS = 86_400_000;

describe('admin Review-claims tabbed queue', () => {
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

    seedTable('User', [
      { id: 'admin-1', role: 'admin' },
      { id: 'user-A', name: 'Maria Kovács', username: 'maria', email: 'maria@example.com', created_at: '2024-01-01T00:00:00.000Z' },
      { id: 'user-B', name: 'David Chen', username: 'david', email: 'david@example.com', created_at: '2024-01-01T00:00:00.000Z' },
      { id: 'user-C', name: 'Priya Shah', username: 'priya', email: 'priya@example.com', created_at: '2024-01-01T00:00:00.000Z' },
    ]);
    seedTable('Home', [
      { id: 'home-1', address: '418 Elm St', city: 'Portland', state: 'OR', zipcode: '97201', name: '418 Elm' },
      { id: 'home-2', address: '1207 NE 22nd Ave', city: 'Portland', state: 'OR', zipcode: '97232', name: null },
    ]);
    seedTable('HomeOwnershipClaim', [
      // 8 days old → "aging" pending claim
      {
        id: 'claim-old-pending',
        home_id: 'home-1',
        claimant_user_id: 'user-C',
        claim_type: 'owner',
        state: 'pending_review',
        method: 'doc_upload',
        risk_score: 12,
        created_at: new Date(NOW - 8 * ONE_DAY_MS).toISOString(),
        updated_at: new Date(NOW - 8 * ONE_DAY_MS).toISOString(),
      },
      // 2 hours old → "new" pending claim
      {
        id: 'claim-fresh-pending',
        home_id: 'home-1',
        claimant_user_id: 'user-A',
        claim_type: 'owner',
        state: 'submitted',
        method: 'doc_upload',
        risk_score: 8,
        created_at: new Date(NOW - 2 * 3_600_000).toISOString(),
        updated_at: new Date(NOW - 2 * 3_600_000).toISOString(),
      },
      // disputed = pending bucket
      {
        id: 'claim-disputed',
        home_id: 'home-2',
        claimant_user_id: 'user-B',
        claim_type: 'owner',
        state: 'disputed',
        method: 'doc_upload',
        risk_score: 31,
        created_at: new Date(NOW - 1 * ONE_DAY_MS).toISOString(),
        updated_at: new Date(NOW - 1 * ONE_DAY_MS).toISOString(),
      },
      // approved bucket
      {
        id: 'claim-approved-1',
        home_id: 'home-1',
        claimant_user_id: 'user-A',
        claim_type: 'owner',
        state: 'approved',
        method: 'doc_upload',
        risk_score: 5,
        created_at: new Date(NOW - 14 * ONE_DAY_MS).toISOString(),
        updated_at: new Date(NOW - 14 * ONE_DAY_MS).toISOString(),
      },
      {
        id: 'claim-approved-2',
        home_id: 'home-2',
        claimant_user_id: 'user-B',
        claim_type: 'resident',
        state: 'approved',
        method: 'lease',
        risk_score: 3,
        created_at: new Date(NOW - 30 * ONE_DAY_MS).toISOString(),
        updated_at: new Date(NOW - 30 * ONE_DAY_MS).toISOString(),
      },
      // rejected bucket
      {
        id: 'claim-rejected',
        home_id: 'home-1',
        claimant_user_id: 'user-C',
        claim_type: 'owner',
        state: 'rejected',
        method: 'doc_upload',
        risk_score: 70,
        created_at: new Date(NOW - 5 * ONE_DAY_MS).toISOString(),
        updated_at: new Date(NOW - 5 * ONE_DAY_MS).toISOString(),
      },
    ]);
    seedTable('HomeVerificationEvidence', [
      { id: 'ev-1', claim_id: 'claim-old-pending', evidence_type: 'deed', status: 'pending' },
      { id: 'ev-2', claim_id: 'claim-old-pending', evidence_type: 'tax_bill', status: 'pending' },
      { id: 'ev-3', claim_id: 'claim-fresh-pending', evidence_type: 'utility_bill', status: 'pending' },
      { id: 'ev-4', claim_id: 'claim-approved-1', evidence_type: 'deed', status: 'verified' },
    ]);
  });

  describe('GET /api/admin/claims?bucket=pending', () => {
    test('returns only pending-bucket claims, enriched with home + claimant + evidence_count', async () => {
      const res = await authedGet(app, '/api/admin/claims?bucket=pending');

      expect(res.status).toBe(200);
      expect(res.body.claims).toBeDefined();

      const ids = res.body.claims.map((c) => c.id).sort();
      expect(ids).toEqual(['claim-disputed', 'claim-fresh-pending', 'claim-old-pending']);

      const oldPending = res.body.claims.find((c) => c.id === 'claim-old-pending');
      expect(oldPending.home).toMatchObject({ id: 'home-1', address: '418 Elm St', city: 'Portland' });
      expect(oldPending.claimant).toMatchObject({ id: 'user-C', name: 'Priya Shah' });
      expect(oldPending.evidence_count).toBe(2);

      const freshPending = res.body.claims.find((c) => c.id === 'claim-fresh-pending');
      expect(freshPending.evidence_count).toBe(1);

      const disputed = res.body.claims.find((c) => c.id === 'claim-disputed');
      expect(disputed.home.id).toBe('home-2');
      expect(disputed.claimant.name).toBe('David Chen');
      expect(disputed.evidence_count).toBe(0);

      // Approved / rejected must NOT leak into the pending bucket.
      expect(ids).not.toContain('claim-approved-1');
      expect(ids).not.toContain('claim-approved-2');
      expect(ids).not.toContain('claim-rejected');
    });

    test('surfaces oldest_age_seconds for the queue banner', async () => {
      const res = await authedGet(app, '/api/admin/claims?bucket=pending');

      expect(res.status).toBe(200);
      // The oldest pending claim is 8 days old; surface that as a positive
      // integer of seconds so the client renders "Oldest in queue: 8d".
      expect(res.body.oldest_age_seconds).toBeGreaterThanOrEqual(7 * ONE_DAY_MS / 1000);
    });
  });

  describe('GET /api/admin/claims?bucket=approved', () => {
    test('returns only approved claims and does not surface oldest_age_seconds', async () => {
      const res = await authedGet(app, '/api/admin/claims?bucket=approved');

      expect(res.status).toBe(200);
      const ids = res.body.claims.map((c) => c.id).sort();
      expect(ids).toEqual(['claim-approved-1', 'claim-approved-2']);
      expect(res.body.oldest_age_seconds).toBeNull();

      const enriched = res.body.claims.find((c) => c.id === 'claim-approved-1');
      expect(enriched.home.id).toBe('home-1');
      expect(enriched.claimant.username).toBe('maria');
      expect(enriched.evidence_count).toBe(1);
    });
  });

  describe('GET /api/admin/claims?bucket=rejected', () => {
    test('returns only rejected claims', async () => {
      const res = await authedGet(app, '/api/admin/claims?bucket=rejected');

      expect(res.status).toBe(200);
      const ids = res.body.claims.map((c) => c.id);
      expect(ids).toEqual(['claim-rejected']);
      expect(res.body.oldest_age_seconds).toBeNull();
    });
  });

  describe('GET /api/admin/claims with unknown bucket', () => {
    test('rejects unknown bucket values with 400', async () => {
      const res = await authedGet(app, '/api/admin/claims?bucket=nonsense');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/unknown bucket/i);
    });
  });

  describe('GET /api/admin/claims/counts', () => {
    test('returns per-bucket totals matching the seeded fixture', async () => {
      const res = await authedGet(app, '/api/admin/claims/counts');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        pending: 3,
        approved: 2,
        rejected: 1,
      });
    });

    test('counts endpoint resolves before /claims/:claimId so "counts" is not mis-routed', async () => {
      // Route declaration order matters: if /claims/:claimId is matched
      // first, this would 404 with a "Claim not found" message instead of
      // returning the count payload.
      const res = await authedGet(app, '/api/admin/claims/counts');
      expect(res.status).toBe(200);
      expect(res.body.pending).toBe(3);
    });
  });

  describe('admin gating', () => {
    test('non-admin users get 403 from the bucket endpoint', async () => {
      seedTable('User', [
        { id: 'user-1', role: 'user' },
      ]);
      setAuthMocks({
        getUser: async () => ({
          data: {
            user: {
              id: 'user-1',
              email: 'user@example.com',
              email_confirmed_at: '2026-04-04T00:00:00.000Z',
            },
          },
          error: null,
        }),
      });

      const res = await request(app)
        .get('/api/admin/claims?bucket=pending')
        .set('Authorization', 'Bearer test-token')
        .set('x-test-user-id', 'user-1')
        .set('x-test-role', 'user');

      expect(res.status).toBe(403);
    });

    test('non-admin users get 403 from the counts endpoint', async () => {
      seedTable('User', [
        { id: 'user-1', role: 'user' },
      ]);
      setAuthMocks({
        getUser: async () => ({
          data: {
            user: {
              id: 'user-1',
              email: 'user@example.com',
              email_confirmed_at: '2026-04-04T00:00:00.000Z',
            },
          },
          error: null,
        }),
      });

      const res = await request(app)
        .get('/api/admin/claims/counts')
        .set('Authorization', 'Bearer test-token')
        .set('x-test-user-id', 'user-1')
        .set('x-test-role', 'user');

      expect(res.status).toBe(403);
    });
  });
});
