'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Camera } from 'lucide-react';
import * as api from '@pantopus/api';
import { extractApiError } from '@pantopus/ui-utils';
import { toast } from '@/components/ui/toast-store';
import ProfileAvatar from '@/components/profile/public/atoms/ProfileAvatar';
import { setOwnLocalProfile, type OwnLocalProfile } from '@/lib/me';

const smallButton =
  'min-h-[2.75rem] px-3.5 rounded-full border border-app-strong bg-surface text-[0.875rem] font-semibold text-app hover-bg-app disabled:opacity-50';

interface NeighborPhotoFieldProps {
  view: OwnLocalProfile;
  /** The account id: the color behind your initials. */
  accountId: string;
  /** The name as typed, for the initials. */
  name: string;
}

/**
 * The photo neighbors see on your profile, posts, comments and chats (your Local Profile's). It saves as soon as you
 * pick it, as Privacy's "How neighbors see you" card did: add or change it, use your account photo, or remove it.
 */
export default function NeighborPhotoField({ view, accountId, name }: NeighborPhotoFieldProps) {
  const { profile, account, followsAccount } = view;
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarUrl = profile.avatarUrl || null;

  const savePhoto = async (change: () => Promise<OwnLocalProfile>, message: string) => {
    setBusy(true);
    try {
      setOwnLocalProfile(await change());
      toast.success(message);
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Couldn't change the photo. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const onPickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
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

  const note = !avatarUrl
    ? (account.avatarUrl ? 'Neighbors see your initials, not your account photo.' : 'Neighbors see your initials until you add one.')
    : followsAccount.avatarUrl
      ? 'Your account photo: it changes when your account photo does.'
      : "A photo just for neighbors: changing your account photo won't change it.";

  return (
    <div id="photo" className="py-4 flex items-start gap-3.5 scroll-mt-24">
      <span className="relative shrink-0">
        <ProfileAvatar name={name} seed={accountId} photoUrl={avatarUrl} size={56} />
        <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-surface border border-app text-app-strong flex items-center justify-center">
          <Camera className="w-3.5 h-3.5" />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] leading-5 font-semibold text-app">Profile photo</p>
        <p className="mt-0.5 text-[0.8125rem] leading-[1.125rem] text-app-muted" aria-live="polite">{busy ? 'Saving…' : note}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={smallButton}>
            {avatarUrl ? 'Change photo' : 'Add photo'}
          </button>
          {account.avatarUrl && !followsAccount.avatarUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void savePhoto(
                () => api.localProfiles.updateMyLocalProfile({ avatar_url: account.avatarUrl }),
                'Neighbors now see your account photo',
              )}
              className={smallButton}
            >
              Use account photo
            </button>
          ) : null}
          {avatarUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void savePhoto(
                () => api.localProfiles.updateMyLocalProfile({ avatar_url: null }),
                'Neighbors now see your initials',
              )}
              className={smallButton}
            >
              Remove
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={onPickPhoto}
          className="hidden"
          aria-label="Choose the photo neighbors see"
        />
      </div>
    </div>
  );
}
