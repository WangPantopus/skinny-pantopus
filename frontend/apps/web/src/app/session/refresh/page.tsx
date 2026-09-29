'use client';

/**
 * /session/refresh — web session recovery hand-off.
 *
 * The Next middleware sends visitors here when `pantopus_session=1` but the
 * 1-hour `pantopus_access` cookie is missing. The 7-day refresh cookie is
 * path-scoped to /api/users/refresh (invisible to the middleware), so the only
 * place that can find out whether the session is still alive is a same-origin
 * request to that endpoint. We go through `refreshAuthSession()` so the call
 * shares the single-flight mutex in @pantopus/api with any in-page 401 retry
 * (Supabase treats a parallel replay as TOKEN_REUSE).
 *
 * Outcomes:
 *   success   → full navigation to `redirectTo` (cookies re-read by the middleware)
 *   invalid   → POST /api/users/logout (clears every cookie, incl. the
 *               path-scoped refresh cookie) → `onFail` or /login?redirectTo=…
 *   transient → keep cookies, show Retry / Sign in (never sign the user out
 *               over a flaky network)
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import { clearAuthToken, refreshAuthSession, type AuthRefreshResult } from '@pantopus/api';
import { safeRedirectPath } from '@/lib/auth-utils';
import {
  SESSION_REFRESH_GUARD_KEY,
  hardNavigate,
  isRefreshLoop,
  parseRefreshGuard,
  safeLocalPath,
} from '@/lib/session-refresh';

type Phase = 'refreshing' | 'redirecting' | 'transient';

function readParams(): { redirectTo: string; onFail: string | null } {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const redirectTo = safeRedirectPath(params.get('redirectTo'), '/app/place');
  // onFail is only ever a public same-origin twin set by our middleware
  // (e.g. /gigs/:id or /); anything else collapses to "no fallback" → /login.
  const rawOnFail = params.get('onFail');
  const onFail = rawOnFail ? safeLocalPath(rawOnFail, '') || null : null;
  return { redirectTo, onFail };
}

function loginUrlFor(redirectTo: string): string {
  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}

function readGuard(): ReturnType<typeof parseRefreshGuard> {
  try {
    return parseRefreshGuard(window.sessionStorage.getItem(SESSION_REFRESH_GUARD_KEY));
  } catch {
    return null;
  }
}

function writeGuard(target: string): void {
  try {
    window.sessionStorage.setItem(SESSION_REFRESH_GUARD_KEY, JSON.stringify({ target, at: Date.now() }));
  } catch {
    /* private mode / quota — the loop guard just degrades */
  }
}

function clearGuard(): void {
  try {
    window.sessionStorage.removeItem(SESSION_REFRESH_GUARD_KEY);
  } catch {
    /* ignore */
  }
}

/** Best-effort server logout so the path-scoped refresh cookie is cleared too. */
async function signOutLocally(): Promise<void> {
  try {
    await api.auth.logout();
  } catch {
    // Backend unreachable, rate-limited or already signed out, so the server did
    // not clear the cookies. Drop the JS-readable session flag here: while it is
    // set, the middleware sends the next visit (e.g. `/`) straight back to this
    // page, which refreshes and fails to sign out again, page after page.
    clearSessionFlag();
  }
  clearAuthToken();
}

/** Expire the JS-readable `pantopus_session` flag (set host-only on path `/`). */
function clearSessionFlag(): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `pantopus_session=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}

// The copy of this page that has decided to sign out and leave; it clears this
// when it unmounts. Signing out changes the auth session, and QueryProvider
// remounts the whole tree on every auth change, so a fresh copy of this page
// mounts before the navigation completes. That copy must not refresh and sign
// out again: each pass would remount it once more, looping until the backend
// rate-limits the visitor (and their sign-in).
let signOutOwner: object | null = null;

function SessionRefreshContent() {
  const [instance] = useState(() => ({}));
  const [handingOff] = useState(() => signOutOwner !== null);
  const [phase, setPhase] = useState<Phase>(handingOff ? 'redirecting' : 'refreshing');
  const [message, setMessage] = useState('');
  const [{ redirectTo, onFail }] = useState(readParams);
  const startedRef = useRef(false);

  const go = useCallback((href: string) => {
    setPhase('redirecting');
    // Full navigation on purpose: the middleware must re-read the cookies.
    hardNavigate(href);
  }, []);

  const attempt = useCallback(async () => {
    setPhase('refreshing');
    setMessage('');

    // Loop breaker: if we were here for the same target < 15 s ago the
    // refresh "worked" but no access cookie appeared — stop and sign in.
    if (isRefreshLoop(readGuard(), redirectTo, Date.now())) {
      signOutOwner = instance;
      clearGuard();
      await signOutLocally();
      go(onFail ?? loginUrlFor(redirectTo));
      return;
    }
    writeGuard(redirectTo);

    let result: AuthRefreshResult;
    try {
      result = await refreshAuthSession({ trigger: 'middleware_stale_session' });
    } catch (err: unknown) {
      result = {
        status: 'transient',
        message: err instanceof Error ? err.message : 'Could not reach the server',
      };
    }

    if (result.status === 'success') {
      go(redirectTo);
      return;
    }

    if (result.status === 'invalid') {
      signOutOwner = instance;
      clearGuard();
      await signOutLocally();
      go(onFail ?? loginUrlFor(redirectTo));
      return;
    }

    // transient: keep cookies, let the user retry or sign in.
    clearGuard();
    setMessage(result.message || 'We could not reach Pantopus. Check your connection and try again.');
    setPhase('transient');
  }, [go, instance, onFail, redirectTo]);

  useEffect(() => {
    if (startedRef.current) return; // React strict-mode double invoke guard
    startedRef.current = true;
    if (handingOff) return; // remounted while another copy signs out and leaves
    void attempt();
  }, [attempt, handingOff]);

  // A later mount with no navigation in between (a stopped navigation, or a test
  // rendering the page again) starts fresh.
  useEffect(
    () => () => {
      if (signOutOwner === instance) signOutOwner = null;
    },
    [instance],
  );

  return (
    <div className="min-h-screen bg-app flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center" role="status" aria-live="polite">
        {phase !== 'transient' ? (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-4 text-sm text-app-secondary">
              {phase === 'redirecting' ? 'Taking you back…' : 'Restoring your session…'}
            </p>
          </>
        ) : (
          <div className="bg-surface rounded-xl border border-app p-6 space-y-4">
            <div>
              <h1 className="text-lg font-semibold text-app">Couldn&apos;t restore your session</h1>
              <p className="mt-1 text-sm text-app-secondary">{message}</p>
              <p className="mt-1 text-xs text-app-muted">You are still signed in — nothing was cleared.</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => void attempt()}
                className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                Try again
              </button>
              <Link
                href={loginUrlFor(redirectTo)}
                className="w-full px-4 py-2.5 border border-app-strong text-app-strong rounded-lg hover-bg-app font-medium"
              >
                Sign in instead
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SessionRefreshPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-app flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      }
    >
      <SessionRefreshContent />
    </Suspense>
  );
}
