// ============================================================
// Place — GROUP. An overline label over a vertical stack of cards.
// The presentation layer that composes contract sections into the
// curated dashboard groups (Today, Your home, Risk & readiness, …).
// ============================================================

import type { ReactNode } from 'react';
import Overline from '../primitives/Overline';

export interface GroupProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Group({ label, children, className = '' }: GroupProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <Overline as="div" className="px-0.5 mb-2 tracking-[0.08em] text-app-text-muted">
        {label}
      </Overline>
      {/* Mobile: the designed vertical stack. Desktop (lg+): cards pair up
          2-across; a lone card — or the odd one out at the end — spans the
          full row so the grid never leaves a hole. */}
      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:items-stretch lg:[&>:only-child]:col-span-2 lg:[&>:last-child:nth-child(odd)]:col-span-2">
        {children}
      </div>
    </div>
  );
}
