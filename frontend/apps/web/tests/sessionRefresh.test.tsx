/**
 * Persistent login — web session recovery (design §11, docs/01 §1.5).
 *
 *   A. middleware: a stale session (pantopus_session=1, no pantopus_access) is
 *      handed to /session/refresh instead of having its cookies cleared; the
 *      refresh route always passes; unauthenticated /app still goes to /login;
 *      authenticated traffic is unchanged.
 *   B. /session/refresh page: success → full navigation to redirectTo;
 *      invalid → server logout (clears the path-scoped refresh cookie) →
 *      onFail or /login?redirectTo; transient → keep cookies + Retry;
 *      loop guard stops a redirect ping-pong.
 *   C. pure helpers: isRefreshLoop / parseRefreshGuard.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const apiMock = require('@pantopus/api');

jest.mock('next/server', () => {
  const buildResponse = (headers: Record<string, string> = {}) => {
    const cookieSet = jest.fn();
    return {
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
      cookies: { set: cookieSet },
    };
  };
  return {
    NextRequest: class {},
    NextResponse: {
      rewrite: (url: URL) => buildResponse({ 'x-middleware-rewrite': String(url) }),
      redirect: (url: URL) => buildResponse({ location: String(url) }),
      next: () => buildResponse(),
    },
  };
});

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    require('react').createElement('a', { href: String(href), ...props }, children),
}));

// jsdom forbids redefining window.location, so the page navigates through
// hardNavigate() which we stub here (everything else is the real module).
const mockHardNavigate = jest.fn();
jest.mock('@/lib/session-refresh', () => ({
  ...jest.requireActual('../src/lib/session-refresh'),
  hardNavigate: (href: string) => mockHardNavigate(href),
}));

const { middleware } = require('../src/middleware');
const {
  SESSION_REFRESH_PATH,
  SESSION_REFRESH_GUARD_KEY,
  isRefreshLoop,
  parseRefreshGuard,
  safeLocalPath,
} = jest.requireActual('../src/lib/session-refresh');

function buildRequest(input: string, cookies: Record<string, string> = {}) {
  const url = new URL(input);
  return {
    url: input,
    nextUrl: { pathname: url.pathname, search: url.search },
    cookies: {
      get: (name: string) => (name in cookies ? { name, value: cookies[name] } : undefined),
    },
  } as any;
}

const STALE = { pantopus_session: '1' };
const AUTHED = { pantopus_session: '1', pantopus_access: 'jwt' };

describe('middleware — stale web session recovery', () => {
  test('stale /app/* → /session/refresh?redirectTo=…, cookies untouched', () => {
    const res = middleware(buildRequest('https://web.test/app/settings/security?tab=devices', STALE));
    const location = new URL(res.headers.get('location'));
    expect(location.pathname).toBe(SESSION_REFRESH_PATH);
    expect(location.searchParams.get('redirectTo')).toBe('/app/settings/security?tab=devices');
    expect(location.searchParams.get('onFail')).toBeNull();
    expect(res.cookies.set).not.toHaveBeenCalled();
  });

  test('stale /app route with a public twin carries it as onFail', () => {
    const res = middleware(buildRequest('https://web.test/app/gigs/abc123?ref=x', STALE));
    const location = new URL(res.headers.get('location'));
    expect(location.pathname).toBe(SESSION_REFRESH_PATH);
    expect(location.searchParams.get('redirectTo')).toBe('/app/gigs/abc123?ref=x');
    expect(location.searchParams.get('onFail')).toBe('/gigs/abc123?ref=x');
    expect(res.cookies.set).not.toHaveBeenCalled();
  });

  test('stale / → refresh towards /app/place with the landing page as fallback', () => {
    const res = middleware(buildRequest('https://web.test/', STALE));
    const location = new URL(res.headers.get('location'));
    expect(location.pathname).toBe(SESSION_REFRESH_PATH);
    expect(location.searchParams.get('redirectTo')).toBe('/app/place');
    expect(location.searchParams.get('onFail')).toBe('/');
    expect(res.cookies.set).not.toHaveBeenCalled();
  });

  test('stale /login and auth-flow pages render normally without clearing cookies', () => {
    for (const path of ['/login', '/register', '/forgot-password', '/reset-password?token=t']) {
      const res = middleware(buildRequest(`https://web.test${path}`, STALE));
      expect(res.headers.get('location')).toBeNull();
      expect(res.cookies.set).not.toHaveBeenCalled();
    }
  });

  test('the refresh route itself always passes (stale, authed, anonymous)', () => {
    for (const cookies of [STALE, AUTHED, {}]) {
      const res = middleware(buildRequest(`https://web.test${SESSION_REFRESH_PATH}?redirectTo=%2Fapp%2Fplace`, cookies));
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    }
  });

  test('anonymous /app/* still goes to /login?redirectTo (no refresh attempt without a session flag)', () => {
    const res = middleware(buildRequest('https://web.test/app/place', {}));
    const location = new URL(res.headers.get('location'));
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirectTo')).toBe('/app/place');
  });

  test('anonymous /app/gigs/:id bounces to the public page', () => {
    const res = middleware(buildRequest('https://web.test/app/gigs/abc?x=1', {}));
    expect(res.headers.get('location')).toBe('https://web.test/gigs/abc?x=1');
  });

  test('authenticated traffic is unchanged: /app passes, / and /login go to /app/place', () => {
    expect(middleware(buildRequest('https://web.test/app/place', AUTHED)).headers.get('location')).toBeNull();
    expect(middleware(buildRequest('https://web.test/', AUTHED)).headers.get('location')).toBe('https://web.test/app/place');
    expect(middleware(buildRequest('https://web.test/login', AUTHED)).headers.get('location')).toBe('https://web.test/app/place');
    expect(middleware(buildRequest('https://web.test/gigs/abc', AUTHED)).headers.get('location')).toBe('https://web.test/app/gigs/abc');
  });
});

describe('/session/refresh page', () => {
  const replaceSpy = mockHardNavigate;

  function setUrl(search: string) {
    window.history.replaceState({}, '', `${SESSION_REFRESH_PATH}${search}`);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    apiMock.auth.logout.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
  });

  function loadPage() {
    const Page = require('../src/app/session/refresh/page').default;
    return render(<Page />);
  }

  test('success → full navigation to redirectTo (middleware re-reads the fresh cookies)', async () => {
    setUrl('?redirectTo=%2Fapp%2Fsettings%2Fsecurity%3Ftab%3Ddevices');
    apiMock.refreshAuthSession.mockResolvedValue({ status: 'success', accessToken: '__session__' });

    loadPage();

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/app/settings/security?tab=devices'));
    expect(apiMock.refreshAuthSession).toHaveBeenCalledTimes(1);
    expect(apiMock.refreshAuthSession).toHaveBeenCalledWith({ trigger: 'middleware_stale_session' });
    expect(apiMock.auth.logout).not.toHaveBeenCalled();
    expect(apiMock.clearAuthToken).not.toHaveBeenCalled();
  });

  test('invalid → server logout (clears path-scoped refresh cookie) → /login?redirectTo', async () => {
    setUrl('?redirectTo=%2Fapp%2Fplace');
    apiMock.refreshAuthSession.mockResolvedValue({ status: 'invalid', statusCode: 401, code: 'TOKEN_REUSE' });

    loadPage();

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/login?redirectTo=%2Fapp%2Fplace'));
    expect(apiMock.auth.logout).toHaveBeenCalledTimes(1);
    expect(apiMock.clearAuthToken).toHaveBeenCalledTimes(1);
  });

  test('invalid with onFail → goes to the public fallback instead of login', async () => {
    setUrl('?redirectTo=%2Fapp%2Fgigs%2Fabc&onFail=%2Fgigs%2Fabc');
    apiMock.refreshAuthSession.mockResolvedValue({ status: 'invalid', statusCode: 401 });

    loadPage();

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/gigs/abc'));
    expect(apiMock.auth.logout).toHaveBeenCalledTimes(1);
  });

  test('transient → keeps cookies, shows Retry + Sign in; Retry re-attempts', async () => {
    setUrl('?redirectTo=%2Fapp%2Fplace');
    apiMock.refreshAuthSession
      .mockResolvedValueOnce({ status: 'transient', statusCode: 503, message: 'Service Unavailable' })
      .mockResolvedValueOnce({ status: 'success', accessToken: '__session__' });

    loadPage();

    expect(await screen.findByText("Couldn't restore your session")).toBeInTheDocument();
    expect(screen.getByText('Service Unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in instead' })).toHaveAttribute('href', '/login?redirectTo=%2Fapp%2Fplace');
    expect(apiMock.auth.logout).not.toHaveBeenCalled();
    expect(apiMock.clearAuthToken).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    });
    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/app/place'));
    expect(apiMock.refreshAuthSession).toHaveBeenCalledTimes(2);
  });

  test('unsafe redirectTo falls back to /app/place', async () => {
    setUrl('?redirectTo=https%3A%2F%2Fevil.example%2Fphish');
    apiMock.refreshAuthSession.mockResolvedValue({ status: 'success', accessToken: '__session__' });

    loadPage();

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/app/place'));
  });

  test('loop guard: a second hand-off for the same target within 15 s signs the user in instead of looping', async () => {
    setUrl('?redirectTo=%2Fapp%2Fplace');
    window.sessionStorage.setItem(
      SESSION_REFRESH_GUARD_KEY,
      JSON.stringify({ target: '/app/place', at: Date.now() - 2_000 }),
    );
    apiMock.refreshAuthSession.mockResolvedValue({ status: 'success', accessToken: '__session__' });

    loadPage();

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/login?redirectTo=%2Fapp%2Fplace'));
    // No refresh attempted — that is what would have looped.
    expect(apiMock.refreshAuthSession).not.toHaveBeenCalled();
    expect(apiMock.auth.logout).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(SESSION_REFRESH_GUARD_KEY)).toBeNull();
  });
});

describe('session-refresh helpers', () => {
  test('isRefreshLoop only trips for the same target inside the window', () => {
    const now = 1_000_000;
    expect(isRefreshLoop(null, '/app/place', now)).toBe(false);
    expect(isRefreshLoop({ target: '/app/other', at: now - 1_000 }, '/app/place', now)).toBe(false);
    expect(isRefreshLoop({ target: '/app/place', at: now - 1_000 }, '/app/place', now)).toBe(true);
    expect(isRefreshLoop({ target: '/app/place', at: now - 20_000 }, '/app/place', now)).toBe(false);
    expect(isRefreshLoop({ target: '/app/place', at: now + 5_000 }, '/app/place', now)).toBe(false); // clock skew
  });

  test('safeLocalPath admits same-origin public paths only', () => {
    expect(safeLocalPath('/gigs/abc?x=1', '')).toBe('/gigs/abc?x=1');
    expect(safeLocalPath('/', '')).toBe('/');
    expect(safeLocalPath('%2Flisting%2F42', '')).toBe('/listing/42');
    expect(safeLocalPath('https://evil.example/', '')).toBe('');
    expect(safeLocalPath('//evil.example/', '')).toBe('');
    expect(safeLocalPath('/\\evil.example', '')).toBe('');
    expect(safeLocalPath('/javascript:alert(1)', '')).toBe('');
    expect(safeLocalPath('/a/../b', '')).toBe('');
    expect(safeLocalPath('/a b', '')).toBe('');
    expect(safeLocalPath(null, '/fallback')).toBe('/fallback');
  });

  test('parseRefreshGuard tolerates garbage', () => {
    expect(parseRefreshGuard(null)).toBeNull();
    expect(parseRefreshGuard('')).toBeNull();
    expect(parseRefreshGuard('{not json')).toBeNull();
    expect(parseRefreshGuard(JSON.stringify({ target: 1, at: 'x' }))).toBeNull();
    expect(parseRefreshGuard(JSON.stringify({ target: '/a', at: 5 }))).toEqual({ target: '/a', at: 5 });
  });
});
