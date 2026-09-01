// @ts-nocheck
'use client';

// ============================================================
// Register — the wedge slim signup (Phase 1).
//
// Email + password (or OAuth) and nothing else: no username (the
// backend auto-generates a handle — usernames belong to the creator
// layer), no name fields (collected later, in the claim flow, where
// they're actually needed). The page usually receives a pendingPlace
// stashed by /start, and lands on /app/place to claim it.
// ============================================================

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

const PASSWORD_MIN_LENGTH = 12;

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = (searchParams.get('email') || '').trim().toLowerCase();
  const redirectTo = readAuthRedirectQuery(searchParams) || undefined;
  type FieldErrors = Record<string, string>;
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!prefillEmail) return;
    setFormData((prev) => (prev.email ? prev : { ...prev, email: prefillEmail }));
  }, [prefillEmail]);

  // Funnel: the register form mounted (fires once per mount; the anon id
  // joins this to the T0 preview events).
  useEffect(() => {
    api.recordFunnelEvent('register_started');
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.name;
    if (error) setError('');
    setFormData((prev) => ({
      ...prev,
      [key]: e.target.value,
    }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      let changed = false;
      if (prev[key]) {
        delete next[key];
        changed = true;
      }
      if ((key === 'password' || key === 'confirmPassword') && prev.confirmPassword) {
        delete next.confirmPassword;
        changed = true;
      }
      if (!changed) return prev;
      return next;
    });
  };

  const passwordHint = useMemo(() => {
    const p = formData.password;
    if (!p) return `Use at least ${PASSWORD_MIN_LENGTH} characters. A passphrase is a strong choice.`;
    if (p.length < PASSWORD_MIN_LENGTH) return `Too short. Aim for ${PASSWORD_MIN_LENGTH}+ characters.`;
    if (p.length < 16) return 'Good start. Longer is even better.';
    return 'Strong password length.';
  }, [formData.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const nextFieldErrors: FieldErrors = {};

    if (formData.password.length < PASSWORD_MIN_LENGTH) {
      nextFieldErrors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }
    if (formData.password !== formData.confirmPassword) {
      nextFieldErrors.confirmPassword = 'Passwords do not match.';
    }
    if (!termsAccepted) {
      nextFieldErrors.terms = 'You must accept the Terms of Service and Privacy Policy.';
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError(Object.values(nextFieldErrors)[0]);
      return;
    }

    setLoading(true);

    try {
      const anonId = api.getFunnelAnonId();
      const response = await api.auth.register({
        email: normalizeEmail(formData.email),
        password: formData.password,
        ...(anonId ? { anon_id: anonId } : {}),
      });

      const respObj = response as Record<string, any>;
      const token = (respObj.accessToken || respObj.token) as string | undefined;
      if (token) {
        // Backend sets httpOnly cookies via same-origin proxy.
        router.push(safeRedirectPath(redirectTo, '/app/place'));
      } else {
        const emailForNext = encodeURIComponent(normalizeEmail(formData.email));
        router.push(`/verify-email-sent?email=${emailForNext}`);
      }
    } catch (err: unknown) {
      setFieldErrors(extractFieldErrors(err));
      setError(extractApiError(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    if (oauthLoading) return;
    setOauthLoading(provider);
    try {
      const { url } = await api.auth.getOAuthUrl(
        provider,
        oauthRedirectParamForWeb(redirectTo, typeof window !== 'undefined' ? window.location.origin : undefined),
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

  const labelClass = 'block text-sm font-medium text-app-text-strong';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="flex justify-center">
          <PantopusBadge />
        </div>

        <h2 className="mt-6 text-center text-3xl font-bold text-app-text dark:text-white">
          Create your free account
        </h2>

        <p className="mt-2 text-center text-sm text-app-text-secondary">
          Save your place and get daily updates about it.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-app-surface/90 backdrop-blur py-8 px-4 shadow-lg shadow-black/5 dark:shadow-black/30 rounded-2xl border border-app-border-subtle sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div role="alert" className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg whitespace-pre-line">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className={labelClass}>
                Email address <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className={inputClass + (fieldErrors.email ? inputErrorClass : '')}
                  placeholder="you@example.com"
                />
                {fieldErrors.email ? <p className={fieldErrorClass}>{fieldErrors.email}</p> : null}
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className={labelClass}>
                Password <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={formData.password}
                  onChange={handleChange}
                  className={inputClass + ' pr-20' + (fieldErrors.password ? inputErrorClass : '')}
                  placeholder="Create a secure password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-2 my-auto h-9 px-3 rounded-md text-sm font-medium text-app-text-strong hover:bg-app-hover dark:hover:bg-gray-800"
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password ? <p className={fieldErrorClass}>{fieldErrors.password}</p> : null}
              <p className="mt-1 text-xs text-app-text-secondary dark:text-app-text-muted">{passwordHint}</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className={labelClass}>
                Confirm password <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={inputClass + ' pr-20' + (fieldErrors.confirmPassword ? inputErrorClass : '')}
                  placeholder="Repeat your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  aria-label={showConfirmPw ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute inset-y-0 right-2 my-auto h-9 px-3 rounded-md text-sm font-medium text-app-text-strong hover:bg-app-hover dark:hover:bg-gray-800"
                >
                  {showConfirmPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.confirmPassword ? <p className={fieldErrorClass}>{fieldErrors.confirmPassword}</p> : null}
            </div>

            {/* Terms */}
            <div>
              <div className="flex items-start gap-3">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked && fieldErrors.terms) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.terms;
                        return next;
                      });
                    }
                  }}
                  className={`mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-app-border rounded bg-app-surface${fieldErrors.terms ? ' border-red-300 dark:border-red-700' : ''}`}
                />
                <label htmlFor="terms" className="text-sm text-app-text-strong">
                  I agree to the{' '}
                  <Link href="/terms" className="text-primary-700 dark:text-primary-300 hover:opacity-90">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-primary-700 dark:text-primary-300 hover:opacity-90">
                    Privacy Policy
                  </Link>
                  .
                </label>
              </div>
              {fieldErrors.terms ? <p className={fieldErrorClass}>{fieldErrors.terms}</p> : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>

            <p className="text-center text-xs text-app-text-secondary dark:text-app-text-muted">
              Private by default. Your name and profile come later — only when you need them.
            </p>
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
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary-700 dark:text-primary-300 hover:opacity-90">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}
