// ============================================================
// SectionListBody — a run of SectionCards (overline + children
// + optional action). Used for read-only detail surfaces.
// ============================================================

'use client';

import type { ReactNode } from 'react';
import { SectionCard } from '../../primitives';

export interface SectionListSection {
  key: string;
  overline?: string;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}

export interface SectionListBodyProps {
  sections: SectionListSection[];
  className?: string;
}

export default function SectionListBody({ sections, className = '' }: SectionListBodyProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {sections.map((s) => (
        <SectionCard key={s.key} overline={s.overline} action={s.action}>
          {s.children}
        </SectionCard>
      ))}
    </div>
  );
}
