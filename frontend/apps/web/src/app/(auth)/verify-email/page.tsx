'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import PantopusBadge from '@/components/PantopusBadge';
import { extractApiError, normalizeEmail } from '@/lib/auth-utils';

type VerifyState = 'verifying' | 'success' | 'error';

function VerifyEmailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasStartedRef = useRef(false);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<VerifyState>('verifying');
  const [message, setMessage] = useState('Verifying your email...');
  const [resending, setResending] = useState(false);
  const [emailHint, setEmailHint] = useState('');

  // Cleanup redirect timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function run() {
      const hashParams = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
      );

      const tokenHash = searchParams.get('token_hash') || hashParams.get('token_hash') || '';
      const token = searchParams.get('token') || hashParams.get('token') || '';
      const email = normalizeEmail(searchParams.get('email') || hashParams.get('email') || '');
      const typeParam = searchParams.get('type') || hashParams.get('type') || 'signup';
      const allowedTypes = new Set(['email', 'signup', 'magiclink']);
      const type = (allowedTypes.has(typeParam) ? typeParam : 'signup') as 'email' | 'signup' | 'magiclink';

      setEmailHint(email);

      // Require a verification token — do not trust access_token alone
      if (!tokenHash && !token) {
        if (!cancelled) {
          setState('error');
          setMessage('Verification link is missing required token parameters.');
        }
        return;
      }

      try {
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          setState('error');
          setMessage('Verification request timed out. Please try again or contact support.');
        }, 15000);

        const res = await api.auth.verifyEmail({
          tokenHash: tokenHash || undefined,
          token: token || undefined,
          email: email || undefined,
          type,
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (!cancelled) {
          setState('success');
          setMessage(res?.message || 'Email verified successfully. You can now sign in.');
          redirectTimeoutRef.current = setTimeout(() => router.push('/login'), 1200);
        }
      } catch (err: unknown) {
        if (timeoutId) clearTimeout(timeoutId);
        if (!cancelled) {
          setState('error');
          setMessage(extractApiError(err, 'Verification failed. The link may be invalid or expired.'));
        }
      }
    }

    run();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [searchParams, router]);

  const resend = async () => {
    if (!emailHint) {
      setMessage('Enter your email on the login page to resend verification.');
      setState('error');
      return;
    }
    setResending(true);
    try {
      const res = await api.auth.resendVerification(emailHint);
      setMessage(res?.message || 'If that email exists, a verification email has been sent.');
    } catch (err: unknown) {
      setMessage(extractApiError(err, 'Could not resend verification email.'));
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
        <h1 className="mt-6 text-center text-3xl font-bold text-app-text dark:text-white">Verify your email</h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-app-surface/90 backdrop-blur py-8 px-4 shadow-lg shadow-black/5 dark:shadow-black/30 rounded-2xl border border-app-border-subtle sm:px-10">
          <div
            role={state === 'error' ? 'alert' : 'status'}
            className={`rounded-lg px-4 py-3 text-sm ${
              state === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-950 dark:border-green-900 dark:text-green-200'
                : state === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-200'
                  : 'bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-200'
            }`}
          >
            {message}
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/login"
              className="w-full inline-flex justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700"
            >
              Go to Sign in
            </Link>

            {state === 'error' ? (
              <button
                type="button"
                onClick={resend}
                disabled={resending}
                className="w-full py-2 text-sm font-medium text-primary-700 dark:text-primary-300 hover:opacity-90 disabled:opacity-60"
              >
                {resending ? 'Sending verification...' : 'Resend verification email'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailPageContent />
    </Suspense>
  );
}
