// ============================================================
// SectionCard — border + subtle shadow, 16–20px radius.
// Design-system rule: border + shadow-sm, no left-border accents.
// ============================================================

'use client';

import type { ReactNode } from 'react';
import SectionHeader from './SectionHeader';

export interface SectionCardProps {
  overline?: string;
  title?: ReactNode;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const PADDING_MAP: Record<NonNullable<SectionCardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export default function SectionCard({
  overline,
  title,
  action,
  children,
  className = '',
  padding = 'md',
}: SectionCardProps) {
  return (
    <section
      className={`bg-app-surface border border-app-border rounded-2xl shadow-sm ${PADDING_MAP[padding]} ${className}`}
    >
      {(overline || title || action) && (
        <SectionHeader overline={overline} title={title} action={action} />
      )}
      {children}
    </section>
  );
}
