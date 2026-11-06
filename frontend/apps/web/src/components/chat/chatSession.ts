// Chat's session state on this device. Every page loads this module (the root
// layout's QueryProvider and the app shell use it), so it holds what has to react at
// once to a sign-out or an account switch, and the clears that need none of chat's
// own code. The encrypted store (chatStorage.ts) and the outbox (chatOutbox.ts) load
// with Messages, or after first paint on other app pages, and check this state
// before every read, write and send.
import { AUTH_SESSION_CHANGE_KEY, authSessionMarker, getApiBaseUrl, getAuthToken } from '@pantopus/api/client';

export const CHAT_DATABASE = 'pantopus-private-chat-v1';
export const HISTORY_TTL = 7 * 24 * 60 * 60 * 1000;
export type ChatRecordKind = 'history' | 'outbox' | 'media' | 'draft' | 'received-media';
export const isRetainedKind = (kind: ChatRecordKind) => kind === 'history' || kind === 'received-media';
export interface ChatRecordMetadata { id: string; account: string; kind: ChatRecordKind; key: string; at: number; bytes: number; revision?: string; rooms?: string[]; mimeType?: string; historyGeneration?: number; messageIds?: string[]; inbox?: boolean }
export interface ChatStorageScope { account: string; marker: string; generation: number }
export type HistoryRetirement = { account: string; marker: string; generation: number; previousGeneration?: number; rooms: string[]; cleared?: boolean; mediaOnly?: boolean; messageIds?: string[] };

const HISTORY_RETIREMENT = 'pantopus-chat-history-retired';
const STORES = ['keys', 'metadata', 'payloads'];

// ── The store's connection ───────────────────────────────────

let database: Promise<IDBDatabase> | undefined;

export function openChatDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(CHAT_DATABASE, 1);
    request.onupgradeneeded = () => {
      for (const store of STORES) request.result.createObjectStore(store);
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

/** False only when this browser says it has no chat store: a visitor who never had one gets none. */
async function chatDatabaseMayExist(): Promise<boolean> {
  if (database) return true;
  try {
    if (typeof indexedDB === 'undefined') return false;
    if (typeof indexedDB.databases !== 'function') return true;
    return (await indexedDB.databases()).some((info) => info.name === CHAT_DATABASE);
  } catch { return true; }
}

/** One read-write transaction over the store, given up (nothing written) once `current` is false. */
function change(db: IDBDatabase, current: () => boolean, action: (stores: { keys: IDBObjectStore; metadata: IDBObjectStore; payloads: IDBObjectStore }) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES, 'readwrite');
    try {
      if (!current()) throw new Error('This chat session ended.');
      action({ keys: transaction.objectStore('keys'), metadata: transaction.objectStore('metadata'), payloads: transaction.objectStore('payloads') });
    } catch { transaction.abort(); }
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(new Error('Chat storage could not be changed.'));
  });
}

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

/** Ends this tab's chat session at once: no read, write or send started before it can finish. */
export function suspendChatSession(): void {
  sessionEpoch++;
  suspendChatStorage();
  suspendListeners.forEach((listener) => listener());
}

export function chatSessionMarker(): string { try { return localStorage.getItem(AUTH_SESSION_CHANGE_KEY) || ''; } catch { return ''; } }

/** Existing cookie sessions can predate this origin's local marker. Call only
 * after a verified profile; never weaken the offline binding check in chatStorage. */
export function establishVerifiedChatSession(): boolean {
  if (!getAuthToken() || chatSessionMarker()) return false;
  try {
    const marker = `${Date.now()}:chat-${crypto.randomUUID()}`;
    localStorage.setItem(AUTH_SESSION_CHANGE_KEY, marker);
    // Other tabs receive the browser's storage event. This tab must retire its
    // pending reads too, then bind the profile under the established marker.
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_SESSION_CHANGE_KEY, newValue: marker }));
    return true;
  } catch { return false; }
}

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

// ── Clears that need no chat code ────────────────────────────

/** Everything chat kept in this browser, for every account: a sign-out, or a visit without a session. */
export async function clearChatDevice(): Promise<void> {
  retirementsSeen++;
  suspendChatSession();
  historyGenerations.clear();
  receivedHistoryGenerations.clear();
  // A signal an older version left in place (see publishHistoryRetirement).
  try { localStorage.removeItem(HISTORY_RETIREMENT); } catch { /* storage disabled: nothing was kept */ }
  if (!(await chatDatabaseMayExist())) return;
  await change(await openChatDatabase(), () => true, (stores) => {
    stores.keys.clear(); stores.metadata.clear(); stores.payloads.clear();
  });
}

/** Every other account's keys and records, and expired history, go when the app
 * knows who is signed in, as activating the store (chatStorage.ts) also does: the
 * same moment as before the store and the outbox loaded after first paint. */
export async function purgeOtherChatAccounts(accountId: string): Promise<void> {
  const account = chatAccountKey(accountId);
  const marker = authSessionMarker();
  const current = () => getAuthToken() !== null && authSessionMarker() === marker;
  if (!current() || !(await chatDatabaseMayExist())) return;
  await change(await openChatDatabase(), current, ({ keys, metadata, payloads }) => {
    const cursor = keys.openKeyCursor();
    cursor.onsuccess = () => {
      if (!cursor.result) return;
      if (cursor.result.key !== account) keys.delete(cursor.result.key);
      cursor.result.continue();
    };
    const entries = metadata.getAll();
    entries.onsuccess = () => {
      for (const entry of entries.result as ChatRecordMetadata[]) {
        if (typeof entry?.id !== 'string') continue;
        if (entry.account !== account || (isRetainedKind(entry.kind) && Date.now() - entry.at > HISTORY_TTL)) {
          metadata.delete(entry.id);
          payloads.delete(entry.id);
        }
      }
    };
  });
}

/** When the code that keeps the inbox can't load: drop this account's saved
 * history and media that might hold the retired rooms or messages (any without a
 * room index, too). The tab that retired them already did; this only makes sure. */
export async function deleteRetiredChatSnapshots(event: HistoryRetirement): Promise<void> {
  if (!(await chatDatabaseMayExist())) return;
  const rooms = new Set(event.rooms);
  const messages = new Set(event.messageIds ?? []);
  await change(await openChatDatabase(), () => true, ({ metadata, payloads }) => {
    const entries = metadata.getAll();
    entries.onsuccess = () => {
      for (const entry of entries.result as ChatRecordMetadata[]) {
        if (typeof entry?.id !== 'string' || entry.account !== event.account || !isRetainedKind(entry.kind)) continue;
        if (event.cleared || !entry.rooms || entry.rooms.some((room) => rooms.has(room))
          || entry.messageIds?.some((id) => messages.has(id))) {
          metadata.delete(entry.id);
          payloads.delete(entry.id);
        }
      }
    };
  });
}

// ── The outbox, after first paint ────────────────────────────

let retry: { actorId: string; epoch: number } | null = null;

/**
 * Starts the outbox (messages queued in any tab, sent from any app page) once the
 * page has painted, instead of in its startup scripts. If its code can't load (a new
 * deployment, offline), queued sends stay saved and it tries again on the next
 * navigation or when the browser is back online. Returns a cancel for unmounting.
 */
export function startChatOutboxAfterPaint(actorId: string): () => void {
  const epoch = sessionEpoch;
  let cancelled = false;
  const ours = () => !cancelled && epoch === sessionEpoch;
  const start = () => {
    if (!ours()) return;
    import('./chatOutbox').then(({ startChatOutbox }) => {
      if (!ours()) return;
      retry = null;
      void startChatOutbox(actorId).catch(() => {});
    }, () => {
      if (!ours()) return;
      retry = { actorId, epoch };
      window.addEventListener('online', retryChatOutboxStart, { once: true });
    });
  };
  const idle = typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(start, { timeout: 2000 }) : null;
  const timer = idle === null ? window.setTimeout(start, 1) : null;
  return () => {
    cancelled = true;
    if (idle !== null) window.cancelIdleCallback(idle);
    if (timer !== null) window.clearTimeout(timer);
  };
}

/** A start whose code failed to load tries again (the app shell calls this on navigation). */
export function retryChatOutboxStart(): void {
  const pending = retry;
  retry = null;
  if (pending && pending.epoch === sessionEpoch) startChatOutboxAfterPaint(pending.actorId);
}
