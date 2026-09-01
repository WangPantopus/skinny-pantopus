/**
 * Instagram-style place tags on Beacon (persona) posts.
 *
 * Beacon composers publish via POST /api/broadcast/channels/:id/messages.
 * An explicitly picked venue (latitude + longitude + location_name) is
 * intentional public disclosure and is written to the backing Post row
 * with location_precision 'approx_area'; identity-linking (home_id /
 * target_place_id / radius_miles) and GPS attestation (gps_*) columns
 * must NEVER be written on Beacon posts.
 *
 * Also pins the /api/posts side: the P2.4 persona firewall still rejects
 * postAs='persona' outright — the explicit-place-tag relaxation in
 * routes/posts.js is defense-in-depth behind that firewall, so a place
 * tag must not open a path through /api/posts.
 */

// Neutralize rate limiters (broadcastPublishLimiter shares in-memory
// state across tests in one process) — same idiom as
// tests/integration/posts.identityContext.test.js.
jest.mock('../../middleware/rateLimiter', () => {
  const noop = (_req, _res, next) => next();
  return new Proxy({}, { get: () => noop });
});

jest.mock('../../jobs/organicMatch', () => ({
  matchBusinessesForPost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/s3Service', () => ({
  getPublicUrl: jest.fn((key) => `https://cdn.example.com/${key}`),
}));

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;

const express = require('express');
const request = require('supertest');

const broadcastChannelsRouter = require('../../routes/broadcastChannels');
const postsRouter = require('../../routes/posts');

const OWNER_ID   = '11111111-1111-4111-8111-111111111111';
const PERSONA_ID = '66666666-6666-4666-8666-666666666666';
const CHANNEL_ID = '77777777-7777-4777-8777-777777777777';

const PLACE_TAG = {
  latitude: 45.5219,
  longitude: -122.6841,
  location_name: 'Blue Star Donuts',
  location_address: '1237 SW Washington St',
  place_id: 'poi.111',
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/broadcast', broadcastChannelsRouter);
  app.use('/api/posts', postsRouter);
  return app;
}

function asUser(req, userId) {
  return req.set('x-test-user-id', userId);
}

function publish(body) {
  return asUser(
    request(buildApp()).post(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
    OWNER_ID,
  ).send(body);
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  seedTable('User', [{ id: OWNER_ID, role: 'user', username: 'owner_handle' }]);
  seedTable('PublicPersona', [{
    id: PERSONA_ID, user_id: OWNER_ID,
    handle: 'mayabuilds', handle_normalized: 'mayabuilds',
    display_name: 'Maya Builds', audience_mode: 'open', status: 'active',
    audience_label: 'followers',
    follower_count: 0, post_count: 0,
  }]);
  seedTable('BroadcastChannel', [{
    id: CHANNEL_ID, persona_id: PERSONA_ID,
    title: 'Maya Updates', status: 'active',
  }]);
});

describe('POST /api/broadcast/channels/:channelId/messages — place tag', () => {
  test('publish WITH a place tag writes the location columns + approx_area', async () => {
    const res = await publish({ body: 'Live from the bakery', ...PLACE_TAG });

    expect(res.status).toBe(201);

    const stored = getTable('Post').find((m) => m.id === res.body.message.id);
    expect(stored.latitude).toBeCloseTo(45.5219);
    expect(stored.longitude).toBeCloseTo(-122.6841);
    expect(stored.effective_latitude).toBeCloseTo(45.5219);
    expect(stored.effective_longitude).toBeCloseTo(-122.6841);
    expect(stored.location_name).toBe('Blue Star Donuts');
    expect(stored.location_address).toBe('1237 SW Washington St');
    expect(stored.location_precision).toBe('approx_area');
    expect(stored.geocode_provider).toBe('mapbox');
    expect(stored.geocode_mode).toBe('temporary');
    expect(stored.geocode_place_id).toBe('poi.111');
    expect(stored.geocode_source_flow).toBe('broadcast_publish');
    expect(typeof stored.geocode_created_at).toBe('string');

    // Identity-linking + GPS attestation columns must never be written.
    expect(stored.home_id).toBeNull();
    expect(stored.target_place_id).toBeNull();
    expect(stored.radius_miles).toBeNull();
    expect(stored.gps_timestamp ?? null).toBeNull();
    expect(stored.gps_latitude ?? null).toBeNull();
    expect(stored.gps_longitude ?? null).toBeNull();

    // Serialized message surfaces the tag for broadcast history.
    expect(res.body.message.location_name).toBe('Blue Star Donuts');
    expect(res.body.message.location_address).toBe('1237 SW Washington St');
  });

  test('place_id and location_address are optional within a tag', async () => {
    const res = await publish({
      body: 'Tagged without provenance',
      latitude: PLACE_TAG.latitude,
      longitude: PLACE_TAG.longitude,
      location_name: PLACE_TAG.location_name,
    });

    expect(res.status).toBe(201);
    const stored = getTable('Post').find((m) => m.id === res.body.message.id);
    expect(stored.location_name).toBe('Blue Star Donuts');
    expect(stored.location_precision).toBe('approx_area');
    expect(stored.location_address).toBeNull();
    expect(stored.geocode_place_id).toBeNull();
    expect(stored.geocode_provider).toBe('mapbox');
  });

  test('publish WITHOUT a place tag keeps location columns null + precision none', async () => {
    const res = await publish({ body: 'No location on this one' });

    expect(res.status).toBe(201);

    const stored = getTable('Post').find((m) => m.id === res.body.message.id);
    expect(stored.latitude).toBeNull();
    expect(stored.longitude).toBeNull();
    expect(stored.effective_latitude).toBeNull();
    expect(stored.effective_longitude).toBeNull();
    expect(stored.location_name).toBeNull();
    expect(stored.location_address).toBeNull();
    expect(stored.location_precision).toBe('none');
    expect(stored.geocode_provider ?? null).toBeNull();
    expect(stored.geocode_place_id ?? null).toBeNull();

    expect(res.body.message.location_name).toBeNull();
    expect(res.body.message.location_address).toBeNull();
  });

  test('coords without location_name do not write a partial tag', async () => {
    const res = await publish({
      body: 'Coords but no venue name',
      latitude: PLACE_TAG.latitude,
      longitude: PLACE_TAG.longitude,
    });

    expect(res.status).toBe(201);
    const stored = getTable('Post').find((m) => m.id === res.body.message.id);
    expect(stored.latitude).toBeNull();
    expect(stored.longitude).toBeNull();
    expect(stored.location_name).toBeNull();
    expect(stored.location_precision).toBe('none');
  });

  test('whitespace-only location_name does not satisfy the tag (trimmed by Joi)', async () => {
    const res = await publish({
      body: 'Blank venue name',
      latitude: PLACE_TAG.latitude,
      longitude: PLACE_TAG.longitude,
      location_name: '   ',
    });

    expect(res.status).toBe(201);
    const stored = getTable('Post').find((m) => m.id === res.body.message.id);
    expect(stored.latitude).toBeNull();
    expect(stored.longitude).toBeNull();
    expect(stored.location_name).toBeNull();
    expect(stored.location_precision).toBe('none');
  });

  test('latitude without longitude is rejected (pairing rule)', async () => {
    const res = await publish({
      body: 'Half a coordinate',
      latitude: PLACE_TAG.latitude,
      location_name: PLACE_TAG.location_name,
    });

    expect(res.status).toBe(400);
  });

  test('out-of-range latitude is rejected', async () => {
    const res = await publish({ body: 'Bad tag', ...PLACE_TAG, latitude: 91 });
    expect(res.status).toBe(400);
  });

  test('unknown keys are still stripped by validation (schema behavior unchanged)', async () => {
    // middleware/validate.js runs Joi with stripUnknown: true, so unknown
    // keys are silently dropped — they never reach the insert.
    const res = await publish({ body: 'Sneaky field', bogus_field: 'x' });
    expect(res.status).toBe(201);
    const stored = getTable('Post').find((m) => m.id === res.body.message.id);
    expect(stored.bogus_field).toBeUndefined();
  });
});

describe('POST /api/posts — persona firewall vs. explicit place tag', () => {
  test('a place tag does not bypass the P2.4 persona firewall', async () => {
    const res = await asUser(request(buildApp()).post('/api/posts'), OWNER_ID).send({
      content: 'Beacon post trying the personal route',
      postType: 'general',
      postAs: 'persona',
      identityContextId: PERSONA_ID,
      latitude: PLACE_TAG.latitude,
      longitude: PLACE_TAG.longitude,
      locationName: PLACE_TAG.location_name,
      locationAddress: PLACE_TAG.location_address,
      geocodePlaceId: PLACE_TAG.place_id,
      geocodeProvider: 'mapbox',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('wrong_post_route');
    expect(getTable('Post')).toHaveLength(0);
  });
});
