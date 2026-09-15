/**
 * Tests for the status sharing endpoints:
 *   POST /:gigId/share-status   (auth required)
 *   GET  /status/:token         (public)
 */

const db = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = db;

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
    _headers: {},
    set(name, value) { res._headers[name.toLowerCase()] = value; return res; },
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
      status_share_token: null, status_share_expires_at: null,
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
    const allowedKeys = ['title', 'status', 'helper_first_name', 'helper_eta_minutes', 'helper_location_updated_at', 'updated_at', 'expires_at'];
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


describe('existing status sharing current context', () => {
  const token = 'abcdef1234567890abcdef1234567890';
  const newerToken = '1234567890abcdef1234567890abcdef';
  const post = getHandler('post', '/:gigId/share-status'), read = getHandler('get', '/status/:token');
  beforeEach(() => {
    seedTable('Gig', [{ id: 'shared-gig', user_id: 'owner', accepted_by: 'worker', title: 'Shared task', status: 'assigned',
      status_share_token: token, status_share_expires_at: '2099-01-01T00:00:00Z', helper_eta_minutes: 12, updated_at: '2026-09-15T12:00:00Z' }]);
    seedTable('User', [{ id: 'worker', first_name: 'Helper' }]);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
  function interleave({ beforeUpdate, afterHelper } = {}) {
    const originalFrom = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = originalFrom(table), execute = query._execute.bind(query), update = query.update.bind(query);
      query._execute = () => {
        const result = structuredClone(execute());
        if (table === 'User' && afterHelper) { const change = afterHelper; afterHelper = null; change(); }
        return result;
      };
      query.update = value => { if (table === 'Gig' && beforeUpdate) { const change = beforeUpdate; beforeUpdate = null; change(); } return update(value); };
      return query;
    });
  }
  test.each(['owner', 'worker', 'deleted', 'newer-link'])('share command refuses post-read %s changes', async scenario => {
    let expected;
    interleave({ beforeUpdate: () => {
      if (scenario === 'deleted') seedTable('Gig', []);
      else Object.assign(getTable('Gig')[0], scenario === 'owner' ? { user_id: 'replacement' } : scenario === 'worker' ? { accepted_by: 'replacement' } : { status_share_token: newerToken });
      expected = structuredClone(getTable('Gig'));
    } });
    const res = mockRes(); await post(mockReq({ params: { gigId: 'shared-gig' }, user: { id: scenario === 'worker' ? 'worker' : 'owner' } }), res);
    expect(res._status).toBe(409); expect(res._json.share_url).toBeUndefined(); expect(getTable('Gig')).toEqual(expected);
  });
  test('public status rejects the exact expiry boundary', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') }); getTable('Gig')[0].status_share_expires_at = new Date().toISOString();
    const res = mockRes(); await read(mockReq({ params: { token } }), res); expect(res._status).toBe(404);
  });
  test.each(['expires', 'rotates', 'worker-changes'])('public status retires while its helper lookup %s', async scenario => {
    interleave({ afterHelper: () => Object.assign(getTable('Gig')[0], scenario === 'expires' ? { status_share_expires_at: '2000-01-01T00:00:00Z' } : scenario === 'rotates' ? { status_share_token: newerToken } : { accepted_by: 'replacement' }) });
    const res = mockRes(); await read(mockReq({ params: { token } }), res); expect(res._status).toBe(404);
  });
  test.each(['post', 'read'])('%s status lookup remains retryable when its database read fails', async mode => {
    const originalFrom = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => { const query = originalFrom(table); query._execute = () => ({ data: null, error: { message: 'Synthetic unavailable read' } }); return query; });
    const res = mockRes(); await (mode === 'post' ? post(mockReq({ params: { gigId: 'shared-gig' }, user: { id: 'owner' } }), res) : read(mockReq({ params: { token } }), res));
    expect(res._status).toBe(503); expect(res._json.title).toBeUndefined(); expect(res._json.share_url).toBeUndefined();
  });
  test.each(['post', 'read'])('%s status responses disable caching', async mode => {
    const res = mockRes(); await (mode === 'post' ? post(mockReq({ params: { gigId: 'shared-gig' }, user: { id: 'owner' } }), res) : read(mockReq({ params: { token } }), res));
    expect(res._status).toBe(200); expect(res._headers['cache-control']).toContain('no-store');
  });
});
