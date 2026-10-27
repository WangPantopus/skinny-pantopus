'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import * as api from '@pantopus/api';
import { extractApiError, extractFieldErrors } from '@pantopus/ui-utils';
import { toast } from '@/components/ui/toast-store';
import { setOwnLocalProfile, useOwnLocalProfile, type OwnLocalProfile } from '@/lib/me';

const secondaryButtonClass =
  'px-4 py-2 bg-surface text-app-strong border border-app-strong rounded-lg hover:bg-surface-raised font-medium text-sm disabled:opacity-50';

/**
 * How neighbors see you: the name and photo other people see on your posts, comments, chats, tasks and notices
 * (your Local Profile). Your account name stays private. A name or photo you choose here stays when you edit your
 * account; one that is still your account's moves with it.
 */
export default function NeighborsSeeYouCard({ enabled, username }: { enabled: boolean; username?: string | null }) {
  const query = useOwnLocalProfile({ enabled });
  const view = query.data;
  // The name as typed, until it is saved; null shows the saved one.
  const [draft, setDraft] = useState<string | null>(null);
  const [nameError, setNameError] = useState('');
  const [busy, setBusy] = useState<'name' | 'photo' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Not offered when the server has no Local Profiles (the identity firewall switched off answers 404).
  if ((query.error as { statusCode?: number } | null)?.statusCode === 404) return null;

  const header = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <UserRound className="w-5 h-5 text-app-secondary" />
        <h2 className="text-lg font-semibold text-app">How neighbors see you</h2>
      </div>
      <p className="text-sm text-app-secondary mb-4">
        Your name and photo on your posts, comments, chats, tasks and notices. Your account name stays private.
      </p>
    </>
  );

  if (!view) {
    return (
      <div className="bg-surface rounded-xl border border-app p-6" data-testid="neighbors-see-you">
        {header}
        {query.isError ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-app-secondary">We couldn&apos;t load how neighbors see you.</p>
            <button type="button" onClick={() => { void query.refetch(); }} className={secondaryButtonClass}>
              Try again
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-surface-muted" />
            <div className="h-4 w-40 rounded bg-surface-muted" />
          </div>
        )}
      </div>
    );
  }

  const { profile, account, followsAccount } = view;
  const name = draft ?? profile.displayName;
  const trimmed = name.replace(/\s+/g, ' ').trim();
  const nameChanged = trimmed !== profile.displayName;
  const avatarUrl = profile.avatarUrl || null;

  const saved = (next: OwnLocalProfile, message: string) => {
    setOwnLocalProfile(next);
    toast.success(message);
  };

  const saveName = async (value: string) => {
    if (!value) {
      setNameError('Enter the name neighbors should see.');
      return;
    }
    setBusy('name');
    setNameError('');
    try {
      const next = await api.localProfiles.updateMyLocalProfile({ display_name: value });
      setDraft(null);
      saved(next, `Neighbors now see you as ${next.profile.displayName}`);
    } catch (err: unknown) {
      const fields = extractFieldErrors(err) as Record<string, string | undefined>;
      setNameError(fields.display_name || extractApiError(err, "Couldn't save the name. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const savePhoto = async (change: () => Promise<OwnLocalProfile>, message: string) => {
    setBusy('photo');
    try {
      saved(await change(), message);
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Couldn't change the photo. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, GIF, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    void savePhoto(() => api.upload.uploadLocalProfilePicture(file), 'Neighbors now see your new photo');
  };

  const nameNote = followsAccount.displayName
    ? 'Same as your account name: it changes when you change your name in Edit Profile.'
    : "Only for neighbors: changing your account name won't change it.";
  const photoNote = !avatarUrl
    ? (account.avatarUrl ? 'No photo: neighbors see your initials, not your account photo.' : 'No photo: neighbors see your initials.')
    : followsAccount.avatarUrl
      ? 'Your account photo: it changes when you change it in Edit Profile.'
      : "A photo just for neighbors: changing your account photo won't change it.";

  return (
    <div className="bg-surface rounded-xl border border-app p-6" data-testid="neighbors-see-you">
      {header}

      {/* What other people see */}
      <div className="flex items-center gap-4 mb-5">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            className="w-16 h-16 rounded-full object-cover border border-app"
            width={64}
            height={64}
            sizes="64px"
            quality={75}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold">
            {profile.displayName.trim().charAt(0).toUpperCase() || '?'}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-app truncate" data-testid="neighbors-see-you-name">{profile.displayName}</p>
          {profile.handle ? <p className="text-sm text-app-secondary truncate">@{profile.handle}</p> : null}
        </div>
      </div>

      {/* Name */}
      <label htmlFor="neighbors-see-you-name-input" className="block text-sm font-medium text-app-strong mb-2">
        Name neighbors see
      </label>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nameChanged) void saveName(trimmed);
        }}
      >
        <input
          id="neighbors-see-you-name-input"
          type="text"
          value={name}
          maxLength={255}
          onChange={(e) => { setDraft(e.target.value); setNameError(''); }}
          aria-invalid={nameError ? true : undefined}
          aria-describedby="neighbors-see-you-name-note"
          className={'flex-1 min-w-0 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface ' + (nameError ? 'border-red-500' : 'border-app-strong')}
        />
        <button
          type="submit"
          disabled={!nameChanged || busy !== null}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
        >
          {busy === 'name' ? 'Saving…' : 'Save'}
        </button>
      </form>
      {nameError ? <p className="text-sm text-red-600 mt-1" role="alert">{nameError}</p> : null}
      <p id="neighbors-see-you-name-note" className="text-xs text-app-secondary mt-1">{nameNote}</p>
      {!followsAccount.displayName ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void saveName(account.displayName)}
          className="mt-2 text-sm font-medium text-primary-600 hover:underline disabled:opacity-50"
        >
          Use my account name ({account.displayName})
        </button>
      ) : null}

      {/* Photo */}
      <div className="mt-5">
        <span className="block text-sm font-medium text-app-strong mb-2">Photo neighbors see</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy !== null} onClick={() => fileRef.current?.click()} className={secondaryButtonClass}>
            {busy === 'photo' ? 'Saving…' : avatarUrl ? 'Change photo' : 'Add photo'}
          </button>
          {account.avatarUrl && !followsAccount.avatarUrl ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void savePhoto(
                () => api.localProfiles.updateMyLocalProfile({ avatar_url: account.avatarUrl }),
                'Neighbors now see your account photo',
              )}
              className={secondaryButtonClass}
            >
              Use account photo
            </button>
          ) : null}
          {avatarUrl ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void savePhoto(
                () => api.localProfiles.updateMyLocalProfile({ avatar_url: null }),
                'Neighbors now see your initials',
              )}
              className={secondaryButtonClass}
            >
              Remove photo
            </button>
          ) : null}
        </div>
        <p className="text-xs text-app-secondary mt-2">{photoNote}</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={onPickPhoto}
          className="hidden"
        />
      </div>

      {username ? (
        <a
          href={`/${encodeURIComponent(username)}?preview=public`}
          className="inline-block mt-5 text-sm font-medium text-primary-600 hover:underline"
        >
          Preview your profile as others see it →
        </a>
      ) : null}
    </div>
  );
}
