/**
 * P1.5 — tier CRUD route tests.
 *
 * Audience Profile design v2 §10. Tests the owner-only routes mounted
 * via routes/personaTiers.js plus the public GET /:handle/tiers route
 * added inside routes/personas.js. Uses the in-memory supabaseAdmin
 * mock, so this lives under tests/unit/ rather than tests/integration/
 * (the integration runner is excluded from `npm test`).
 *
 * The test app mounts routes with the same precedence the production
 * app.js uses: owner-only personaTiers FIRST (constrained to UUID :id
 * in app.js; the test uses UUIDs anyway so the regex isn't needed
 * here), public personas SECOND.
 */

const express = require('express');
const request = require('supertest');

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;

const featureFlagService = require('../../services/featureFlagService');
const personaTiersRouter = require('../../routes/personaTiers');
const personasRouter = require('../../routes/personas');

const FLAG_NAME = 'audience_profile';
const OWNER_ID    = '11111111-1111-4111-8111-111111111111';
const STRANGER_ID = '22222222-2222-4222-8222-222222222222';
const FAN_ID      = '33333333-3333-4333-8333-333333333333';
const PERSONA_ID  = '44444444-4444-4444-4444-444444444444';
const PERSONA_HANDLE = 'mayabuilds';

function buildApp() {
  const app = express();
  app.use(express.json());
  // Mount order mirrors production app.js. The personaTiers router has
  // a UUID-format gate at the top that calls next('router') for non-UUID
  // :id values, letting handle-shaped URLs fall through to the public
  // GET /:handle/tiers route in personasRouter below.
  app.use('/api/personas/:id/tiers', personaTiersRouter);
  app.use('/api/personas', personasRouter);
  return app;
}

function asUser(req, userId) {
  return req.set('x-test-user-id', userId);
}

function seedFlagOn({ globally = false, betaUserIds = [] } = {}) {
  seedTable('FeatureFlag', [{
    id: 'flag-1',
    flag_name: FLAG_NAME,
    enabled_globally: globally,
    enabled_for_internal_team: false,
    beta_user_ids: betaUserIds,
    description: 'Beacon + paid tier',
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
  }]);
  featureFlagService.invalidateFlagCache();
}

function seedFlagOff() {
  seedTable('FeatureFlag', [{
    id: 'flag-1',
    flag_name: FLAG_NAME,
    enabled_globally: false,
    enabled_for_internal_team: false,
    beta_user_ids: [],
    description: 'Beacon + paid tier',
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
  }]);
  featureFlagService.invalidateFlagCache();
}

function seedUsers() {
  seedTable('User', [
    { id: OWNER_ID, role: 'user', username: 'owner_personal_handle' },
    { id: STRANGER_ID, role: 'user', username: 'stranger' },
    { id: FAN_ID, role: 'user', username: 'fan_personal' },
  ]);
}

function seedPersona() {
  seedTable('PublicPersona', [{
    id: PERSONA_ID,
    user_id: OWNER_ID,
    handle: PERSONA_HANDLE,
    handle_normalized: PERSONA_HANDLE,
    display_name: 'Maya Builds',
    audience_mode: 'open',
    status: 'active',
    follower_count: 0,
    post_count: 0,
  }]);
}

function seedDefaultLadder() {
  seedTable('PersonaTier', [
    { id: 'tier-1', persona_id: PERSONA_ID, rank: 1, name: 'Follower',
      description: 'Free updates', price_cents: 0, currency: 'USD',
      billing_interval: 'month', msg_threads_per_period: null,
      creator_can_initiate_dm: false, reply_policy: 'discretion',
      status: 'active', stripe_price_id: null, position: 1 },
    { id: 'tier-2', persona_id: PERSONA_ID, rank: 2, name: 'Member',
      description: 'Member benefits', price_cents: 500, currency: 'USD',
      billing_interval: 'month', msg_threads_per_period: 5,
      creator_can_initiate_dm: false, reply_policy: 'discretion',
      status: 'active', stripe_price_id: 'price_member_test', position: 2 },
    { id: 'tier-3', persona_id: PERSONA_ID, rank: 3, name: 'Insider',
      description: 'Insider benefits', price_cents: 1500, currency: 'USD',
      billing_interval: 'month', msg_threads_per_period: 25,
      creator_can_initiate_dm: true, reply_policy: 'within_7_days',
      status: 'active', stripe_price_id: 'price_insider_test', position: 3 },
  ]);
}

beforeEach(() => {
  resetTables();
  seedUsers();
  seedPersona();
  seedDefaultLadder();
  seedFlagOn({ globally: true });
});

afterEach(() => {
  featureFlagService.invalidateFlagCache();
});

// ---------------------------------------------------------------------------
// GET /api/personas/:id/tiers (owner)
// ---------------------------------------------------------------------------
describe('GET /api/personas/:id/tiers', () => {
  test('owner sees the 3 active tiers', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/tiers`),
      OWNER_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.tiers).toHaveLength(3);
    expect(res.body.tiers.map((t) => t.rank).sort()).toEqual([1, 2, 3]);
    expect(res.body.tiers[0]).toMatchObject({
      rank: 1, name: 'Follower', priceCents: 0, status: 'active',
    });
    // Owner serializer DOES include stripePriceId.
    expect(res.body.tiers.find((t) => t.rank === 2).stripePriceId)
      .toBe('price_member_test');
  });

  test('include_hidden=true also returns hidden + archived tiers', async () => {
    seedTable('PersonaTier', [
      ...getTable('PersonaTier'),
      { id: 'tier-hidden', persona_id: PERSONA_ID, rank: 2, name: 'Hidden Member',
        description: 'archived', price_cents: 500, currency: 'USD',
        billing_interval: 'month', msg_threads_per_period: 5,
        creator_can_initiate_dm: false, reply_policy: 'discretion',
        status: 'hidden', stripe_price_id: null, position: 2 },
    ]);
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/tiers?include_hidden=true`),
      OWNER_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.tiers.length).toBeGreaterThanOrEqual(4);
    expect(res.body.tiers.some((t) => t.status === 'hidden')).toBe(true);
  });

  test('non-owner gets 404 (existence is hidden)', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/tiers`),
      STRANGER_ID,
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  test('without the audience_profile flag, owner gets 404 (feature invisible)', async () => {
    seedFlagOff();
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/tiers`),
      OWNER_ID,
    );
    expect(res.status).toBe(404);
  });

  test('persona id that does not exist returns 404', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/personas/55555555-5555-5555-5555-555555555555/tiers`),
      OWNER_ID,
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/personas/:id/tiers/:tierId
// ---------------------------------------------------------------------------
describe('PATCH /api/personas/:id/tiers/:tierId', () => {
  test('owner can update name, description, price_cents, msg_threads_per_period, reply_policy', async () => {
    const res = await asUser(
      request(buildApp()).patch(`/api/personas/${PERSONA_ID}/tiers/tier-2`),
      OWNER_ID,
    ).send({
      name: 'Renamed Member',
      description: 'New description',
      price_cents: 700,
      msg_threads_per_period: 10,
      reply_policy: 'within_3_days',
    });
    expect(res.status).toBe(200);
    expect(res.body.tier).toMatchObject({
      id: 'tier-2',
      rank: 2,
      name: 'Renamed Member',
      description: 'New description',
      priceCents: 700,
      msgThreadsPerPeriod: 10,
      replyPolicy: 'within_3_days',
    });

    // The IdentityAuditLog row was written.
    const audit = getTable('IdentityAuditLog');
    expect(audit.some((e) => e.action === 'persona_tier.update'
                          && e.target_id === 'tier-2')).toBe(true);
  });

  test('non-owner cannot update', async () => {
    const res = await asUser(
      request(buildApp()).patch(`/api/personas/${PERSONA_ID}/tiers/tier-2`),
      STRANGER_ID,
    ).send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
    const t = getTable('PersonaTier').find((t) => t.id === 'tier-2');
    expect(t.name).toBe('Member');
  });

  test('updating an unknown tier returns 404', async () => {
    const res = await asUser(
      request(buildApp()).patch(`/api/personas/${PERSONA_ID}/tiers/no-such-tier`),
      OWNER_ID,
    ).send({ name: 'Whatever' });
    expect(res.status).toBe(404);
  });

  test('Joi rejects an empty body with 400', async () => {
    const res = await asUser(
      request(buildApp()).patch(`/api/personas/${PERSONA_ID}/tiers/tier-2`),
      OWNER_ID,
    ).send({});
    expect(res.status).toBe(400);
  });

  test('Joi rejects an out-of-range reply_policy', async () => {
    const res = await asUser(
      request(buildApp()).patch(`/api/personas/${PERSONA_ID}/tiers/tier-2`),
      OWNER_ID,
    ).send({ reply_policy: 'whenever' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/personas/:id/tiers/:tierId/visibility
// ---------------------------------------------------------------------------
describe('PATCH /api/personas/:id/tiers/:tierId/visibility', () => {
  test('hiding rank 1 returns 400 (free Follower must always be active)', async () => {
    const res = await asUser(
      request(buildApp()).patch(`/api/personas/${PERSONA_ID}/tiers/tier-1/visibility`),
      OWNER_ID,
    ).send({ status: 'hidden' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/free Follower tier cannot be hidden/);

    const t = getTable('PersonaTier').find((t) => t.id === 'tier-1');
    expect(t.status).toBe('active');
  });

  test('hiding rank 2 succeeds and writes an audit row', async () => {
    const res = await asUser(
      request(buildApp()).patch(`/api/personas/${PERSONA_ID}/tiers/tier-2/visibility`),
      OWNER_ID,
    ).send({ status: 'hidden' });
    expect(res.status).toBe(200);
    expect(res.body.tier.status).toBe('hidden');

    const audit = getTable('IdentityAuditLog');
    expect(audit.some((e) => e.action === 'persona_tier.visibility_change'
                          && e.metadata?.status === 'hidden')).toBe(true);
  });

  test('archiving rank 3 succeeds', async () => {
    const res = await asUser(
      request(buildApp()).patch(`/api/personas/${PERSONA_ID}/tiers/tier-3/visibility`),
      OWNER_ID,
    ).send({ status: 'archived' });
    expect(res.status).toBe(200);
    expect(res.body.tier.status).toBe('archived');
  });

  test('Joi rejects unknown status values with 400', async () => {
    const res = await asUser(
      request(buildApp()).patch(`/api/personas/${PERSONA_ID}/tiers/tier-2/visibility`),
      OWNER_ID,
    ).send({ status: 'deleted' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/personas/:id/tiers/:tierId
// ---------------------------------------------------------------------------
describe('DELETE /api/personas/:id/tiers/:tierId', () => {
  test('deleting a tier with no members succeeds', async () => {
    seedTable('PersonaMembership', []);
    const res = await asUser(
      request(buildApp()).delete(`/api/personas/${PERSONA_ID}/tiers/tier-3`),
      OWNER_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(getTable('PersonaTier').some((t) => t.id === 'tier-3')).toBe(false);

    const audit = getTable('IdentityAuditLog');
    expect(audit.some((e) => e.action === 'persona_tier.delete'
                          && e.target_id === 'tier-3')).toBe(true);
  });

  test('deleting a tier with an active membership returns 409', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-active', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: 'tier-2',
      fan_handle: 'fan_aaaa', fan_handle_normalized: 'fan_aaaa',
      status: 'active',
    }]);
    const res = await asUser(
      request(buildApp()).delete(`/api/personas/${PERSONA_ID}/tiers/tier-2`),
      OWNER_ID,
    );
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'tier_has_active_members',
    });
    expect(getTable('PersonaTier').some((t) => t.id === 'tier-2')).toBe(true);
  });

  test('terminal-status memberships do not block deletion', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-expired', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: 'tier-2',
      fan_handle: 'fan_old', fan_handle_normalized: 'fan_old',
      status: 'expired',
    }]);
    const res = await asUser(
      request(buildApp()).delete(`/api/personas/${PERSONA_ID}/tiers/tier-2`),
      OWNER_ID,
    );
    expect(res.status).toBe(200);
    expect(getTable('PersonaTier').some((t) => t.id === 'tier-2')).toBe(false);
  });

  test('non-owner cannot delete', async () => {
    const res = await asUser(
      request(buildApp()).delete(`/api/personas/${PERSONA_ID}/tiers/tier-3`),
      STRANGER_ID,
    );
    expect(res.status).toBe(404);
    expect(getTable('PersonaTier').some((t) => t.id === 'tier-3')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/personas/:handle/tiers (public)
// ---------------------------------------------------------------------------
describe('GET /api/personas/:handle/tiers (public)', () => {
  test('returns active tiers without stripePriceId', async () => {
    // Anon — no x-test-user-id header (the verifyToken mock still sets
    // a default user, but this route uses optionalAuth and doesn't care).
    const res = await request(buildApp())
      .get(`/api/personas/${PERSONA_HANDLE}/tiers`);
    expect(res.status).toBe(200);
    expect(res.body.tiers).toHaveLength(3);
    expect(res.body.tiers.every((t) => !('stripePriceId' in t))).toBe(true);
    expect(res.body.tiers[0]).toMatchObject({
      rank: 1, name: 'Follower', priceCents: 0,
    });
  });

  test('hidden tiers are not returned to the public', async () => {
    seedTable('PersonaTier', getTable('PersonaTier').map((t) =>
      t.id === 'tier-3' ? { ...t, status: 'hidden' } : t,
    ));
    const res = await request(buildApp())
      .get(`/api/personas/${PERSONA_HANDLE}/tiers`);
    expect(res.status).toBe(200);
    expect(res.body.tiers).toHaveLength(2);
    expect(res.body.tiers.some((t) => t.rank === 3)).toBe(false);
  });

  test('unknown handle returns 404', async () => {
    const res = await request(buildApp())
      .get(`/api/personas/no-such-handle/tiers`);
    expect(res.status).toBe(404);
  });

  test('public route works without the audience_profile flag', async () => {
    // Design v2: viewing a persona's Beacon (tier ladder included)
    // is the entry point a fan needs BEFORE we can flip their flag
    // on. The public route must not require the flag.
    seedFlagOff();
    const res = await request(buildApp())
      .get(`/api/personas/${PERSONA_HANDLE}/tiers`);
    expect(res.status).toBe(200);
    expect(res.body.tiers).toHaveLength(3);
  });
});
