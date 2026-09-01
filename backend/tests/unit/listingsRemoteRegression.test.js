// ============================================================
// TEST: Listings Remote Regression
//
// Regression test: NULL-location listings must still be included
// in find_listings_nearby_v2 results (they are remote/locationless).
// ============================================================

const { resetTables, setRpcMock } = require('../__mocks__/supabaseAdmin');

// ── Mock logger ──────────────────────────────────────────────
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ── Mock verifyToken ─────────────────────────────────────────
jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = { id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa', role: 'user' };
  next();
});

// ── Mock notificationService ─────────────────────────────────
jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(),
}));

const express = require('express');
const request = require('supertest');

const LISTING_LOCAL = '11111111-1111-1111-8111-111111111111';
const LISTING_REMOTE = '22222222-2222-1222-8222-222222222222';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/listings', require('../../routes/listings'));
  return app;
}

// ============================================================
// TEST SUITE
// ============================================================
describe('Listings Remote Regression', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    resetTables();
  });

  it('should include NULL-location listings in nearby results', async () => {
    const localListing = {
      id: LISTING_LOCAL,
      title: 'Local Item',
      description: 'A nearby item',
      price: 25,
      is_free: false,
      category: 'electronics',
      status: 'active',
      user_id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa',
      created_at: '2026-01-15T00:00:00Z',
      distance_meters: 500,
      latitude: 37.78,
      longitude: -122.42,
      creator_name: 'Seller A',
      creator_username: 'sellera',
      profile_picture_url: null,
    };

    const remoteListing = {
      id: LISTING_REMOTE,
      title: 'Remote Service',
      description: 'A remote/locationless listing',
      price: 0,
      is_free: true,
      category: 'services',
      status: 'active',
      user_id: 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb',
      created_at: '2026-01-14T00:00:00Z',
      distance_meters: null,
      latitude: null,
      longitude: null,
      creator_name: 'Seller B',
      creator_username: 'sellerb',
      profile_picture_url: null,
    };

    let capturedParams = null;

    setRpcMock((rpcName, params) => {
      if (rpcName === 'find_listings_nearby_v2') {
        capturedParams = params;
        // Simulate the v2 RPC returning both local and NULL-location listings
        return { data: [localListing, remoteListing], error: null };
      }
      return { data: null, error: null };
    });

    // Seed Listing table for enrichWithCoordinates fallback lookup
    const { seedTable } = require('../__mocks__/supabaseAdmin');
    seedTable('Listing', [
      { id: LISTING_LOCAL, latitude: 37.78, longitude: -122.42 },
      { id: LISTING_REMOTE, latitude: null, longitude: null },
    ]);

    const res = await request(app)
      .get('/api/listings/nearby')
      .query({
        latitude: '37.7749',
        longitude: '-122.4194',
        radius: '16000',
      })
      .expect(200);

    // Both listings should be returned
    expect(res.body.listings).toBeDefined();
    expect(res.body.listings).toHaveLength(2);

    // The remote listing (NULL lat/lng) must be present
    const remote = res.body.listings.find(l => l.id === LISTING_REMOTE);
    expect(remote).toBeDefined();
    expect(remote.title).toBe('Remote Service');

    // The local listing should also be present
    const local = res.body.listings.find(l => l.id === LISTING_LOCAL);
    expect(local).toBeDefined();
    expect(local.distance_meters).toBe(500);

    // Verify the RPC was called (not bypassed)
    expect(capturedParams).toBeTruthy();
    expect(capturedParams.p_latitude).toBe(37.7749);
    expect(capturedParams.p_longitude).toBe(-122.4194);
  });

  it('honors radiusMiles for nearby listing search when radius meters is absent', async () => {
    let capturedParams = null;

    setRpcMock((rpcName, params) => {
      if (rpcName === 'find_listings_nearby_v2') {
        capturedParams = params;
        return { data: [], error: null };
      }
      return { data: null, error: null };
    });

    await request(app)
      .get('/api/listings/nearby')
      .query({
        latitude: '37.7749',
        longitude: '-122.4194',
        radiusMiles: '1000',
      })
      .expect(200);

    expect(capturedParams).toBeTruthy();
    expect(capturedParams.p_radius_meters).toBe(1609340);
  });

  it('keeps radius meters precedence over radiusMiles for nearby listing search', async () => {
    let capturedParams = null;

    setRpcMock((rpcName, params) => {
      if (rpcName === 'find_listings_nearby_v2') {
        capturedParams = params;
        return { data: [], error: null };
      }
      return { data: null, error: null };
    });

    await request(app)
      .get('/api/listings/nearby')
      .query({
        latitude: '37.7749',
        longitude: '-122.4194',
        radius: '16000',
        radiusMiles: '1000',
      })
      .expect(200);

    expect(capturedParams).toBeTruthy();
    expect(capturedParams.p_radius_meters).toBe(16000);
  });

  it('honors radiusMiles for location-aware listing search', async () => {
    let capturedParams = null;

    setRpcMock((rpcName, params) => {
      if (rpcName === 'find_listings_nearby_v2') {
        capturedParams = params;
        return { data: [], error: null };
      }
      return { data: null, error: null };
    });

    await request(app)
      .get('/api/listings/search')
      .query({
        q: 'lamp',
        latitude: '37.7749',
        longitude: '-122.4194',
        radiusMiles: '25',
      })
      .expect(200);

    expect(capturedParams).toBeTruthy();
    expect(capturedParams.p_radius_meters).toBe(40234);
  });
});
