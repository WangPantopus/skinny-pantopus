// ============================================================
// TEST: Mail Verification Routes
//
// Focused route-contract tests for the frontend-facing mail verification API:
//   POST /verify/mail/start
//   POST /verify/mail/:verification_id/resend
//   GET  /verify/mail/:verification_id
//   POST /verify/mail/confirm
//
// The service remains attempt-based internally; these tests verify the route
// layer translates that into the frontend contract.
// ============================================================

const { resetTables } = require('../__mocks__/supabaseAdmin');

jest.mock('../../services/addressValidation/mailVerificationService', () => ({
  startVerification: jest.fn(),
  resendCode: jest.fn(),
  getVerificationStatus: jest.fn(),
  confirmCode: jest.fn(),
}));

jest.mock('../../middleware/rateLimiter', () => ({
  globalWriteLimiter: (req, res, next) => next(),
  addressValidationLimiter: (req, res, next) => next(),
  addressClaimLimiter: (req, res, next) => next(),
}));

jest.mock('../../middleware/verifyToken', () => {
  const mw = (req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com', role: 'user' };
    next();
  };
  mw.requireAdmin = (req, res, next) => next();
  return mw;
});

jest.mock('../../services/addressValidation/googleProvider', () => ({
  isAvailable: jest.fn(() => false),
  validate: jest.fn(),
}));

jest.mock('../../services/addressValidation/smartyProvider', () => ({
  isAvailable: jest.fn(() => false),
  verify: jest.fn(),
}));

const mailVerificationService = require('../../services/addressValidation/mailVerificationService');
const router = require('../../routes/addressValidation');

function mockReq({
  body = {},
  params = {},
  method = 'POST',
  path = '/test',
  originalUrl = '/api/v1/address/test',
} = {}) {
  return {
    body,
    params,
    user: { id: 'test-user-id', email: 'test@example.com', role: 'user' },
    method,
    path,
    originalUrl,
    ip: '127.0.0.1',
    get: () => 'test-agent',
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

function findHandler(method, path) {
  for (const layer of router.stack) {
    if (
      layer.route
      && layer.route.path === path
      && layer.route.methods[method.toLowerCase()]
    ) {
      const stack = layer.route.stack;
      return stack[stack.length - 1].handle;
    }
  }

  throw new Error(`Handler not found: ${method} ${path}`);
}

const startHandler = findHandler('POST', '/verify/mail/start');
const resendHandler = findHandler('POST', '/verify/mail/:verification_id/resend');
const legacyResendHandler = findHandler('POST', '/verify/mail/resend');
const statusHandler = findHandler('GET', '/verify/mail/:verification_id');
const confirmHandler = findHandler('POST', '/verify/mail/confirm');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

describe('POST /verify/mail/start', () => {
  test('returns the frontend start contract on success', async () => {
    mailVerificationService.startVerification.mockResolvedValue({
      success: true,
      attempt_id: 'attempt-uuid-1',
      verification_id: 'attempt-uuid-1',
      address_id: 'addr-uuid-1',
      status: 'pending',
      expires_at: '2026-04-30T00:00:00.000Z',
      cooldown_until: '2026-04-02T01:00:00.000Z',
      max_resends: 3,
      resends_remaining: 3,
    });

    const req = mockReq({
      body: { address_id: 'addr-uuid-1', unit: 'Apt 2A' },
      path: '/verify/mail/start',
      originalUrl: '/api/v1/address/verify/mail/start',
    });
    const res = mockRes();

    await startHandler(req, res);

    expect(mailVerificationService.startVerification).toHaveBeenCalledWith(
      'test-user-id',
      'addr-uuid-1',
      'Apt 2A',
    );
    expect(res._status).toBe(200);
    expect(res._json).toEqual({
      verification_id: 'attempt-uuid-1',
      address_id: 'addr-uuid-1',
      status: 'pending',
      expires_at: '2026-04-30T00:00:00.000Z',
      cooldown_until: '2026-04-02T01:00:00.000Z',
      max_resends: 3,
      resends_remaining: 3,
    });
  });

  test('maps start errors to HTTP errors unchanged', async () => {
    mailVerificationService.startVerification.mockResolvedValue({
      success: false,
      error: 'Address is not deliverable',
    });

    const req = mockReq({ body: { address_id: 'addr-uuid-1' } });
    const res = mockRes();

    await startHandler(req, res);

    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'Address is not deliverable' });
  });

  test('maps mail dispatch failures to service unavailable', async () => {
    mailVerificationService.startVerification.mockResolvedValue({
      success: false,
      error: 'Failed to send verification mail',
    });

    const req = mockReq({ body: { address_id: 'addr-uuid-1' } });
    const res = mockRes();

    await startHandler(req, res);

    expect(res._status).toBe(503);
    expect(res._json).toEqual({ error: 'Failed to send verification mail' });
  });
});

describe('POST /verify/mail/:verification_id/resend', () => {
  test('returns the frontend resend contract on success', async () => {
    mailVerificationService.resendCode.mockResolvedValue({
      success: true,
      verification_id: 'attempt-uuid-1',
      address_id: 'addr-uuid-1',
      status: 'pending',
      expires_at: '2026-04-30T00:00:00.000Z',
      cooldown_until: '2026-04-02T02:00:00.000Z',
      max_resends: 3,
      resends_remaining: 2,
    });

    const req = mockReq({
      params: { verification_id: 'attempt-uuid-1' },
      path: '/verify/mail/:verification_id/resend',
      originalUrl: '/api/v1/address/verify/mail/attempt-uuid-1/resend',
    });
    const res = mockRes();

    await resendHandler(req, res);

    expect(mailVerificationService.resendCode).toHaveBeenCalledWith(
      'attempt-uuid-1',
      'test-user-id',
    );
    expect(res._status).toBe(200);
    expect(res._json).toEqual({
      verification_id: 'attempt-uuid-1',
      address_id: 'addr-uuid-1',
      status: 'pending',
      expires_at: '2026-04-30T00:00:00.000Z',
      cooldown_until: '2026-04-02T02:00:00.000Z',
      max_resends: 3,
      resends_remaining: 2,
    });
  });

  test('keeps the legacy resend alias working', async () => {
    mailVerificationService.resendCode.mockResolvedValue({
      success: true,
      verification_id: 'attempt-uuid-1',
      address_id: 'addr-uuid-1',
      status: 'pending',
      expires_at: '2026-04-30T00:00:00.000Z',
      cooldown_until: '2026-04-02T02:00:00.000Z',
      max_resends: 3,
      resends_remaining: 2,
    });

    const req = mockReq({
      body: { attempt_id: 'attempt-uuid-1' },
      path: '/verify/mail/resend',
      originalUrl: '/api/v1/address/verify/mail/resend',
    });
    const res = mockRes();

    await legacyResendHandler(req, res);

    expect(mailVerificationService.resendCode).toHaveBeenCalledWith(
      'attempt-uuid-1',
      'test-user-id',
    );
    expect(res._status).toBe(200);
    expect(res._json.verification_id).toBe('attempt-uuid-1');
  });

  test('returns cooldown info on resend throttling', async () => {
    mailVerificationService.resendCode.mockResolvedValue({
      success: false,
      error: 'Cooldown period has not passed',
      cooldown_until: '2026-04-02T02:00:00.000Z',
    });

    const req = mockReq({ params: { verification_id: 'attempt-uuid-1' } });
    const res = mockRes();

    await resendHandler(req, res);

    expect(res._status).toBe(429);
    expect(res._json).toEqual({
      error: 'Cooldown period has not passed',
      cooldown_until: '2026-04-02T02:00:00.000Z',
    });
  });

  test('maps resend dispatch failures to service unavailable', async () => {
    mailVerificationService.resendCode.mockResolvedValue({
      success: false,
      error: 'Failed to send verification mail',
    });

    const req = mockReq({ params: { verification_id: 'attempt-uuid-1' } });
    const res = mockRes();

    await resendHandler(req, res);

    expect(res._status).toBe(503);
    expect(res._json).toEqual({ error: 'Failed to send verification mail' });
  });
});

describe('GET /verify/mail/:verification_id', () => {
  test('returns current verification status', async () => {
    mailVerificationService.getVerificationStatus.mockResolvedValue({
      success: true,
      verification_id: 'attempt-uuid-1',
      status: 'pending',
      expires_at: '2026-04-30T00:00:00.000Z',
      cooldown_until: '2026-04-02T02:00:00.000Z',
      resends_remaining: 2,
    });

    const req = mockReq({
      method: 'GET',
      params: { verification_id: 'attempt-uuid-1' },
      path: '/verify/mail/:verification_id',
      originalUrl: '/api/v1/address/verify/mail/attempt-uuid-1',
    });
    const res = mockRes();

    await statusHandler(req, res);

    expect(mailVerificationService.getVerificationStatus).toHaveBeenCalledWith(
      'attempt-uuid-1',
      'test-user-id',
    );
    expect(res._status).toBe(200);
    expect(res._json).toEqual({
      verification_id: 'attempt-uuid-1',
      status: 'pending',
      expires_at: '2026-04-30T00:00:00.000Z',
      cooldown_until: '2026-04-02T02:00:00.000Z',
      resends_remaining: 2,
    });
  });

  test('returns 404 when verification does not exist', async () => {
    mailVerificationService.getVerificationStatus.mockResolvedValue({
      success: false,
      error: 'Verification attempt not found',
    });

    const req = mockReq({ method: 'GET', params: { verification_id: 'missing-id' } });
    const res = mockRes();

    await statusHandler(req, res);

    expect(res._status).toBe(404);
    expect(res._json).toEqual({ error: 'Verification attempt not found' });
  });
});

describe('POST /verify/mail/confirm', () => {
  test('returns confirmed status on success', async () => {
    mailVerificationService.confirmCode.mockResolvedValue({
      verified: true,
      occupancy_id: 'occ-uuid-1',
    });

    const req = mockReq({
      body: { verification_id: 'attempt-uuid-1', code: '123456' },
      path: '/verify/mail/confirm',
      originalUrl: '/api/v1/address/verify/mail/confirm',
    });
    const res = mockRes();

    await confirmHandler(req, res);

    expect(mailVerificationService.confirmCode).toHaveBeenCalledWith(
      'attempt-uuid-1',
      '123456',
      'test-user-id',
    );
    expect(res._status).toBe(200);
    expect(res._json).toEqual({ status: 'confirmed', occupancy_id: 'occ-uuid-1' });
  });

  test('supports legacy attempt_id in the confirm body', async () => {
    mailVerificationService.confirmCode.mockResolvedValue({
      verified: true,
      occupancy_id: 'occ-legacy-1',
    });

    const req = mockReq({ body: { attempt_id: 'attempt-uuid-1', code: '123456' } });
    const res = mockRes();

    await confirmHandler(req, res);

    expect(mailVerificationService.confirmCode).toHaveBeenCalledWith(
      'attempt-uuid-1',
      '123456',
      'test-user-id',
    );
    expect(res._json).toEqual({ status: 'confirmed', occupancy_id: 'occ-legacy-1' });
  });

  test('returns wrong_code without turning it into an HTTP error', async () => {
    mailVerificationService.confirmCode.mockResolvedValue({
      verified: false,
      attempts_remaining: 2,
    });

    const req = mockReq({ body: { verification_id: 'attempt-uuid-1', code: '000000' } });
    const res = mockRes();

    await confirmHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({
      status: 'wrong_code',
      attempts_remaining: 2,
    });
  });

  test('returns expired without an HTTP error', async () => {
    mailVerificationService.confirmCode.mockResolvedValue({
      verified: false,
      error: 'Verification code has expired',
    });

    const req = mockReq({ body: { verification_id: 'attempt-uuid-1', code: '000000' } });
    const res = mockRes();

    await confirmHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ status: 'expired' });
  });

  test('returns locked without an HTTP error', async () => {
    mailVerificationService.confirmCode.mockResolvedValue({
      verified: false,
      locked: true,
      error: 'Too many attempts. Request a new code.',
    });

    const req = mockReq({ body: { verification_id: 'attempt-uuid-1', code: '000000' } });
    const res = mockRes();

    await confirmHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ status: 'locked' });
  });

  test('maps not found to 404', async () => {
    mailVerificationService.confirmCode.mockResolvedValue({
      verified: false,
      error: 'Verification attempt not found',
    });

    const req = mockReq({ body: { verification_id: 'missing-id', code: '123456' } });
    const res = mockRes();

    await confirmHandler(req, res);

    expect(res._status).toBe(404);
    expect(res._json).toEqual({ error: 'Verification attempt not found' });
  });
});

describe('Route registration', () => {
  test('registers the frontend mail verification routes', () => {
    const routes = router.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    expect(routes).toContainEqual(
      expect.objectContaining({
        path: '/verify/mail/start',
        methods: expect.arrayContaining(['post']),
      }),
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        path: '/verify/mail/:verification_id/resend',
        methods: expect.arrayContaining(['post']),
      }),
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        path: '/verify/mail/:verification_id',
        methods: expect.arrayContaining(['get']),
      }),
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        path: '/verify/mail/confirm',
        methods: expect.arrayContaining(['post']),
      }),
    );
  });
});
