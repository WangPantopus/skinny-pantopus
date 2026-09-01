'use client';

import { Sparkles, User } from 'lucide-react';
import type { AIChatMessage } from '@pantopus/types';
import { AIDraftCard } from './AIDraftCard';

interface AIMessageBubbleProps {
  message: AIChatMessage;
  isStreaming?: boolean;
}

export function AIMessageBubble({ message, isStreaming }: AIMessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
          isUser
            ? 'bg-gray-200'
            : 'bg-gradient-to-br from-violet-500 to-indigo-600'
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-gray-600" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-white" />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex flex-col gap-2 max-w-[80%] min-w-0 ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Text bubble */}
        {message.content && (
          <div
            className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
              isUser
                ? 'bg-violet-600 text-white rounded-br-md'
                : 'bg-gray-100 text-gray-800 rounded-bl-md'
            }`}
          >
            {message.content}
            {isStreaming && !message.content && (
              <span className="inline-flex gap-1 ml-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
            {isStreaming && message.content && (
              <span className="inline-block w-0.5 h-4 bg-violet-500 ml-0.5 animate-pulse align-text-bottom" />
            )}
          </div>
        )}

        {/* Streaming placeholder when no content yet */}
        {isStreaming && !message.content && message.role === 'assistant' && (
          <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-100">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        )}

        {/* Draft cards */}
        {message.drafts?.map((draft, idx) => (
          <AIDraftCard key={`${message.id}-draft-${idx}`} draft={draft} />
        ))}
      </div>
    </div>
  );
}
