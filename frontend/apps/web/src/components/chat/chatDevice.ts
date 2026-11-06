// What the root layout does with chat on every page, without chat's own code (lib/query-provider.tsx):
// the clears at sign-out, at an account switch and for a visit without a session, and
// starting the outbox after first paint once the app shell says who is signed in.
import { AUTH_SESSION_CHANGE_KEY, authSessionMarker, getAuthToken } from '@pantopus/api/client';
import { CHAT_DATABASE, CHAT_STORES, HISTORY_RETIREMENT, HISTORY_TTL, chatAccountKey, chatDatabaseOpened, chatSessionEpoch, chatSessionMarker,
  historyGenerations, isRetainedKind, noteChatRetirement, openChatDatabase, receivedHistoryGenerations, suspendChatSession,
  type ChatRecordMetadata, type HistoryRetirement } from './chatSession';

/** False only when this browser says it has no chat store: a visitor who never had one gets none. */
async function chatDatabaseMayExist(): Promise<boolean> {
  if (chatDatabaseOpened()) return true;
  try {
    if (typeof indexedDB === 'undefined') return false;
    if (typeof indexedDB.databases !== 'function') return true;
    return (await indexedDB.databases()).some((info) => info.name === CHAT_DATABASE);
  } catch { return true; }
}

/** One read-write transaction over the store, given up (nothing written) once `current` is false. */
function change(db: IDBDatabase, current: () => boolean, action: (stores: { keys: IDBObjectStore; metadata: IDBObjectStore; payloads: IDBObjectStore }) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHAT_STORES, 'readwrite');
    try {
      if (!current()) throw new Error('This chat session ended.');
      action({ keys: transaction.objectStore('keys'), metadata: transaction.objectStore('metadata'), payloads: transaction.objectStore('payloads') });
    } catch { transaction.abort(); }
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(new Error('Chat storage could not be changed.'));
  });
}

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

/** Everything chat kept in this browser, for every account: a sign-out, or a visit without a session. */
export async function clearChatDevice(): Promise<void> {
  noteChatRetirement();
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

let retry: { actorId: string; epoch: number } | null = null;

/**
 * Starts the outbox (messages queued in any tab, sent from any app page) once the
 * page has painted, instead of in its startup scripts. If its code can't load (a new
 * deployment, offline), queued sends stay saved and it tries again on the next
 * navigation or when the browser is back online. Returns a cancel for unmounting.
 */
export function startChatOutboxAfterPaint(actorId: string): () => void {
  const epoch = chatSessionEpoch();
  let cancelled = false;
  const ours = () => !cancelled && epoch === chatSessionEpoch();
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
  if (pending && pending.epoch === chatSessionEpoch()) startChatOutboxAfterPaint(pending.actorId);
}
