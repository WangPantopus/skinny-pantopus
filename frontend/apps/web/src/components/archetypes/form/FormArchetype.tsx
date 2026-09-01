// ============================================================
// FormArchetype — single-screen form shell (spec A13, web).
//
// Can render either:
//   - `surface: 'page'`   — full-width page form with sticky footer
//   - `surface: 'modal'`  — intended to live inside a ModalShell
//
// Composition:
//   ArchetypePageHeader (X close + title + right action)
//   · FieldGroups or arbitrary children ·
//   · Optional StickyFooter with primary + secondary buttons ·
//
// Note: forms in modals usually rely on the modal's own close
// affordance — pass `surface="modal"` and the archetype skips
// the page header.
// ============================================================

'use client';

import type { ReactNode } from 'react';
import {
  ArchetypePageHeader,
  type ArchetypePageHeaderAction,
  FieldGroup,
  StickyFooter,
  type StickyFooterProps,
} from '../primitives';

export interface FormFieldGroupConfig {
  key: string;
  overline?: string;
  description?: ReactNode;
  children: ReactNode;
}

export interface FormArchetypeProps {
  title: ReactNode;
  subtitle?: ReactNode;
  overline?: string;
  surface?: 'page' | 'modal';
  /** Text button action on the right side of the header (e.g. "Save"). */
  headerAction?: ArchetypePageHeaderAction;
  /** Declarative group list. */
  fieldGroups?: FormFieldGroupConfig[];
  /** Or render children directly. */
  children?: ReactNode;
  /** Sticky bottom footer (prefer this over headerAction for heavy submits). */
  stickyFooter?: StickyFooterProps;
  /** Max width of the form content column. */
  maxWidth?: 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const MAX_W: Record<NonNullable<FormArchetypeProps['maxWidth']>, string> = {
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  full: 'max-w-none',
};

export default function FormArchetype({
  title,
  subtitle,
  overline,
  surface = 'page',
  headerAction,
  fieldGroups,
  children,
  stickyFooter,
  maxWidth = 'lg',
  className = '',
}: FormArchetypeProps) {
  return (
    <div className={`${MAX_W[maxWidth]} mx-auto ${className}`}>
      {surface === 'page' ? (
        <ArchetypePageHeader
          overline={overline}
          title={title}
          subtitle={subtitle}
          primaryAction={headerAction}
        />
      ) : null}
      <div className="space-y-1">
        {fieldGroups?.map((g) => (
          <FieldGroup key={g.key} overline={g.overline} description={g.description}>
            {g.children}
          </FieldGroup>
        ))}
        {children}
      </div>
      {stickyFooter ? <StickyFooter {...stickyFooter} /> : null}
    </div>
  );
}
