import { NextRequest, NextResponse } from 'next/server';
// Same-origin client route that attempts POST /api/users/refresh (through the
// single-flight mutex in @pantopus/api) BEFORE anyone clears cookies. The
// refresh cookie is path-scoped to /api/users/refresh, so this middleware
// cannot see it and must never treat "access cookie missing" as "signed out".
// See docs/01-authentication-authorization.md §1.5 (web session recovery).
import { SESSION_REFRESH_PATH } from './lib/session-refresh';

// Backend sets these via same-origin proxy (no separate Next.js session route needed).
const ACCESS_COOKIE = 'pantopus_access';
const SESSION_COOKIE = 'pantopus_session';

const AUTH_PAGES = new Set(['/login', '/register']);

// Public read-only twins of app routes. Used (a) to bounce signed-out visitors
// to the public page and (b) as the fallback when a stale session cannot be
// refreshed.
const PUBLIC_ALIASES: Array<[RegExp, (id: string) => string]> = [
  [/^\/app\/gigs\/([^/]+)$/, (id) => `/gigs/${id}`],
  [/^\/app\/marketplace\/([^/]+)$/, (id) => `/listing/${id}`],
  [/^\/app\/feed\/post\/([^/]+)$/, (id) => `/posts/${id}`],
];

function publicAliasFor(pathname: string): string | null {
  for (const [pattern, buildPath] of PUBLIC_ALIASES) {
    const match = pathname.match(pattern);
    if (match) return buildPath(match[1]);
  }
  return null;
}

function buildRefreshRedirect(req: NextRequest, redirectTo: string, onFail?: string) {
  const url = new URL(SESSION_REFRESH_PATH, req.url);
  url.searchParams.set('redirectTo', redirectTo);
  if (onFail) url.searchParams.set('onFail', onFail);
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const personaMatch = pathname.match(/^\/(?:@|%40)([^/]+)$/i);
  if (personaMatch) {
    const rewriteUrl = new URL(`/persona/${personaMatch[1]}`, req.url);
    rewriteUrl.search = search;
    return NextResponse.rewrite(rewriteUrl);
  }

  if (pathname === '/signin') {
    const dest = new URL('/login', req.url);
    dest.search = search;
    return NextResponse.redirect(dest);
  }
  const hasSessionFlag = req.cookies.get(SESSION_COOKIE)?.value === '1';
  const hasAccessCookie = Boolean(req.cookies.get(ACCESS_COOKIE)?.value);
  const isAuthenticated = hasSessionFlag && hasAccessCookie;
  // The 1-hour access cookie expired (or was dropped) while the 30-day session
  // flag is still set. The 7-day refresh cookie may well be alive — we cannot
  // tell from here — so this is "maybe signed in", never "signed out".
  const hasStaleSession = hasSessionFlag && !hasAccessCookie;

  // The refresh route itself must always pass, in every cookie state, or the
  // recovery hand-off below would loop.
  if (pathname === SESSION_REFRESH_PATH) {
    return NextResponse.next();
  }

  if (hasStaleSession) {
    // Recovery hand-off: try to refresh before deciding anything. Cookies are
    // NOT cleared here — the client route clears them (via /api/users/logout)
    // only when the refresh endpoint says the session is truly invalid.
    if (pathname.startsWith('/app')) {
      const alias = publicAliasFor(pathname);
      return buildRefreshRedirect(req, `${pathname}${search || ''}`, alias ? `${alias}${search || ''}` : undefined);
    }
    if (pathname === '/') {
      // Returning users land on their Place once refreshed; the landing page
      // stays the fallback when the refresh cookie is gone.
      return buildRefreshRedirect(req, '/app/place', '/');
    }
    // /login, /register and the auth-flow pages render normally. A fresh
    // login simply overwrites the cookies; nothing to clear up front.
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const alias = publicAliasFor(pathname);
    if (alias) {
      const redirectUrl = new URL(alias, req.url);
      redirectUrl.search = search || '';
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isAuthenticated) {
    const appAliases: Array<[RegExp, (id: string) => string]> = [
      [/^\/gigs\/([^/]+)$/, (id) => `/app/gigs/${id}`],
    ];

    for (const [pattern, buildPath] of appAliases) {
      const match = pathname.match(pattern);
      if (!match) continue;
      const redirectUrl = new URL(buildPath(match[1]), req.url);
      redirectUrl.search = search || '';
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Returning users visiting the root land on their Place (the default
  // landing for the authed app).
  if (pathname === '/' && isAuthenticated) {
    return NextResponse.redirect(new URL('/app/place', req.url));
  }

  // Keep authenticated users out of login/register pages.
  if (AUTH_PAGES.has(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL('/app/place', req.url));
  }

  // App routes require session.
  if (pathname.startsWith('/app') && !isAuthenticated) {
    const loginUrl = new URL('/login', req.url);
    const redirectTo = `${pathname}${search || ''}`;
    loginUrl.searchParams.set('redirectTo', redirectTo);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
