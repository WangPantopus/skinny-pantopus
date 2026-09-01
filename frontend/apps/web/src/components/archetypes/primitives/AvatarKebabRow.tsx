// ============================================================
// AvatarKebabRow — avatar + name (with chip) + meta + kebab.
// People-first list row used for members, owners, connections.
// ============================================================

'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { MoreVertical, Check } from 'lucide-react';
import Chip, { type ChipVariant } from './Chip';

export interface AvatarKebabRowProps {
  name: ReactNode;
  avatarUrl?: string | null;
  initials?: string;
  avatarBg?: string;
  meta?: ReactNode;
  roleLabel?: string;
  roleVariant?: ChipVariant;
  verified?: boolean;
  onClick?: () => void;
  onKebabClick?: () => void;
  trailing?: ReactNode;
  className?: string;
}

function initialsFrom(name: ReactNode) {
  if (typeof name !== 'string') return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase();
}

export default function AvatarKebabRow({
  name,
  avatarUrl,
  initials,
  avatarBg,
  meta,
  roleLabel,
  roleVariant = 'neutral',
  verified,
  onClick,
  onKebabClick,
  trailing,
  className = '',
}: AvatarKebabRowProps) {
  const letters = useMemo(() => initials ?? initialsFrom(name), [initials, name]);

  const body = (
    <div className="flex items-center gap-3 p-4">
      <div className="relative shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
        ) : (
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-[15px]"
            style={{ background: avatarBg ?? 'var(--color-primary-600)' }}
          >
            {letters}
          </div>
        )}
        {verified ? (
          <span className="absolute -right-0.5 -bottom-0.5 w-4 h-4 rounded-full bg-app-home border-2 border-app-surface flex items-center justify-center">
            <Check size={9} className="text-white" strokeWidth={4} />
          </span>
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-app-text truncate">{name}</span>
          {roleLabel ? <Chip label={roleLabel} variant={roleVariant} /> : null}
        </div>
        {meta ? (
          <div className="text-xs text-app-text-secondary mt-0.5 truncate">{meta}</div>
        ) : null}
      </div>
      {trailing ??
        (onKebabClick ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onKebabClick();
            }}
            className="w-8 h-8 rounded-md flex items-center justify-center text-app-text-secondary hover:bg-app-hover shrink-0"
            aria-label="More options"
          >
            <MoreVertical size={18} />
          </button>
        ) : null)}
    </div>
  );

  const wrapperCls = `bg-app-surface border border-app-border rounded-2xl shadow-sm ${onClick ? 'hover:shadow-md hover:-translate-y-px transition' : ''}`;

  return onClick ? (
    <button type="button" onClick={onClick} className={`${wrapperCls} w-full text-left block ${className}`}>
      {body}
    </button>
  ) : (
    <div className={`${wrapperCls} ${className}`}>{body}</div>
  );
}
