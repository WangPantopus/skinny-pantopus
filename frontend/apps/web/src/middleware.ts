import { NextRequest, NextResponse } from 'next/server';

// Backend sets these via same-origin proxy (no separate Next.js session route needed).
const ACCESS_COOKIE = 'pantopus_access';
const SESSION_COOKIE = 'pantopus_session';

const AUTH_PAGES = new Set(['/login', '/register']);
const AUTH_FLOW_PAGES = new Set(['/forgot-password', '/reset-password', '/verify-email', '/verify-email-sent']);

function clearAuthCookies(res: NextResponse) {
  const clear = { path: '/', maxAge: 0 };
  res.cookies.set(ACCESS_COOKIE, '', clear);
  res.cookies.set(SESSION_COOKIE, '', clear);
  res.cookies.set('pantopus_refresh', '', clear);
  res.cookies.set('pantopus_csrf', '', clear);
  return res;
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
  const hasStaleSession = hasSessionFlag && !hasAccessCookie;

  if (!isAuthenticated) {
    const publicAliases: Array<[RegExp, (id: string) => string]> = [
      [/^\/app\/gigs\/([^/]+)$/, (id) => `/gigs/${id}`],
      [/^\/app\/marketplace\/([^/]+)$/, (id) => `/listing/${id}`],
      [/^\/app\/feed\/post\/([^/]+)$/, (id) => `/posts/${id}`],
    ];

    for (const [pattern, buildPath] of publicAliases) {
      const match = pathname.match(pattern);
      if (!match) continue;
      const redirectUrl = new URL(buildPath(match[1]), req.url);
      redirectUrl.search = search || '';
      const response = NextResponse.redirect(redirectUrl);
      return hasStaleSession ? clearAuthCookies(response) : response;
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

  if (hasStaleSession && pathname.startsWith('/app')) {
    const loginUrl = new URL('/login', req.url);
    const redirectTo = `${pathname}${search || ''}`;
    loginUrl.searchParams.set('redirectTo', redirectTo);
    return clearAuthCookies(NextResponse.redirect(loginUrl));
  }

  if (hasStaleSession && (pathname === '/' || AUTH_PAGES.has(pathname) || AUTH_FLOW_PAGES.has(pathname))) {
    return clearAuthCookies(NextResponse.next());
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
