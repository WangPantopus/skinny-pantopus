'use client';

import type { ReactNode } from 'react';
import { ThumbsUp, Hand, AlertTriangle, Award } from 'lucide-react';
import type { CommunityMailItem, ReactionType } from '@/types/mailbox';

type CommunityCardProps = {
  item: CommunityMailItem;
  onReact?: (reaction: ReactionType) => void;
  onRsvp?: () => void;
  onClick?: () => void;
};

const reactionLabels: Record<ReactionType, ReactNode> = {
  acknowledged: <ThumbsUp className="w-4 h-4" />,
  will_attend: <Hand className="w-4 h-4" />,
  concerned: <AlertTriangle className="w-4 h-4" />,
  thumbs_up: <Award className="w-4 h-4" />,
};

export default function CommunityCard({
  item,
  onReact,
  onRsvp,
  onClick,
}: CommunityCardProps) {
  return (
    <div className="rounded-lg border border-app-border overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-4 py-3 hover:bg-app-hover dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mb-1 ${
              item.community_type === 'civic_notice'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                : item.community_type === 'neighborhood_event'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                  : 'bg-app-surface-sunken text-app-text-strong'
            }`}>
              {item.community_type.replace(/_/g, ' ')}
            </span>
            <p className="text-sm font-semibold text-app-text">
              {item.title}
            </p>
            {item.body && (
              <p className="text-xs text-app-text-secondary mt-0.5 line-clamp-2">{item.body}</p>
            )}
          </div>
          <span className="flex-shrink-0 text-xs text-app-text-muted">
            {new Date(item.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Source */}
        <p className="text-xs text-app-text-muted mt-1">
          Published to {item.published_to}
          {item.sender_display && ` by ${item.sender_display}`}
        </p>
      </button>

      {/* Reaction bar */}
      <div className="px-4 py-2 border-t border-app-border-subtle flex items-center gap-2">
        {(Object.keys(reactionLabels) as ReactionType[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onReact?.(r)}
            className="px-2 py-1 text-sm rounded hover:bg-app-hover dark:hover:bg-gray-800 transition-colors"
            title={r.replace(/_/g, ' ')}
          >
            {reactionLabels[r]}
          </button>
        ))}

        {item.community_type === 'neighborhood_event' && onRsvp && (
          <button
            type="button"
            onClick={onRsvp}
            className="ml-auto px-3 py-1 text-xs font-semibold text-primary-600 border border-primary-200 dark:border-primary-800 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          >
            RSVP
          </button>
        )}
      </div>
    </div>
  );
}
