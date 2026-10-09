// ============================================================
// The Messages list: one cache entry for GET /api/chat/unified-conversations,
// shared by the Messages page, the floating chat widget and the sidebar's
// hover warm-up. Fresh for 30 seconds (Instant Screens contract §4,
// "Messages list"); live events update it in place.
// ============================================================

import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';

export type ConversationsReply = Awaited<ReturnType<typeof api.chat.getUnifiedConversations>>;

// TODO: cursor pagination when the backend supports it. Today the endpoint
// returns everything up to `limit`.
export const CONVERSATIONS_LIMIT = 200;
export const CONVERSATIONS_FRESH_MS = 30 * 1000;

export function conversationsQuery() {
  return {
    queryKey: queryKeys.conversations(),
    queryFn: () => api.chat.getUnifiedConversations({ limit: CONVERSATIONS_LIMIT }),
    staleTime: CONVERSATIONS_FRESH_MS,
  };
}
