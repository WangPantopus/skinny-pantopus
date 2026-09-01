'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PantopusBadge from '@/components/PantopusBadge';
import * as api from '@pantopus/api';
import { extractApiError, normalizeEmail } from '@/lib/auth-utils';

const RESEND_COOLDOWN_SECONDS = 30;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (cooldown > 0) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.auth.requestPasswordReset(normalizeEmail(email));
      setSuccess(response?.message || 'If that email exists, a reset link has been sent.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError(extractApiError(err, 'Failed to send reset link.'));
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
          Forgot your password?
        </h2>
        <p className="mt-2 text-center text-sm text-app-text-secondary">
          Enter your email and we&apos;ll send a reset link.
        </p>
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
              <label htmlFor="email" className="block text-sm font-medium text-app-text-strong">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-app-text placeholder-gray-400 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 dark:placeholder-gray-500"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="w-full flex justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send reset link'}
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
