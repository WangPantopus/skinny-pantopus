// ============================================================
// PostAuthorHeader — 44px avatar + name/meta + intent chip.
// Used on Pulse post detail pages.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { Chip, type ChipVariant } from '../../primitives';

export interface PostAuthorHeaderProps {
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  meta?: string;
  intentLabel?: string;
  intentVariant?: ChipVariant;
  intentIcon?: LucideIcon;
  verified?: boolean;
  onAvatarClick?: () => void;
  className?: string;
}

export default function PostAuthorHeader({
  name,
  avatarUrl,
  initials,
  meta,
  intentLabel,
  intentVariant = 'primary',
  intentIcon,
  verified,
  onAvatarClick,
  className = '',
}: PostAuthorHeaderProps) {
  const letters = (initials ?? name.slice(0, 2)).toUpperCase();
  return (
    <header className={`flex items-center gap-3 py-3 ${className}`}>
      <button
        type="button"
        onClick={onAvatarClick}
        disabled={!onAvatarClick}
        className="relative shrink-0 disabled:cursor-default"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
        ) : (
          <div className="w-11 h-11 rounded-full bg-primary-600 text-white font-bold text-base flex items-center justify-center">
            {letters}
          </div>
        )}
        {verified ? (
          <span className="absolute -right-0.5 -bottom-0.5 w-4 h-4 rounded-full bg-app-home border-2 border-app-surface flex items-center justify-center">
            <Check size={9} className="text-white" strokeWidth={4} />
          </span>
        ) : null}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-app-text truncate">{name}</div>
        {meta ? <div className="text-xs text-app-text-secondary mt-0.5 truncate">{meta}</div> : null}
      </div>
      {intentLabel ? <Chip label={intentLabel} variant={intentVariant} icon={intentIcon} size="md" /> : null}
    </header>
  );
}
