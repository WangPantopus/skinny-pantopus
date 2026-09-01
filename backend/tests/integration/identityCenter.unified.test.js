/**
 * P2.6 — unified Profiles & Privacy backend response.
 *
 * Per unified-IA §8 + §8.3, GET /api/identity/center must return every
 * §8 section in a single response so the page can render in ≤10 seconds
 * with one round-trip:
 *   - personalProfile (LocalProfile)
 *   - homes (with role)
 *   - businessProfiles (with role)
 *   - audienceProfile (persona, or null)
 *   - bridges
 *   - blockCounts: { personal, audience }
 *   - personaCount
 *
 * The audience block count aggregates across every persona the user
 * owns; it never breaks down per-persona (would leak persona existence
 * via a count of 1 in the overview).
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
const HOME_ID = '11111111-1111-4111-8111-111111111111';
const PERSONA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PERSONA_ID_2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BLOCKED_USER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

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
    id: USER_ID, role: 'user', username: 'maya', email: 'maya@test.local',
    first_name: 'Maya', last_name: 'Builder', verified: true, account_type: 'individual',
  }]);
  seedTable('LocalProfile', [{
    id: 'lp-1', user_id: USER_ID, handle: 'maya', display_name: 'Maya Builds',
    audience_label: 'neighbors',
  }]);
}

beforeEach(() => {
  resetTables();
  seedBaseUser();
});

describe('P2.6 — GET /api/identity/center unified response shape', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  test('returns all unified-IA §8 fields including blockCounts and personaCount', async () => {
    seedTable('Home', [{ id: HOME_ID, name: 'Riverside Apt', city: 'Camas', state: 'WA' }]);
    // The supabase mock does not resolve foreign-key joins, so seed the
    // joined `home` shape directly on the occupancy row to mirror what
    // the real query returns.
    seedTable('HomeOccupancy', [{
      id: 'occ-1', home_id: HOME_ID, user_id: USER_ID,
      role: 'owner', role_base: 'owner', is_active: true,
      home: { id: HOME_ID, name: 'Riverside Apt', city: 'Camas', state: 'WA', primary_photo_url: null },
    }]);

    const res = await asUser(request(app).get('/api/identity'));
    expect(res.status).toBe(200);
    // Every §8 field must be present so the page can render in one tap.
    for (const field of [
      'privateAccount',
      'localProfile',
      'audienceProfile',
      'bridges',
      'homes',
      'businessProfiles',
      'personaCount',
      'blockCounts',
    ]) {
      expect(res.body).toHaveProperty(field);
    }
    expect(res.body.blockCounts).toEqual(expect.objectContaining({
      personal: expect.any(Number),
      audience: expect.any(Number),
    }));
  });

  test('personaCount is 0 + audienceProfile is null when the user has no persona', async () => {
    const res = await asUser(request(app).get('/api/identity'));
    expect(res.status).toBe(200);
    expect(res.body.personaCount).toBe(0);
    expect(res.body.audienceProfile).toBeNull();
    // No personas → audience block aggregator must short-circuit to 0
    // (no PersonaBlock query at all per the route's `if personaIds.length`).
    expect(res.body.blockCounts.audience).toBe(0);
  });

  test('blockCounts.audience aggregates across every persona the user owns', async () => {
    seedTable('PublicPersona', [
      { id: PERSONA_ID, user_id: USER_ID, handle: 'mayabuilds', handle_normalized: 'mayabuilds', display_name: 'Maya Builds', status: 'active' },
      { id: PERSONA_ID_2, user_id: USER_ID, handle: 'mayateaches', handle_normalized: 'mayateaches', display_name: 'Maya Teaches', status: 'active' },
    ]);
    seedTable('PersonaBlock', [
      { id: 'pb-1', persona_id: PERSONA_ID,   blocked_user_id: BLOCKED_USER, source: 'persona_owner_action' },
      { id: 'pb-2', persona_id: PERSONA_ID,   blocked_user_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', source: 'persona_owner_action' },
      { id: 'pb-3', persona_id: PERSONA_ID_2, blocked_user_id: BLOCKED_USER, source: 'chargeback' },
    ]);
    seedTable('UserBlock', [
      { id: 'ub-1', blocker_user_id: USER_ID, blocked_user_id: BLOCKED_USER },
    ]);

    const res = await asUser(request(app).get('/api/identity'));
    expect(res.status).toBe(200);
    // 2 personas → personaCount = 2; 3 PersonaBlock rows across both = 3.
    expect(res.body.personaCount).toBe(2);
    expect(res.body.blockCounts.audience).toBe(3);
    expect(res.body.blockCounts.personal).toBe(1);
    // §8.3 invariant: the response must NOT carry a per-persona
    // breakdown that would leak persona existence in the overview.
    expect(res.body.blockCounts).not.toHaveProperty('byPersona');
    expect(res.body.blockCounts).not.toHaveProperty('per_persona');
  });

  test('homes carry a role on each row so the unified UI can render the role pill', async () => {
    seedTable('Home', [{ id: HOME_ID, name: 'Riverside Apt', city: 'Camas', state: 'WA' }]);
    seedTable('HomeOccupancy', [{
      id: 'occ-1', home_id: HOME_ID, user_id: USER_ID,
      role: 'owner', role_base: 'owner', is_active: true,
      home: { id: HOME_ID, name: 'Riverside Apt', city: 'Camas', state: 'WA', primary_photo_url: null },
    }]);

    const res = await asUser(request(app).get('/api/identity'));
    expect(res.status).toBe(200);
    expect(res.body.homes).toHaveLength(1);
    expect(res.body.homes[0]).toEqual(expect.objectContaining({
      id: HOME_ID,
      role: 'owner',
    }));
  });
});
