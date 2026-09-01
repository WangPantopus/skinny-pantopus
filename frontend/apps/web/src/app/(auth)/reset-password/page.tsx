'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PantopusBadge from '@/components/PantopusBadge';
import * as api from '@pantopus/api';
import { extractApiError } from '@/lib/auth-utils';

const PASSWORD_MIN_LENGTH = 12;

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tokenFromHash, setTokenFromHash] = useState('');
  const [emailFromHash, setEmailFromHash] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const token = useMemo(() => {
    return (
      searchParams.get('token_hash') ||
      searchParams.get('token') ||
      searchParams.get('access_token') ||
      tokenFromHash
    );
  }, [searchParams, tokenFromHash]);

  const email = useMemo(() => {
    return searchParams.get('email') || emailFromHash || '';
  }, [searchParams, emailFromHash]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get('access_token') || '';
    const emailParam = hashParams.get('email') || '';
    if (accessToken) setTokenFromHash(accessToken);
    if (emailParam) setEmailFromHash(emailParam);
  }, []);

  // Cleanup redirect timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Reset token is missing or expired.');
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.auth.resetPassword(token, newPassword, email || undefined);
      setSuccess(response?.message || 'Password reset successful.');
      redirectTimeoutRef.current = setTimeout(() => router.push('/login'), 1200);
    } catch (err: unknown) {
      setError(extractApiError(err, 'Failed to reset password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <PantopusBadge />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-app-text dark:text-white">
          Set a new password
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-app-surface/90 backdrop-blur py-8 px-4 shadow-lg shadow-black/5 dark:shadow-black/30 rounded-2xl border border-app-border-subtle sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            ) : null}
            {success ? (
              <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
                {success}
              </div>
            ) : null}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-app-text-strong">
                New password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full rounded-md border border-app-border bg-app-surface px-3 py-2 pr-16 text-app-text placeholder-gray-400 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 dark:placeholder-gray-500"
                  placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-primary-700 dark:text-primary-300 hover:opacity-90 select-none"
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-app-text-strong">
                Confirm password
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPw ? 'text' : 'password'}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-md border border-app-border bg-app-surface px-3 py-2 pr-16 text-app-text placeholder-gray-400 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 dark:placeholder-gray-500"
                  placeholder="Repeat password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  aria-label={showConfirmPw ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-primary-700 dark:text-primary-300 hover:opacity-90 select-none"
                >
                  {showConfirmPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-app-text-secondary">
            <Link href="/login" className="font-medium text-primary-700 dark:text-primary-300 hover:opacity-90">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
