'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import { bindPlaceArrival } from '@/components/place/pendingPlace';
import { authPageHref, readAuthRedirectQuery, safeRedirectPath } from '@/lib/auth-utils';

const NO_CODE_ERROR_DELAY_MS = 700;

function AuthCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(readAuthRedirectQuery(searchParams), '/app/place');
  const [error, setError] = useState('');
  const exchangeRef = useRef<{ key: string; promise: ReturnType<typeof api.auth.oauthCallback> } | null>(null);
  const hashCredentials = useRef<{ access: string; refresh: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const code = searchParams?.get('code') || params.get('code');
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const access = hash.get('access_token');
    if (access) hashCredentials.current = { access, refresh: hash.get('refresh_token') };
    if (window.location.hash) window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    const credentials = hashCredentials.current;
    if (!code && !credentials) {
      const timeout = setTimeout(() => {
        if (!cancelled) setError('No authorization code received. Please try signing in again.');
      }, NO_CODE_ERROR_DELAY_MS);
      return () => { cancelled = true; clearTimeout(timeout); };
    }

    const key = credentials ? `token:${credentials.access}` : `code:${code}`;
    if (exchangeRef.current?.key !== key) {
      exchangeRef.current = {
        key,
        promise: credentials
          ? api.auth.oauthTokenCallback(credentials.access, credentials.refresh)
          : api.auth.oauthCallback(code!),
      };
    }
    setError('');
    exchangeRef.current.promise.then((response) => {
      if (cancelled) return;
      bindPlaceArrival(redirectTo, response.user?.id);
      router.replace(redirectTo);
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    });
    return () => { cancelled = true; };
  }, [searchParams, router, redirectTo]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-950 flex flex-col items-center justify-center px-4">
        <div className="bg-app-surface/90 backdrop-blur py-8 px-6 shadow-lg rounded-2xl border border-app-border-subtle max-w-md w-full text-center">
          <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
            Sign-in failed
          </div>
          <p className="text-app-text-secondary text-sm mb-6">{error}</p>
          <Link
            href={authPageHref('/login', redirectTo)}
            className="inline-block px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-950 flex flex-col items-center justify-center px-4">
      <div className="bg-app-surface/90 backdrop-blur py-8 px-6 shadow-lg rounded-2xl border border-app-border-subtle max-w-md w-full text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-app-text-secondary text-sm">Completing sign-in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackPageContent />
    </Suspense>
  );
}
