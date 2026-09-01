'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { authDevices, type StepUpPurpose } from '@pantopus/api';
import ModalShell from '@/components/ui/ModalShell';

/**
 * Password step-up (docs/persistent-login/CONTRACT.md §"POST /api/auth/step-up").
 *
 * On web the only server-verifiable step-up method is the password: the
 * biometric `device_key` method needs a hardware key that browsers do not
 * have. Resolves with the opaque `stepUpToken` (5-min, purpose-bound, one-shot
 * for destructive purposes) that the caller sends back as `X-Step-Up`.
 */
export interface StepUpRequest {
  purpose: StepUpPurpose;
  /** Human title, e.g. "Remove Ying's iPhone" */
  title: string;
  /** One-line explanation of what will happen once confirmed. */
  description?: string;
  /** Submit label, defaults to "Confirm". */
  confirmLabel?: string;
  /** Destructive styling hint (copy only; ModalShell owns the palette). */
  destructive?: boolean;
}

interface StepUpPasswordModalProps {
  request: StepUpRequest | null;
  /** Whether the account has a password (from GET /api/users/auth-methods). `null` = unknown/loading. */
  hasPassword: boolean | null;
  onResolve: (stepUpToken: string | null) => void;
}

function readErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { message?: unknown; statusCode?: number } | null | undefined;
  if (anyErr?.statusCode === 401) return 'Incorrect password. Please try again.';
  if (anyErr?.statusCode === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  return typeof anyErr?.message === 'string' && anyErr.message ? anyErr.message : fallback;
}

export default function StepUpPasswordModal({ request, hasPassword, onResolve }: StepUpPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset local state whenever a new request opens.
  useEffect(() => {
    if (!request) return;
    setPassword('');
    setShow(false);
    setError('');
    setSubmitting(false);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [request]);

  if (!request) return null;

  const cancel = () => {
    if (submitting) return;
    onResolve(null);
  };

  const submit = async () => {
    if (!password || submitting || hasPassword === false) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await authDevices.stepUpWithPassword(request.purpose, password);
      if (!res?.stepUpToken) {
        setError('Could not confirm your identity. Please try again.');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      onResolve(res.stepUpToken);
    } catch (err: unknown) {
      setError(readErrorMessage(err, 'Could not confirm your identity. Please try again.'));
      setSubmitting(false);
    }
  };

  const noPassword = hasPassword === false;

  return (
    <ModalShell
      open
      onClose={cancel}
      onCancel={cancel}
      icon={KeyRound}
      title={request.title}
      subtitle={request.description || 'Confirm your password to continue.'}
      cancelLabel="Cancel"
      submitLabel={request.confirmLabel || 'Confirm'}
      onSubmit={submit}
      submitDisabled={noPassword || password.length === 0}
      submitting={submitting}
      submitIcon={ShieldCheck}
      maxWidth="max-w-md"
    >
      {noPassword ? (
        <div className="rounded-lg border border-app-border bg-app-surface-muted p-4 text-sm text-app-text-secondary space-y-2">
          <p className="font-medium text-app-text">This account has no password yet.</p>
          <p>
            Sensitive actions on the web need a password. Set one first, or confirm this action from the
            Pantopus app on a phone where you are signed in (Face ID / fingerprint).
          </p>
          <Link href="/app/profile/settings/password" className="inline-block text-emerald-700 font-medium hover:underline">
            Set a password →
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-3"
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-app-text-strong">Password</span>
            <div className="relative">
              <input
                ref={inputRef}
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                disabled={submitting}
                aria-label="Password"
                className="w-full px-3 py-2.5 pr-10 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>
          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <p className="text-xs text-app-text-muted">
            {request.destructive
              ? 'This confirmation is valid for one action and expires in 5 minutes.'
              : 'Your confirmation expires in 5 minutes.'}
          </p>
          {/* Hidden submit so Enter works inside the form. */}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      )}
    </ModalShell>
  );
}
