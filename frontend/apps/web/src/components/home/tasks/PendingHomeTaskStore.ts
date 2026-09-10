import { validRetainedTaskCreate, type RetainedTaskCreate } from './homeTaskModel';

export interface TaskDraftSnapshot { draft: RetainedTaskCreate; revision: string }
interface SealedDraft { version: 1; revision: string; iv: ArrayBuffer; ciphertext: ArrayBuffer }
const DATABASE = 'pantopus-private-task-recovery';
const KEY_ID = 'task-create-v1';
let database: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('keys');
      request.result.createObjectStore('drafts');
    };
    request.onerror = () => reject(new Error('Protected task recovery storage could not be opened.'));
    request.onblocked = () => reject(new Error('Close older Pantopus tabs, then reopen task recovery.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = undefined; };
      resolve(db);
    };
  }).catch(error => { database = undefined; throw error; });
  return database;
}

function readValue<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly');
    let value: T | undefined;
    const request = transaction.objectStore(store).get(key);
    request.onsuccess = () => { value = request.result as T | undefined; };
    transaction.oncomplete = () => resolve(value);
    transaction.onabort = transaction.onerror = () => reject(new Error('Protected task recovery could not be read.'));
  });
}

async function encryptionKey(db: IDBDatabase): Promise<CryptoKey> {
  const saved = await readValue<CryptoKey>(db, 'keys', KEY_ID);
  if (saved) return saved;
  const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return new Promise((resolve, reject) => {
    // Two tabs may generate keys concurrently. The single write transaction
    // chooses one key before either caller encrypts a retained command.
    const transaction = db.transaction('keys', 'readwrite');
    const keys = transaction.objectStore('keys');
    const request = keys.get(KEY_ID);
    let selected: CryptoKey;
    request.onsuccess = () => {
      selected = request.result || candidate;
      if (!request.result) keys.put(selected, KEY_ID);
    };
    transaction.oncomplete = () => resolve(selected);
    transaction.onabort = transaction.onerror = () => reject(new Error('Protected task recovery could not be initialized.'));
  });
}

/** Encrypted original create input, with atomic compare-and-write across tabs. */
export class PendingHomeTaskStore {
  private readonly key: string;
  private readonly additionalData: Uint8Array<ArrayBuffer>;

  constructor(readonly origin: string, readonly actorId: string, readonly homeId: string) {
    this.key = JSON.stringify([origin, actorId, homeId]);
    this.additionalData = new TextEncoder().encode(`pantopus-task-create-v1:${this.key}`);
  }

  async load(): Promise<TaskDraftSnapshot | null> {
    const db = await openDatabase();
    const sealed = await readValue<SealedDraft>(db, 'drafts', this.key);
    if (!sealed) return null;
    try {
      if (sealed.version !== 1 || typeof sealed.revision !== 'string'
        || !(sealed.iv instanceof ArrayBuffer) || sealed.iv.byteLength !== 12
        || !(sealed.ciphertext instanceof ArrayBuffer)) throw new Error('Invalid envelope');
      const key = await readValue<CryptoKey>(db, 'keys', KEY_ID);
      if (!key) throw new Error('Missing key');
      const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: this.additionalData }, key, sealed.ciphertext);
      const draft = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as RetainedTaskCreate;
      if (!validRetainedTaskCreate(draft, this.origin, this.actorId, this.homeId)) throw new Error('Invalid saved request');
      return { draft, revision: sealed.revision };
    } catch {
      // A corrupt command is never treated as an empty slot or silently erased.
      throw new Error('The original task request could not be read. It has been kept; no new task was submitted.');
    }
  }

  async save(draft: RetainedTaskCreate, expected: TaskDraftSnapshot | null, isCurrent: () => boolean): Promise<TaskDraftSnapshot> {
    if (!validRetainedTaskCreate(draft, this.origin, this.actorId, this.homeId)) throw new Error('The original task request is invalid.');
    const db = await openDatabase();
    const key = await encryptionKey(db);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: this.additionalData }, key,
      new TextEncoder().encode(JSON.stringify(draft)));
    const revision = crypto.randomUUID();
    const sealed: SealedDraft = { version: 1, revision, iv: iv.buffer, ciphertext };
    await this.replace(db, expected, sealed, isCurrent);
    return { draft: structuredClone(draft), revision };
  }

  async clear(expected: TaskDraftSnapshot, isCurrent: () => boolean): Promise<void> {
    await this.replace(await openDatabase(), expected, null, isCurrent);
  }

  private replace(db: IDBDatabase, expected: TaskDraftSnapshot | null, next: SealedDraft | null,
    isCurrent: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('drafts', 'readwrite');
      const store = transaction.objectStore('drafts');
      const request = store.get(this.key);
      let failure = 'The original task request could not be saved. No replacement request was submitted.';
      request.onsuccess = () => {
        let current = false;
        try { current = isCurrent(); } catch { /* A missing lifetime proof cannot authorize a write. */ }
        if (!current) {
          failure = 'This task form is no longer current. The saved request was kept.';
          transaction.abort(); return;
        }
        const actual = request.result as SealedDraft | undefined;
        if (expected ? actual?.revision !== expected.revision : actual !== undefined) {
          failure = 'Another tab changed the saved task request. Reopen this form to recover that request.';
          transaction.abort(); return;
        }
        if (next) store.put(next, this.key);
        else store.delete(this.key);
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(new Error(failure));
    });
  }
}
