'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import PantopusBadge from '@/components/PantopusBadge';
import {
  extractApiError,
  extractFieldErrors,
  normalizeEmail,
  oauthRedirectParamForWeb,
  readAuthRedirectQuery,
  safeRedirectPath,
} from '@/lib/auth-utils';

export default function LoginPage() {
  const router = useRouter();
  type FieldErrors = Record<string, string>;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setFieldErrors({});
    setLoading(true);

    try {
      const response = await api.auth.login({ email: normalizeEmail(email), password });

      // api.auth.login() stores tokens in memory. Backend sets httpOnly
      // cookies via same-origin proxy — no separate session sync needed.

      // If the backend says email verification is required, redirect there
      if (response.requiresEmailVerification) {
        const emailForNext = encodeURIComponent(normalizeEmail(email));
        router.push(`/verify-email-sent?email=${emailForNext}`);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      router.push(safeRedirectPath(readAuthRedirectQuery(params), '/app/place'));
    } catch (err: unknown) {
      setFieldErrors(extractFieldErrors(err));
      setError(extractApiError(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const canResendVerification = error.toLowerCase().includes('verify');

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setError('Enter your email first to resend verification.');
      return;
    }
    setResending(true);
    setInfo('');
    try {
      const res = await api.auth.resendVerification(normalizeEmail(email));
      setInfo(res?.message || 'If that email exists, a verification email has been sent.');
    } catch (err: unknown) {
      setError(extractApiError(err, 'Could not resend verification email.'));
    } finally {
      setResending(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    if (oauthLoading) return;
    setOauthLoading(provider);
    try {
      const params = new URLSearchParams(window.location.search);
      const rawRedirect = readAuthRedirectQuery(params);
      const { url } = await api.auth.getOAuthUrl(
        provider,
        oauthRedirectParamForWeb(rawRedirect, typeof window !== 'undefined' ? window.location.origin : undefined),
      );
      window.location.href = url;
    } catch (err: unknown) {
      setError(extractApiError(err, `Failed to start ${provider} sign-in`));
      setOauthLoading(null);
    }
  };

  const inputClass =
    'appearance-none block w-full px-3 py-2 rounded-md shadow-sm ' +
    'border border-app-border ' +
    'bg-app-surface ' +
    'text-app-text ' +
    'placeholder-gray-400 dark:placeholder-gray-500 ' +
    'focus:outline-none focus:ring-primary-500 focus:border-primary-500';
  const inputErrorClass = ' border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/20';
  const fieldErrorClass = 'mt-1 text-xs text-red-600 dark:text-red-300';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <PantopusBadge />
        </div>

        <h2 className="mt-6 text-center text-3xl font-bold text-app-text dark:text-white">
          Welcome back
        </h2>

        <p className="mt-2 text-center text-sm text-app-text-secondary">
          Sign in to Pantopus
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-app-surface/90 backdrop-blur py-8 px-4 shadow-lg shadow-black/5 dark:shadow-black/30 rounded-2xl border border-app-border-subtle sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div role="alert" className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg whitespace-pre-line">
                {error}
              </div>
            )}
            {info && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-200 px-4 py-3 rounded-lg">
                {info}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-app-text-strong"
              >
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((prev) => {
                      if (!prev.email) return prev;
                      const next = { ...prev };
                      delete next.email;
                      return next;
                    });
                  }}
                  className={inputClass + (fieldErrors.email ? inputErrorClass : '')}
                  placeholder="you@example.com"
                />
                {fieldErrors.email ? <p className={fieldErrorClass}>{fieldErrors.email}</p> : null}
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-app-text-strong"
              >
                Password
              </label>

              {/* Password input with Show/Hide */}
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((prev) => {
                      if (!prev.password) return prev;
                      const next = { ...prev };
                      delete next.password;
                      return next;
                    });
                  }}
                  className={`${inputClass} pr-16${fieldErrors.password ? inputErrorClass : ''}`}
                  placeholder="Your password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-primary-700 dark:text-primary-300 hover:opacity-90 select-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password ? <p className={fieldErrorClass}>{fieldErrors.password}</p> : null}
            </div>

            <div className="flex items-center justify-end">
              <div className="text-sm">
                <Link
                  href="/forgot-password"
                  className="font-medium text-primary-700 dark:text-primary-300 hover:opacity-90"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>

            {canResendVerification && (
              <div>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={loading || resending}
                  className="w-full py-2 text-sm font-medium text-primary-700 dark:text-primary-300 hover:opacity-90 disabled:opacity-60"
                >
                  {resending ? 'Sending verification...' : 'Resend verification email'}
                </button>
              </div>
            )}
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-app-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-app-surface/90 text-app-text-secondary">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!!oauthLoading}
                onClick={() => handleOAuth('google')}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 border border-app-border rounded-md shadow-sm bg-app-surface text-sm font-medium text-app-text-strong hover:bg-app-hover dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {oauthLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
              </button>
              <button
                type="button"
                disabled={!!oauthLoading}
                onClick={() => handleOAuth('apple')}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 border border-app-border rounded-md shadow-sm bg-app-surface text-sm font-medium text-app-text-strong hover:bg-app-hover dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                {oauthLoading === 'apple' ? 'Redirecting...' : 'Continue with Apple'}
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-app-text-secondary dark:text-app-text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-primary-700 dark:text-primary-300 hover:opacity-90">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
