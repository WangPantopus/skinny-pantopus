'use client';

import type { VaultFolder } from '@/types/mailbox';

type VaultFolderCardProps = {
  folder: VaultFolder;
  onClick?: () => void;
};

export default function VaultFolderCard({ folder, onClick }: VaultFolderCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-app-border hover:bg-app-hover dark:hover:bg-gray-800 transition-colors text-left"
    >
      {/* Folder icon with color */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: folder.color ? `${folder.color}20` : undefined }}
      >
        <span className="text-xl" role="img" aria-label={folder.label}>
          {folder.icon || '📁'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-app-text truncate">
          {folder.label}
        </p>
        <p className="text-xs text-app-text-secondary mt-0.5">
          {folder.item_count} item{folder.item_count !== 1 ? 's' : ''}
        </p>
      </div>

      <svg className="w-4 h-4 text-app-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
