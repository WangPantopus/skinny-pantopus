'use client';

import React from 'react';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';
import type { Notification } from '@pantopus/types';

interface NotificationRowProps {
  notif: Notification;
  isSelected: boolean;
  onClick: (notif: Notification) => void;
  onDelete: (id: string) => void;
}

function NotificationRow({ notif, isSelected, onClick, onDelete }: NotificationRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(notif)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(notif);
      }}
      className={`w-full text-left px-4 py-3.5 flex gap-3 hover:bg-app-hover transition cursor-pointer group ${
        !notif.is_read ? 'bg-blue-50/40' : ''
      } ${isSelected ? 'ring-2 ring-inset ring-blue-400' : ''}`}
    >
      {/* Icon */}
      <div className="text-xl flex-shrink-0 mt-0.5">{notif.icon || '🔔'}</div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm leading-snug ${
              !notif.is_read ? 'font-semibold text-app-text' : 'font-medium text-app-text-strong'
            }`}
          >
            {notif.title}
          </p>
          {!notif.is_read && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
          )}
        </div>
        {notif.body && (
          <p className="text-xs text-app-text-secondary mt-0.5 line-clamp-2">{notif.body}</p>
        )}
        <p className="text-[10px] text-app-text-muted mt-1">{timeAgo(notif.created_at)}</p>
      </div>

      {/* Delete on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notif.id);
        }}
        className="opacity-0 group-hover:opacity-100 text-app-text-muted hover:text-red-500 p-1 flex-shrink-0 transition"
        title="Remove"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default React.memo(NotificationRow);
