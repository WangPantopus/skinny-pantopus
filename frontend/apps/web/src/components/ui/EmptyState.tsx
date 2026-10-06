'use client';

import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** The title's heading level: h3 by default; h2 where no h2 comes before it on the page. */
  headingLevel?: 2 | 3;
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, headingLevel = 3 }: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-app-surface-sunken flex items-center justify-center mb-5">
        <Icon className="w-8 h-8 text-app-text-muted" />
      </div>
      <Heading className="text-lg font-semibold text-app-text mb-1">{title}</Heading>
      {description && (
        <p className="text-sm text-app-text-secondary max-w-sm mt-1 leading-relaxed">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
