import { AUTH_SESSION_CHANGE_KEY, authSessionMarker, getApiBaseUrl, getAuthToken } from '@pantopus/api';
import { readTaskRecoveryValue, taskRecoveryEncryptionKey } from '@/components/home/tasks/TaskRecoveryStorage';

const DATABASE = 'pantopus-private-chat-v1';
const HISTORY_TTL = 7 * 24 * 60 * 60 * 1000;
const HISTORY_BYTES = 5 * 1024 * 1024;
const RECEIVED_MEDIA_BYTES = 50 * 1024 * 1024;
const OUTBOX_BYTES = 100 * 1024 * 1024;
const OUTBOX_FULL = 'Your pending messages and drafts are full (100 items or 100 MB). Send or remove an item before adding more.';
type Kind = 'history' | 'outbox' | 'media' | 'draft' | 'received-media';
const isRetained = (kind: Kind) => kind === 'history' || kind === 'received-media';
interface Metadata { id: string; account: string; kind: Kind; key: string; at: number; bytes: number; revision?: string; rooms?: string[]; mimeType?: string; historyGeneration?: number; messageIds?: string[]; inbox?: boolean }
export interface ChatDraftCommit { key: string; revision: string; mediaKeys: string[] }
export interface ChatRecordMutation {
  expectedDraft?: { key: string; revision: string | null };
  remove?: Array<{ kind: Kind; key: string }>;
}
export const consumeChatDraft = (draft?: ChatDraftCommit): ChatRecordMutation => draft ? {
  expectedDraft: draft,
  remove: [{ kind: 'draft', key: draft.key }, ...draft.mediaKeys.map((key) => ({ kind: 'media' as const, key }))],
} : {};
interface Envelope { iv: ArrayBuffer; ciphertext: ArrayBuffer }
interface SessionBinding { account: string; sessionMarker: string; at: number }
export interface ChatStorageScope { account: string; marker: string; generation: number }
let database: Promise<IDBDatabase> | undefined;
let generation = 0;
let active: ChatStorageScope | null = null;
const HISTORY_RETIREMENT = 'pantopus-chat-history-retired';
type HistoryRetirement = { account: string; marker: string; generation: number; previousGeneration?: number; rooms: string[]; cleared?: boolean; mediaOnly?: boolean; messageIds?: string[] };
const historyGenerations = new Map<string, number>();
const receivedHistoryGenerations = new Map<string, number>();
const historyListeners = new Set<(event: HistoryRetirement) => void>();
let historyChannel: BroadcastChannel | null = null;
let listeningForHistory = false;
const HISTORY_FENCE = 'history-generation';
type HistoryFence = { account: string; generation: number };

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

/** Capture before an inbox request, even before its profile query completes. */
export async function captureChatHistoryFence(): Promise<HistoryFence | null> {
  return await readTaskRecoveryValue<HistoryFence>(await open(), 'metadata', HISTORY_FENCE) ?? null;
}

function receiveHistoryRetirement(event: HistoryRetirement) {
  if (!event || event.marker !== sessionMarker() || !getAuthToken() || typeof event.account !== 'string'
    || !Number.isSafeInteger(event.generation) || !Array.isArray(event.rooms)) return;
  if ((receivedHistoryGenerations.get(event.account) ?? -1) >= event.generation) return;
  receivedHistoryGenerations.set(event.account, event.generation);
  historyGenerations.set(event.account, Math.max(historyGenerations.get(event.account) ?? 0, event.generation));
  historyListeners.forEach((listener) => listener(event));
}

function publishHistoryRetirement(event: HistoryRetirement) {
  receiveHistoryRetirement(event);
  try { historyChannel?.postMessage(event); } catch { /* Use the storage fallback. */ }
  try { localStorage.setItem(HISTORY_RETIREMENT, JSON.stringify(event)); } catch { /* The encrypted fence still protects reloads and writes. */ }
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

export function isChatHistoryGenerationCurrent(accountId: string, value: number): boolean {
  return (historyGenerations.get(JSON.stringify([getApiBaseUrl(), accountId])) ?? 0) === value;
}

export async function readChatHistoryGeneration(scope: ChatStorageScope): Promise<number> {
  const fence = await readTaskRecoveryValue<HistoryFence>(await open(), 'metadata', HISTORY_FENCE);
  const value = fence?.account === scope.account ? fence.generation : 0;
  if (!isChatStorageCurrent(scope)) throw new Error('This chat session ended.');
  historyGenerations.set(scope.account, Math.max(historyGenerations.get(scope.account) ?? 0, value));
  return historyGenerations.get(scope.account)!;
}

function sessionMarker(): string { try { return localStorage.getItem(AUTH_SESSION_CHANGE_KEY) || ''; } catch { return ''; } }

/** Existing cookie sessions can predate this origin's local marker. Call only
 * after a verified profile; never weaken the offline binding check below. */
export function establishVerifiedChatSession(): boolean {
  if (!getAuthToken() || sessionMarker()) return false;
  try {
    const marker = `${Date.now()}:chat-${crypto.randomUUID()}`;
    localStorage.setItem(AUTH_SESSION_CHANGE_KEY, marker);
    // Other tabs receive the browser's storage event. This tab must retire its
    // pending reads too, then bind the profile under the established marker.
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_SESSION_CHANGE_KEY, newValue: marker }));
    return true;
  } catch { return false; }
}

/** Only a previously verified account from this exact browser session may
 * open its encrypted history while profile requests are unavailable. */
export async function readCachedChatAccountId(): Promise<string | null> {
  if (!getAuthToken() || !sessionMarker()) return null;
  const marker = sessionMarker();
  const binding = await readTaskRecoveryValue<SessionBinding>(await open(), 'metadata', 'session');
  if (!binding || binding.sessionMarker !== marker || sessionMarker() !== marker
    || !getAuthToken() || Date.now() - binding.at > HISTORY_TTL) return null;
  const [origin, actor] = JSON.parse(binding.account) as string[];
  return origin === getApiBaseUrl() && typeof actor === 'string' ? actor : null;
}

function open(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      for (const store of ['keys', 'metadata', 'payloads']) request.result.createObjectStore(store);
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

export function isChatStorageCurrent(scope: ChatStorageScope): boolean {
  return active === scope && scope.generation === generation && getAuthToken() !== null && authSessionMarker() === scope.marker;
}

export function suspendChatStorage(): void { generation++; active = null; }

function metadata(db: IDBDatabase): Promise<Metadata[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('metadata');
    const request = transaction.objectStore('metadata').getAll();
    transaction.oncomplete = () => resolve((request.result as Metadata[]).filter((entry) => typeof entry.id === 'string'));
    transaction.onabort = transaction.onerror = () => reject(new Error('Chat recovery could not be read.'));
  });
}

function mutate(db: IDBDatabase, scope: ChatStorageScope | null, action: (transaction: IDBTransaction) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['keys', 'metadata', 'payloads'], 'readwrite');
    try {
      if (scope && !isChatStorageCurrent(scope)) throw new Error('This chat session ended.');
      action(transaction);
    } catch { transaction.abort(); }
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(new Error('Chat could not be saved on this device. Free some storage and try again.'));
  });
}

export async function activateChatStorage(accountId: string): Promise<ChatStorageScope> {
  const account = JSON.stringify([getApiBaseUrl(), accountId]);
  if (active?.account === account && isChatStorageCurrent(active)) return active;
  for (const key of historyGenerations.keys()) if (key !== account) historyGenerations.delete(key);
  for (const key of receivedHistoryGenerations.keys()) if (key !== account) receivedHistoryGenerations.delete(key);
  const scope = { account, marker: authSessionMarker(), generation: ++generation };
  active = scope;
  const db = await open();
  const entries = await metadata(db);
  await mutate(db, scope, (transaction) => {
    const keys = transaction.objectStore('keys').openKeyCursor();
    keys.onsuccess = () => {
      const cursor = keys.result;
      if (!cursor) return;
      if (cursor.key !== account) transaction.objectStore('keys').delete(cursor.key);
      cursor.continue();
    };
    for (const entry of entries) if (entry.account !== account || (isRetained(entry.kind) && Date.now() - entry.at > HISTORY_TTL)) {
      transaction.objectStore('metadata').delete(entry.id);
      transaction.objectStore('payloads').delete(entry.id);
      if (entry.account !== account) transaction.objectStore('keys').delete(entry.account);
    }
    transaction.objectStore('metadata').put({ account, sessionMarker: sessionMarker(), at: Date.now() }, 'session');
  });
  return scope;
}

export async function clearChatStorage(historyOnly = false): Promise<void> {
  if (!historyOnly) { suspendChatStorage(); historyGenerations.clear(); receivedHistoryGenerations.clear(); }
  const db = await open();
  const scope = historyOnly ? active : null;
  let retired: HistoryRetirement | undefined;
  await mutate(db, scope, (transaction) => {
    if (!historyOnly) {
      for (const store of ['keys', 'metadata', 'payloads']) transaction.objectStore(store).clear();
    } else {
      const entries = transaction.objectStore('metadata').getAll();
      entries.onsuccess = () => {
        for (const entry of entries.result as Metadata[]) if (isRetained(entry.kind)) {
          transaction.objectStore('metadata').delete(entry.id);
          transaction.objectStore('payloads').delete(entry.id);
        }
      };
      if (scope) {
        const fence = transaction.objectStore('metadata').get(HISTORY_FENCE);
        fence.onsuccess = () => {
          const next = (fence.result?.account === scope.account ? Number(fence.result.generation) || 0 : 0) + 1;
          transaction.objectStore('metadata').put({ account: scope.account, generation: next }, HISTORY_FENCE);
          retired = { account: scope.account, marker: sessionMarker(), generation: next, rooms: [], cleared: true };
        };
      }
    }
  });
  if (retired && scope && isChatStorageCurrent(scope)) publishHistoryRetirement(retired);
}

const recordId = (scope: ChatStorageScope, kind: Kind, key: string) => JSON.stringify([scope.account, kind, key]);

async function seal(scope: ChatStorageScope, id: string, bytes: ArrayBuffer): Promise<Envelope> {
  const key = await taskRecoveryEncryptionKey(await open(), scope.account, () => isChatStorageCurrent(scope));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv: iv.buffer, ciphertext: await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
    additionalData: new TextEncoder().encode(id) }, key, bytes) };
}

export async function readChatRecord<T>(scope: ChatStorageScope, kind: Kind, key: string): Promise<T | null> {
  const bytes = await readChatBytes(scope, kind, key);
  return bytes ? JSON.parse(new TextDecoder().decode(bytes)) as T : null;
}

export async function readChatBytes(scope: ChatStorageScope, kind: Kind, key: string): Promise<ArrayBuffer | null> {
  const db = await open();
  const historyGeneration = isRetained(kind) ? await readChatHistoryGeneration(scope) : null;
  const id = recordId(scope, kind, key);
  // Read the envelope and key in one snapshot: another tab may accept/remove
  // the pending message or clear its account while this read is in flight.
  const { meta, sealed, secret } = await new Promise<{ meta?: Metadata; sealed?: Envelope; secret?: CryptoKey }>((resolve, reject) => {
    const transaction = db.transaction(['metadata', 'payloads', 'keys']);
    const metaRequest = transaction.objectStore('metadata').get(id);
    const payloadRequest = transaction.objectStore('payloads').get(id);
    const keyRequest = transaction.objectStore('keys').get(scope.account);
    transaction.oncomplete = () => resolve({ meta: metaRequest.result, sealed: payloadRequest.result, secret: keyRequest.result });
    transaction.onabort = transaction.onerror = () => reject(new Error('Chat recovery could not be read.'));
  });
  if (!isChatStorageCurrent(scope) || !meta || (isRetained(kind) && Date.now() - meta.at > HISTORY_TTL)) return null;
  // Older app versions advance the shared fence without knowing about received
  // media. Their denials must still make previously saved binaries unreadable.
  if (kind === 'received-media' && meta.historyGeneration !== historyGeneration) return null;
  if (!sealed || !secret) throw new Error('Saved chat recovery could not be opened.');
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv,
    additionalData: new TextEncoder().encode(id) }, secret, sealed.ciphertext);
  if (!isChatStorageCurrent(scope)) return null;
  // A denial in another tab can retire this snapshot while decryption runs.
  if (historyGeneration !== null && await readChatHistoryGeneration(scope) !== historyGeneration) return null;
  return bytes;
}

/** Fence late writes first, then remove only snapshots containing denied rooms.
 * The generation is one bounded value per account, not an ever-growing deny list. */
export async function retireChatHistoryRooms(accountId: string, roomIds: string[], mediaOnly = false, messageIds?: string[]): Promise<HistoryRetirement | undefined> {
  const rooms = [...new Set(roomIds.filter(Boolean))];
  if (!rooms.length) return;
  const denied = new Set(rooms);
  const deletedMessages = messageIds?.length ? new Set(messageIds) : null;
  const scope = await activateChatStorage(accountId);
  const db = await open();
  // Older snapshots predate the metadata room index. There are at most 20.
  const legacy = new Set<string>();
  for (const entry of await metadata(db)) {
    if (entry.account !== scope.account || entry.kind !== 'history'
      || (mediaOnly && !deletedMessages) || (entry.rooms && (!deletedMessages || entry.messageIds || entry.inbox))) continue;
    try {
      const value = await readChatRecord(scope, 'history', entry.key);
      if (!value || chatHistoryRooms(value).some((room) => denied.has(room))
        && (!deletedMessages || chatHistoryMessageIds(value).some((id) => deletedMessages.has(id)))) legacy.add(entry.id);
    } catch { legacy.add(entry.id); }
  }
  const next = await new Promise<number>((resolve, reject) => {
    const transaction = db.transaction(['metadata', 'payloads'], 'readwrite');
    const metas = transaction.objectStore('metadata');
    const request = metas.getAll();
    const fence = metas.get(HISTORY_FENCE);
    let generation = 0;
    fence.onsuccess = () => {
      if (!isChatStorageCurrent(scope)) { transaction.abort(); return; }
      const previousGeneration = fence.result?.account === scope.account ? Number(fence.result.generation) || 0 : 0;
      generation = previousGeneration + 1;
      metas.put({ account: scope.account, generation }, HISTORY_FENCE);
      for (const entry of request.result as Metadata[]) if (entry.account === scope.account && isRetained(entry.kind)) {
        const affectedMessage = !deletedMessages || entry.inbox || legacy.has(entry.id)
          || (entry.kind === 'received-media' && !entry.messageIds) || entry.messageIds?.some((id) => deletedMessages.has(id));
        if ((!mediaOnly || entry.kind === 'received-media' || deletedMessages && entry.kind === 'history')
          && affectedMessage && (legacy.has(entry.id) || entry.rooms?.some((room) => denied.has(room)))) {
          metas.delete(entry.id); transaction.objectStore('payloads').delete(entry.id);
        } else if (entry.kind === 'received-media' && entry.historyGeneration === previousGeneration) {
          metas.put({ ...entry, historyGeneration: generation }, entry.id);
        }
      }
    };
    transaction.oncomplete = () => resolve(generation);
    transaction.onabort = transaction.onerror = () => reject(new Error('Revoked chat history could not be removed.'));
  });
  if (!isChatStorageCurrent(scope)) return;
  const event = { account: scope.account, marker: sessionMarker(), generation: next, previousGeneration: next - 1, rooms, mediaOnly, messageIds };
  publishHistoryRetirement(event);
  return event;
}

export async function listChatRecordKeys(scope: ChatStorageScope, kind: Kind): Promise<string[]> {
  return (await metadata(await open())).filter((entry) => entry.account === scope.account && entry.kind === kind).map((entry) => entry.key);
}

export async function readChatReceivedMedia(scope: ChatStorageScope, key: string): Promise<Blob | null> {
  const meta = await readTaskRecoveryValue<Metadata>(await open(), 'metadata', recordId(scope, 'received-media', key));
  if (!meta?.mimeType) return null;
  const bytes = await readChatBytes(scope, 'received-media', key);
  return bytes ? new Blob([bytes], { type: meta.mimeType }) : null;
}

export async function deleteChatRecords(scope: ChatStorageScope, records: Array<{ kind: Kind; key: string }>): Promise<void> {
  await mutate(await open(), scope, (transaction) => {
    for (const record of records) {
      const id = recordId(scope, record.kind, record.key);
      transaction.objectStore('metadata').delete(id);
      transaction.objectStore('payloads').delete(id);
    }
  });
}

/** Reject over-capacity selections before loading/encrypting their bytes.
 * The write transaction repeats this check for concurrent tabs. */
export async function assertChatOutboxCapacity(scope: ChatStorageScope, records: Array<{ kind: 'outbox' | 'media' | 'draft'; key: string; bytes: number }>, mutation: ChatRecordMutation = {}): Promise<void> {
  const replaced = new Set([...records, ...(mutation.remove ?? [])].map((record) => recordId(scope, record.kind, record.key)));
  const existing = (await metadata(await open())).filter((entry) => entry.account === scope.account
    && !isRetained(entry.kind) && !replaced.has(entry.id));
  if (!isChatStorageCurrent(scope)) throw new Error('This chat session ended.');
  if (existing.reduce((sum, entry) => sum + entry.bytes, 0) + records.reduce((sum, entry) => sum + entry.bytes + 16, 0) > OUTBOX_BYTES
    || existing.filter((entry) => entry.kind === 'outbox' || entry.kind === 'draft').length + records.filter((entry) => entry.kind === 'outbox' || entry.kind === 'draft').length > 100) {
    throw new Error(OUTBOX_FULL);
  }
}

/** Metadata and original attachment bytes commit together, before a send starts. */
export async function writeChatRecords(scope: ChatStorageScope, records: Array<{ kind: Kind; key: string; value: unknown; revision?: string } | { kind: 'media'; key: string; bytes: ArrayBuffer }
  | { kind: 'received-media'; key: string; bytes: ArrayBuffer; roomId: string; messageId: string; historyGeneration: number; mimeType: string }>, mutation: ChatRecordMutation = {}): Promise<void> {
  const prepared = await Promise.all(records.map(async (record) => {
    const id = recordId(scope, record.kind, record.key);
    const bytes = 'bytes' in record ? record.bytes : new TextEncoder().encode(JSON.stringify(record.value)).buffer;
    const sealed = await seal(scope, id, bytes);
    return { meta: { id, account: scope.account, kind: record.kind, key: record.key, at: Date.now(), bytes: sealed.ciphertext.byteLength,
      ...(record.kind === 'history' ? { rooms: chatHistoryRooms(record.value), messageIds: chatHistoryMessageIds(record.value),
        inbox: Boolean((record.value as { inbox?: unknown } | null)?.inbox) } : {}),
      ...('roomId' in record ? { rooms: [record.roomId] } : {}),
      ...('mimeType' in record ? { mimeType: record.mimeType } : {}),
      ...('historyGeneration' in record ? { historyGeneration: record.historyGeneration } : {}),
      ...('messageId' in record ? { messageIds: [record.messageId] } : {}),
      ...('revision' in record ? { revision: record.revision } : {}) }, sealed };
  }));
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['metadata', 'payloads'], 'readwrite');
    const metas = transaction.objectStore('metadata');
    const payloads = transaction.objectStore('payloads');
    const request = metas.getAll();
    const historyFence = metas.get(HISTORY_FENCE);
    let reason = 'Chat could not be saved. Free some device storage and try again.';
    historyFence.onsuccess = () => {
      if (!isChatStorageCurrent(scope)) { reason = 'This chat session ended.'; transaction.abort(); return; }
      const expected = historyFence.result?.account === scope.account ? Number(historyFence.result.generation) || 0 : 0;
      if (records.some((record) => isRetained(record.kind)
        && Number('historyGeneration' in record ? record.historyGeneration
          : 'value' in record ? (record.value as { historyGeneration?: number })?.historyGeneration ?? 0 : 0) !== expected)) {
        reason = 'Chat access changed. Refresh before retaining this history.';
        transaction.abort(); return;
      }
      if (mutation.expectedDraft) {
        const actual = (request.result as Metadata[]).find((entry) => entry.id === recordId(scope, 'draft', mutation.expectedDraft!.key));
        if ((actual?.revision ?? null) !== mutation.expectedDraft.revision) {
          reason = 'Another tab changed this draft. Keep your text here and reopen the conversation to recover the saved draft.';
          transaction.abort(); return;
        }
      }
      const removed = new Set((mutation.remove ?? []).map((record) => recordId(scope, record.kind, record.key)));
      const replaced = new Set([...prepared.map((entry) => entry.meta.id), ...removed]);
      const entries = (request.result as Metadata[]).filter((entry) => entry.id && entry.account === scope.account && !replaced.has(entry.id));
      const outgoing = [...entries, ...prepared.map((entry) => entry.meta)].filter((entry) => !isRetained(entry.kind));
      if (outgoing.reduce((sum, entry) => sum + entry.bytes, 0) > OUTBOX_BYTES
        || outgoing.filter((entry) => entry.kind === 'outbox' || entry.kind === 'draft').length > 100) {
        reason = OUTBOX_FULL;
        transaction.abort(); return;
      }
      const history = [...entries, ...prepared.map((entry) => entry.meta)].filter((entry) => entry.kind === 'history').sort((a, b) => b.at - a.at);
      let total = 0;
      const evicted = new Set(history.filter((entry, index) => {
        total += entry.bytes;
        return index >= 20 || total > HISTORY_BYTES || Date.now() - entry.at > HISTORY_TTL;
      }).map((entry) => entry.id));
      const received = [...entries, ...prepared.map((entry) => entry.meta)].filter((entry) => entry.kind === 'received-media').sort((a, b) => b.at - a.at);
      let receivedBytes = 0;
      for (const [index, entry] of received.entries()) {
        receivedBytes += entry.bytes;
        if (index >= 100 || receivedBytes > RECEIVED_MEDIA_BYTES || Date.now() - entry.at > HISTORY_TTL) evicted.add(entry.id);
      }
      try {
        for (const id of removed) { metas.delete(id); payloads.delete(id); }
        for (const entry of prepared) if (!evicted.has(entry.meta.id)) { metas.put(entry.meta, entry.meta.id); payloads.put(entry.sealed, entry.meta.id); }
        for (const id of evicted) { metas.delete(id); payloads.delete(id); }
      } catch { transaction.abort(); }
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(new Error(reason));
  });
}
