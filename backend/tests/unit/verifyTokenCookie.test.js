// ============================================================
// TEST: verifyToken – Cookie & Bearer Auth (AUTH-3.3)
//
// Verifies token extraction logic and _authMethod tagging.
// Since moduleNameMapper makes it hard to override supabase mock,
// we test the real middleware with the existing supabase mock
// (which has a default getUser returning mock-user-id).
// ============================================================

const { resetTables } = require('../__mocks__/supabaseAdmin');

// The real verifyToken (moduleNameMapper maps ../config/supabase
// to supabaseAdmin mock, which has auth.getUser built in)
const verifyToken = require('../../middleware/verifyToken');

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
});

describe('verifyToken cookie/bearer extraction (AUTH-3.3)', () => {
  test('extracts token from cookie when no Bearer header present and sets _authMethod = "cookie"', async () => {
    const req = mockReq({
      cookies: { pantopus_access: 'cookie-token-123' },
    });
    const res = mockRes();
    const next = jest.fn();

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req._authMethod).toBe('cookie');
    expect(req.user).toBeDefined();
    expect(req.user.id).toBeDefined();
  });

  test('extracts token from Bearer header when no cookie present and sets _authMethod = "bearer"', async () => {
    const req = mockReq({
      headers: { authorization: 'Bearer bearer-token-456' },
    });
    const res = mockRes();
    const next = jest.fn();

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req._authMethod).toBe('bearer');
    expect(req.user).toBeDefined();
  });

  test('prefers bearer when both cookie and header are present', async () => {
    const req = mockReq({
      cookies: { pantopus_access: 'cookie-token' },
      headers: { authorization: 'Bearer header-token' },
    });
    const res = mockRes();
    const next = jest.fn();

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req._authMethod).toBe('bearer');
  });

  test('returns 401 when neither cookie nor header is present', async () => {
    const req = mockReq({});
    const res = mockRes();
    const next = jest.fn();

    await verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/no token/i);
  });

  test('returns 401 when Authorization header lacks Bearer prefix', async () => {
    const req = mockReq({
      headers: { authorization: 'Basic abc123' },
    });
    const res = mockRes();
    const next = jest.fn();

    await verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('cookie auth attaches user object to request', async () => {
    const req = mockReq({
      cookies: { pantopus_access: 'some-valid-token' },
    });
    const res = mockRes();
    const next = jest.fn();

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toHaveProperty('id');
    expect(req.user).toHaveProperty('email');
    expect(req.user).toHaveProperty('role');
  });

  test('bearer auth attaches user object to request', async () => {
    const req = mockReq({
      headers: { authorization: 'Bearer some-valid-token' },
    });
    const res = mockRes();
    const next = jest.fn();

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toHaveProperty('id');
    expect(req.user).toHaveProperty('email');
    expect(req.user).toHaveProperty('role');
  });
});
