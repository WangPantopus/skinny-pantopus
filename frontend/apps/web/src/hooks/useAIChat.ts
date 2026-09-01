'use client';

import { useState, useCallback, useRef } from 'react';
import * as api from '@pantopus/api';
import type { AIChatMessage, AIChatDraft } from '@pantopus/types';

/**
 * Hook for the AI Chat Agent with SSE streaming.
 *
 * Manages:
 *   - messages[]     — Full conversation history (client-side)
 *   - conversationId — Persisted across sessions via AIConversation table
 *   - isStreaming     — Whether tokens are currently arriving
 *   - sendMessage()  — Sends a message and processes the stream
 *   - startNew()     — Starts a fresh conversation
 */
export function useAIChat() {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const streamTextRef = useRef('');

  /**
   * Send a message to the AI agent and stream the response.
   */
  const sendMessage = useCallback(
    (text: string, coarseLocation?: { city?: string; state?: string }) => {
      // Abort any in-flight stream
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      setError(null);
      setIsStreaming(true);
      streamTextRef.current = '';

      // Add user message immediately
      const userMsg: AIChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };

      // Add placeholder assistant message for streaming
      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: AIChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        drafts: [],
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const handle = api.ai.streamChat(
        {
          message: text,
          conversationId: conversationId || undefined,
          coarseLocation,
        },
        {
          onConversation: (data) => {
            setConversationId(data.conversationId);
          },

          onTextDelta: (delta) => {
            streamTextRef.current += delta;
            const currentText = streamTextRef.current;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: currentText } : m
              )
            );
          },

          onDraft: (data) => {
            const draft: AIChatDraft = {
              type: data.type as AIChatDraft['type'],
              draft: data.draft as AIChatDraft['draft'],
              valid: data.valid,
            };
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, drafts: [...(m.drafts || []), draft] }
                  : m
              )
            );
          },

          onError: (data) => {
            setError(data.message || data.error);
            setIsStreaming(false);
          },

          onDone: () => {
            setIsStreaming(false);
            abortRef.current = null;
          },
        }
      );

      abortRef.current = handle;
    },
    [conversationId]
  );

  /**
   * Start a new conversation — clears messages and resets state.
   */
  const startNewConversation = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setMessages([]);
    setConversationId(null);
    setIsStreaming(false);
    setError(null);
    streamTextRef.current = '';
  }, []);

  /**
   * Load a previous conversation (messages are not stored server-side,
   * so this just sets the conversation ID for continuation).
   */
  const loadConversation = useCallback((id: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setMessages([]);
    setConversationId(id);
    setIsStreaming(false);
    setError(null);
    streamTextRef.current = '';
  }, []);

  /**
   * Abort any in-flight stream.
   */
  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return {
    messages,
    conversationId,
    isStreaming,
    error,
    sendMessage,
    startNewConversation,
    loadConversation,
    abort,
  };
}
