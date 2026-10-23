// ============================================================
// CHAT ENDPOINTS
// Real-time chat rooms and messages
// ============================================================

import { get, post, put, patch, del } from '../client';
import type { ApiRequestConfig } from '../client';
import type {
  ChatRoom,
  ChatMessage,
  ChatRoomWithDetails,
  ConversationTopic,
  UnifiedConversationItem,
  ApiResponse,
  ReactionSummary
} from '@pantopus/types';

/**
 * Get user's chat rooms
 */
export async function getChatRooms(filters?: {
  type?: 'direct' | 'group' | 'gig' | 'home';
  limit?: number;
}): Promise<{ 
  rooms: ChatRoomWithDetails[];
  total: number;
  totalUnread: number;
}> {
  return get<{ 
    rooms: ChatRoomWithDetails[]; 
    total: number;
    totalUnread: number;
  }>('/api/chat/rooms', filters);
}

/**
 * Get chat rooms for a specific business identity (shared business inbox).
 */
export async function getBusinessChatRooms(
  businessUserId: string,
  filters?: {
    type?: 'direct' | 'group' | 'gig' | 'home';
    limit?: number;
  }
): Promise<{
  rooms: ChatRoomWithDetails[];
  total: number;
  totalUnread: number;
  businessUserId: string;
}> {
  return get<{
    rooms: ChatRoomWithDetails[];
    total: number;
    totalUnread: number;
    businessUserId: string;
  }>(`/api/chat/business/${businessUserId}/rooms`, filters);
}

/**
 * Get a specific chat room with details
 */
export async function getChatRoom(
  roomId: string,
  params?: { asBusinessUserId?: string }
): Promise<{ room: ChatRoomWithDetails }> {
  return get<{ room: ChatRoomWithDetails }>(`/api/chat/rooms/${roomId}`, params);
}

export type CreateDirectChatResponse = {
  roomId: string;
  otherUser: {
    id: string;
    username: string;
    name: string;
    profile_picture_url?: string;
  };
};

/** Collapses concurrent createDirectChat calls (same peer + identity) into one HTTP request. */
const directChatInflight = new Map<string, Promise<CreateDirectChatResponse>>();

function directChatCacheKey(otherUserId: string, asBusinessUserId?: string) {
  return `${otherUserId}\0${asBusinessUserId ?? ''}`;
}

/**
 * Create or get direct chat with another user
 */
export async function createDirectChat(
  otherUserId: string,
  options?: { asBusinessUserId?: string }
): Promise<CreateDirectChatResponse> {
  const key = directChatCacheKey(otherUserId, options?.asBusinessUserId);
  let inflight = directChatInflight.get(key);
  if (!inflight) {
    inflight = post<CreateDirectChatResponse>('/api/chat/direct', {
      otherUserId,
      ...(options?.asBusinessUserId ? { asBusinessUserId: options.asBusinessUserId } : {}),
    }).finally(() => {
      directChatInflight.delete(key);
    });
    directChatInflight.set(key, inflight);
  }
  return inflight;
}

/**
 * Create a group chat
 */
export async function createGroupChat(data: {
  roomName: string;
  roomDescription?: string;
  participantIds: string[];
}): Promise<{ 
  room: ChatRoom;
  participantCount: number;
}> {
  return post<{ 
    room: ChatRoom; 
    participantCount: number;
  }>('/api/chat/group', data);
}

/**
 * Update chat room details
 */
export async function updateChatRoom(roomId: string, data: {
  roomName?: string;
  roomDescription?: string;
  roomImageUrl?: string;
}): Promise<{ room: ChatRoom }> {
  return put<{ room: ChatRoom }>(`/api/chat/rooms/${roomId}`, data);
}

/**
 * Leave a chat room
 * @deprecated Not implemented server-side. No backend route exists.
 */
export async function leaveChatRoom(roomId: string): Promise<ApiResponse> {
  console.warn('leaveChatRoom: not implemented server-side');
  return del<ApiResponse>(`/api/chat/rooms/${roomId}/leave`);
}

/**
 * Get messages from a chat room
 */
export async function getMessages(roomId: string, params?: {
  limit?: number;
  before?: string; // message ID for pagination
  after?: string;
  sync?: boolean;
  asBusinessUserId?: string;
}): Promise<{
  messages: (ChatMessage & {
    sender: {
      id: string;
      username: string;
      name: string;
      profile_picture_url?: string;
    };
  })[];
  hasMore: boolean;
  nextCursor?: string | null;
  syncCursors?: ChatSyncCursors;
}> {
  return get<{
    messages: any[];
    hasMore: boolean;
    nextCursor?: string | null;
    syncCursors?: ChatSyncCursors;
  }>(`/api/chat/rooms/${roomId}/messages`, params);
}

/**
 * Get canonical person-conversation messages across all shared rooms.
 */
export async function getConversationMessages(otherUserId: string, params?: {
  limit?: number;
  before?: string;
  after?: string;
  sync?: boolean;
  asBusinessUserId?: string;
  topicId?: string;
}): Promise<{
  messages: (ChatMessage & {
    sender: {
      id: string;
      username: string;
      name: string;
      profile_picture_url?: string;
    };
  })[];
  hasMore: boolean;
  nextCursor?: string | null;
  roomIds: string[];
  syncCursors?: ChatSyncCursors;
}> {
  return get<{
    messages: any[];
    hasMore: boolean;
    nextCursor?: string | null;
    roomIds: string[];
    syncCursors?: ChatSyncCursors;
  }>(`/api/chat/conversations/${otherUserId}/messages`, params);
}

export type ChatSyncCursors = Record<string, number>;
export type ChatSyncMessage = ChatMessage & { sync_version?: number };
export type ChatMessageTombstone = { id: string; room_id: string; deleted: true; sync_version: number };
export type ChatReadReceipt = { roomId: string; userId: string; readAt: string; throughMessageId?: string; throughCreatedAt?: string };
export interface ChatChanges {
  messages: Array<ChatSyncMessage | ChatMessageTombstone>;
  syncCursors: ChatSyncCursors;
  untilCursors: ChatSyncCursors;
  hasMore: boolean;
  roomIds: string[];
  removedRoomIds: string[];
  resetRequired: boolean;
  readReceipts: ChatReadReceipt[];
}

/** Resume a captured history snapshot; all topics share the same room revision. */
export function getMessageChanges(target: { roomId?: string; otherUserId?: string }, params: {
  cursor: ChatSyncCursors;
  until?: ChatSyncCursors;
  limit?: number;
  asBusinessUserId?: string;
}): Promise<ChatChanges> {
  const path = target.roomId ? `rooms/${target.roomId}` : `conversations/${target.otherUserId}`;
  return get<ChatChanges>(`/api/chat/${path}/changes`, {
    cursor: JSON.stringify(params.cursor),
    ...(params.until ? { until: JSON.stringify(params.until) } : {}),
    limit: params.limit ?? 200,
    ...(params.asBusinessUserId ? { asBusinessUserId: params.asBusinessUserId } : {}),
  });
}

/**
 * Mark canonical person-conversation as read across all shared rooms.
 */
export async function markConversationAsRead(
  otherUserId: string,
  options?: { asBusinessUserId?: string; throughMessageId?: string }
): Promise<{ unreadCount: number; updatedRooms: number }> {
  return post<{ unreadCount: number; updatedRooms: number }>(
    `/api/chat/conversations/${otherUserId}/read`,
    {
      ...(options?.asBusinessUserId ? { asBusinessUserId: options.asBusinessUserId } : {}),
      ...(options?.throughMessageId ? { throughMessageId: options.throughMessageId } : {}),
    }
  );
}

/**
 * Send a message (REST API - also available via Socket.IO)
 */
export async function sendMessage(data: {
  roomId: string;
  messageText?: string;
  messageType?: 'text' | 'image' | 'video' | 'file' | 'audio' | 'location' | 'gig_offer' | 'listing_offer';
  fileIds?: string[];
  metadata?: Record<string, any>;
  replyToId?: string;
  asBusinessUserId?: string;
  topicId?: string;
  clientMessageId?: string;
}): Promise<{ message: ChatMessage }> {
  return post<{ message: ChatMessage }>('/api/chat/messages', data);
}

/**
 * Edit a message
 */
export async function editMessage(messageId: string, messageText: string): Promise<{ 
  message: ChatMessage 
}> {
  return put<{ message: ChatMessage }>(`/api/chat/messages/${messageId}`, { 
    messageText 
  });
}

/**
 * Delete a message
 */
export async function deleteMessage(messageId: string): Promise<ApiResponse> {
  return del<ApiResponse>(`/api/chat/messages/${messageId}`);
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(roomId: string, messageId?: string): Promise<{
  unreadCount: number;
}> {
  return post<{ unreadCount: number }>(`/api/chat/rooms/${roomId}/read`, {
    messageId
  });
}

export async function markMessagesAsReadForIdentity(
  roomId: string,
  options: { messageId?: string; asBusinessUserId?: string; throughMessageId?: string }
): Promise<{ unreadCount: number }> {
  return post<{ unreadCount: number }>(`/api/chat/rooms/${roomId}/read`, {
    ...(options?.messageId ? { messageId: options.messageId } : {}),
    ...(options?.throughMessageId ? { throughMessageId: options.throughMessageId } : {}),
    ...(options?.asBusinessUserId ? { asBusinessUserId: options.asBusinessUserId } : {}),
  });
}

/**
 * Add participant to group chat
 */
export async function addParticipant(roomId: string, userId: string): Promise<{ 
  participant: any;
}> {
  return post<{ participant: any }>(`/api/chat/rooms/${roomId}/participants`, { 
    userId 
  });
}

/**
 * Remove participant from group chat
 */
export async function removeParticipant(
  roomId: string, 
  participantUserId: string
): Promise<ApiResponse> {
  return del<ApiResponse>(`/api/chat/rooms/${roomId}/participants/${participantUserId}`);
}

/**
 * Get chat statistics
 */
export async function getChatStats(config?: ApiRequestConfig): Promise<{
  stats: {
    total_chats: number;
    total_messages: number;
    total_unread: number;
    direct_chats: number;
    gig_chats: number;
    home_chats: number;
  };
}> {
  return get<{ stats: any }>('/api/chat/stats', undefined, config);
}

export interface ChatSearchResult {
  messages: ChatSyncMessage[];
  roomContexts: Record<string, { conversationId: string; kind: 'conversation' | 'room'; name: string; identity?: Record<string, unknown> | null }>;
  hasMore: boolean;
  nextCursor: string | null;
}

/** Server-authorized literal search, including messages outside loaded history. */
export function searchChatMessages(query: string, options?: {
  roomId?: string; otherUserId?: string; asBusinessUserId?: string; before?: string; limit?: number;
}): Promise<ChatSearchResult> {
  const path = options?.roomId ? `/rooms/${options.roomId}` : options?.otherUserId ? `/conversations/${options.otherUserId}` : '';
  return get<ChatSearchResult>(`/api/chat${path}/search`, {
    q: query, limit: options?.limit ?? 50,
    ...(options?.before ? { before: options.before } : {}),
    ...(options?.asBusinessUserId ? { asBusinessUserId: options.asBusinessUserId } : {}),
  });
}

export function searchMessages(roomId: string, query: string): Promise<ChatSearchResult> {
  return searchChatMessages(query, { roomId });
}

export interface ChatMessageContext {
  messages: ChatSyncMessage[];
  roomIds: string[];
  anchorMessageId: string;
  hasMore: boolean;
  nextCursor: string | null;
  hasMoreAfter: boolean;
}

export function getMessageContext(target: { roomId?: string; otherUserId?: string }, messageId: string,
  params?: { limit?: number; asBusinessUserId?: string }): Promise<ChatMessageContext> {
  const path = target.roomId ? `rooms/${target.roomId}` : `conversations/${target.otherUserId}`;
  return get<ChatMessageContext>(`/api/chat/${path}/messages/${messageId}/context`, { limit: 25, ...params });
}

export type ChatPreferences = { notificationsEnabled: boolean; roomIds: string[] };
export function getChatPreferences(target: { roomId?: string; otherUserId?: string }, asBusinessUserId?: string): Promise<ChatPreferences> {
  const path = target.roomId ? `rooms/${target.roomId}` : `conversations/${target.otherUserId}`;
  return get<ChatPreferences>(`/api/chat/${path}/preferences`, asBusinessUserId ? { asBusinessUserId } : undefined);
}
export function setChatPreferences(target: { roomId?: string; otherUserId?: string }, notificationsEnabled: boolean,
  asBusinessUserId?: string): Promise<ChatPreferences> {
  const path = target.roomId ? `rooms/${target.roomId}` : `conversations/${target.otherUserId}`;
  return patch<ChatPreferences>(`/api/chat/${path}/preferences`, { notificationsEnabled, ...(asBusinessUserId ? { asBusinessUserId } : {}) });
}
export function muteRoom(roomId: string, muted: boolean): Promise<ChatPreferences> {
  return setChatPreferences({ roomId }, !muted);
}

/**
 * Pin/unpin a chat room
 * @deprecated Not implemented server-side. No backend route exists.
 */
export async function pinRoom(roomId: string, pinned: boolean): Promise<ApiResponse> {
  console.warn('pinRoom: not implemented server-side');
  return put<ApiResponse>(`/api/chat/rooms/${roomId}/pin`, { pinned });
}

/**
 * Archive a chat room
 * @deprecated Not implemented server-side. No backend route exists.
 */
export async function archiveRoom(roomId: string): Promise<ApiResponse> {
  console.warn('archiveRoom: not implemented server-side');
  return post<ApiResponse>(`/api/chat/rooms/${roomId}/archive`);
}

/**
 * Unarchive a chat room
 * @deprecated Not implemented server-side. No backend route exists.
 */
export async function unarchiveRoom(roomId: string): Promise<ApiResponse> {
  console.warn('unarchiveRoom: not implemented server-side');
  return post<ApiResponse>(`/api/chat/rooms/${roomId}/unarchive`);
}

/**
 * Get archived rooms
 * @deprecated Not implemented server-side. No backend route exists.
 */
export async function getArchivedRooms(): Promise<{ rooms: ChatRoomWithDetails[] }> {
  console.warn('getArchivedRooms: not implemented server-side');
  return get<{ rooms: ChatRoomWithDetails[] }>('/api/chat/rooms/archived');
}

// ─── Unified Conversations (Person-Grouped) ───

/**
 * Get person-grouped conversations list (one row per person + group/home rooms)
 */
export async function getUnifiedConversations(params?: {
  limit?: number;
  before?: string;
  since?: string;
}): Promise<{
  conversations: UnifiedConversationItem[];
  total: number;
  totalUnread: number;
  totalMessages: number;
  hasMore: boolean;
  nextCursor: string | null;
}> {
  return get<{
    conversations: UnifiedConversationItem[];
    total: number;
    totalUnread: number;
    totalMessages: number;
    hasMore: boolean;
    nextCursor: string | null;
  }>('/api/chat/unified-conversations', params);
}

/**
 * Find or create a topic for a person-pair conversation
 */
export async function findOrCreateTopic(
  otherUserId: string,
  data: {
    topicType: 'general' | 'task' | 'listing' | 'delivery' | 'home' | 'business';
    topicRefId?: string;
    title: string;
  }
): Promise<{ topic: ConversationTopic; created: boolean }> {
  return post<{ topic: ConversationTopic; created: boolean }>(
    `/api/chat/conversations/${otherUserId}/topics`,
    data
  );
}

/**
 * Get topics for a person-pair conversation
 */
export async function getConversationTopics(
  otherUserId: string
): Promise<{ topics: ConversationTopic[] }> {
  return get<{ topics: ConversationTopic[] }>(
    `/api/chat/conversations/${otherUserId}/topics`
  );
}

// ─── Message Reactions ───

/**
 * Add (`reacted: true`) or remove (`reacted: false`) a reaction on a message, so a retry keeps the state asked for.
 * Without `reacted` the server toggles it (add if absent, remove if present).
 */
export async function reactToMessage(
  messageId: string,
  reaction: string,
  reacted?: boolean
): Promise<{ reactions: ReactionSummary[] }> {
  return post<{ reactions: ReactionSummary[] }>(
    `/api/chat/messages/${messageId}/react`,
    reacted === undefined ? { reaction } : { reaction, reacted }
  );
}

/**
 * Get all reactions for a message.
 */
export async function getMessageReactions(
  messageId: string
): Promise<{ reactions: ReactionSummary[] }> {
  return get<{ reactions: ReactionSummary[] }>(
    `/api/chat/messages/${messageId}/reactions`
  );
}

// ─── Pre-bid Chat Status ───

export interface PreBidStatus {
  is_pre_bid: boolean;
  gig_id: string | null;
  has_bid?: boolean;
  messages_sent?: number;
  messages_limit?: number;
  messages_remaining?: number;
}

/**
 * Check pre-bid chat status for a gig chat room
 */
export async function getPreBidStatus(roomId: string): Promise<PreBidStatus> {
  return get<PreBidStatus>(`/api/chat/rooms/${roomId}/pre-bid-status`);
}
