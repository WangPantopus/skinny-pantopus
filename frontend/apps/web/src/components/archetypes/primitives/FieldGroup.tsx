// ============================================================
// FieldGroup — overline + optional description + children (fields).
// Keeps forms scannable with a consistent rhythm.
// ============================================================

'use client';

import type { ReactNode } from 'react';
import Overline from './Overline';

export interface FieldGroupProps {
  overline?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function FieldGroup({ overline, description, children, className = '' }: FieldGroupProps) {
  return (
    <section className={`mb-8 ${className}`}>
      {overline ? <Overline className="mb-2">{overline}</Overline> : null}
      {description ? (
        <p className="text-sm text-app-text-secondary mb-3 leading-relaxed">{description}</p>
      ) : null}
      {children}
    </section>
  );
}
