// Inbox persistence is also used by the root session boundary. Keep it
// independent of screen hooks and sockets so session recovery can start
// without downloading the Messages UI and its networking dependencies.
import { authSessionMarker } from '@pantopus/api/client';
import type { getUnifiedConversations } from '@pantopus/api/endpoints/chat';
import type { UnifiedConversationItem } from '@pantopus/types';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { activateChatStorage, captureChatHistoryFence, isChatStorageActiveFor, writeChatRecords } from '@/components/chat/chatStorage';

type ConversationTail = { generation?: string; rows: UnifiedConversationItem[]; nextCursor: string | null; hasMore: boolean };
export type ConversationsReply = Awaited<ReturnType<typeof getUnifiedConversations>> & { refreshId?: string; keptTail?: ConversationTail };
export const CONVERSATIONS_LIMIT = 50;
export const INBOX_KEY = 'personal-inbox-v1';
export type SavedInbox = { inbox: ConversationsReply; roomIds: string[]; historyGeneration: number };

export async function retainInbox(reply: ConversationsReply, actor: string, marker: string,
  fence: Awaited<ReturnType<typeof captureChatHistoryFence>> | undefined, current?: () => boolean) {
  if (fence === undefined || !actor || marker !== authSessionMarker()) return;
  const scope = await activateChatStorage(actor);
  if (marker !== authSessionMarker() || current?.() === false) return;
  const inbox = { ...reply, conversations: reply.conversations.slice(0, CONVERSATIONS_LIMIT), keptTail: undefined };
  const rooms = inbox.conversations.flatMap((row) => row._type === 'room' ? [row.id] : row.room_ids);
  const value: SavedInbox = { inbox, roomIds: [...new Set(rooms)], historyGeneration: fence?.account === scope.account ? fence.generation : 0 };
  await writeChatRecords(scope, [{ kind: 'history', key: INBOX_KEY, value }]);
}

/** Save the inbox already patched in memory after access/message retirement.
 * A newer authorized read replaces it and saves itself under the new fence. */
export async function retainInboxAfterRetirement(client: QueryClient, event: { account: string; generation: number; cleared?: boolean }): Promise<void> {
  if (event.cleared) return;
  const reply = client.getQueryData<ConversationsReply>(queryKeys.conversations());
  if (!reply || !Array.isArray(reply.conversations)) return;
  let accountId: unknown;
  try { accountId = (JSON.parse(event.account) as unknown[])[1]; } catch { return; }
  if (typeof accountId !== 'string' || !isChatStorageActiveFor(accountId)) return;
  await retainInbox(reply, accountId, authSessionMarker(), { account: event.account, generation: event.generation },
    () => client.getQueryData(queryKeys.conversations()) === reply);
}
