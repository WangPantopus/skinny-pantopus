'use client';

import React from 'react';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';
import type { Notification } from '@pantopus/types';

interface NotificationRowProps {
  notif: Notification;
  isSelected: boolean;
  onClick: (notif: Notification) => void;
  onDelete: (id: string) => void;
  deleting?: boolean;
}

function NotificationRow({ notif, isSelected, onClick, onDelete, deleting = false }: NotificationRowProps) {
  return (
    <div
      className={`w-full px-4 py-3.5 flex gap-3 hover:bg-app-hover transition group ${
        !notif.is_read ? 'bg-blue-50/40' : ''
      } ${isSelected ? 'ring-2 ring-inset ring-blue-400' : ''}`}
    >
      {/* The row's own action. The delete button below is its sibling, not inside it: a button's content is
          flattened for screen readers, so a button inside a button can't be reached. */}
      <button
        type="button"
        onClick={() => onClick(notif)}
        className="flex min-w-0 flex-1 gap-3 text-left cursor-pointer"
      >
        {/* Icon */}
        <span className="block text-xl flex-shrink-0 mt-0.5">{notif.icon || '🔔'}</span>

        {/* Content */}
        <span className="block min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span
              className={`block text-sm leading-snug ${
                !notif.is_read ? 'font-semibold text-app-text' : 'font-medium text-app-text-strong'
              }`}
            >
              {notif.title}
            </span>
            {!notif.is_read && (
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
            )}
          </span>
          {notif.body && (
            <span className="block text-xs text-app-text-secondary mt-0.5 line-clamp-2">{notif.body}</span>
          )}
          <span className="block text-[10px] text-app-text-muted mt-1">{timeAgo(notif.created_at)}</span>
        </span>
      </button>

      {/* Delete on hover */}
      <button
        type="button"
        disabled={deleting}
        onClick={() => onDelete(notif.id)}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-app-text-muted hover:text-red-500 p-1 flex-shrink-0 transition self-start"
        title="Remove"
        aria-label="Remove notification"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default React.memo(NotificationRow);
