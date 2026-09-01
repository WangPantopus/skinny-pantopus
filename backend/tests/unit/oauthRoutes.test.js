const { resetTables, setAuthMocks, getTable } = require('../__mocks__/supabaseAdmin');
const mockCreateClient = jest.fn();

// Keep rate limit middleware from interfering with direct handler tests
jest.mock('../../middleware/rateLimiter', () => ({
  globalWriteLimiter: (req, _res, next) => next(),
  addressValidationLimiter: (req, _res, next) => next(),
  addressClaimLimiter: (req, _res, next) => next(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args) => mockCreateClient(...args),
}));

jest.mock('../../config/auth', () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
}));

const router = require('../../routes/users');

function findHandler(method, path) {
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method.toLowerCase()]
    ) {
      const stack = layer.route.stack;
      return stack[stack.length - 1].handle;
    }
  }
  throw new Error(`Handler not found: ${method} ${path}`);
}

function mockReq({ params = {}, query = {}, body = {}, headers = {}, cookies = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), v])
  );
  return {
    params,
    query,
    body,
    cookies,
    method: 'POST',
    path: '/test',
    originalUrl: '/api/users/test',
    ip: '127.0.0.1',
    get: (headerName) => {
      const key = String(headerName || '').toLowerCase();
      return normalizedHeaders[key] || (key === 'user-agent' ? 'test-agent' : undefined);
    },
  };
}

function mockRes() {
  const res = {
    _status: 200,
    _json: null,
    _cookies: {},
    _clearedCookies: [],
    status(code) { this._status = code; return this; },
    json(payload) { this._json = payload; return this; },
    cookie(name, val, opts) { this._cookies[name] = { val, opts }; return this; },
    clearCookie(name) { this._clearedCookies.push(name); return this; },
  };
  return res;
}

const oauthUrlHandler = findHandler('GET', '/oauth/:provider');
const refreshHandler = findHandler('POST', '/refresh');
const oauthTokenHandler = findHandler('POST', '/oauth/token');
const oauthCallbackHandler = findHandler('POST', '/oauth/callback');
const logoutHandler = findHandler('POST', '/logout');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  mockCreateClient.mockReset();
  process.env.AUTH_REDIRECT_URL = 'https://pantopus.com';
});

describe('GET /oauth/:provider', () => {
  test('accepts token flow request but starts OAuth without forcing response_type', async () => {
    const signInWithOAuth = jest.fn().mockResolvedValue({
      data: { url: 'https://auth.example.com/start' },
      error: null,
    });
    setAuthMocks({ signInWithOAuth });

    const req = mockReq({
      params: { provider: 'apple' },
      query: {
        redirectTo: 'pantopus://auth/callback',
        flow: 'token',
      },
    });
    const res = mockRes();
    await oauthUrlHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.url).toBe('https://auth.example.com/start');
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: expect.objectContaining({
        redirectTo: 'pantopus://auth/callback',
        skipBrowserRedirect: true,
      }),
    });
    expect(signInWithOAuth.mock.calls[0][0].options.queryParams).toBeUndefined();
  });

  test('uses localhost origin for default redirect when request comes from localhost', async () => {
    process.env.AUTH_REDIRECT_URL = 'http://192.168.0.176:3000';
    const signInWithOAuth = jest.fn().mockResolvedValue({
      data: { url: 'https://auth.example.com/start' },
      error: null,
    });
    setAuthMocks({ signInWithOAuth });

    const req = mockReq({
      params: { provider: 'google' },
      headers: { origin: 'http://localhost:3000' },
    });
    const res = mockRes();
    await oauthUrlHandler(req, res);

    expect(res._status).toBe(200);
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: 'http://localhost:3000/auth/callback',
        skipBrowserRedirect: true,
      }),
    });
  });

  test('ignores untrusted request origin for default redirect', async () => {
    process.env.AUTH_REDIRECT_URL = 'https://pantopus.com';
    const signInWithOAuth = jest.fn().mockResolvedValue({
      data: { url: 'https://auth.example.com/start' },
      error: null,
    });
    setAuthMocks({ signInWithOAuth });

    const req = mockReq({
      params: { provider: 'google' },
      headers: { origin: 'https://evil.example' },
    });
    const res = mockRes();
    await oauthUrlHandler(req, res);

    expect(res._status).toBe(200);
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: 'https://pantopus.com/auth/callback',
        skipBrowserRedirect: true,
      }),
    });
  });

  test('rejects invalid flow values', async () => {
    const req = mockReq({
      params: { provider: 'apple' },
      query: { flow: 'invalid-flow' },
    });
    const res = mockRes();
    await oauthUrlHandler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.error).toContain('Invalid flow');
  });
});

describe('POST /refresh', () => {
  test('mobile refresh uses body token even when a stale refresh cookie is present', async () => {
    const refreshSession = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          expires_at: 1_700_000_000,
        },
        user: { id: 'user-1' },
      },
      error: null,
    });
    mockCreateClient.mockReturnValue({ auth: { refreshSession } });

    const req = mockReq({
      body: { refreshToken: 'fresh-body-refresh-token' },
      cookies: { pantopus_refresh: 'stale-cookie-refresh-token' },
      headers: { 'user-agent': 'Pantopus/70 CFNetwork/3860.400.51 Darwin/25.3.0' },
    });
    const res = mockRes();

    await refreshHandler(req, res);

    expect(mockCreateClient.mock.calls[0][2]).toMatchObject({
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(refreshSession).toHaveBeenCalledWith({
      refresh_token: 'fresh-body-refresh-token',
    });
    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({
      ok: true,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    expect(res._cookies.pantopus_refresh).toBeUndefined();
    expect(res._clearedCookies).toContain('pantopus_refresh');
  });

  test('web cookie transport refresh uses cookie token and omits JSON tokens', async () => {
    const refreshSession = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'web-access-token',
          refresh_token: 'web-refresh-token',
          expires_in: 3600,
          expires_at: 1_700_000_001,
        },
        user: { id: 'user-1' },
      },
      error: null,
    });
    mockCreateClient.mockReturnValue({ auth: { refreshSession } });

    const req = mockReq({
      body: { refreshToken: 'body-token-should-not-win' },
      cookies: { pantopus_refresh: 'web-cookie-refresh-token' },
      headers: { 'x-token-transport': 'cookie' },
    });
    const res = mockRes();

    await refreshHandler(req, res);

    expect(refreshSession).toHaveBeenCalledWith({
      refresh_token: 'web-cookie-refresh-token',
    });
    expect(res._status).toBe(200);
    expect(res._json).toEqual({ ok: true });
    expect(res._cookies.pantopus_refresh).toMatchObject({
      val: 'web-refresh-token',
    });
    expect(res._clearedCookies).not.toContain('pantopus_refresh');
  });
});

describe('POST /oauth/token', () => {
  test('returns access token and refresh token when provided', async () => {
    setAuthMocks({
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'oauth-user-1',
            email: 'apple-user@example.com',
            user_metadata: { provider: 'apple' },
          },
        },
        error: null,
      }),
    });

    const req = mockReq({
      body: {
        accessToken: 'access-token-abc',
        refreshToken: 'refresh-token-xyz',
      },
    });
    const res = mockRes();
    await oauthTokenHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.accessToken).toBe('access-token-abc');
    expect(res._json.refreshToken).toBe('refresh-token-xyz');
    expect(getTable('User')).toHaveLength(1);
  });

  test('rejects missing access token', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await oauthTokenHandler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.error).toContain('Access token is required');
  });

  test('rejects missing refresh token to avoid access-token-only persistence', async () => {
    const req = mockReq({ body: { accessToken: 'access-token-abc' } });
    const res = mockRes();
    await oauthTokenHandler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.error).toContain('Refresh token is required');
  });

  test('rejects token when Supabase cannot resolve user', async () => {
    setAuthMocks({
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid token' },
      }),
    });

    const req = mockReq({ body: { accessToken: 'bad-token', refreshToken: 'refresh-token' } });
    const res = mockRes();
    await oauthTokenHandler(req, res);

    expect(res._status).toBe(401);
    expect(res._json.error).toContain('Invalid or expired access token');
  });
});

describe('POST /oauth/callback', () => {
  test('returns 400 when code is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await oauthCallbackHandler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.error).toContain('Authorization code is required');
  });

  test('returns 400 when exchanged user has no email', async () => {
    const exchangeCodeForSession = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
        user: {
          id: 'oauth-no-email',
          email: null,
          user_metadata: {},
        },
      },
      error: null,
    });
    mockCreateClient.mockReturnValue({ auth: { exchangeCodeForSession } });

    const req = mockReq({ body: { code: 'auth-code' } });
    const res = mockRes();
    await oauthCallbackHandler(req, res);

    expect(mockCreateClient.mock.calls[0][2]).toMatchObject({
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(res._status).toBe(400);
    expect(res._json.error).toContain('Email address is required');
  });
});

describe('POST /logout', () => {
  test('revokes the bearer session and clears auth cookies', async () => {
    const adminSignOut = jest.fn().mockResolvedValue({ data: null, error: null });
    setAuthMocks({ adminSignOut });

    const req = mockReq({
      headers: { authorization: 'Bearer bearer-access-token' },
      cookies: { pantopus_access: 'stale-cookie-access-token' },
    });
    const res = mockRes();

    await logoutHandler(req, res);

    expect(adminSignOut).toHaveBeenCalledWith('bearer-access-token', 'local');
    expect(res._status).toBe(200);
    expect(res._json).toEqual({ success: true });
    expect(res._clearedCookies).toEqual(expect.arrayContaining([
      'pantopus_access',
      'pantopus_refresh',
      'pantopus_csrf',
      'pantopus_session',
    ]));
  });

  test('prefers explicit body access token over stale access cookie', async () => {
    const adminSignOut = jest.fn().mockResolvedValue({ data: null, error: null });
    setAuthMocks({ adminSignOut });

    const req = mockReq({
      body: { accessToken: 'body-access-token' },
      cookies: { pantopus_access: 'stale-cookie-access-token' },
    });
    const res = mockRes();

    await logoutHandler(req, res);

    expect(adminSignOut).toHaveBeenCalledWith('body-access-token', 'local');
    expect(res._status).toBe(200);
    expect(res._json).toEqual({ success: true });
  });
});
