// ============================================================
// TEST: verifyToken – Role Cache (AUTH-3.4)
//
// Tests the in-memory role cache: hit, TTL expiry, invalidation,
// and max-size eviction.
// ============================================================

const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');
const verifyToken = require('../../middleware/verifyToken');
const { invalidateRoleCache, _roleCache } = require('../../middleware/verifyToken');

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/test',
    headers: {},
    cookies: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

beforeEach(() => {
  resetTables();
  _roleCache.clear();
});

describe('verifyToken role cache (AUTH-3.4)', () => {
  test('caches role after first request — second request uses cache without DB query', async () => {
    // Seed a user with 'admin' role
    seedTable('User', [{ id: 'mock-user-id', role: 'admin', email: 'a@b.com' }]);

    const req1 = mockReq({ cookies: { pantopus_access: 'token-1' } });
    const res1 = mockRes();
    const next1 = jest.fn();
    await verifyToken(req1, res1, next1);

    expect(next1).toHaveBeenCalled();
    expect(req1.user.role).toBe('admin');
    expect(_roleCache.has('mock-user-id')).toBe(true);

    // Clear the DB table — if cache works, role should still be 'admin'
    resetTables();

    const req2 = mockReq({ cookies: { pantopus_access: 'token-2' } });
    const res2 = mockRes();
    const next2 = jest.fn();
    await verifyToken(req2, res2, next2);

    expect(next2).toHaveBeenCalled();
    expect(req2.user.role).toBe('admin'); // from cache, not DB
  });

  test('expired cache entry triggers fresh DB query', async () => {
    // Seed admin role
    seedTable('User', [{ id: 'mock-user-id', role: 'admin', email: 'a@b.com' }]);

    const req1 = mockReq({ cookies: { pantopus_access: 'token-1' } });
    await verifyToken(req1, mockRes(), jest.fn());
    expect(req1.user.role).toBe('admin');

    // Manually expire the cache entry
    const entry = _roleCache.get('mock-user-id');
    entry.ts = Date.now() - 120_000; // 2 minutes ago

    // Change role in DB
    resetTables();
    seedTable('User', [{ id: 'mock-user-id', role: 'user', email: 'a@b.com' }]);

    const req2 = mockReq({ cookies: { pantopus_access: 'token-2' } });
    await verifyToken(req2, mockRes(), jest.fn());
    expect(req2.user.role).toBe('user'); // fresh from DB
  });

  test('invalidateRoleCache forces fresh DB query on next request', async () => {
    seedTable('User', [{ id: 'mock-user-id', role: 'admin', email: 'a@b.com' }]);

    const req1 = mockReq({ cookies: { pantopus_access: 'token-1' } });
    await verifyToken(req1, mockRes(), jest.fn());
    expect(req1.user.role).toBe('admin');
    expect(_roleCache.has('mock-user-id')).toBe(true);

    // Invalidate and change role
    invalidateRoleCache('mock-user-id');
    expect(_roleCache.has('mock-user-id')).toBe(false);

    resetTables();
    seedTable('User', [{ id: 'mock-user-id', role: 'user', email: 'a@b.com' }]);

    const req2 = mockReq({ cookies: { pantopus_access: 'token-2' } });
    await verifyToken(req2, mockRes(), jest.fn());
    expect(req2.user.role).toBe('user'); // fresh from DB after invalidation
  });

  test('cache evicts oldest entry when max size is reached', () => {
    // Directly test the cache map eviction behavior
    // Fill cache to max (1000 entries)
    for (let i = 0; i < 1000; i++) {
      _roleCache.set(`user-${i}`, { role: 'user', ts: Date.now() });
    }
    expect(_roleCache.size).toBe(1000);
    expect(_roleCache.has('user-0')).toBe(true);

    // The verifyToken setCachedRole checks size before inserting.
    // We simulate by adding one more entry — oldest should be evicted.
    // Since we can't easily call setCachedRole (it's internal), test via
    // a verifyToken call that caches a new user.
    // But the mock getUser always returns 'mock-user-id', so let's just
    // verify the Map-based eviction logic directly.
    _roleCache.set('user-new', { role: 'admin', ts: Date.now() });
    // Map doesn't auto-evict — the eviction is in setCachedRole.
    // So let's test it via the module's internal setCachedRole indirectly:
    // Clear and test that after 1000 entries + a verifyToken call, size stays at 1000.
    _roleCache.clear();
    for (let i = 0; i < 1000; i++) {
      _roleCache.set(`user-${i}`, { role: 'user', ts: Date.now() });
    }

    // Now a verifyToken call will add mock-user-id, triggering eviction of user-0
    const req = mockReq({ cookies: { pantopus_access: 'token' } });
    return verifyToken(req, mockRes(), jest.fn()).then(() => {
      expect(_roleCache.size).toBe(1000); // stays at max
      expect(_roleCache.has('mock-user-id')).toBe(true);
      expect(_roleCache.has('user-0')).toBe(false); // evicted (first inserted)
    });
  });
});
