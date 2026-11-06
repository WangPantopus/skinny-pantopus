// Chat's session state on this device: what has to react at once to a sign-out or
// an account switch. Every page loads it (the root layout's QueryProvider, through
// chatDevice.ts); the encrypted store (chatStorage.ts) and the outbox (chatOutbox.ts)
// load with Messages, or after first paint on other app pages, and check this state
// before every read, write and send. Keep it small: chat pages load a copy of it.
import { AUTH_SESSION_CHANGE_KEY, authSessionMarker, getApiBaseUrl, getAuthToken } from '@pantopus/api/client';

export const CHAT_DATABASE = 'pantopus-private-chat-v1';
export const HISTORY_TTL = 7 * 24 * 60 * 60 * 1000;
export type ChatRecordKind = 'history' | 'outbox' | 'media' | 'draft' | 'received-media';
export const isRetainedKind = (kind: ChatRecordKind) => kind === 'history' || kind === 'received-media';
export interface ChatRecordMetadata { id: string; account: string; kind: ChatRecordKind; key: string; at: number; bytes: number; revision?: string; rooms?: string[]; mimeType?: string; historyGeneration?: number; messageIds?: string[]; inbox?: boolean }
export interface ChatStorageScope { account: string; marker: string; generation: number }
export type HistoryRetirement = { account: string; marker: string; generation: number; previousGeneration?: number; rooms: string[]; cleared?: boolean; mediaOnly?: boolean; messageIds?: string[] };

export const HISTORY_RETIREMENT = 'pantopus-chat-history-retired';
export const CHAT_STORES = ['keys', 'metadata', 'payloads'];

// ── The store's connection ───────────────────────────────────

let database: Promise<IDBDatabase> | undefined;

export function openChatDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(CHAT_DATABASE, 1);
    request.onupgradeneeded = () => {
      for (const store of CHAT_STORES) request.result.createObjectStore(store);
    };
    request.onerror = () => reject(new Error('Chat storage is unavailable. Keep this page open and try again.'));
    request.onblocked = () => reject(new Error('Close older Pantopus tabs to enable chat recovery.'));
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = undefined; };
      resolve(request.result);
    };
  }).catch((error) => { database = undefined; throw error; });
  return database;
}

/** Whether this tab has opened (or is opening) the store. */
export function chatDatabaseOpened(): boolean { return database !== undefined; }

// ── The session's scope ──────────────────────────────────────

let generation = 0;
let active: ChatStorageScope | null = null;
// Advances only when the session ends in this tab (sign-out, account switch).
let sessionEpoch = 0;
const suspendListeners = new Set<() => void>();

export const chatAccountKey = (accountId: string) => JSON.stringify([getApiBaseUrl(), accountId]);

export function beginChatStorageScope(account: string): ChatStorageScope {
  const scope = { account, marker: authSessionMarker(), generation: ++generation };
  active = scope;
  return scope;
}

export function activeChatStorageScope(): ChatStorageScope | null { return active; }

export function isChatStorageCurrent(scope: ChatStorageScope): boolean {
  return active === scope && scope.generation === generation && getAuthToken() !== null && authSessionMarker() === scope.marker;
}

export function suspendChatStorage(): void { generation++; active = null; }

/** True while the active storage scope belongs to this account and is current. */
export function isChatStorageActiveFor(accountId: string): boolean {
  return !!active && active.account === chatAccountKey(accountId) && isChatStorageCurrent(active);
}

/** Called (synchronously) whenever this tab's chat session ends; the outbox resets its own state here. */
export function onChatSessionSuspended(listener: () => void): () => void {
  suspendListeners.add(listener);
  return () => { suspendListeners.delete(listener); };
}

/** Advances only when this tab's chat session ends: work started before it gives up. */
export function chatSessionEpoch(): number { return sessionEpoch; }

/** Ends this tab's chat session at once: no read, write or send started before it can finish. */
export function suspendChatSession(): void {
  sessionEpoch++;
  suspendChatStorage();
  suspendListeners.forEach((listener) => listener());
}

export function chatSessionMarker(): string { try { return localStorage.getItem(AUTH_SESSION_CHANGE_KEY) || ''; } catch { return ''; } }

// ── Retired history across tabs ──────────────────────────────

export const historyGenerations = new Map<string, number>();
export const receivedHistoryGenerations = new Map<string, number>();
const historyListeners = new Set<(event: HistoryRetirement) => void>();
let historyChannel: BroadcastChannel | null = null;
let listeningForHistory = false;
// Retirements this tab has published or received, and clears.
let retirementsSeen = 0;

export function chatRetirementsSeen(): number { return retirementsSeen; }
export function noteChatRetirement(): void { retirementsSeen++; }

/** All routes containing a room share its access decision, including topic views. */
export function chatHistoryRooms(value: unknown): string[] {
  const snapshot = value as { roomIds?: string[]; resolvedRoomId?: string; messages?: Array<{ room_id?: string }> } | null;
  return [...new Set([...(Array.isArray(snapshot?.roomIds) ? snapshot.roomIds : []), snapshot?.resolvedRoomId,
    ...(Array.isArray(snapshot?.messages) ? snapshot.messages.map((message) => message.room_id) : [])]
    .filter((room): room is string => typeof room === 'string' && room.length > 0))];
}

export function chatHistoryMessageIds(value: unknown): string[] {
  const messages = (value as { messages?: Array<{ id?: string }> } | null)?.messages;
  return Array.isArray(messages) ? messages.map((message) => String(message.id || '')).filter(Boolean) : [];
}

function receiveHistoryRetirement(event: HistoryRetirement) {
  retirementsSeen++;
  if (!event || event.marker !== chatSessionMarker() || !getAuthToken() || typeof event.account !== 'string'
    || !Number.isSafeInteger(event.generation) || !Array.isArray(event.rooms)) return;
  if ((receivedHistoryGenerations.get(event.account) ?? -1) >= event.generation) return;
  receivedHistoryGenerations.set(event.account, event.generation);
  historyGenerations.set(event.account, Math.max(historyGenerations.get(event.account) ?? 0, event.generation));
  historyListeners.forEach((listener) => listener(event));
}

export function publishHistoryRetirement(event: HistoryRetirement) {
  receiveHistoryRetirement(event);
  try { historyChannel?.postMessage(event); } catch { /* Use the storage fallback. */ }
  // Only a signal: other tabs get the storage event with this value even though it
  // is removed at once (they ignore the removal), so the account's and its rooms'
  // IDs are not left behind on the device.
  try {
    localStorage.setItem(HISTORY_RETIREMENT, JSON.stringify(event));
    localStorage.removeItem(HISTORY_RETIREMENT);
  } catch { /* The encrypted fence still protects reloads and writes. */ }
}

export function onChatHistoryRetired(listener: (event: HistoryRetirement) => void): () => void {
  if (!listeningForHistory && typeof window !== 'undefined') {
    listeningForHistory = true;
    try {
      historyChannel = new BroadcastChannel(HISTORY_RETIREMENT);
      historyChannel.onmessage = (event) => receiveHistoryRetirement(event.data);
    } catch { /* The storage event below also reaches other same-origin tabs. */ }
    window.addEventListener('storage', (event) => {
      if (event.key !== HISTORY_RETIREMENT || !event.newValue) return;
      try { receiveHistoryRetirement(JSON.parse(event.newValue)); } catch { /* Ignore invalid signals. */ }
    });
  }
  historyListeners.add(listener);
  return () => { historyListeners.delete(listener); };
}

