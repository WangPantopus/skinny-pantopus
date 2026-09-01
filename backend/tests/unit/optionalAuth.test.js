const optionalAuth = require('../../middleware/optionalAuth');
const { resetTables, setAuthMocks } = require('../__mocks__/supabaseAdmin');

function mockReq({ headers = {}, cookies = {} } = {}) {
  return {
    headers,
    cookies,
  };
}

describe('optionalAuth', () => {
  beforeEach(() => {
    resetTables();
    optionalAuth._tokenCache.clear();
  });

  test('prefers Bearer token over stale access cookie', async () => {
    const getUser = jest.fn(async (token) => ({
      data: {
        user: {
          id: token === 'fresh-bearer-token' ? 'fresh-user' : 'stale-user',
          email: `${token}@example.com`,
        },
      },
      error: null,
    }));
    setAuthMocks({ getUser });

    const req = mockReq({
      headers: { authorization: 'Bearer fresh-bearer-token' },
      cookies: { pantopus_access: 'stale-cookie-token' },
    });
    const next = jest.fn();

    await optionalAuth(req, {}, next);

    expect(getUser).toHaveBeenCalledWith('fresh-bearer-token');
    expect(req.user).toMatchObject({ id: 'fresh-user' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
