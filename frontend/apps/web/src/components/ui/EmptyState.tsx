'use client';

import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-app-surface-sunken flex items-center justify-center mb-5">
        <Icon className="w-8 h-8 text-app-text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-app-text mb-1">{title}</h3>
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
