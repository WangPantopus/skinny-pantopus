'use client';

import type { ReactionSummary } from '@pantopus/types';

interface MessageReactionBarProps {
  reactions: ReactionSummary[];
  onReact: (emoji: string) => void;
}

export default function MessageReactionBar({ reactions, onReact }: MessageReactionBarProps) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((r) => (
        <button
          key={r.reaction}
          type="button"
          onClick={() => onReact(r.reaction)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm cursor-pointer transition-colors ${
            r.reacted_by_me
              ? 'border border-primary-500 bg-primary-50 hover:bg-primary-100'
              : 'bg-surface-muted hover:bg-surface border border-transparent'
          }`}
          title={r.users.map((u) => u.name).join(', ')}
        >
          <span>{r.reaction}</span>
          <span className="text-xs text-app-text-secondary">{r.count}</span>
        </button>
      ))}
    </div>
  );
}
