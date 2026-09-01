// ============================================================
// TEST: CSRF Protection Middleware (AUTH-3.3 / AUTH-3.3b)
// ============================================================

const csrfProtection = require('../../middleware/csrfProtection');
const { generateCsrfToken } = require('../../utils/csrf');

const TEST_USER_ID = 'test-user-123';

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/test',
    cookies: {},
    headers: {},
    _authMethod: undefined,
    user: null,
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

/** Build a valid CSRF-authenticated request with matching cookie + header */
function validCsrfReq(method = 'POST', userId = TEST_USER_ID) {
  const token = generateCsrfToken(userId);
  return mockReq({
    method,
    _authMethod: 'cookie',
    user: { id: userId },
    cookies: { pantopus_csrf: token },
    headers: { 'x-csrf-token': token },
  });
}

describe('csrfProtection middleware', () => {
  test('POST with cookie auth but missing x-csrf-token returns 403', () => {
    const token = generateCsrfToken(TEST_USER_ID);
    const req = mockReq({
      method: 'POST',
      _authMethod: 'cookie',
      user: { id: TEST_USER_ID },
      cookies: { pantopus_csrf: token },
      headers: {},
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/CSRF/i);
  });

  test('POST with cookie auth and mismatched x-csrf-token returns 403', () => {
    const token = generateCsrfToken(TEST_USER_ID);
    const req = mockReq({
      method: 'POST',
      _authMethod: 'cookie',
      user: { id: TEST_USER_ID },
      cookies: { pantopus_csrf: token },
      headers: { 'x-csrf-token': 'wrong-token' },
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test('POST with cookie auth and valid session-bound CSRF token succeeds', () => {
    const req = validCsrfReq('POST');
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  test('POST with matching cookie+header but wrong user ID returns 403', () => {
    // Token generated for user A, but req.user is user B
    const tokenForUserA = generateCsrfToken('user-a');
    const req = mockReq({
      method: 'POST',
      _authMethod: 'cookie',
      user: { id: 'user-b' },
      cookies: { pantopus_csrf: tokenForUserA },
      headers: { 'x-csrf-token': tokenForUserA },
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test('POST with Bearer header auth bypasses CSRF', () => {
    const req = mockReq({
      method: 'POST',
      _authMethod: 'bearer',
      cookies: {},
      headers: {},
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('GET request with cookie auth bypasses CSRF', () => {
    const req = mockReq({
      method: 'GET',
      _authMethod: 'cookie',
      user: { id: TEST_USER_ID },
      cookies: { pantopus_csrf: 'some-token' },
      headers: {},
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('Unauthenticated request bypasses CSRF', () => {
    const req = mockReq({
      method: 'POST',
      _authMethod: undefined,
      cookies: {},
      headers: {},
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('DELETE with cookie auth requires CSRF', () => {
    const token = generateCsrfToken(TEST_USER_ID);
    const req = mockReq({
      method: 'DELETE',
      _authMethod: 'cookie',
      user: { id: TEST_USER_ID },
      cookies: { pantopus_csrf: token },
      headers: {},
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test('PUT with cookie auth and valid CSRF succeeds', () => {
    const req = validCsrfReq('PUT');
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('random token matching cookie+header but not HMAC-bound returns 403', () => {
    const randomToken = 'not-an-hmac-token';
    const req = mockReq({
      method: 'POST',
      _authMethod: 'cookie',
      user: { id: TEST_USER_ID },
      cookies: { pantopus_csrf: randomToken },
      headers: { 'x-csrf-token': randomToken },
    });
    const res = mockRes();
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
