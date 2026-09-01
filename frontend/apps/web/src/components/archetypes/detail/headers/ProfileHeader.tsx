// ============================================================
// ProfileHeader — centered 72px avatar + identity chip row +
// name + handle + locality. Used on public profiles and
// business headers.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { Chip, type ChipVariant } from '../../primitives';

export interface ProfileHeaderIdentity {
  label: string;
  variant: ChipVariant;
  icon?: LucideIcon;
}

export interface ProfileHeaderProps {
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  handle?: string;
  locality?: string;
  identities?: ProfileHeaderIdentity[];
  verified?: boolean;
  businessOpenLabel?: string;
  className?: string;
}

export default function ProfileHeader({
  name,
  avatarUrl,
  initials,
  handle,
  locality,
  identities,
  verified,
  businessOpenLabel,
  className = '',
}: ProfileHeaderProps) {
  const letters = (initials ?? name.slice(0, 2)).toUpperCase();
  return (
    <header className={`flex flex-col items-center text-center py-6 ${className}`}>
      <div className="relative mb-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-[72px] h-[72px] rounded-full object-cover" />
        ) : (
          <div className="w-[72px] h-[72px] rounded-full bg-primary-600 text-white font-bold text-[26px] flex items-center justify-center">
            {letters}
          </div>
        )}
        {verified ? (
          <span className="absolute -right-0.5 -bottom-0.5 w-6 h-6 rounded-full bg-app-home border-2 border-app-surface flex items-center justify-center">
            <Check size={14} className="text-white" strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <h1 className="text-[22px] font-bold text-app-text -tracking-[0.015em] truncate">{name}</h1>
      {(handle || locality) ? (
        <p className="text-[13px] text-app-text-secondary mt-0.5">
          {[handle, locality].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {businessOpenLabel ? (
        <p className="text-[13px] text-app-success font-semibold mt-0.5">{businessOpenLabel}</p>
      ) : null}
      {identities && identities.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
          {identities.map((id) => (
            <Chip key={id.label} label={id.label} variant={id.variant} icon={id.icon} size="md" />
          ))}
        </div>
      ) : null}
    </header>
  );
}
