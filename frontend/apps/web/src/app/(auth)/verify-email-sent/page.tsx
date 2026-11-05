'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { bindPlaceArrival } from '@/components/place/pendingPlace';
import PantopusBadge from '@/components/PantopusBadge';
import { authPageHref, readAuthRedirectQuery, safeRedirectPath, extractApiError } from '@/lib/auth-utils';
import { landingAfterSignIn } from '@/lib/invitation-after-sign-in';
import {
  announceSignedIn,
  forgetPendingSignIn,
  listenForEmailConfirmed,
  pendingSignInFor,
} from '@/lib/pending-sign-in';
import WithSearchParams, { type SearchParamsProps } from '@/components/auth/WithSearchParams';

const RESEND_COOLDOWN_SECONDS = 30;

function VerifyEmailSentPageContent({ searchParams }: SearchParamsProps) {
  const redirectTo = safeRedirectPath(readAuthRedirectQuery(searchParams), '/app/place');
  const loginHref = authPageHref('/login', redirectTo);
  const emailParam = searchParams?.get('email') || '';
  const email = useMemo(() => emailParam.trim().toLowerCase(), [emailParam]);

  const [status, setStatus] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const router = useRouter();
  const signingIn = useRef(false);

  // The link opens in another tab or app. Back here, or told by that tab, this tab signs in with the password
  // typed at sign-up, so it isn't asked for again (lib/pending-sign-in).
  useEffect(() => {
    if (!email) return;
    let active = true;
    const trySignIn = async () => {
      const pending = pendingSignInFor(email);
      if (!pending || signingIn.current) return;
      signingIn.current = true;
      try {
        const response = await api.auth.login({ email: pending.email, password: pending.password });
        if (!active || response.requiresEmailVerification) return;
        forgetPendingSignIn();
        announceSignedIn(email);
        bindPlaceArrival(redirectTo, response.user?.id);
        router.push(await landingAfterSignIn(redirectTo));
      } catch {
        // Not confirmed yet (403) or offline: the next return tries again.
      } finally {
        signingIn.current = false;
      }
    };
    const onReturn = () => {
      if (document.visibilityState === 'visible') void trySignIn();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    const stopListening = listenForEmailConfirmed(email, () => void trySignIn());
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      stopListening();
    };
  }, [email, redirectTo, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const onResend = async () => {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    setStatus('');
    try {
      const res = await api.auth.resendVerification(email, redirectTo);
      setStatus(res?.message || 'If that email needs verification, we will attempt to send a new link.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setStatus(extractApiError(err, 'Could not resend verification email.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <PantopusBadge />
        </div>
        <h1 className="mt-6 text-center text-3xl font-bold text-app-text dark:text-white">Check your email</h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-app-surface/90 backdrop-blur py-8 px-4 shadow-lg shadow-black/5 dark:shadow-black/30 rounded-2xl border border-app-border-subtle sm:px-10">
          <p className="text-sm text-app-text-strong">
            We sent a verification link to{' '}
            <span className="font-semibold">{email || 'your email address'}</span>.
            Open the link, then come back and sign in.
          </p>

          {status ? (
            <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-200">
              {status}
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            <a
              href="mailto:"
              className="w-full inline-flex justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700"
            >
              Open Email App
            </a>
            <button
              type="button"
              onClick={onResend}
              disabled={!email || cooldown > 0 || resending}
              className="w-full py-2 text-sm font-medium text-primary-700 dark:text-primary-300 hover:opacity-90 disabled:opacity-60"
            >
              {resending ? 'Sending verification...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
            </button>
            <Link
              href={authPageHref('/register', redirectTo, email ? { email } : {})}
              className="w-full inline-flex justify-center py-2 text-sm font-medium text-primary-700 dark:text-primary-300 hover:opacity-90"
            >
              Use a different email
            </Link>
            <Link
              href={loginHref}
              className="w-full inline-flex justify-center py-2.5 px-4 rounded-lg border border-app-border text-sm font-semibold text-app-text hover:bg-app-hover dark:hover:bg-gray-800"
            >
              Back to Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailSentPage() {
  return <WithSearchParams Content={VerifyEmailSentPageContent} />;
}
