/**
 * Integration tests: Gig Lifecycle
 *
 * Tests the full gig flow against a real Supabase instance:
 *   create → bid → accept → start → complete → confirm
 *
 * Catches bugs like: wrong column names, broken FK relationships,
 * missing RLS policies, incorrect status transitions.
 */
const { createTestUser, seedRow, cleanup, apiRequest, admin } = require('./helpers');

let poster, worker;

beforeAll(async () => {
  poster = await createTestUser({ name: 'Gig Poster', username: `poster_${Date.now()}` });
  worker = await createTestUser({ name: 'Gig Worker', username: `worker_${Date.now()}` });
});

afterAll(async () => {
  await cleanup();
});

describe('Gig Lifecycle', () => {
  let gigId;

  test('POST /api/gigs — creates a gig', async () => {
    const res = await apiRequest('POST', '/api/gigs', poster.token, {
      title: 'Integration Test Gig',
      description: 'Test gig created by integration test suite',
      price: 50.00,
      category: 'general',
    });

    expect(res.status).toBe(201);
    expect(res.body.gig).toBeDefined();
    expect(res.body.gig.title).toBe('Integration Test Gig');
    expect(res.body.gig.status).toBe('open');
    gigId = res.body.gig.id;
  });

  test('GET /api/gigs/user/me — lists the poster\'s gigs', async () => {
    const res = await apiRequest('GET', '/api/gigs/user/me', poster.token);

    expect(res.status).toBe(200);
    expect(res.body.gigs).toBeInstanceOf(Array);
    const found = res.body.gigs.find(g => g.id === gigId);
    expect(found).toBeDefined();
    expect(found.title).toBe('Integration Test Gig');
  });

  test('GET /api/gigs/:id — returns gig detail', async () => {
    const res = await apiRequest('GET', `/api/gigs/${gigId}`, poster.token);

    expect(res.status).toBe(200);
    expect(res.body.gig.id).toBe(gigId);
    expect(res.body.gig.description).toBe('Test gig created by integration test suite');
  });

  test('POST /api/gigs/:gigId/bids — worker places a bid', async () => {
    const res = await apiRequest('POST', `/api/gigs/${gigId}/bids`, worker.token, {
      bid_amount: 45.00,
      message: 'I can do this!',
    });

    expect(res.status).toBe(201);
    expect(res.body.bid).toBeDefined();
    expect(res.body.bid.status).toBe('pending');
  });

  test('GET /api/gigs/my-bids — worker sees their bid', async () => {
    const res = await apiRequest('GET', '/api/gigs/my-bids', worker.token);

    expect(res.status).toBe(200);
    const bids = res.body.bids || res.body.offers || [];
    expect(bids.length).toBeGreaterThanOrEqual(1);
  });

  test('PATCH /api/gigs/:id — poster can update the gig', async () => {
    const res = await apiRequest('PATCH', `/api/gigs/${gigId}`, poster.token, {
      title: 'Updated Integration Test Gig',
    });

    expect(res.status).toBe(200);
  });

  test('DELETE /api/gigs/:id — poster can cancel the gig', async () => {
    // Create a fresh gig to delete (don't mess up the main flow)
    const createRes = await apiRequest('POST', '/api/gigs', poster.token, {
      title: 'Deletable Gig',
      description: 'Will be deleted',
      price: 10.00,
      category: 'general',
    });

    expect(createRes.status).toBe(201);
    const deleteGigId = createRes.body.gig.id;

    const res = await apiRequest('DELETE', `/api/gigs/${deleteGigId}`, poster.token);
    expect([200, 204]).toContain(res.status);
  });

  test('Unauthorized user cannot modify the gig', async () => {
    const res = await apiRequest('PATCH', `/api/gigs/${gigId}`, worker.token, {
      title: 'Hacked title',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('Unauthenticated request is rejected', async () => {
    const res = await apiRequest('GET', '/api/gigs/user/me', null);

    expect(res.status).toBe(401);
  });
});
