/**
 * P0.1 — Collapse PersonaFollow into PersonaMembership.
 *
 * These tests exercise:
 *   1. The PersonaFollow → PersonaMembership view alias in the supabaseAdmin
 *      mock (read parity, write redirection, column projection).
 *   2. The route-level write paths in routes/personas.js, which now write
 *      directly to PersonaMembership and project the response back into the
 *      legacy follow shape.
 *   3. The privacy invariant: a generated fan_handle MUST NOT match the
 *      underlying User.username (fan_handles are random by construction).
 *   4. The PERSONA_FOLLOW_VIEW_ACTIVE startup guard.
 */

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { seedTable, getTable, resetTables } = supabaseAdmin;

const personasRouter = require('../../routes/personas');
const express = require('express');
const request = require('supertest');

const {
  isPersonaFollowViewActive,
  assertPersonaFollowViewActive,
} = require('../../utils/personaFollowViewGuard');
const { getPersonaFollow } = require('../../utils/identityProfiles');

const PERSONA_ID = '11111111-1111-1111-1111-111111111111';
const OWNER_ID = '22222222-2222-2222-2222-222222222222';
const FAN_ID = '33333333-3333-3333-3333-333333333333';
const FAN_USERNAME = 'fan_personal_username_123';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/personas', personasRouter);
  return app;
}

function asFan(req) {
  // The mocked verifyToken middleware reads req.user.id from the
  // x-test-user-id header.
  return req.set('x-test-user-id', FAN_ID);
}

function seedPersonaAndFan({ ownerId = OWNER_ID, fanId = FAN_ID } = {}) {
  seedTable('User', [
    { id: ownerId, username: 'owner_personal_handle' },
    { id: fanId, username: FAN_USERNAME },
  ]);
  seedTable('PublicPersona', [{
    id: PERSONA_ID,
    user_id: ownerId,
    handle: 'creator',
    handle_normalized: 'creator',
    display_name: 'Creator',
    audience_mode: 'open',
    status: 'active',
    follower_count: 0,
  }]);
  seedTable('LocalProfile', []);
  seedTable('PersonaMembership', []);
  seedTable('IdentityAuditLog', []);
}

describe('P0.1 — PersonaFollow / PersonaMembership view aliasing (mock)', () => {
  beforeEach(() => {
    resetTables();
  });

  test('seedTable("PersonaFollow", rows) actually populates PersonaMembership', () => {
    seedTable('PersonaFollow', [{
      id: 'aaaa1111-aaaa-1111-aaaa-111111111111',
      persona_id: PERSONA_ID,
      follower_user_id: FAN_ID,
      status: 'active',
      relationship_type: 'follower',
      source: 'self_follow',
      notification_level: 'all',
    }]);

    const memberships = getTable('PersonaMembership');
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      status: 'active',
      relationship_type: 'follower',
      tier_id: null,
    });
    // The seed had no follower_user_id-as-user_id mapping mistake.
    expect(memberships[0]).not.toHaveProperty('follower_user_id');
    // fan_handle defaulted in via the mock; it is a random fan_<hex> value.
    expect(memberships[0].fan_handle).toMatch(/^fan_[a-f0-9]+$/);
  });

  test('getTable("PersonaFollow") projects PersonaMembership rows as legacy follow rows', () => {
    seedTable('PersonaMembership', [{
      id: 'bbbb2222-bbbb-2222-bbbb-222222222222',
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      tier_id: null,
      fan_handle: 'fan_deadbeef',
      fan_handle_normalized: 'fan_deadbeef',
      status: 'active',
      relationship_type: 'follower',
      source: 'self_follow',
      notification_level: 'all',
      public_visibility: 'private',
      created_at: '2026-05-08T00:00:00Z',
      updated_at: '2026-05-08T00:00:00Z',
    }]);

    const follows = getTable('PersonaFollow');
    expect(follows).toHaveLength(1);
    expect(follows[0]).toMatchObject({
      persona_id: PERSONA_ID,
      follower_user_id: FAN_ID,
      status: 'active',
      relationship_type: 'follower',
    });
  });

  test('the view includes only rank-1 free memberships', () => {
    seedTable('PersonaTier', [
      { id: 'free-tier-id', persona_id: PERSONA_ID, rank: 1 },
      { id: 'paid-tier-id', persona_id: PERSONA_ID, rank: 2 },
    ]);
    seedTable('PersonaMembership', [
      {
        id: 'cccc3333-cccc-3333-cccc-333333333333',
        persona_id: PERSONA_ID,
        user_id: FAN_ID,
        tier_id: 'free-tier-id',
        fan_handle: 'fan_aaaa1111',
        fan_handle_normalized: 'fan_aaaa1111',
        status: 'active',
      },
      {
        id: 'dddd4444-dddd-4444-dddd-444444444444',
        persona_id: PERSONA_ID,
        user_id: 'other-fan-id',
        tier_id: 'paid-tier-id',
        fan_handle: 'fan_bbbb2222',
        fan_handle_normalized: 'fan_bbbb2222',
        status: 'active',
      },
    ]);

    const follows = getTable('PersonaFollow');
    expect(follows).toHaveLength(1);
    expect(follows.map((follow) => follow.follower_user_id))
      .toEqual([FAN_ID]);
  });

  test('explicit follow lookups still project paid memberships for access checks', async () => {
    seedTable('PersonaTier', [
      { id: 'paid-tier-id', persona_id: PERSONA_ID, rank: 2 },
    ]);
    seedTable('PersonaMembership', [{
      id: 'paid-membership-id',
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      tier_id: 'paid-tier-id',
      fan_handle: 'fan_paid1234',
      fan_handle_normalized: 'fan_paid1234',
      status: 'active',
    }]);

    expect(getTable('PersonaFollow')).toHaveLength(0);
    await expect(getPersonaFollow(PERSONA_ID, FAN_ID)).resolves.toMatchObject({
      id: 'paid-membership-id',
      follower_user_id: FAN_ID,
      relationship_type: 'subscriber',
      status: 'active',
    });
  });

  test('supabaseAdmin.from("PersonaFollow").eq("follower_user_id", x) translates to user_id filter', async () => {
    seedTable('PersonaMembership', [{
      id: 'eeee5555-eeee-5555-eeee-555555555555',
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      tier_id: null,
      fan_handle: 'fan_eeee5555',
      fan_handle_normalized: 'fan_eeee5555',
      status: 'active',
    }]);
    const { data } = await supabaseAdmin
      .from('PersonaFollow')
      .select('*')
      .eq('persona_id', PERSONA_ID)
      .eq('follower_user_id', FAN_ID)
      .maybeSingle();
    expect(data).toMatchObject({
      persona_id: PERSONA_ID,
      follower_user_id: FAN_ID,
      status: 'active',
    });
  });

  test('insert into PersonaFollow view writes through to PersonaMembership with column rename', async () => {
    const { data } = await supabaseAdmin
      .from('PersonaFollow')
      .insert({
        persona_id: PERSONA_ID,
        follower_user_id: FAN_ID,
        status: 'active',
        relationship_type: 'follower',
        source: 'self_follow',
        notification_level: 'all',
        public_visibility: 'private',
      })
      .select()
      .single();
    expect(data).toMatchObject({
      persona_id: PERSONA_ID,
      follower_user_id: FAN_ID,
      status: 'active',
    });
    const memberships = getTable('PersonaMembership');
    expect(memberships).toHaveLength(1);
    expect(memberships[0].user_id).toBe(FAN_ID);
    expect(memberships[0].tier_id).toBeNull();
    expect(memberships[0].fan_handle).toMatch(/^fan_[a-f0-9]+$/);
  });
});

describe('P0.1 — POST /api/personas/:id/follow writes to PersonaMembership', () => {
  beforeEach(() => {
    resetTables();
    seedPersonaAndFan();
  });

  test('creates a PersonaMembership row with a random fan_handle', async () => {
    const app = buildApp();
    const res = await asFan(request(app).post(`/api/personas/${PERSONA_ID}/follow`)).send({});

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'active',
      follow: expect.objectContaining({
        persona_id: PERSONA_ID,
        follower_user_id: FAN_ID,
        status: 'active',
      }),
    });

    const memberships = getTable('PersonaMembership');
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      tier_id: null,
      status: 'active',
    });
    expect(memberships[0].fan_handle).toMatch(/^fan_[a-f0-9]{8}$/);
  });

  test('the generated fan_handle does NOT equal the user.username', async () => {
    const app = buildApp();
    await request(app).post(`/api/personas/${PERSONA_ID}/follow`).send({});

    const memberships = getTable('PersonaMembership');
    expect(memberships).toHaveLength(1);
    const fanHandle = memberships[0].fan_handle;
    expect(fanHandle).not.toBe(FAN_USERNAME);
    expect(fanHandle).not.toContain(FAN_USERNAME);
  });

  test('the API response uses the legacy follower_user_id shape (back-compat)', async () => {
    const app = buildApp();
    const res = await asFan(request(app).post(`/api/personas/${PERSONA_ID}/follow`)).send({});
    expect(res.status).toBe(201);
    // Critical: the contract still names the audience-side identifier as
    // follower_user_id even though storage now lives on PersonaMembership.user_id.
    expect(res.body.follow).toHaveProperty('follower_user_id', FAN_ID);
    // And it does NOT leak the new fan_handle / fan_avatar_url / tier_id keys
    // that PR 1 will add to a future fan-list serializer.
    expect(res.body.follow).not.toHaveProperty('fan_handle');
    expect(res.body.follow).not.toHaveProperty('user_id');
    expect(res.body.follow).not.toHaveProperty('tier_id');
  });
});

describe('P0.1 — DELETE /api/personas/:id/follow removes the PersonaMembership row', () => {
  beforeEach(() => {
    resetTables();
    seedPersonaAndFan();
    seedTable('PersonaMembership', [{
      id: 'ffff6666-ffff-6666-ffff-666666666666',
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      tier_id: null,
      fan_handle: 'fan_ffff6666',
      fan_handle_normalized: 'fan_ffff6666',
      status: 'active',
      relationship_type: 'follower',
    }]);
  });

  test('unfollow deletes the membership row', async () => {
    const app = buildApp();
    const res = await asFan(request(app).delete(`/api/personas/${PERSONA_ID}/follow`));
    expect(res.status).toBe(200);
    expect(getTable('PersonaMembership')).toHaveLength(0);
  });

  test('unfollow refuses to delete a Stripe-backed paid membership', async () => {
    seedTable('PersonaTier', [
      { id: 'paid-tier-id', persona_id: PERSONA_ID, rank: 2, name: 'Member' },
    ]);
    seedTable('PersonaMembership', [{
      id: 'paid-membership-id',
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      tier_id: 'paid-tier-id',
      fan_handle: 'fan_paid9999',
      fan_handle_normalized: 'fan_paid9999',
      status: 'active',
      relationship_type: 'subscriber',
      stripe_subscription_id: 'sub_paid_123',
    }]);

    const app = buildApp();
    const res = await asFan(request(app).delete(`/api/personas/${PERSONA_ID}/follow`));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('paid_membership_managed_by_subscription');
    expect(getTable('PersonaMembership')).toHaveLength(1);
  });

  test('unfollow can delete a terminal paid membership row', async () => {
    seedTable('PersonaTier', [
      { id: 'paid-tier-id', persona_id: PERSONA_ID, rank: 2, name: 'Member' },
    ]);
    seedTable('PersonaMembership', [{
      id: 'expired-membership-id',
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      tier_id: 'paid-tier-id',
      fan_handle: 'fan_expired1',
      fan_handle_normalized: 'fan_expired1',
      status: 'expired',
      relationship_type: 'subscriber',
      stripe_subscription_id: 'sub_old_123',
    }]);

    const app = buildApp();
    const res = await asFan(request(app).delete(`/api/personas/${PERSONA_ID}/follow`));
    expect(res.status).toBe(200);
    expect(getTable('PersonaMembership')).toHaveLength(0);
  });
});

describe('P0.1 — PERSONA_FOLLOW_VIEW_ACTIVE startup guard', () => {
  test('default (unset) means the view is considered active', () => {
    expect(isPersonaFollowViewActive({})).toBe(true);
    expect(() => assertPersonaFollowViewActive({})).not.toThrow();
  });

  test('explicit true keeps startup happy', () => {
    expect(isPersonaFollowViewActive({ PERSONA_FOLLOW_VIEW_ACTIVE: 'true' })).toBe(true);
    expect(isPersonaFollowViewActive({ PERSONA_FOLLOW_VIEW_ACTIVE: '1' })).toBe(true);
    expect(() => assertPersonaFollowViewActive({ PERSONA_FOLLOW_VIEW_ACTIVE: 'true' })).not.toThrow();
  });

  test('explicit falsy values block startup with a clear error', () => {
    for (const v of ['false', '0', 'off', 'disabled']) {
      expect(isPersonaFollowViewActive({ PERSONA_FOLLOW_VIEW_ACTIVE: v })).toBe(false);
      expect(() => assertPersonaFollowViewActive({ PERSONA_FOLLOW_VIEW_ACTIVE: v }))
        .toThrow(/PersonaFollow view migration not complete/);
    }
  });
});
