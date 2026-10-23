import { AUTH_SESSION_CHANGE_KEY, authSessionMarker, getApiBaseUrl, getAuthToken } from '@pantopus/api';
import { readTaskRecoveryValue, taskRecoveryEncryptionKey } from '@/components/home/tasks/TaskRecoveryStorage';

const DATABASE = 'pantopus-private-chat-v1';
const HISTORY_TTL = 7 * 24 * 60 * 60 * 1000;
const HISTORY_BYTES = 5 * 1024 * 1024;
const OUTBOX_BYTES = 100 * 1024 * 1024;
const OUTBOX_FULL = 'Your pending messages and drafts are full (100 items or 100 MB). Send or remove an item before adding more.';
type Kind = 'history' | 'outbox' | 'media' | 'draft';
interface Metadata { id: string; account: string; kind: Kind; key: string; at: number; bytes: number; revision?: string }
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

function sessionMarker(): string { try { return localStorage.getItem(AUTH_SESSION_CHANGE_KEY) || ''; } catch { return ''; } }

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
    for (const entry of entries) if (entry.account !== account || (entry.kind === 'history' && Date.now() - entry.at > HISTORY_TTL)) {
      transaction.objectStore('metadata').delete(entry.id);
      transaction.objectStore('payloads').delete(entry.id);
      if (entry.account !== account) transaction.objectStore('keys').delete(entry.account);
    }
    transaction.objectStore('metadata').put({ account, sessionMarker: sessionMarker(), at: Date.now() }, 'session');
  });
  return scope;
}

export async function clearChatStorage(historyOnly = false): Promise<void> {
  if (!historyOnly) suspendChatStorage();
  const db = await open();
  const entries = historyOnly ? await metadata(db) : [];
  await mutate(db, null, (transaction) => {
    if (!historyOnly) {
      for (const store of ['keys', 'metadata', 'payloads']) transaction.objectStore(store).clear();
    } else for (const entry of entries) if (entry.kind === 'history') {
      transaction.objectStore('metadata').delete(entry.id);
      transaction.objectStore('payloads').delete(entry.id);
    }
  });
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
  if (!isChatStorageCurrent(scope) || !meta || (kind === 'history' && Date.now() - meta.at > HISTORY_TTL)) return null;
  if (!sealed || !secret) throw new Error('Saved chat recovery could not be opened.');
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv,
    additionalData: new TextEncoder().encode(id) }, secret, sealed.ciphertext);
  if (!isChatStorageCurrent(scope)) return null;
  return bytes;
}

export async function listChatRecordKeys(scope: ChatStorageScope, kind: Kind): Promise<string[]> {
  return (await metadata(await open())).filter((entry) => entry.account === scope.account && entry.kind === kind).map((entry) => entry.key);
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
    && entry.kind !== 'history' && !replaced.has(entry.id));
  if (!isChatStorageCurrent(scope)) throw new Error('This chat session ended.');
  if (existing.reduce((sum, entry) => sum + entry.bytes, 0) + records.reduce((sum, entry) => sum + entry.bytes + 16, 0) > OUTBOX_BYTES
    || existing.filter((entry) => entry.kind === 'outbox' || entry.kind === 'draft').length + records.filter((entry) => entry.kind === 'outbox' || entry.kind === 'draft').length > 100) {
    throw new Error(OUTBOX_FULL);
  }
}

/** Metadata and original attachment bytes commit together, before a send starts. */
export async function writeChatRecords(scope: ChatStorageScope, records: Array<{ kind: Kind; key: string; value: unknown; revision?: string } | { kind: 'media'; key: string; bytes: ArrayBuffer }>, mutation: ChatRecordMutation = {}): Promise<void> {
  const prepared = await Promise.all(records.map(async (record) => {
    const id = recordId(scope, record.kind, record.key);
    const bytes = 'bytes' in record ? record.bytes : new TextEncoder().encode(JSON.stringify(record.value)).buffer;
    const sealed = await seal(scope, id, bytes);
    return { meta: { id, account: scope.account, kind: record.kind, key: record.key, at: Date.now(), bytes: sealed.ciphertext.byteLength,
      ...('revision' in record ? { revision: record.revision } : {}) }, sealed };
  }));
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['metadata', 'payloads'], 'readwrite');
    const metas = transaction.objectStore('metadata');
    const payloads = transaction.objectStore('payloads');
    const request = metas.getAll();
    let reason = 'Chat could not be saved. Free some device storage and try again.';
    request.onsuccess = () => {
      if (!isChatStorageCurrent(scope)) { reason = 'This chat session ended.'; transaction.abort(); return; }
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
      const outgoing = [...entries, ...prepared.map((entry) => entry.meta)].filter((entry) => entry.kind !== 'history');
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
