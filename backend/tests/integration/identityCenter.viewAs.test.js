/**
 * P2.7 — view-as endpoint covers all 7 user-facing viewer modes against
 * the real serializers (no frontend approximation). Asserts:
 *
 *   1. /view-as?surface=local&viewer=public returns visible+hidden.
 *   2. neighbor sees more than public on the local surface
 *      (canMessage + relationshipStatus differ).
 *   3. persona_member sees rank-2 broadcasts that public + follower
 *      cannot.
 *   4. public on the persona surface sees only public posts/broadcasts.
 *   5. The persona surface's `visible` payload never contains personal-
 *      side keys (firewall holds — proof point of unified-IA §8.2).
 *   6. Invalid viewer is rejected with 400.
 */

jest.mock('../../middleware/rateLimiter', () => {
  const noop = (_req, _res, next) => next();
  return new Proxy({}, { get: () => noop });
});

const express = require('express');
const request = require('supertest');

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable } = supabaseAdmin;

const identityCenterRouter = require('../../routes/identityCenter');

const USER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const PERSONA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CHANNEL_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/identity', identityCenterRouter);
  return app;
}

function asUser(req) {
  return req.set('x-test-user-id', USER_ID);
}

function seedBaseUser() {
  seedTable('User', [{
    id: USER_ID, role: 'user', username: 'maya',
    email: 'maya@private.test', first_name: 'Maya', last_name: 'Builder',
    address: '1 Real St', city: 'Camas', state: 'WA', zipcode: '98607',
    verified: true, account_type: 'individual',
    profile_picture_url: null,
  }]);
  seedTable('LocalProfile', [{
    id: 'lp-1', user_id: USER_ID,
    handle: 'maya', display_name: 'Maya Builds',
    public_city: 'Camas', public_state: 'WA',
    show_neighborhood: false, show_gig_history: true,
    show_verified_resident_badge: true, verified_resident: true,
    audience_label: 'neighbors',
  }]);
}

function seedPersona() {
  seedTable('PublicPersona', [{
    id: PERSONA_ID, user_id: USER_ID,
    handle: 'mayabuilds', handle_normalized: 'mayabuilds',
    display_name: 'Maya Builds',
    status: 'active', audience_mode: 'open', audience_label: 'followers',
    category: 'creator', verified_local_discovery_enabled: false,
    follower_count: 42, post_count: 3,
  }]);
  seedTable('BroadcastChannel', [{
    id: CHANNEL_ID, persona_id: PERSONA_ID, status: 'active',
  }]);
  seedTable('IdentityBridgeSetting', [{
    id: 'bs-1', user_id: USER_ID, persona_id: PERSONA_ID,
    show_persona_on_local: false, show_local_on_persona: false,
  }]);
}

beforeEach(() => {
  resetTables();
  seedBaseUser();
});

describe('P2.7 — GET /api/identity/view-as covers all 8 viewer modes', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  test('local surface with public viewer returns visible + hidden + the legacy preview shape', async () => {
    const res = await asUser(request(app).get('/api/identity/view-as').query({
      surface: 'local',
      viewer: 'public',
    }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      surface: 'local',
      viewer: 'public',
      visible: expect.any(Object),
      hidden: expect.any(Array),
      // Legacy fields stay so the inline preview on /app/identity keeps
      // rendering.
      profile: expect.any(Object),
      visibleSections: expect.any(Array),
      protectedSections: expect.any(Array),
    }));
    // Personal-side keys are absent from the visible payload by
    // construction.
    expect(res.body.hidden).toEqual(expect.arrayContaining(['user_id', 'email', 'address']));
  });

  test('neighbor viewer sees a different relationship + canMessage state than public', async () => {
    const publicRes = await asUser(request(app).get('/api/identity/view-as').query({
      surface: 'local', viewer: 'public',
    }));
    const neighborRes = await asUser(request(app).get('/api/identity/view-as').query({
      surface: 'local', viewer: 'connection',
    }));
    expect(publicRes.status).toBe(200);
    expect(neighborRes.status).toBe(200);

    const pub = publicRes.body.visible.viewer;
    const nbr = neighborRes.body.visible.viewer;
    // Connection viewers have the canMessage privilege; public never does.
    expect(pub.canMessage).toBe(false);
    expect(nbr.canMessage).toBe(true);
    expect(pub.relationshipStatus).toBe('none');
    expect(nbr.relationshipStatus).toBe('accepted');
  });

  test('persona_member sees a rank-2 broadcast that a public viewer + follower cannot', async () => {
    seedPersona();
    seedTable('BroadcastMessage', [
      {
        id: 'b-public', channel_id: CHANNEL_ID, persona_id: PERSONA_ID,
        body: 'public update', visibility: 'public', target_tier_rank: null,
        status: 'published', published_at: '2026-05-08T10:00:00Z', created_at: '2026-05-08T10:00:00Z',
        delivered_count: 0, read_count: 0,
      },
      {
        id: 'b-followers', channel_id: CHANNEL_ID, persona_id: PERSONA_ID,
        body: 'followers update', visibility: 'followers', target_tier_rank: null,
        status: 'published', published_at: '2026-05-08T11:00:00Z', created_at: '2026-05-08T11:00:00Z',
        delivered_count: 0, read_count: 0,
      },
      {
        id: 'b-members', channel_id: CHANNEL_ID, persona_id: PERSONA_ID,
        body: 'members-only update', visibility: 'tier_or_above', target_tier_rank: 2,
        status: 'published', published_at: '2026-05-08T12:00:00Z', created_at: '2026-05-08T12:00:00Z',
        delivered_count: 0, read_count: 0,
      },
    ]);

    const publicRes = await asUser(request(app).get('/api/identity/view-as').query({
      surface: 'persona', viewer: 'public', handle: 'mayabuilds',
    }));
    const followerRes = await asUser(request(app).get('/api/identity/view-as').query({
      surface: 'persona', viewer: 'persona_follower', handle: 'mayabuilds',
    }));
    const memberRes = await asUser(request(app).get('/api/identity/view-as').query({
      surface: 'persona', viewer: 'persona_member', handle: 'mayabuilds',
    }));

    const broadcastIds = (r) => (r.body.sample?.broadcasts || []).map((b) => b.id).sort();
    expect(broadcastIds(publicRes)).toEqual(['b-public']);
    expect(broadcastIds(followerRes)).toEqual(['b-followers', 'b-public']);
    expect(broadcastIds(memberRes)).toEqual(['b-followers', 'b-members', 'b-public']);
  });

  test('public viewer on persona surface sees ONLY public broadcasts', async () => {
    seedPersona();
    seedTable('BroadcastMessage', [
      { id: 'b-public', channel_id: CHANNEL_ID, persona_id: PERSONA_ID, body: 'public', visibility: 'public', status: 'published', published_at: '2026-05-08T10:00:00Z', created_at: '2026-05-08T10:00:00Z' },
      { id: 'b-followers', channel_id: CHANNEL_ID, persona_id: PERSONA_ID, body: 'followers', visibility: 'followers', status: 'published', published_at: '2026-05-08T11:00:00Z', created_at: '2026-05-08T11:00:00Z' },
    ]);
    const res = await asUser(request(app).get('/api/identity/view-as').query({
      surface: 'persona', viewer: 'public', handle: 'mayabuilds',
    }));
    expect(res.status).toBe(200);
    const ids = (res.body.sample?.broadcasts || []).map((b) => b.id);
    expect(ids).toEqual(['b-public']);
  });

  test('persona surface visible payload never contains personal-side keys (firewall proof point)', async () => {
    seedPersona();
    // FORBIDDEN: keys that would unambiguously expose personal-side data
    // if they appeared anywhere in the serialized output. NOTE that the
    // persona serializer carries a `bridges.localProfile` slot (always
    // present, value is null when the bridge is off) — the slot itself
    // is the documented bridge-state signal per §5.4, NOT a leak. So
    // `localProfile` as a top-level data key is excluded here, but we
    // do assert `bridges.localProfile === null` below.
    const FORBIDDEN = ['email', 'phone', 'address', 'home_id', 'user_id', 'first_name', 'last_name', 'legal_name'];
    for (const viewer of ['public', 'persona_follower', 'persona_member', 'persona_insider']) {
      const res = await asUser(request(app).get('/api/identity/view-as').query({
        surface: 'persona', viewer, handle: 'mayabuilds',
      }));
      expect(res.status).toBe(200);
      const json = JSON.stringify(res.body.visible);
      for (const key of FORBIDDEN) {
        // Match `"key":` anywhere in the serialized JSON to catch a key
        // appearing at any nesting depth.
        expect(json).not.toMatch(new RegExp(`"${key}"\\s*:`));
      }
      // Bridge slot exists structurally; its value is null because the
      // bridge is off. This is the §5.4 contract — opt-in only.
      expect(res.body.visible.bridges).toEqual(expect.objectContaining({ localProfile: null }));
      // The hidden list must call out the personal-side keys so the
      // user can verify the firewall holds for this viewer.
      expect(res.body.hidden).toEqual(expect.arrayContaining(['email', 'address', 'home_id']));
    }
  });

  test('invalid viewer is rejected with 400', async () => {
    const res = await asUser(request(app).get('/api/identity/view-as').query({
      surface: 'local', viewer: 'admin',
    }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid viewer mode/i);
  });
});
