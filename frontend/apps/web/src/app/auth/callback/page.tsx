// @ts-nocheck
'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';

const NO_CODE_ERROR_DELAY_MS = 700;

function AuthCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const noCodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Prefer window.location so we don't show a false "no code" error when
    // useSearchParams() hasn't synced yet (common in production hydration).
    const queryString = typeof window !== 'undefined' ? window.location.search : '';
    const urlParams = new URLSearchParams(queryString);
    const codeFromUrl = urlParams.get('code');
    const code = searchParams.get('code') ?? codeFromUrl;

    // Handle implicit flow: token is in the URL hash fragment (#access_token=...)
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
    const accessTokenFromHash = hashParams.get('access_token');
    const refreshTokenFromHash = hashParams.get('refresh_token');

    // Remove OAuth tokens from browser URL bar/history as soon as they are parsed.
    if (hash && typeof window !== 'undefined') {
      const cleanUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    if (accessTokenFromHash) {
      // Implicit flow — verify token with backend and ensure profile exists
      (async () => {
        try {
          await api.auth.oauthTokenCallback(accessTokenFromHash, refreshTokenFromHash);
          router.push('/app/place');
        } catch (err: unknown) {
          console.error('OAuth token callback error:', err);
          setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
        }
      })();
      return () => {};
    }

    if (!code) {
      // Defer "no code" error so we don't flash it when the URL hasn't synced yet (production).
      noCodeTimeoutRef.current = setTimeout(() => {
        const again = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('code')
          : null;
        if (!again) {
          setError('No authorization code received. Please try signing in again.');
        }
      }, NO_CODE_ERROR_DELAY_MS);
      return () => {
        if (noCodeTimeoutRef.current) {
          clearTimeout(noCodeTimeoutRef.current);
          noCodeTimeoutRef.current = null;
        }
      };
    }

    if (noCodeTimeoutRef.current) {
      clearTimeout(noCodeTimeoutRef.current);
      noCodeTimeoutRef.current = null;
    }

    // Clear any "no code" error that may have been set by the deferred timeout
    // (effect ran with code after the timeout already fired).
    setError('');

    (async () => {
      try {
        await api.auth.oauthCallback(code);
        router.push('/app/place');
      } catch (err: unknown) {
        console.error('OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      }
    })();

    return () => {
      if (noCodeTimeoutRef.current) {
        clearTimeout(noCodeTimeoutRef.current);
        noCodeTimeoutRef.current = null;
      }
    };
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-950 flex flex-col items-center justify-center px-4">
        <div className="bg-app-surface/90 backdrop-blur py-8 px-6 shadow-lg rounded-2xl border border-app-border-subtle max-w-md w-full text-center">
          <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
            Sign-in failed
          </div>
          <p className="text-app-text-secondary text-sm mb-6">{error}</p>
          <Link
            href="/login"
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
