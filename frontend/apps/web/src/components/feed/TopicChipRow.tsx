'use client';

import { Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TopicKey } from '@/constants/feedTopics';

interface TopicChipRowProps {
  topics: ReadonlyArray<{ key: TopicKey; label: string; icon?: ReactNode }>;
  activeTopic: TopicKey | null;
  onTopicChange: (topic: TopicKey | null) => void;
}

/**
 * Row of topic chips rendered under the Place surface above the post-type /
 * sports-mode chips. Tapping an active topic chip exits the topic lane.
 *
 * Phase 1 ships only the Sports topic. The component accepts a list so
 * future topics drop in without touching call sites.
 */
export default function TopicChipRow({ topics, activeTopic, onTopicChange }: TopicChipRowProps) {
  if (!topics || topics.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
      {topics.map((t) => {
        const isActive = activeTopic === t.key;
        const icon = t.icon ?? <Trophy className="w-4 h-4" />;
        return (
          <button
            key={t.key}
            onClick={() => onTopicChange(isActive ? null : t.key)}
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
              isActive
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-surface text-app-muted border border-app hover-bg-app hover:shadow-sm'
            }`}
          >
            <span className="flex-shrink-0">{icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
