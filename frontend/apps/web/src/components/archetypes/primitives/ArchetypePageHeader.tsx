// ============================================================
// ArchetypePageHeader — the archetype library's title row.
// Differs from the legacy `PageHeader` by supporting an eyebrow
// overline, multiple trailing actions, and a meta description
// paragraph. The existing `PageHeader` still works; this one is
// adopted by archetype-migrated pages.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import Overline from './Overline';

export interface ArchetypePageHeaderAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}

export interface ArchetypePageHeaderProps {
  overline?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  primaryAction?: ArchetypePageHeaderAction;
  secondaryActions?: ArchetypePageHeaderAction[];
  /** Optional filter / search row below the header. */
  children?: ReactNode;
  className?: string;
}

function actionClasses(variant: ArchetypePageHeaderAction['variant']) {
  if (variant === 'ghost') {
    return 'border border-app-border bg-app-surface text-app-text-strong hover:bg-app-hover';
  }
  if (variant === 'danger') {
    return 'bg-app-error text-white hover:brightness-110';
  }
  return 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm';
}

function ActionButton({ action }: { action: ArchetypePageHeaderAction }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={`h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 transition ${actionClasses(action.variant)}`}
    >
      {Icon ? <Icon size={16} /> : null}
      {action.label}
    </button>
  );
}

export default function ArchetypePageHeader({
  overline,
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  children,
  className = '',
}: ArchetypePageHeaderProps) {
  return (
    <header className={`mb-6 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {overline ? <Overline className="mb-1">{overline}</Overline> : null}
          <h1 className="text-[22px] leading-tight font-bold text-app-text -tracking-[0.01em] truncate">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-app-text-secondary mt-1 max-w-[720px] leading-relaxed">
              {subtitle}
            </p>
          ) : null}
        </div>
        {(primaryAction || (secondaryActions && secondaryActions.length > 0)) && (
          <div className="flex items-center gap-2 shrink-0">
            {secondaryActions?.map((a) => (
              <ActionButton key={a.label} action={{ ...a, variant: a.variant ?? 'ghost' }} />
            ))}
            {primaryAction ? (
              <ActionButton action={{ ...primaryAction, variant: primaryAction.variant ?? 'primary' }} />
            ) : null}
          </div>
        )}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}
