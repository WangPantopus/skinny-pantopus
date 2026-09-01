// ============================================================
// TEST: requireAuthority Middleware
//
// Unit tests for the HomeAuthority checking middleware.
// ============================================================

const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');

// ── Mock logger ──────────────────────────────────────────────
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const requireAuthority = require('../../middleware/requireAuthority');

function mockReq(overrides = {}) {
  return {
    user: { id: 'user-1' },
    params: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {
    _status: 200,
    _json: null,
    status(code) { res._status = code; return res; },
    json(data) { res._json = data; return res; },
  };
  return res;
}

beforeEach(() => {
  resetTables();
});

describe('requireAuthority', () => {
  test('passes when user has direct verified authority', async () => {
    seedTable('HomeAuthority', [{
      id: 'auth-1',
      home_id: 'home-1',
      subject_type: 'user',
      subject_id: 'user-1',
      status: 'verified',
      verification_tier: 'standard',
    }]);

    const req = mockReq({ params: { homeId: 'home-1' } });
    const res = mockRes();
    const next = jest.fn();

    await requireAuthority(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.authority).toBeDefined();
    expect(req.authority.id).toBe('auth-1');
  });

  test('returns 403 when no authority exists', async () => {
    const req = mockReq({ params: { homeId: 'home-1' } });
    const res = mockRes();
    const next = jest.fn();

    await requireAuthority(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(res._json.error).toContain('No verified authority');
  });

  test('returns 403 when authority is pending', async () => {
    seedTable('HomeAuthority', [{
      id: 'auth-1',
      home_id: 'home-1',
      subject_type: 'user',
      subject_id: 'user-1',
      status: 'pending',
    }]);

    const req = mockReq({ params: { homeId: 'home-1' } });
    const res = mockRes();
    const next = jest.fn();

    await requireAuthority(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  test('returns 401 when no user', async () => {
    const req = mockReq({ user: null });
    const res = mockRes();
    const next = jest.fn();

    await requireAuthority(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  test('passes with null authority when no homeId resolvable', async () => {
    const req = mockReq({ params: {}, body: {} });
    const res = mockRes();
    const next = jest.fn();

    await requireAuthority(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.authority).toBeNull();
  });

  test('resolves homeId from body when not in params', async () => {
    seedTable('HomeAuthority', [{
      id: 'auth-1',
      home_id: 'home-1',
      subject_type: 'user',
      subject_id: 'user-1',
      status: 'verified',
    }]);

    const req = mockReq({ body: { home_id: 'home-1' } });
    const res = mockRes();
    const next = jest.fn();

    await requireAuthority(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.authority.id).toBe('auth-1');
  });

  test('passes when user belongs to a business with authority', async () => {
    seedTable('BusinessTeam', [{
      id: 'bm-1',
      business_user_id: 'biz-1',
      user_id: 'user-1',
      is_active: true,
    }]);
    seedTable('HomeAuthority', [{
      id: 'auth-biz',
      home_id: 'home-1',
      subject_type: 'business',
      subject_id: 'biz-1',
      status: 'verified',
    }]);

    const req = mockReq({ params: { homeId: 'home-1' } });
    const res = mockRes();
    const next = jest.fn();

    await requireAuthority(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.authority.subject_type).toBe('business');
  });

  test('returns 403 when business authority exists but user is not a member', async () => {
    seedTable('HomeAuthority', [{
      id: 'auth-biz',
      home_id: 'home-1',
      subject_type: 'business',
      subject_id: 'biz-1',
      status: 'verified',
    }]);

    const req = mockReq({ params: { homeId: 'home-1' } });
    const res = mockRes();
    const next = jest.fn();

    await requireAuthority(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });
});
