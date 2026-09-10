import {
  applyAuthSession, clearAuthSession, configureApiClient, onTokenChange, AUTH_SESSION_CHANGE_KEY,
} from '../../../packages/api/src/client';

beforeEach(() => {
  localStorage.clear();
  configureApiClient({ platform: 'web' });
});

test('cookie-session changes publish a nonsecret marker for other browser tabs', async () => {
  const observe = jest.fn();
  const unsubscribe = onTokenChange(observe);
  try {
    await applyAuthSession({ accessToken: 'synthetic-auth-value', refreshToken: 'synthetic-refresh-value' });
    const first = localStorage.getItem(AUTH_SESSION_CHANGE_KEY);
    expect(first).toMatch(/^\d+:\d+$/);
    expect(first).not.toContain('synthetic');
    await clearAuthSession();
    expect(localStorage.getItem(AUTH_SESSION_CHANGE_KEY)).not.toBe(first);
    expect(observe).toHaveBeenCalledTimes(2);
  } finally { unsubscribe(); }
});

test('disabled storage cannot prevent cookie-session clearing or its local observers', async () => {
  const observe = jest.fn();
  const unsubscribe = onTokenChange(observe);
  const blocked = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Disabled'); });
  try {
    await expect(clearAuthSession()).resolves.toBeUndefined();
    expect(observe).toHaveBeenCalledWith(null);
  } finally { blocked.mockRestore(); unsubscribe(); }
});
