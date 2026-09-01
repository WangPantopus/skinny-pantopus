/**
 * Tests for the status sharing endpoints:
 *   POST /:gigId/share-status   (auth required)
 *   GET  /status/:token         (public)
 */

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

const router = require('../routes/gigsV2');

// Extract route handlers from Express router stack
function getHandler(method, pathPattern) {
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.methods[method] &&
      layer.route.path === pathPattern
    ) {
      const handlers = layer.route.stack.filter(s => s.method === method);
      return handlers[handlers.length - 1].handle;
    }
  }
  throw new Error(`No handler found for ${method.toUpperCase()} ${pathPattern}`);
}

function mockReq(overrides = {}) {
  return {
    params: {},
    body: {},
    user: { id: 'user-1' },
    app: { get: () => null },
    ...overrides,
  };
}

function mockRes() {
  const res = {
    _status: null,
    _json: null,
    status(code) { res._status = code; return res; },
    json(data) { res._json = data; return res; },
  };
  return res;
}

beforeEach(() => resetTables());

// =====================================================================
//  POST /:gigId/share-status
// =====================================================================

describe('POST /:gigId/share-status', () => {
  const handler = getHandler('post', '/:gigId/share-status');
  const gigId = 'gig-200';
  const posterId = 'poster-1';
  const helperId = 'helper-1';

  function seedAssignedGig() {
    seedTable('Gig', [{
      id: gigId,
      user_id: posterId,
      accepted_by: helperId,
      status: 'assigned',
      title: 'Fix my sink',
    }]);
  }

  test('should generate share link with valid token (poster)', async () => {
    seedAssignedGig();

    const req = mockReq({ params: { gigId }, user: { id: posterId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.share_url).toMatch(/\/status\/[a-f0-9]{32}$/);
    expect(res._json.expires_at).toBeDefined();

    // Verify token stored in DB
    const gig = getTable('Gig').find(g => g.id === gigId);
    expect(gig.status_share_token).toBeDefined();
    expect(gig.status_share_token).toHaveLength(32);
    expect(gig.status_share_expires_at).toBeDefined();
  });

  test('should allow helper to generate share link', async () => {
    seedAssignedGig();

    const req = mockReq({ params: { gigId }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.share_url).toMatch(/\/status\//);
  });

  test('should reject unauthorized user', async () => {
    seedAssignedGig();

    const req = mockReq({ params: { gigId }, user: { id: 'stranger' } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(403);
  });

  test('should return 404 for nonexistent gig', async () => {
    const req = mockReq({ params: { gigId: 'no-such-gig' }, user: { id: posterId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(404);
  });
});

// =====================================================================
//  GET /status/:token
// =====================================================================

describe('GET /status/:token', () => {
  const handler = getHandler('get', '/status/:token');
  const gigId = 'gig-300';
  const token = 'abcdef1234567890abcdef1234567890';

  function seedGigWithToken(overrides = {}) {
    seedTable('Gig', [{
      id: gigId,
      title: 'Walk my dog',
      status: 'assigned',
      helper_eta_minutes: 12,
      updated_at: '2026-03-06T10:00:00Z',
      status_share_token: token,
      status_share_expires_at: new Date(Date.now() + 86400000).toISOString(), // 24h from now
      accepted_by: 'helper-1',
      ...overrides,
    }]);
    seedTable('User', [{
      id: 'helper-1',
      first_name: 'Alice',
    }]);
  }

  test('should return sanitized status for valid token', async () => {
    seedGigWithToken();

    const req = mockReq({ params: { token } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.title).toBe('Walk my dog');
    expect(res._json.status).toBe('assigned');
    expect(res._json.helper_first_name).toBe('Alice');
    expect(res._json.helper_eta_minutes).toBe(12);
    expect(res._json.updated_at).toBeDefined();
  });

  test('should NOT include user_id, address, or payment info in public response', async () => {
    seedGigWithToken();

    const req = mockReq({ params: { token } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);

    // Verify NO sensitive fields
    const json = res._json;
    expect(json.user_id).toBeUndefined();
    expect(json.accepted_by).toBeUndefined();
    expect(json.id).toBeUndefined();
    expect(json.address).toBeUndefined();
    expect(json.exact_location).toBeUndefined();
    expect(json.payment_id).toBeUndefined();
    expect(json.payment_status).toBeUndefined();
    expect(json.stripe_payment_intent_id).toBeUndefined();
    expect(json.price).toBeUndefined();

    // Only allowed fields
    const allowedKeys = ['title', 'status', 'helper_first_name', 'helper_eta_minutes', 'updated_at'];
    expect(Object.keys(json).sort()).toEqual(allowedKeys.sort());
  });

  test('should return 404 for expired token', async () => {
    seedGigWithToken({
      status_share_expires_at: new Date(Date.now() - 1000).toISOString(), // expired
    });

    const req = mockReq({ params: { token } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(404);
    expect(res._json.error).toMatch(/expired/i);
  });

  test('should return 404 for invalid/nonexistent token', async () => {
    // No gig seeded

    const req = mockReq({ params: { token: 'invalid-token' } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(404);
  });

  test('should return null helper_first_name when no helper assigned', async () => {
    seedTable('Gig', [{
      id: gigId,
      title: 'Test gig',
      status: 'open',
      helper_eta_minutes: null,
      updated_at: '2026-03-06T10:00:00Z',
      status_share_token: token,
      status_share_expires_at: new Date(Date.now() + 86400000).toISOString(),
      accepted_by: null,
    }]);

    const req = mockReq({ params: { token } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.helper_first_name).toBeNull();
  });
});
