/**
 * P0.8 — feature flag service + middleware + routes.
 *
 * Audience Profile design v2 §19 acceptance criterion 15.
 *
 * Coverage:
 *   1. isFeatureEnabled honours the three enablement tiers
 *      (enabled_globally, enabled_for_internal_team via User.role,
 *      beta_user_ids).
 *   2. Cache: a second call within 60s does not hit the DB.
 *   3. invalidateFlagCache forces a reload.
 *   4. requireFeatureFlag middleware returns 404 when the flag is off.
 *   5. GET /api/feature-flags/:flagName returns ONLY { flagName, enabled }
 *      and never echoes beta_user_ids or other flag internals.
 *   6. POST /api/admin/feature-flags/:flagName updates the flag, audit-logs
 *      the change, and refuses non-admin callers.
 */

const express = require('express');
const request = require('supertest');
const path = require('path');

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;

const FLAG_NAME = 'audience_profile';
const REGULAR_USER = '11111111-1111-4111-8111-111111111111';
const INTERNAL_USER = '22222222-2222-4222-8222-222222222222';
const BETA_USER = '33333333-3333-4333-8333-333333333333';

// The featureFlagService is not in the moduleNameMapper auto-mock list,
// so a normal require gets the real implementation. Same for the
// middleware and the routes.
const featureFlagService = require('../../services/featureFlagService');
const requireFeatureFlag = require('../../middleware/requireFeatureFlag');
const featureFlagRoutes = require('../../routes/featureFlags');

function seedFlag(overrides = {}) {
  seedTable('FeatureFlag', [{
    id: 'flag-1',
    flag_name: FLAG_NAME,
    enabled_globally: false,
    enabled_for_internal_team: false,
    beta_user_ids: [],
    description: 'Beacon + paid tier',
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
    ...overrides,
  }]);
}

function seedUsers() {
  seedTable('User', [
    { id: REGULAR_USER, role: 'user', username: 'regular' },
    { id: INTERNAL_USER, role: 'admin', username: 'pantopus_admin' },
    { id: BETA_USER, role: 'user', username: 'betafan' },
  ]);
}

beforeEach(() => {
  resetTables();
  featureFlagService.invalidateFlagCache();
  seedUsers();
});

describe('P0.8 — featureFlagService.isFeatureEnabled', () => {
  test('returns false when the flag does not exist', async () => {
    expect(await featureFlagService.isFeatureEnabled('does_not_exist', { id: REGULAR_USER, role: 'user' })).toBe(false);
  });

  test('returns false when all three enablement tiers are off', async () => {
    seedFlag();
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, { id: REGULAR_USER, role: 'user' })).toBe(false);
  });

  test('returns true when enabled_globally is on', async () => {
    seedFlag({ enabled_globally: true });
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, { id: REGULAR_USER, role: 'user' })).toBe(true);
  });

  test('returns true for an internal-team user when enabled_for_internal_team is on', async () => {
    seedFlag({ enabled_for_internal_team: true });
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, { id: INTERNAL_USER, role: 'admin' })).toBe(true);
  });

  test('returns false for a regular user when enabled_for_internal_team is on', async () => {
    seedFlag({ enabled_for_internal_team: true });
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, { id: REGULAR_USER, role: 'user' })).toBe(false);
  });

  test('returns true when the user_id is in beta_user_ids', async () => {
    seedFlag({ beta_user_ids: [BETA_USER] });
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, { id: BETA_USER, role: 'user' })).toBe(true);
  });

  test('returns false when the user_id is NOT in beta_user_ids', async () => {
    seedFlag({ beta_user_ids: [BETA_USER] });
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, { id: REGULAR_USER, role: 'user' })).toBe(false);
  });

  test('accepts a userId string (fetches the user.role under the hood)', async () => {
    seedFlag({ enabled_for_internal_team: true });
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, INTERNAL_USER)).toBe(true);
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, REGULAR_USER)).toBe(false);
  });

  test('caches the flag (a second call after a DB row mutation reads the cached value within TTL)', async () => {
    seedFlag({ enabled_globally: false });
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, { id: REGULAR_USER, role: 'user' })).toBe(false);

    // Mutate the underlying row directly. Without cache invalidation, the
    // service should keep seeing the old (false) value.
    getTable('FeatureFlag')[0].enabled_globally = true;
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, { id: REGULAR_USER, role: 'user' })).toBe(false);

    // After explicit invalidation, the new value takes effect.
    featureFlagService.invalidateFlagCache(FLAG_NAME);
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, { id: REGULAR_USER, role: 'user' })).toBe(true);
  });
});

describe('P0.8 — requireFeatureFlag middleware', () => {
  // moduleNameMapper redirects `../middleware/verifyToken` (the import the
  // routes use) to the test mock — but that mapper does not match the
  // double-relative `../../middleware/verifyToken` import shape from this
  // test file. Pull the mock by its concrete path so the x-test-user-id
  // header gets turned into req.user the same way the route mock does.
  const verifyToken = require('../__mocks__/verifyToken');
  function buildApp() {
    const app = express();
    app.use(express.json());
    app.get('/test-flag', verifyToken, requireFeatureFlag(FLAG_NAME), (req, res) => res.json({ ok: true }));
    return app;
  }

  test('returns 404 when req.user is missing (verifyToken not wired)', async () => {
    // Build an app WITHOUT verifyToken so req.user is never populated —
    // simulates the production case where someone forgets to chain
    // verifyToken before requireFeatureFlag.
    seedFlag({ enabled_globally: true });
    const app = express();
    app.use(express.json());
    app.get('/test-flag', requireFeatureFlag(FLAG_NAME), (req, res) => res.json({ ok: true }));
    const res = await request(app).get('/test-flag');
    expect(res.status).toBe(404);
  });

  test('returns 404 when the flag does not exist', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/test-flag')
      .set('x-test-user-id', REGULAR_USER);
    // No flag seeded -> 404 even though user is authenticated.
    expect(res.status).toBe(404);
  });

  test('returns 404 when the flag exists but is off for the user', async () => {
    seedFlag();
    const app = buildApp();
    const res = await request(app)
      .get('/test-flag')
      .set('x-test-user-id', REGULAR_USER);
    expect(res.status).toBe(404);
  });

  test('passes through to the route when the flag is enabled globally', async () => {
    seedFlag({ enabled_globally: true });
    const app = buildApp();
    const res = await request(app)
      .get('/test-flag')
      .set('x-test-user-id', REGULAR_USER);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('passes through for an internal user when enabled_for_internal_team is on', async () => {
    seedFlag({ enabled_for_internal_team: true });
    const app = buildApp();
    const res = await request(app)
      .get('/test-flag')
      .set('x-test-user-id', INTERNAL_USER)
      .set('x-test-role', 'admin');
    expect(res.status).toBe(200);
  });

  test('passes through for a beta user', async () => {
    seedFlag({ beta_user_ids: [BETA_USER] });
    const app = buildApp();
    const res = await request(app)
      .get('/test-flag')
      .set('x-test-user-id', BETA_USER);
    expect(res.status).toBe(200);
  });
});

describe('P0.8 — GET /api/feature-flags/:flagName', () => {
  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api', featureFlagRoutes);
    return app;
  }

  test('returns { flagName, enabled: false } when the flag is off', async () => {
    seedFlag();
    const app = buildApp();
    const res = await request(app)
      .get(`/api/feature-flags/${FLAG_NAME}`)
      .set('x-test-user-id', REGULAR_USER);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ flagName: FLAG_NAME, enabled: false });
  });

  test('returns enabled=true for a user in the beta cohort', async () => {
    seedFlag({ beta_user_ids: [BETA_USER] });
    const app = buildApp();
    const res = await request(app)
      .get(`/api/feature-flags/${FLAG_NAME}`)
      .set('x-test-user-id', BETA_USER);
    expect(res.body.enabled).toBe(true);
  });

  test('NEVER echoes beta_user_ids or other flag internals to the caller', async () => {
    seedFlag({
      enabled_globally: true,
      enabled_for_internal_team: true,
      beta_user_ids: [BETA_USER, REGULAR_USER, INTERNAL_USER],
      description: 'secret cohort description',
    });
    const app = buildApp();
    const res = await request(app)
      .get(`/api/feature-flags/${FLAG_NAME}`)
      .set('x-test-user-id', REGULAR_USER);
    expect(res.body).toEqual({ flagName: FLAG_NAME, enabled: true });
    expect(res.body).not.toHaveProperty('beta_user_ids');
    expect(res.body).not.toHaveProperty('enabled_for_internal_team');
    expect(res.body).not.toHaveProperty('description');
    expect(JSON.stringify(res.body)).not.toContain(REGULAR_USER);
    expect(JSON.stringify(res.body)).not.toContain(INTERNAL_USER);
  });

  test('rejects an invalid flag name', async () => {
    seedFlag();
    const app = buildApp();
    const res = await request(app)
      .get('/api/feature-flags/INVALID-NAME!')
      .set('x-test-user-id', REGULAR_USER);
    expect(res.status).toBe(400);
  });
});

describe('P0.8 — POST /api/admin/feature-flags/:flagName (admin only)', () => {
  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api', featureFlagRoutes);
    return app;
  }

  beforeEach(() => {
    seedFlag();
    seedTable('IdentityAuditLog', []);
  });

  test('rejects callers without admin role', async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/api/admin/feature-flags/${FLAG_NAME}`)
      .set('x-test-user-id', REGULAR_USER)
      .send({ enabled_globally: true });
    expect(res.status).toBe(403);
  });

  test('admin can flip enabled_for_internal_team and add beta users', async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/api/admin/feature-flags/${FLAG_NAME}`)
      .set('x-test-user-id', INTERNAL_USER)
      .set('x-test-role', 'admin')
      .send({
        enabled_for_internal_team: true,
        beta_user_ids: [BETA_USER],
        description: 'phase 1 internal cohort',
      });
    expect(res.status).toBe(200);
    expect(res.body.enabled_for_internal_team).toBe(true);
    expect(res.body.beta_user_count).toBe(1);
    // The response is a public-shape summary — beta_user_ids itself is NOT
    // in the body (defense in depth even on the admin route).
    expect(res.body).not.toHaveProperty('beta_user_ids');
  });

  test('admin update writes an IdentityAuditLog row with a field-level diff', async () => {
    const app = buildApp();
    await request(app)
      .post(`/api/admin/feature-flags/${FLAG_NAME}`)
      .set('x-test-user-id', INTERNAL_USER)
      .set('x-test-role', 'admin')
      .send({ enabled_globally: true });
    const log = getTable('IdentityAuditLog');
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      actor_user_id: INTERNAL_USER,
      action: 'feature_flag.updated',
      target_type: 'FeatureFlag',
      target_id: FLAG_NAME,
    });
    expect(log[0].metadata).toMatchObject({
      flag_name: FLAG_NAME,
      diff: { enabled_globally: { previous: false, next: true } },
    });
  });

  test('admin update invalidates the in-process cache so the next read reflects the new value', async () => {
    // Prime the cache as off.
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, { id: REGULAR_USER, role: 'user' })).toBe(false);

    const app = buildApp();
    const res = await request(app)
      .post(`/api/admin/feature-flags/${FLAG_NAME}`)
      .set('x-test-user-id', INTERNAL_USER)
      .set('x-test-role', 'admin')
      .send({ enabled_globally: true });
    expect(res.status).toBe(200);

    // The cached value would still be `false` if the admin route had
    // forgotten to invalidate. Our setFlag does, so we get `true` here.
    expect(await featureFlagService.isFeatureEnabled(FLAG_NAME, { id: REGULAR_USER, role: 'user' })).toBe(true);
  });

  test('admin update on a non-existent flag returns 404', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/admin/feature-flags/never_seeded_flag')
      .set('x-test-user-id', INTERNAL_USER)
      .set('x-test-role', 'admin')
      .send({ enabled_globally: true });
    expect(res.status).toBe(404);
  });
});
