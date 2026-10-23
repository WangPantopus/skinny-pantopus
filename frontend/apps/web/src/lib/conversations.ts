// ============================================================
// The Messages list: one cache entry for GET /api/chat/unified-conversations,
// shared by the Messages page, the floating chat widget and the sidebar's
// hover warm-up. Fresh for 30 seconds (Instant Screens contract §4,
// "Messages list"); live events update it in place.
// ============================================================

import * as api from '@pantopus/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UnifiedConversationItem } from '@pantopus/types';
import { queryKeys } from '@/lib/query-keys';

type ConversationTail = { generation?: string; rows: UnifiedConversationItem[]; nextCursor: string | null; hasMore: boolean };
export type ConversationsReply = Awaited<ReturnType<typeof api.chat.getUnifiedConversations>> & { refreshId?: string; keptTail?: ConversationTail };

export const CONVERSATIONS_LIMIT = 50;
export const CONVERSATIONS_FRESH_MS = 30 * 1000;

export function conversationsQuery() {
  return {
    queryKey: queryKeys.conversations(),
    queryFn: async (): Promise<ConversationsReply> => ({
      ...await api.chat.getUnifiedConversations({ limit: CONVERSATIONS_LIMIT }), refreshId: crypto.randomUUID(),
    }),
    staleTime: CONVERSATIONS_FRESH_MS,
  };
}

export function conversationKey(conversation: UnifiedConversationItem): string {
  return conversation._type === 'room' ? `room:${conversation.id}` : `person:${conversation.other_participant_id}`;
}

export function compareConversationTime(a?: string | null, b?: string | null): number {
  const milliseconds = Date.parse(a || '1970-01-01') - Date.parse(b || '1970-01-01');
  if (milliseconds) return milliseconds;
  const fraction = (value?: string | null) => (value?.match(/\.(\d+)/)?.[1] || '').padEnd(6, '0');
  return fraction(a).localeCompare(fraction(b));
}

/** Older pages belong to this authoritative first-page snapshot. A refresh
 * drops them, so revoked memberships never linger in a stale tail. */
export function useConversationPages() {
  const client = useQueryClient();
  const query = useQuery(conversationsQuery());
  const head = query.data;
  const generation = head?.refreshId;
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const current = useRef(generation);
  current.current = generation;
  const request = useRef(0);
  const inFlight = useRef(false);
  const validTail = head?.keptTail?.generation === generation ? head?.keptTail : null;
  useEffect(() => {
    request.current += 1; inFlight.current = false;
    setLoadingMore(false); setMoreError(null);
    return () => { request.current += 1; };
  }, [generation]);
  const conversations = useMemo(() => {
    const seen = new Set<string>();
    return [...(head?.conversations || []), ...(validTail?.rows || [])].filter((conversation) => {
      const key = conversationKey(conversation);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }, [head?.conversations, validTail]);
  const nextCursor = validTail ? validTail.nextCursor : head?.nextCursor;
  const hasMore = validTail ? validTail.hasMore : Boolean(head?.hasMore);
  const loadMore = useCallback(async () => {
    if (!nextCursor || !hasMore || inFlight.current) return;
    const ownRequest = ++request.current;
    const marker = api.authSessionMarker();
    inFlight.current = true; setLoadingMore(true); setMoreError(null);
    try {
      const page = await api.chat.getUnifiedConversations({ limit: CONVERSATIONS_LIMIT, before: nextCursor });
      if (ownRequest !== request.current || current.current !== generation || marker !== api.authSessionMarker()) return;
      client.setQueryData<ConversationsReply>(queryKeys.conversations(), (previous) => previous?.refreshId === generation ? ({ ...previous,
        keptTail: { generation, rows: [...(validTail?.rows || []), ...page.conversations],
          nextCursor: page.nextCursor, hasMore: page.hasMore } }) : previous);
    } catch (error) {
      if (ownRequest === request.current && current.current === generation && marker === api.authSessionMarker()) {
        setMoreError(error instanceof Error ? error.message : 'Could not load more conversations.');
      }
    } finally {
      if (ownRequest === request.current) { inFlight.current = false; setLoadingMore(false); }
    }
  }, [nextCursor, hasMore, generation, client, validTail]);
  return { query, conversations, hasMore, loadMore, loadingMore, moreError };
}
