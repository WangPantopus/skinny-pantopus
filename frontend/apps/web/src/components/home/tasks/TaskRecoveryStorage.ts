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

export function readTaskRecoveryValue<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly');
    let value: T | undefined;
    const request = transaction.objectStore(store).get(key);
    request.onsuccess = () => { value = request.result as T | undefined; };
    transaction.oncomplete = () => resolve(value);
    transaction.onabort = transaction.onerror = () => reject(new Error('Protected task recovery could not be read.'));
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
      if (!request.result) keys.put(selected, keyId);
    };
    transaction.oncomplete = () => resolve(selected);
    transaction.onabort = transaction.onerror = () => reject(new Error('Protected task recovery could not be initialized.'));
  });
}

