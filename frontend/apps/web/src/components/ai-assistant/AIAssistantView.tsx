'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  StopCircle,
  ChevronLeft,
} from 'lucide-react';
import { useAIChat } from '@/hooks/useAIChat';
import { AIMessageBubble } from './AIMessageBubble';

interface AIAssistantViewProps {
  /** Pre-fill the input with text (e.g. from Magic Task "Chat with Pantopus" link) */
  initialMessage?: string;
  /** Navigate back to chat list */
  onBack?: () => void;
}

export function AIAssistantView({ initialMessage, onBack }: AIAssistantViewProps) {
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    startNewConversation,
    abort,
  } = useAIChat();

  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasSentInitial = useRef(false);

  // Auto-send initial message if provided
  useEffect(() => {
    if (initialMessage && !hasSentInitial.current) {
      hasSentInitial.current = true;
      sendMessage(initialMessage);
    }
  }, [initialMessage, sendMessage]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleNewConversation = useCallback(() => {
    startNewConversation();
    setInput('');
    inputRef.current?.focus();
  }, [startNewConversation]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-indigo-50">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              Pantopus Assistant
            </h2>
            <p className="text-xs text-gray-500">
              {isStreaming ? 'Thinking…' : 'Ask me to draft gigs, listings, posts, or summarize mail'}
            </p>
          </div>
        </div>
        <button
          onClick={handleNewConversation}
          className="p-2 rounded-lg hover:bg-white/60 transition-colors text-gray-500 hover:text-gray-700"
          title="New conversation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-violet-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Hi! I&apos;m Pantopus
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm">
              I can help you draft gigs, create listings, write posts, and
              summarize your mail. Just describe what you need!
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  onClick={() => {
                    setInput(prompt.text);
                    inputRef.current?.focus();
                  }}
                  className="px-3 py-1.5 text-xs rounded-full bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors border border-violet-100"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <AIMessageBubble key={msg.id} message={msg} isStreaming={isStreaming && msg === messages[messages.length - 1] && msg.role === 'assistant'} />
        ))}

        {error && (
          <div className="mx-auto max-w-md px-4 py-2.5 rounded-xl bg-red-50 text-red-700 text-sm text-center">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Describe what you need…"
              className="w-full resize-none rounded-xl border border-gray-200 bg-white pl-4 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 placeholder:text-gray-400 max-h-32 scrollbar-thin"
              style={{
                height: 'auto',
                minHeight: '40px',
                maxHeight: '128px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
              disabled={isStreaming}
            />
          </div>

          {isStreaming ? (
            <button
              onClick={abort}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
              title="Stop generating"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white disabled:text-gray-400 flex items-center justify-center transition-colors"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Quick prompt suggestions ────────────────────────────────

const QUICK_PROMPTS = [
  { label: '🛋️ Help me move something', text: 'I need help moving furniture' },
  { label: '🏷️ Sell an item', text: 'I want to sell' },
  { label: '📢 Post to neighbors', text: 'I want to tell my neighbors about' },
  { label: '📬 Summarize my mail', text: 'Can you summarize my recent mail?' },
  { label: '🌤️ What\'s happening nearby?', text: 'What\'s happening near my home?' },
  { label: '🧹 Need cleaning help', text: 'I need someone to clean my house' },
];
