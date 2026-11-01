'use client';

import { useState } from 'react';
import Image from 'next/image';
import { UserRound } from 'lucide-react';

// A person's initials sit on one color of their own, the same on iOS, Android and the web (profile build, README 7
// step 1): the account id's character codes, summed, pick one of five fills that carry white text at AA in both
// themes.
const PERSON_COLORS = ['#0369A1', '#047857', '#6D28D9', '#BE123C', '#475569'] as const;

export function personColor(seed: string | null | undefined): string {
  const value = String(seed ?? '').toLowerCase();
  let sum = 0;
  for (let i = 0; i < value.length; i += 1) sum += value.charCodeAt(i);
  return PERSON_COLORS[sum % PERSON_COLORS.length];
}

/** "Rowan Park" → "RP"; one word gives one letter. */
export function personInitials(name: string | null | undefined): string {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

interface ProfileAvatarProps {
  /** The name shown next to the avatar; its initials stand in for a missing photo. */
  name: string | null;
  /** The account id: it picks the person's color. */
  seed: string | null | undefined;
  photoUrl?: string | null;
  /** Diameter in px. */
  size: number;
  className?: string;
}

/** The person's photo, or their initials on their own color. Decorative: the name is always written beside it. */
export default function ProfileAvatar({ name, seed, photoUrl = null, size, className = '' }: ProfileAvatarProps) {
  // A photo that fails to load shows the initials rather than a broken image.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = personInitials(name);
  const style = { width: size, height: size };

  if (photoUrl && failedUrl !== photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        sizes={`${size}px`}
        quality={75}
        onError={() => setFailedUrl(photoUrl)}
        className={`shrink-0 rounded-full object-cover bg-app-surface-sunken ${className}`}
        style={style}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`shrink-0 rounded-full flex items-center justify-center font-semibold text-white select-none ${className}`}
      style={{ ...style, backgroundColor: personColor(seed), fontSize: Math.round(size * 0.36) }}
    >
      {initials || <UserRound className="w-1/2 h-1/2" />}
    </span>
  );
}
