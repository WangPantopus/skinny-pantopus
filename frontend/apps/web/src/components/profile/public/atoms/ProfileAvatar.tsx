'use client';

import { useState } from 'react';
import Image from 'next/image';
import { UserRound } from 'lucide-react';
import { personColor, personInitials } from '@/lib/personColor';

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
