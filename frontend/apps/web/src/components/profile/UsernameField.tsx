'use client';

// ============================================================
// A person's username: the address of their profile link
// (pantopus.com/u/<username>). Nobody picks one at sign-up, so until
// they do it is one the server made up. Checks availability as the
// person types (after a pause), and says plainly that changing it
// changes the link and that old links stop working.
// ============================================================

import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import type { UsernameAvailability } from '@pantopus/api';
import { buildUserProfileShareUrl } from '@pantopus/utils';

export type UsernameStatus = 'unchanged' | 'checking' | 'available' | 'unavailable' | 'error';

/** A username as it would be saved: no spaces, no leading @, lowercase. */
export function normalizeUsernameInput(value: string): string {
  return value.replace(/\s+/g, '').replace(/^@+/, '').toLowerCase();
}

/** The profile link without the scheme, for reading. */
export function profileLinkLabel(username: string): string {
  return buildUserProfileShareUrl(username).replace(/^https?:\/\//, '');
}

const inputClass =
  'w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface';
const inputErrorClass = ' border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/20';

export default function UsernameField({
  id,
  value,
  onChange,
  currentUsername,
  currentIsMadeUp,
  serverError,
  onStatusChange,
  autoFocus = false,
  showCurrentLink = true,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  currentUsername: string;
  currentIsMadeUp: boolean;
  /** A message from a save the server rejected. */
  serverError?: string;
  onStatusChange?: (status: UsernameStatus) => void;
  autoFocus?: boolean;
  /** Say what the link is now (off where the surrounding copy already does). */
  showCurrentLink?: boolean;
}) {
  const [status, setStatus] = useState<UsernameStatus>('unchanged');
  const [message, setMessage] = useState('');
  const desired = normalizeUsernameInput(value);
  const changed = desired !== '' && desired !== currentUsername.toLowerCase();

  useEffect(() => {
    if (!changed) {
      setStatus('unchanged');
      setMessage('');
      return;
    }
    setStatus('checking');
    let current = true;
    const timer = window.setTimeout(async () => {
      try {
        const answer: UsernameAvailability = await api.users.checkUsernameAvailability(desired);
        if (!current) return;
        if (answer.available) {
          setStatus(answer.reason === 'current' ? 'unchanged' : 'available');
          setMessage('');
        } else {
          setStatus('unavailable');
          setMessage(answer.message || "That username isn't available. Try another.");
        }
      } catch {
        if (!current) return;
        setStatus('error');
        setMessage("Couldn't check that username. It's checked again when you save.");
      }
    }, 400);
    return () => { current = false; window.clearTimeout(timer); };
  }, [desired, changed]);

  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);

  const shownError = serverError || (status === 'unavailable' ? message : '');
  const statusId = `${id}-status`;

  return (
    <div>
      <div className="flex items-center rounded-lg">
        <span className="mr-2 text-app-secondary" aria-hidden="true">@</span>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(normalizeUsernameInput(e.target.value))}
          placeholder={currentIsMadeUp ? 'Choose a username' : currentUsername}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={30}
          autoFocus={autoFocus}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={statusId}
          className={inputClass + (shownError ? inputErrorClass : '')}
        />
      </div>
      <div id={statusId} aria-live="polite" className="mt-1 space-y-1 text-xs">
        {shownError ? (
          <p className="text-red-600 dark:text-red-300">{shownError}</p>
        ) : status === 'checking' ? (
          <p className="text-app-secondary">Checking…</p>
        ) : status === 'error' ? (
          <p className="text-app-secondary">{message}</p>
        ) : status === 'available' ? (
          <p className="text-green-700 dark:text-green-400">@{desired} is available.</p>
        ) : null}
        {changed && !shownError ? (
          <p className="text-app-secondary">
            Your profile link becomes <span className="font-medium text-app">{profileLinkLabel(desired)}</span>.
            {' '}Links to {profileLinkLabel(currentUsername)} will stop working.
          </p>
        ) : !changed && !showCurrentLink ? null : !changed && currentIsMadeUp ? (
          <p className="text-app-secondary">
            You haven&apos;t chosen one yet, so your profile link is {profileLinkLabel(currentUsername)} for now.
          </p>
        ) : !changed ? (
          <p className="text-app-secondary">Your profile link is {profileLinkLabel(currentUsername)}.</p>
        ) : null}
        <p className="text-app-muted">3 to 30 lowercase letters, numbers or underscores.</p>
      </div>
    </div>
  );
}
