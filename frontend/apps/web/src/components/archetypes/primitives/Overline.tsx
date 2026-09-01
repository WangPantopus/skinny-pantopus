// ============================================================
// Overline — uppercase 11/16/600 + 0.06em tracking section label.
// Mirrors .overline in the design system.
// ============================================================

import type { ReactNode } from 'react';

export interface OverlineProps {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'div' | 'p' | 'h2' | 'h3';
}

export default function Overline({ children, className = '', as: Tag = 'span' }: OverlineProps) {
  return (
    <Tag
      className={`block text-[11px] leading-4 font-semibold tracking-[0.06em] uppercase text-app-text-secondary ${className}`}
    >
      {children}
    </Tag>
  );
}
