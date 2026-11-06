'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import { bindPlaceArrival } from '@/components/place/pendingPlace';
import { OAUTH_NONCE_PARAM, authPageHref, readAuthRedirectQuery, safeRedirectPath } from '@/lib/auth-utils';
import { landingAfterSignIn } from '@/lib/invitation-after-sign-in';
import { oauthAttemptInviteCode, takeOAuthAttempt } from '@/lib/oauth-attempt';

const NO_CODE_ERROR_DELAY_MS = 700;
// The Auth server passes the provider's error through: Google sends
// access_denied when the person cancels, Apple user_cancelled_authorize.
const PROVIDER_CANCEL_ERRORS = new Set(['access_denied', 'user_cancelled_authorize']);
// Same sentence as the apps' rejected callback.
const ATTEMPT_REJECTED_ERROR = "Sign-in couldn't be verified. Please try again.";

// The sign-in this callback is finishing, kept outside the page: saving the session makes the app rebuild every page
// (QueryProvider), and the rebuilt page must carry on with the tokens already taken out of the address, the decided
// check and the exchange, or it finds no code and never lands. A callback with another check starts over.
type CallbackSignIn = {
  nonce: string | null;
  hashCredentials: { access: string; refresh: string | null } | null;
  // Whether this callback is the sign-in this tab started. Decided once, because
  // deciding uses the attempt up and the effect below can run more than once.
  attemptOwned: boolean | null;
  // The friend's invite code a Create account attempt carried; the server credits them if this sign-in makes the account.
  inviteCode: string | undefined;
  exchange: { key: string; promise: ReturnType<typeof api.auth.oauthCallback> } | null;
  // Where the finished sign-in goes, asked once per exchange: a household invitation opens only once.
  landing: { key: string; promise: Promise<string> } | null;
};
let callbackSignIn: CallbackSignIn | null = null;

function AuthCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(readAuthRedirectQuery(searchParams), '/app/place');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const code = searchParams?.get('code') || params.get('code');
    const nonce = searchParams?.get(OAUTH_NONCE_PARAM) || params.get(OAUTH_NONCE_PARAM);
    if (callbackSignIn?.nonce !== nonce) {
      callbackSignIn = { nonce, hashCredentials: null, attemptOwned: null, inviteCode: undefined, exchange: null, landing: null };
    }
    const signIn = callbackSignIn;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const access = hash.get('access_token');
    if (access) signIn.hashCredentials = { access, refresh: hash.get('refresh_token') };
    if (window.location.hash) window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    const providerError = params.get('error') || hash.get('error');
    if (providerError && !code && !signIn.hashCredentials) {
      if (PROVIDER_CANCEL_ERRORS.has(providerError)) {
        router.replace(authPageHref('/login', redirectTo));
      } else {
        setError("Sign-in didn't finish. Please try again or use your email.");
      }
      return () => { cancelled = true; };
    }
    const credentials = signIn.hashCredentials;
    if (!code && !credentials) {
      const timeout = setTimeout(() => {
        if (!cancelled) setError('No authorization code received. Please try signing in again.');
      }, NO_CODE_ERROR_DELAY_MS);
      return () => { cancelled = true; clearTimeout(timeout); };
    }
    // A link carrying someone else's session or code (login CSRF) never signs
    // this browser in: only the attempt this tab started, with its check.
    if (signIn.attemptOwned === null) {
      signIn.inviteCode = oauthAttemptInviteCode();
      signIn.attemptOwned = takeOAuthAttempt(nonce);
    }
    if (!signIn.attemptOwned) {
      setError(ATTEMPT_REJECTED_ERROR);
      return () => { cancelled = true; };
    }

    const key = credentials ? `token:${credentials.access}` : `code:${code}`;
    if (signIn.exchange?.key !== key) {
      signIn.exchange = {
        key,
        promise: credentials
          ? api.auth.oauthTokenCallback(credentials.access, credentials.refresh, signIn.inviteCode)
          : api.auth.oauthCallback(code!, signIn.inviteCode),
      };
    }
    setError('');
    signIn.exchange.promise.then((response) => {
      if (cancelled) return;
      if (signIn.landing?.key !== key) {
        bindPlaceArrival(redirectTo, response.user?.id);
        signIn.landing = { key, promise: landingAfterSignIn(redirectTo) };
      }
      return signIn.landing.promise.then((landing) => { if (!cancelled) router.replace(landing); });
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
