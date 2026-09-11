const supabaseAdmin = require('../../config/supabaseAdmin');
const { resetTables, setAuthMocks, getTable, seedTable } = require('../__mocks__/supabaseAdmin');

jest.mock('../../config/auth', () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
}));

jest.mock('../../services/emailService', () => ({
  checkDeliveryAvailability: jest.fn().mockResolvedValue({ available: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const emailService = require('../../services/emailService');
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

function mockReq({
  body = {},
  headers = {},
  path = '/register',
  originalUrl = '/api/users/register',
} = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), v])
  );

  return {
    body,
    method: 'POST',
    path,
    originalUrl,
    ip: '127.0.0.1',
    get: (headerName) => {
      const key = String(headerName || '').toLowerCase();
      return normalizedHeaders[key] || (key === 'user-agent' ? 'test-agent' : undefined);
    },
  };
}

function mockRes() {
  return {
    _status: 200,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(payload) {
      this._json = payload;
      return this;
    },
  };
}

const registerHandler = findHandler('POST', '/register');
const resendVerificationHandler = findHandler('POST', '/resend-verification');
const forgotPasswordHandler = findHandler('POST', '/forgot-password');

describe('POST /register', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.AUTH_REDIRECT_URL = 'https://pantopus.com';
  });

  test('returns 400 when user profile insert loses a username uniqueness race', async () => {
    setAuthMocks({
      adminGenerateLink: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'auth-user-race',
            email: 'race@example.com',
            email_confirmed_at: null,
          },
          properties: {
            action_link: 'https://example.com/verify?token=race',
            hashed_token: 'race-hashed-token',
            email_otp: '123456',
            redirect_to: 'https://pantopus.com/verify-email',
            verification_type: 'signup',
          },
        },
        error: null,
      }),
    });

    const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);
    jest.spyOn(supabaseAdmin, 'from').mockImplementation((tableName) => {
      const builder = originalFrom(tableName);
      if (tableName !== 'User') return builder;

      const originalInsert = builder.insert.bind(builder);
      builder.insert = (payload) => {
        if (payload?.id !== 'auth-user-race') {
          return originalInsert(payload);
        }

        return {
          select() {
            return this;
          },
          async single() {
            return {
              data: null,
              error: {
                message: 'duplicate key value violates unique constraint "User_username_key"',
                code: '23505',
                details: 'Key (username)=(masontest12482134124) already exists.',
                hint: null,
              },
            };
          },
        };
      };

      return builder;
    });

    const req = mockReq({
      body: {
        email: 'race@example.com',
        password: 'test12312345',
        username: 'masontest12482134124',
        firstName: 'Mason',
        lastName: 'Turner',
      },
      headers: {
        origin: 'https://pantopus.com',
      },
    });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'Username already taken' });
    expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith('auth-user-race');
    expect(getTable('User')).toHaveLength(0);
  });
});

describe('POST /resend-verification', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.AUTH_REDIRECT_URL = 'https://pantopus.com';
  });

  test('does not generate a magic link for unknown emails', async () => {
    const adminGenerateLink = jest.fn().mockResolvedValue({
      data: {
        properties: {
          hashed_token: 'should-not-be-used',
        },
      },
      error: null,
    });
    setAuthMocks({ adminGenerateLink });

    const req = mockReq({
      body: { email: 'missing@example.com' },
      path: '/resend-verification',
      originalUrl: '/api/users/resend-verification',
      headers: { origin: 'https://pantopus.com' },
    });
    const res = mockRes();

    await resendVerificationHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({
      message: 'If that email needs verification, we will attempt to send a new link.',
    });
    expect(adminGenerateLink).not.toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  test('does not generate a magic link for already verified users', async () => {
    seedTable('User', [
      {
        id: 'user-verified',
        email: 'verified@example.com',
        verified: true,
      },
    ]);

    const adminGenerateLink = jest.fn().mockResolvedValue({
      data: {
        properties: {
          hashed_token: 'should-not-be-used',
        },
      },
      error: null,
    });
    setAuthMocks({ adminGenerateLink });

    const req = mockReq({
      body: { email: 'verified@example.com' },
      path: '/resend-verification',
      originalUrl: '/api/users/resend-verification',
      headers: { origin: 'https://pantopus.com' },
    });
    const res = mockRes();

    await resendVerificationHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({
      message: 'If that email needs verification, we will attempt to send a new link.',
    });
    expect(adminGenerateLink).not.toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  test('sends a one-hour verification resend for existing unverified users', async () => {
    seedTable('User', [
      {
        id: 'user-pending',
        email: 'pending@example.com',
        verified: false,
      },
    ]);

    const adminGenerateLink = jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'user-pending',
          email: 'pending@example.com',
        },
        properties: {
          hashed_token: 'pending-hashed-token',
        },
      },
      error: null,
    });
    setAuthMocks({ adminGenerateLink });

    const req = mockReq({
      body: { email: 'pending@example.com' },
      path: '/resend-verification',
      originalUrl: '/api/users/resend-verification',
      headers: { origin: 'https://pantopus.com' },
    });
    const res = mockRes();

    await resendVerificationHandler(req, res);

    expect(res._status).toBe(200);
    expect(adminGenerateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email: 'pending@example.com',
      options: {
        redirectTo: 'https://pantopus.com/verify-email',
      },
    });
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith({
      toEmail: 'pending@example.com',
      verifyLink: 'https://pantopus.com/verify-email?token_hash=pending-hashed-token&type=magiclink&email=pending%40example.com&redirectTo=%2Fapp%2Fplace',
      isResend: true,
      linkExpiresIn: '1 hour',
    });
  });
});

describe('POST /forgot-password', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.AUTH_REDIRECT_URL = 'https://pantopus.com';
  });

  test('sends a Pantopus reset URL instead of the Supabase action link', async () => {
    const adminGenerateLink = jest.fn().mockResolvedValue({
      data: {
        properties: {
          action_link: 'https://gzzdqechcbfpalfvgyro.supabase.co/auth/v1/verify?token=should-not-leak',
          hashed_token: 'reset-hashed-token',
        },
      },
      error: null,
    });
    setAuthMocks({ adminGenerateLink });

    const req = mockReq({
      body: { email: 'reset@example.com', redirectTo: '/app/feed/post/post-1' },
      path: '/forgot-password',
      originalUrl: '/api/users/forgot-password',
      headers: { origin: 'https://pantopus.com' },
    });
    const res = mockRes();

    await forgotPasswordHandler(req, res);

    expect(res._status).toBe(200);
    expect(adminGenerateLink).toHaveBeenCalledWith({
      type: 'recovery',
      email: 'reset@example.com',
      options: {
        redirectTo: 'https://pantopus.com/reset-password',
      },
    });
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith({
      toEmail: 'reset@example.com',
      resetLink: 'https://pantopus.com/reset-password?token_hash=reset-hashed-token&type=recovery&email=reset%40example.com&redirectTo=%2Fapp%2Ffeed%2Fpost%2Fpost-1',
    });
  });
});

describe('verification email arrival context', () => {
  beforeEach(() => {
    resetTables(); jest.clearAllMocks();
    process.env.AUTH_REDIRECT_URL = 'https://pantopus.com';
    setAuthMocks({ adminGenerateLink: jest.fn().mockResolvedValue({ data: { user: { id: 'arrival-user', email: 'arrival@example.com', email_confirmed_at: null }, properties: { hashed_token: 'arrival-token' } }, error: null }) });
  });
  test.each(['/app/place?preview=0123456789abcdef', '/app/feed/post/post-1?comment=reply', '/persona/garden'])('registration email carries %s', async (target) => {
    const res = mockRes();
    await registerHandler(mockReq({ body: { email: 'arrival@example.com', password: 'long-password-123', username: 'arrivaluser', redirectTo: target } }), res);
    expect(res._status).toBe(201);
    const url = new URL(emailService.sendVerificationEmail.mock.calls[0][0].verifyLink);
    expect(url.pathname).toBe('/verify-email');
    expect(url.searchParams.get('token_hash')).toBe('arrival-token');
    expect(url.searchParams.get('redirectTo')).toBe(target);
  });
  test.each(['/persona/garden', 'https://evil.test'])('resend validates destination %s', async (target) => {
    seedTable('User', [{ id: 'arrival-user', email: 'arrival@example.com', verified: false }]);
    const res = mockRes();
    await resendVerificationHandler(mockReq({ body: { email: 'arrival@example.com', redirectTo: target } }), res);
    const url = new URL(emailService.sendVerificationEmail.mock.calls[0][0].verifyLink);
    expect(url.origin).toBe('https://pantopus.com');
    expect(url.searchParams.get('redirectTo')).toBe(target.startsWith('/persona/') ? target : '/app/place');
  });
});


describe('account email delivery failures', () => {
  beforeEach(() => {
    resetTables(); jest.clearAllMocks();
    emailService.checkDeliveryAvailability.mockResolvedValue({ available: true });
    emailService.sendVerificationEmail.mockResolvedValue({ success: true });
    emailService.sendPasswordResetEmail.mockResolvedValue({ success: true });
    process.env.AUTH_REDIRECT_URL = 'https://pantopus.com';
  });

  test.each([
    ['/register', registerHandler],
    ['/resend-verification', resendVerificationHandler],
    ['/forgot-password', forgotPasswordHandler],
  ])('%s rejects mail outages before looking up an account', async (path, handler) => {
    seedTable('User', [{ id: 'known', email: 'known@example.com', verified: false }]);
    const from = jest.spyOn(supabaseAdmin, 'from');
    const generateLink = jest.fn();
    setAuthMocks({ adminGenerateLink: generateLink });
    emailService.checkDeliveryAvailability.mockResolvedValue({ available: false });
    const responses = [];
    for (const email of ['known@example.com', 'missing@example.com']) {
      const res = mockRes();
      await handler(mockReq({ path, body: { email, password: 'long-test-password', username: 'newuser' } }), res);
      expect(res._status).toBe(503);
      expect(res._json.code).toBe('EMAIL_UNAVAILABLE');
      responses.push(res._json);
    }
    expect(responses[0]).toEqual(responses[1]);
    expect(from).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    from.mockRestore();
  });

  test.each(['rejected', 'thrown', 'missing-token'])('registration preserves a recoverable account after %s delivery', async (failure) => {
    const deleteUser = jest.fn();
    setAuthMocks({
      adminGenerateLink: jest.fn().mockResolvedValue({
        data: { user: { id: 'new-email-user', email: 'new@example.com', email_confirmed_at: null },
          properties: failure === 'missing-token' ? {} : { hashed_token: 'verification-hash' } }, error: null,
      }),
      adminDeleteUser: deleteUser,
    });
    if (failure === 'thrown') emailService.sendVerificationEmail.mockRejectedValueOnce(new Error('transport failed'));
    else emailService.sendVerificationEmail.mockResolvedValueOnce({ success: false, error: 'EMAIL_SEND_FAILED' });
    const res = mockRes();
    await registerHandler(mockReq({ body: { email: 'new@example.com', password: 'long-test-password', username: 'emailuser' } }), res);
    expect(res._status).toBe(503);
    expect(res._json).toMatchObject({ code: 'VERIFICATION_EMAIL_UNAVAILABLE', accountCreated: true, requiresEmailVerification: true });
    expect(res._json.error).toContain('Request a new link');
    expect(getTable('User')).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'new-email-user', verified: false })]));
    expect(deleteUser).not.toHaveBeenCalled();
  });

  test('recovery acknowledgement remains the same if sending fails for a known account', async () => {
    const generateLink = jest.fn()
      .mockResolvedValueOnce({ data: { properties: { hashed_token: 'recovery-hash' } }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    setAuthMocks({ adminGenerateLink: generateLink });
    emailService.sendPasswordResetEmail.mockResolvedValue({ success: false });
    const known = mockRes(); const missing = mockRes();
    await forgotPasswordHandler(mockReq({ body: { email: 'known@example.com' } }), known);
    await forgotPasswordHandler(mockReq({ body: { email: 'missing@example.com' } }), missing);
    expect(known._status).toBe(200);
    expect(known._json).toEqual(missing._json);
    expect(known._json.message).not.toContain('has been sent');
  });
});
