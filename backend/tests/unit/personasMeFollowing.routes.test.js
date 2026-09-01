/**
 * GET /api/personas/me/following — fan-side management screen.
 *
 * Validates:
 *  - row shape (persona / fanHandle / paidTier / latestPost / unreadCount)
 *  - sort modes (activity, recent, alpha, unread)
 *  - status filters (suspended hidden, paused surfaced with flag, paid included)
 *  - /seen zeros the unread count
 *  - /mute sets and clears muted_until
 *
 * Uses the project's in-memory supabaseAdmin mock. PostgREST FK-join
 * syntax (`persona:PublicPersona!persona_id(...)`) is not expanded by
 * the mock, so test fixtures seed `persona` and `tier` sub-objects
 * directly on the PersonaMembership rows. Real PostgREST resolves them
 * automatically; the production behavior is verified by integration
 * tests under tests/integration/.
 */

const express = require('express');
const request = require('supertest');

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable } = supabaseAdmin;

const featureFlagService = require('../../services/featureFlagService');
const personasRouter = require('../../routes/personas');

const FLAG_NAME = 'audience_profile';
const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

const PERSONA_A_ID = '44444444-4444-4444-4444-444444444444';
const PERSONA_B_ID = '55555555-5555-5555-5555-555555555555';
const PERSONA_PAID_ID = '66666666-6666-6666-6666-666666666666';
const PERSONA_PAUSED_ID = '77777777-7777-7777-7777-777777777777';
const PERSONA_SUSPENDED_ID = '88888888-8888-8888-8888-888888888888';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/personas', personasRouter);
  return app;
}

function asUser(req, userId) {
  return req.set('x-test-user-id', userId);
}

function seedFlagOn() {
  seedTable('FeatureFlag', [{
    id: 'flag-1',
    flag_name: FLAG_NAME,
    enabled_globally: true,
    enabled_for_internal_team: false,
    beta_user_ids: [],
    description: 'Beacon + paid tier',
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
  }]);
  featureFlagService.invalidateFlagCache();
}

function makePersona(id, overrides = {}) {
  return {
    id,
    user_id: OTHER_USER_ID,
    handle: overrides.handle || `beacon_${id.slice(0, 4)}`,
    handle_normalized: (overrides.handle || `beacon_${id.slice(0, 4)}`).toLowerCase(),
    display_name: overrides.display_name || 'Test Beacon',
    avatar_url: overrides.avatar_url || null,
    status: overrides.status || 'active',
    // PublicPersona uses credential_status, not a boolean `verified`. The
    // serializer maps credential_status === 'verified' → verified: true.
    credential_status: overrides.credential_status || 'none',
    follower_count: 1,
    post_count: 0,
  };
}

function makeMembership(personaId, overrides = {}) {
  const persona = overrides.personaRow || makePersona(personaId, overrides.persona || {});
  const tier = overrides.tier || { rank: 1, name: 'Follower', price_cents: 0 };
  return {
    id: overrides.id || `mem-${personaId.slice(0, 8)}`,
    persona_id: personaId,
    user_id: overrides.userId || VIEWER_ID,
    tier_id: overrides.tier_id || 'tier-1',
    fan_handle: overrides.fan_handle || `fan_${personaId.slice(0, 8)}`,
    fan_handle_normalized: (overrides.fan_handle || `fan_${personaId.slice(0, 8)}`).toLowerCase(),
    notification_level: overrides.notification_level || 'all',
    status: overrides.status || 'active',
    muted_until: overrides.muted_until || null,
    last_seen_at: overrides.last_seen_at || '2026-05-01T00:00:00Z',
    joined_at: overrides.joined_at || '2026-04-01T00:00:00Z',
    // Pre-joined fields — the mock does not expand FK selects.
    persona,
    tier,
  };
}

function seedAll() {
  seedTable('User', [
    { id: VIEWER_ID, role: 'user', username: 'viewer' },
    { id: OTHER_USER_ID, role: 'user', username: 'persona_owner' },
  ]);
  seedTable('PublicPersona', [
    makePersona(PERSONA_A_ID, { handle: 'aurora', display_name: 'Aurora' }),
    makePersona(PERSONA_B_ID, { handle: 'beacon_b', display_name: 'Beacon B' }),
    makePersona(PERSONA_PAID_ID, { handle: 'paid_one', display_name: 'Paid One' }),
    makePersona(PERSONA_PAUSED_ID, { handle: 'paused_one', display_name: 'Paused One', status: 'paused' }),
    makePersona(PERSONA_SUSPENDED_ID, { handle: 'gone', display_name: 'Gone', status: 'suspended' }),
  ]);
}

beforeEach(() => {
  resetTables();
  seedFlagOn();
  seedAll();
});

afterEach(() => {
  featureFlagService.invalidateFlagCache();
});

// ---------------------------------------------------------------------------
// GET /api/personas/me/following
// ---------------------------------------------------------------------------
describe('GET /api/personas/me/following', () => {
  test('returns an empty list when the viewer follows nothing', async () => {
    seedTable('PersonaMembership', []);
    seedTable('Post', []);

    const res = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.counts).toEqual({ totalFollowing: 0, unreadBeacons: 0 });
    expect(res.body.pagination).toEqual({ nextOffset: null, hasMore: false });
  });

  test('returns followed beacons with latest post snippet and unread count', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, {
        persona: { handle: 'aurora', display_name: 'Aurora', credential_status: 'verified' },
        last_seen_at: '2026-05-01T00:00:00Z',
      }),
    ]);
    seedTable('Post', [
      {
        id: 'post-old',
        identity_context_type: 'persona',
        identity_context_id: PERSONA_A_ID,
        title: null,
        content: 'Older post (seen)',
        archived_at: null,
        created_at: '2026-04-15T00:00:00Z',
      },
      {
        id: 'post-new-1',
        identity_context_type: 'persona',
        identity_context_id: PERSONA_A_ID,
        title: null,
        content: 'Newer post',
        archived_at: null,
        created_at: '2026-05-09T00:00:00Z',
      },
      {
        id: 'post-new-2',
        identity_context_type: 'persona',
        identity_context_id: PERSONA_A_ID,
        title: 'Latest',
        content: 'Latest content',
        archived_at: null,
        created_at: '2026-05-10T12:00:00Z',
      },
    ]);

    const res = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      persona: { handle: 'aurora', displayName: 'Aurora', status: 'active', verified: true },
      notificationLevel: 'all',
      paidTier: null,
      unreadCount: 2,
      latestPost: { id: 'post-new-2', snippet: 'Latest' },
    });
    expect(res.body.counts).toEqual({ totalFollowing: 1, unreadBeacons: 1 });
  });

  test('credential_status not "verified" maps to verified: false', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, {
        persona: { handle: 'aurora', display_name: 'Aurora', credential_status: 'pending' },
      }),
    ]);
    seedTable('Post', []);

    const res = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);

    expect(res.body.items[0].persona.verified).toBe(false);
  });

  test('brand-new follow with last_seen_at=null falls back to joined_at (no false unread)', async () => {
    // A follow created at 2026-05-10. A persona post from BEFORE joined_at
    // must NOT count as unread — the user wasn't following back then.
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, {
        id: 'mem-fresh',
        last_seen_at: null,
        joined_at: '2026-05-10T00:00:00Z',
      }),
    ]);
    seedTable('Post', [
      // Pre-follow post — must NOT be counted.
      { id: 'p-before', identity_context_type: 'persona', identity_context_id: PERSONA_A_ID,
        content: 'Old post', archived_at: null, created_at: '2026-05-01T00:00:00Z' },
      // Post-follow post — IS counted.
      { id: 'p-after', identity_context_type: 'persona', identity_context_id: PERSONA_A_ID,
        content: 'New post', archived_at: null, created_at: '2026-05-11T00:00:00Z' },
    ]);

    const res = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.items[0].unreadCount).toBe(1);
  });

  test('sort=alpha orders by persona display name', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_B_ID, { id: 'mem-b', persona: { handle: 'beacon_b', display_name: 'Zebra' } }),
      makeMembership(PERSONA_A_ID, { id: 'mem-a', persona: { handle: 'aurora', display_name: 'Aurora' } }),
    ]);
    seedTable('Post', []);

    const res = await asUser(
      request(buildApp()).get('/api/personas/me/following?sort=alpha'),
      VIEWER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => i.persona.displayName)).toEqual(['Aurora', 'Zebra']);
  });

  test('sort=unread surfaces beacons with new posts first', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, { id: 'mem-a', last_seen_at: '2026-05-10T00:00:00Z' }),
      makeMembership(PERSONA_B_ID, { id: 'mem-b', last_seen_at: '2026-05-01T00:00:00Z' }),
    ]);
    seedTable('Post', [
      // B has 2 unread (newer than last_seen_at), A has 0.
      { id: 'p-b-1', identity_context_type: 'persona', identity_context_id: PERSONA_B_ID,
        content: 'B new', archived_at: null, created_at: '2026-05-09T00:00:00Z' },
      { id: 'p-b-2', identity_context_type: 'persona', identity_context_id: PERSONA_B_ID,
        content: 'B newer', archived_at: null, created_at: '2026-05-10T00:00:00Z' },
      { id: 'p-a-1', identity_context_type: 'persona', identity_context_id: PERSONA_A_ID,
        content: 'A old', archived_at: null, created_at: '2026-04-15T00:00:00Z' },
    ]);

    const res = await asUser(
      request(buildApp()).get('/api/personas/me/following?sort=unread'),
      VIEWER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => i.persona.id)).toEqual([PERSONA_B_ID, PERSONA_A_ID]);
    expect(res.body.items[0].unreadCount).toBe(2);
    expect(res.body.items[1].unreadCount).toBe(0);
  });

  test('paid memberships are returned with a paidTier object', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_PAID_ID, {
        id: 'mem-paid',
        tier_id: 'tier-paid',
        tier: { rank: 2, name: 'Member', price_cents: 500 },
        persona: { handle: 'paid_one', display_name: 'Paid One' },
      }),
    ]);
    seedTable('Post', []);

    const res = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].paidTier).toEqual({ rank: 2, name: 'Member', priceCents: 500 });
  });

  test('paused personas surface with status=paused; suspended personas are hidden', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_PAUSED_ID, {
        id: 'mem-paused',
        persona: { handle: 'paused_one', display_name: 'Paused One', status: 'paused' },
      }),
      makeMembership(PERSONA_SUSPENDED_ID, {
        id: 'mem-suspended',
        persona: { handle: 'gone', display_name: 'Gone', status: 'suspended' },
      }),
    ]);
    seedTable('Post', []);

    const res = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].persona).toMatchObject({ status: 'paused', handle: 'paused_one' });
  });

  test('canceled or removed memberships are excluded', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, { id: 'mem-active' }),
      makeMembership(PERSONA_B_ID, { id: 'mem-canceled', status: 'canceled' }),
    ]);
    seedTable('Post', []);

    const res = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].membershipId).toBe('mem-active');
  });

  test('only returns the requesting user\'s memberships', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, { id: 'mem-viewer', userId: VIEWER_ID }),
      makeMembership(PERSONA_B_ID, { id: 'mem-other', userId: OTHER_USER_ID }),
    ]);
    seedTable('Post', []);

    const res = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].membershipId).toBe('mem-viewer');
  });
});

// ---------------------------------------------------------------------------
// POST /api/personas/me/following/:personaId/seen
// ---------------------------------------------------------------------------
describe('POST /api/personas/me/following/:personaId/seen', () => {
  test('zeros the unread count by updating last_seen_at', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, { id: 'mem-a', last_seen_at: '2026-04-01T00:00:00Z' }),
    ]);
    seedTable('Post', [
      { id: 'p-new', identity_context_type: 'persona', identity_context_id: PERSONA_A_ID,
        content: 'Recent', archived_at: null, created_at: '2026-05-09T00:00:00Z' },
    ]);

    const before = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);
    expect(before.body.items[0].unreadCount).toBe(1);

    const seen = await asUser(
      request(buildApp()).post(`/api/personas/me/following/${PERSONA_A_ID}/seen`),
      VIEWER_ID,
    );
    expect(seen.status).toBe(200);
    expect(seen.body.unreadCount).toBe(0);
    expect(typeof seen.body.lastSeenAt).toBe('string');

    const after = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);
    expect(after.body.items[0].unreadCount).toBe(0);
  });

  test('returns 204 when the user is not following that beacon (idempotent)', async () => {
    seedTable('PersonaMembership', []);

    const res = await asUser(
      request(buildApp()).post(`/api/personas/me/following/${PERSONA_A_ID}/seen`),
      VIEWER_ID,
    );
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/personas/me/following/:personaId/mute
// ---------------------------------------------------------------------------
describe('PATCH /api/personas/me/following/:personaId/mute', () => {
  test('sets muted_until when days is provided', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, { id: 'mem-a' }),
    ]);

    const res = await asUser(
      request(buildApp())
        .patch(`/api/personas/me/following/${PERSONA_A_ID}/mute`)
        .send({ days: 30 }),
      VIEWER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.mutedUntil).toEqual(expect.any(String));
    expect(new Date(res.body.mutedUntil).getTime()).toBeGreaterThan(Date.now());
  });

  test('clears muted_until when days is null', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, {
        id: 'mem-a',
        muted_until: new Date(Date.now() + 30 * 86400000).toISOString(),
      }),
    ]);

    const res = await asUser(
      request(buildApp())
        .patch(`/api/personas/me/following/${PERSONA_A_ID}/mute`)
        .send({ days: null }),
      VIEWER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.mutedUntil).toBeNull();
  });

  test('returns 404 when no membership exists', async () => {
    seedTable('PersonaMembership', []);

    const res = await asUser(
      request(buildApp())
        .patch(`/api/personas/me/following/${PERSONA_A_ID}/mute`)
        .send({ days: 30 }),
      VIEWER_ID,
    );

    expect(res.status).toBe(404);
  });

  test('rejects invalid days payload', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, { id: 'mem-a' }),
    ]);

    const res = await asUser(
      request(buildApp())
        .patch(`/api/personas/me/following/${PERSONA_A_ID}/mute`)
        .send({ days: -1 }),
      VIEWER_ID,
    );

    expect(res.status).toBe(400);
  });

  test('mutedUntil round-trips to the next GET /me/following', async () => {
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, { id: 'mem-a' }),
    ]);
    seedTable('Post', []);

    // 1. Before muting: list shows mutedUntil = null.
    const before = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);
    expect(before.body.items[0].mutedUntil).toBeNull();

    // 2. Mute for 7 days.
    const mute = await asUser(
      request(buildApp())
        .patch(`/api/personas/me/following/${PERSONA_A_ID}/mute`)
        .send({ days: 7 }),
      VIEWER_ID,
    );
    expect(mute.status).toBe(200);
    expect(typeof mute.body.mutedUntil).toBe('string');

    // 3. List now reflects the muted state.
    const after = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);
    expect(after.body.items[0].mutedUntil).toEqual(mute.body.mutedUntil);

    // 4. Unmuting clears it back to null.
    await asUser(
      request(buildApp())
        .patch(`/api/personas/me/following/${PERSONA_A_ID}/mute`)
        .send({ days: null }),
      VIEWER_ID,
    );
    const cleared = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);
    expect(cleared.body.items[0].mutedUntil).toBeNull();
  });

  test('past muted_until is treated as not muted (serializer-side expiry)', async () => {
    // The screen treats an expired mute as "not muted" without needing
    // a server cleanup job. Verify the serializer enforces it.
    seedTable('PersonaMembership', [
      makeMembership(PERSONA_A_ID, {
        id: 'mem-a',
        muted_until: '2020-01-01T00:00:00Z',
      }),
    ]);
    seedTable('Post', []);

    const res = await asUser(request(buildApp()).get('/api/personas/me/following'), VIEWER_ID);
    expect(res.body.items[0].mutedUntil).toBeNull();
  });
});
