// ============================================================
// SectionHeader — overline + optional right-aligned action link.
// Used above a SectionCard group or list group.
// ============================================================

'use client';

import type { ReactNode } from 'react';
import Overline from './Overline';

export interface SectionHeaderProps {
  overline?: string;
  title?: ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export default function SectionHeader({ overline, title, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between mb-3 ${className}`}>
      <div className="min-w-0">
        {overline ? <Overline>{overline}</Overline> : null}
        {title ? (
          <div className="text-base font-semibold text-app-text mt-1">{title}</div>
        ) : null}
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
