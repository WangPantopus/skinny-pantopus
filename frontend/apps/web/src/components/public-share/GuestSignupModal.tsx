'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FormEvent } from 'react';

type ContributionMode = 'cook' | 'takeout' | 'groceries';

type GuestSignupModalProps = {
  supportTrainId: string;
  slotId: string;
  slotLabel: string;
  slotDate: string;
  appUrl: string;
  fallbackUrl: string | null;
  enabledModes: ContributionMode[];
  onClose: () => void;
  onSuccess: () => void;
};

type Step = 'choose' | 'form' | 'success';

export default function GuestSignupModal({
  supportTrainId,
  slotId,
  slotLabel,
  slotDate,
  appUrl,
  fallbackUrl,
  enabledModes,
  onClose,
  onSuccess,
}: GuestSignupModalProps) {
  const [step, setStep] = useState<Step>('choose');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contributionMode, setContributionMode] = useState<ContributionMode>(
    enabledModes[0] || 'cook'
  );
  const [noteToRecipient, setNoteToRecipient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingAccountWarning, setExistingAccountWarning] = useState(false);
  const [signedUpWithAccount, setSignedUpWithAccount] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const modeLabels: Record<ContributionMode, string> = {
    cook: 'Home-cooked meal',
    takeout: 'Takeout',
    groceries: 'Groceries',
  };

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus the dialog on mount
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Clean up fallback timer on unmount
  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  // Escape key to close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'success') {
        onClose();
      }
    },
    [onClose, step]
  );

  async function submitGuestSignup(allowExistingAccountGuest = false) {
    if (submitting) return;
    setError(null);
    setExistingAccountWarning(false);
    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/activities/support-trains/${supportTrainId}/slots/${slotId}/guest-reserve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_name: name.trim(),
            guest_email: email.trim().toLowerCase(),
            allow_guest_for_existing_account: allowExistingAccountGuest,
            contribution_mode: contributionMode,
            note_to_recipient: noteToRecipient.trim() || null,
          }),
        }
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        if (body?.error === 'ACCOUNT_EXISTS') {
          setExistingAccountWarning(true);
          return;
        }
        throw new Error(body?.message || 'Failed to sign up. Please try again.');
      }

      setSignedUpWithAccount(!!body?.user_id && !body?.guest_email);
      setStep('success');
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : null;
      setError(
        err instanceof TypeError
          ? 'Network error. Please check your connection and try again.'
          : message || 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await submitGuestSignup(false);
  }

  function handleOpenInApp() {
    window.location.assign(appUrl);
    if (fallbackUrl) {
      const url = fallbackUrl;
      fallbackTimerRef.current = setTimeout(() => {
        window.location.assign(url);
      }, 1200);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop — clicking it closes the modal */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={step !== 'success' ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Sign up for ${slotLabel}`}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl focus:outline-none sm:rounded-2xl sm:p-8"
      >
        {/* Close button */}
        {step !== 'success' && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {/* Step: Choose signup method */}
        {step === 'choose' && (
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Sign up for {slotLabel}</h3>
            <p className="mt-1 text-sm text-gray-500">{slotDate}</p>

            <div className="mt-6 space-y-3">
              {/* Pantopus app option */}
              <button
                onClick={handleOpenInApp}
                className="flex w-full items-start gap-4 rounded-xl border-2 border-primary-200 bg-primary-50 p-4 text-left transition hover:border-primary-400"
              >
                <span className="mt-0.5 text-2xl">📱</span>
                <div>
                  <p className="font-semibold text-gray-900">Sign up on Pantopus</p>
                  <p className="mt-1 text-sm text-gray-600">
                    One-tap signup, real-time updates, delivery coordination, and direct chat with
                    the organizer.
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                    Recommended
                  </span>
                </div>
              </button>

              {/* Email option */}
              <button
                onClick={() => setStep('form')}
                className="flex w-full items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-gray-300 hover:bg-gray-50"
              >
                <span className="mt-0.5 text-2xl">✉️</span>
                <div>
                  <p className="font-semibold text-gray-900">Sign up with email</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Quick signup with just your name and email. The organizer will follow up with
                    delivery details.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step: Email signup form */}
        {step === 'form' && (
          <div>
            <button
              onClick={() => setStep('choose')}
              className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Back
            </button>

            <h3 className="text-xl font-semibold text-gray-900">Sign up with email</h3>
            <p className="mt-1 text-sm text-gray-500">
              {slotLabel} · {slotDate}
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="guest-name" className="block text-sm font-medium text-gray-700">
                  Your name
                </label>
                <input
                  id="guest-name"
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Jane Smith"
                />
              </div>

              <div>
                <label htmlFor="guest-email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="guest-email"
                  type="email"
                  required
                  maxLength={320}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setExistingAccountWarning(false);
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="jane@example.com"
                />
              </div>

              {enabledModes.length > 1 ? (
                <div>
                  <label
                    htmlFor="contribution-mode"
                    className="block text-sm font-medium text-gray-700"
                  >
                    How will you help?
                  </label>
                  <select
                    id="contribution-mode"
                    value={contributionMode}
                    onChange={(e) => setContributionMode(e.target.value as ContributionMode)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {enabledModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {modeLabels[mode]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : enabledModes.length === 1 ? (
                <p className="text-sm text-gray-600">
                  Signing up to bring: <strong>{modeLabels[enabledModes[0]]}</strong>
                </p>
              ) : null}

              <div>
                <label
                  htmlFor="note-to-recipient"
                  className="block text-sm font-medium text-gray-700"
                >
                  Note to recipient <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="note-to-recipient"
                  maxLength={1000}
                  value={noteToRecipient}
                  onChange={(e) => setNoteToRecipient(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Any dietary notes or a message for the family"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              {existingAccountWarning && (
                <div
                  className="rounded-xl border border-primary-200 bg-primary-50 p-4"
                  role="alert"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    This email already has a Pantopus account.
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Sign up through Pantopus for chat and in-app location sharing, or continue with
                    email as a guest.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleOpenInApp}
                      className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                    >
                      Open Pantopus
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void submitGuestSignup(true)}
                      className="rounded-full border border-primary-200 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continue with email
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !name.trim() || !email.trim()}
                className="w-full rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Signing up...' : 'Sign Up'}
              </button>
            </form>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="text-center">
            <div className="text-4xl">🎉</div>
            <h3 className="mt-3 text-xl font-semibold text-gray-900">You&rsquo;re signed up!</h3>
            <p className="mt-2 text-sm text-gray-600">
              {signedUpWithAccount ? (
                <>
                  This signup is linked to your Pantopus account. The organizer can share delivery
                  details with you in-app.
                </>
              ) : (
                <>
                  We&rsquo;ve sent a confirmation to <strong>{email}</strong>. The organizer will
                  share delivery details closer to the date.
                </>
              )}
            </p>

            <div className="mt-6 space-y-3">
              <button
                onClick={handleOpenInApp}
                className="w-full rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
              >
                Get the Pantopus App
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-full border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
