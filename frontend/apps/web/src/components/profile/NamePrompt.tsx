'use client';

// ============================================================
// "What should we call you?" — asked once of an account that has
// no first or last name (accounts made while sign-up asked only for
// an email and password, and Google or Apple sign-ins that brought no
// name). Without a name, the household, neighbors and helpers see a
// stand-in instead of the person. Save or Not now; either way this
// browser doesn't ask that account again (Edit Profile still can).
// ============================================================

import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import * as api from '@pantopus/api';
import type { User } from '@pantopus/types';
import ModalShell from '@/components/ui/ModalShell';
import { extractApiError } from '@/lib/auth-utils';

const ASKED_KEY = 'pantopus.namePrompt.asked';

function askedKey(userId: string) {
  return `${ASKED_KEY}:${userId}`;
}

function wasAsked(userId: string): boolean {
  try {
    return window.localStorage.getItem(askedKey(userId)) === '1';
  } catch {
    return false;
  }
}

function markAsked(userId: string) {
  try { window.localStorage.setItem(askedKey(userId), '1'); } catch { /* private mode: it may ask again */ }
}

/** True when the account is missing a first or last name. */
export function isMissingName(user: Pick<User, 'firstName' | 'lastName'> | null | undefined): boolean {
  return !user?.firstName?.trim() || !user?.lastName?.trim();
}

const inputClass =
  'appearance-none block w-full px-3 py-2 rounded-md shadow-sm border border-app-border bg-app-surface text-app-text ' +
  'placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500';
const inputErrorClass = ' border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/20';
const labelClass = 'block text-sm font-medium text-app-text-strong';
const fieldErrorClass = 'mt-1 text-xs text-red-600 dark:text-red-300';

export default function NamePrompt({
  user,
  onSaved,
  onOpenChange,
}: {
  user: User | null;
  onSaved: (user: User) => void;
  /** AppShell holds its promo cards while this is open, so two dialogs never stack. */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const userId = user?.id ? String(user.id) : null;
  const isBusiness = user?.accountType === 'business';

  useEffect(() => {
    if (!userId || isBusiness || !isMissingName(user) || wasAsked(userId)) return;
    setFirstName(user?.firstName?.trim() || '');
    setMiddleName(user?.middleName?.trim() || '');
    setLastName(user?.lastName?.trim() || '');
    setOpen(true);
    // Asked once: mark it now, so a reload or another tab doesn't ask again.
    markAsked(userId);
  }, [userId, isBusiness, user]);

  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

  const close = () => setOpen(false);

  const save = async () => {
    const next: { firstName?: string; lastName?: string } = {};
    if (!firstName.trim()) next.firstName = 'Enter your first name.';
    if (!lastName.trim()) next.lastName = 'Enter your last name.';
    setErrors(next);
    setError('');
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      const { user: saved } = await api.users.updateProfile({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
      });
      onSaved(saved);
      setOpen(false);
    } catch (err) {
      setError(extractApiError(err, "Your name wasn't saved. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={close}
      icon={UserRound}
      title="What should we call you?"
      subtitle="Add your name so your household and neighbors know who you are."
      cancelLabel="Not now"
      onCancel={close}
      cancelDisabled={saving}
      submitLabel="Save"
      onSubmit={save}
      submitting={saving}
      maxWidth="max-w-md"
    >
      <form
        className="space-y-4 px-6 pb-2"
        onSubmit={(e) => { e.preventDefault(); save(); }}
        noValidate
      >
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="name-prompt-first" className={labelClass}>
            First name <span className="text-red-500">*</span>
          </label>
          <input
            id="name-prompt-first"
            autoComplete="given-name"
            maxLength={255}
            value={firstName}
            onChange={(e) => { setFirstName(e.target.value); if (errors.firstName) setErrors((p) => ({ ...p, firstName: undefined })); }}
            aria-invalid={errors.firstName ? true : undefined}
            aria-describedby={errors.firstName ? 'name-prompt-first-error' : undefined}
            className={`mt-1 ${inputClass}${errors.firstName ? inputErrorClass : ''}`}
          />
          {errors.firstName ? <p id="name-prompt-first-error" className={fieldErrorClass}>{errors.firstName}</p> : null}
        </div>
        <div>
          <label htmlFor="name-prompt-middle" className={labelClass}>
            Middle name <span className="font-normal text-app-text-secondary">(optional)</span>
          </label>
          <input
            id="name-prompt-middle"
            autoComplete="additional-name"
            maxLength={255}
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="name-prompt-last" className={labelClass}>
            Last name <span className="text-red-500">*</span>
          </label>
          <input
            id="name-prompt-last"
            autoComplete="family-name"
            maxLength={255}
            value={lastName}
            onChange={(e) => { setLastName(e.target.value); if (errors.lastName) setErrors((p) => ({ ...p, lastName: undefined })); }}
            aria-invalid={errors.lastName ? true : undefined}
            aria-describedby={errors.lastName ? 'name-prompt-last-error' : undefined}
            className={`mt-1 ${inputClass}${errors.lastName ? inputErrorClass : ''}`}
          />
          {errors.lastName ? <p id="name-prompt-last-error" className={fieldErrorClass}>{errors.lastName}</p> : null}
        </div>
        {/* Enter submits from any field. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </ModalShell>
  );
}
