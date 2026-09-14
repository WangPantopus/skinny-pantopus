const DATABASE = 'pantopus-private-task-recovery';
let database: Promise<IDBDatabase> | undefined;

export function openTaskRecoveryDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('keys');
      request.result.createObjectStore('drafts');
    };
    request.onerror = () => reject(new Error('Protected recovery storage could not be opened.'));
    request.onblocked = () => reject(new Error('Close older Pantopus tabs, then reopen recovery.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = undefined; };
      resolve(db);
    };
  }).catch(error => { database = undefined; throw error; });
  return database;
}

export function readTaskRecoveryValue<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly');
    let value: T | undefined;
    const request = transaction.objectStore(store).get(key);
    request.onsuccess = () => { value = request.result as T | undefined; };
    transaction.oncomplete = () => resolve(value);
    transaction.onabort = transaction.onerror = () => reject(new Error('Protected recovery could not be read.'));
  });
}

export async function taskRecoveryEncryptionKey(db: IDBDatabase, keyId: string): Promise<CryptoKey> {
  const saved = await readTaskRecoveryValue<CryptoKey>(db, 'keys', keyId);
  if (saved) return saved;
  const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return new Promise((resolve, reject) => {
    // Two tabs may generate keys concurrently. The single write transaction
    // chooses one key before either caller encrypts a retained command.
    const transaction = db.transaction('keys', 'readwrite');
    const keys = transaction.objectStore('keys');
    const request = keys.get(keyId);
    let selected: CryptoKey;
    request.onsuccess = () => {
      selected = request.result || candidate;
      // A synchronous quota/security failure must reject the protected write,
      // not escape this callback or leave the caller waiting on initialization.
      try { if (!request.result) keys.put(selected, keyId); } catch { transaction.abort(); }
    };
    transaction.oncomplete = () => resolve(selected);
    transaction.onabort = transaction.onerror = () => reject(new Error('Protected recovery could not be initialized.'));
  });
}


export interface ProtectedRecoverySnapshot<T> { value: T; revision: string }
interface ProtectedEnvelope { version: 1; revision: string; iv: ArrayBuffer; ciphertext: ArrayBuffer }
/** Retain an encrypted original in the existing recovery database; never overwrite another tab's original. */
export class ProtectedRecoverySlot<T> {
  private readonly key: string;
  private readonly additionalData: Uint8Array<ArrayBuffer>;
  constructor(scope: string[], private readonly valid: (value: unknown) => value is T,
    private readonly database = openTaskRecoveryDatabase) {
    this.key = JSON.stringify(scope);
    this.additionalData = new TextEncoder().encode(`pantopus-protected-original-v1:${this.key}`);
  }
  async load(): Promise<ProtectedRecoverySnapshot<T> | null> {
    const db = await this.database();
    const sealed = await readTaskRecoveryValue<ProtectedEnvelope>(db, 'drafts', this.key);
    if (sealed === undefined) return null;
    try {
      if (!sealed || sealed.version !== 1 || typeof sealed.revision !== 'string'
        || !(sealed.iv instanceof ArrayBuffer) || sealed.iv.byteLength !== 12
        || !(sealed.ciphertext instanceof ArrayBuffer)) throw new Error('Invalid saved envelope');
      const key = await readTaskRecoveryValue<CryptoKey>(db, 'keys', 'protected-original-v1');
      if (!key) throw new Error('Missing key');
      const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: this.additionalData }, key, sealed.ciphertext);
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!this.valid(value)) throw new Error('Invalid saved original');
      return { value, revision: sealed.revision };
    } catch {
      throw new Error('The saved original could not be read. It was kept; reopen recovery before sending.');
    }
  }
  async retain(value: T, isCurrent: () => boolean): Promise<ProtectedRecoverySnapshot<T>> {
    if (!this.valid(value)) throw new Error('The original request could not be validated.');
    const db = await this.database();
    const key = await taskRecoveryEncryptionKey(db, 'protected-original-v1');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const original = JSON.stringify(value);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: this.additionalData }, key, new TextEncoder().encode(original));
    const revision = crypto.randomUUID();
    await this.replace(db, null, { version: 1, revision, iv: iv.buffer, ciphertext }, isCurrent);
    return { value: JSON.parse(original) as T, revision };
  }
  async clear(expected: ProtectedRecoverySnapshot<T>, isCurrent: () => boolean): Promise<void> {
    await this.replace(await this.database(), expected.revision, null, isCurrent);
  }
  private replace(db: IDBDatabase, expected: string | null, next: ProtectedEnvelope | null,
    isCurrent: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('drafts', 'readwrite');
      const store = transaction.objectStore('drafts');
      const request = store.get(this.key);
      let failure = 'Protected recovery could not be saved. Reopen the form before sending.';
      request.onsuccess = () => {
        let current = false;
        try { current = isCurrent(); } catch { /* Retired work cannot change the saved original. */ }
        if (!current) { failure = 'This page is no longer current. The original was kept.'; transaction.abort(); return; }
        const actual = request.result as ProtectedEnvelope | undefined;
        if (expected === null ? actual !== undefined : actual?.revision !== expected) {
          failure = 'Another tab changed the saved original. Reopen the form to recover it.';
          transaction.abort(); return;
        }
        try { if (next) store.put(next, this.key); else store.delete(this.key); }
        catch { transaction.abort(); }
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(new Error(failure));
    });
  }
}
