// ============================================================
// FileChevronRow — typed-file row with circular icon + name +
// meta + right chevron. Meant to be placed inside a grouped card.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface FileChevronRowProps {
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  name: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
  last?: boolean;
  trailing?: ReactNode;
  className?: string;
}

export default function FileChevronRow({
  icon: Icon,
  iconColor,
  iconBg,
  name,
  meta,
  onClick,
  last,
  trailing,
  className = '',
}: FileChevronRowProps) {
  const content = (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: iconBg ?? 'rgb(var(--app-surface-sunken))' }}
      >
        <Icon size={17} style={iconColor ? { color: iconColor } : undefined} className={iconColor ? '' : 'text-primary-600'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-app-text truncate">{name}</div>
        {meta ? (
          <div className="text-xs text-app-text-secondary mt-0.5 truncate">{meta}</div>
        ) : null}
      </div>
      {trailing ?? <ChevronRight size={16} className="text-app-text-muted shrink-0" />}
    </div>
  );

  const divider = last ? '' : 'border-b border-app-border';

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left block hover:bg-app-hover transition ${divider} ${className}`}
    >
      {content}
    </button>
  ) : (
    <div className={`${divider} ${className}`}>{content}</div>
  );
}
