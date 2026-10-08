'use client';

// ============================================================
// "Pick a username for your link" — asked the first time someone
// shares their own profile while its link still uses the username the
// server made up (pantopus.com/u/user_3f9a…). Save and share, or share
// the link as it is; either way this browser doesn't ask again.
// ============================================================

import { useState } from 'react';
import { AtSign } from 'lucide-react';
import * as api from '@pantopus/api';
import type { User } from '@pantopus/types';
import ModalShell from '@/components/ui/ModalShell';
import UsernameField, { profileLinkLabel, type UsernameStatus } from '@/components/profile/UsernameField';
import { extractApiError } from '@/lib/auth-utils';

const ASKED_KEY = 'pantopus.usernamePrompt.asked';

/** True when this browser hasn't asked this account yet. */
export function shouldAskForUsername(user: Pick<User, 'id' | 'usernameIsGenerated'> | null | undefined): boolean {
  if (!user?.id || !user.usernameIsGenerated) return false;
  try {
    return window.localStorage.getItem(`${ASKED_KEY}:${user.id}`) !== '1';
  } catch {
    return true;
  }
}

export function markAskedForUsername(userId: string) {
  try { window.localStorage.setItem(`${ASKED_KEY}:${userId}`, '1'); } catch { /* private mode: it may ask again */ }
}

export default function UsernamePrompt({
  open,
  currentUsername,
  onShareAsIs,
  onSaved,
}: {
  open: boolean;
  currentUsername: string;
  /** Share the link as it is (the made-up username). */
  onShareAsIs: () => void;
  /** Saved: share the new link. */
  onSaved: (user: User) => void;
}) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<UsernameStatus>('unchanged');
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value || status !== 'available') return;
    setSaving(true);
    setServerError('');
    try {
      const { user } = await api.users.updateProfile({ username: value });
      onSaved(user);
    } catch (err) {
      setServerError(extractApiError(err, "Your username wasn't saved. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onShareAsIs}
      icon={AtSign}
      title="Pick a username for your link"
      subtitle={`Your profile link uses a made-up name: ${profileLinkLabel(currentUsername)}. Choose one people will recognize.`}
      cancelLabel="Share as is"
      onCancel={onShareAsIs}
      cancelDisabled={saving}
      submitLabel="Save and share"
      onSubmit={save}
      submitDisabled={status !== 'available'}
      submitting={saving}
      maxWidth="max-w-md"
    >
      <form
        className="px-6 pb-2"
        onSubmit={(e) => { e.preventDefault(); save(); }}
        noValidate
      >
        <label htmlFor="username-prompt-field" className="mb-2 block text-sm font-medium text-app-text-strong">Username</label>
        <UsernameField
          id="username-prompt-field"
          value={value}
          onChange={(next) => { setValue(next); setServerError(''); }}
          currentUsername={currentUsername}
          currentIsMadeUp
          serverError={serverError}
          onStatusChange={setStatus}
          autoFocus
          showCurrentLink={false}
        />
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </ModalShell>
  );
}
