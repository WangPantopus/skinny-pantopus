import { openTaskRecoveryDatabase, readTaskRecoveryValue, taskRecoveryEncryptionKey } from './TaskRecoveryStorage';

import { validRetainedTaskCreate, type RetainedTaskCreate } from './homeTaskModel';

export interface TaskDraftSnapshot { draft: RetainedTaskCreate; revision: string }
interface SealedDraft { version: 1; revision: string; iv: ArrayBuffer; ciphertext: ArrayBuffer }
/** Encrypted original create input, with atomic compare-and-write across tabs. */
export class PendingHomeTaskStore {
  private readonly key: string;
  private readonly additionalData: Uint8Array<ArrayBuffer>;

  constructor(readonly origin: string, readonly actorId: string, readonly homeId: string) {
    this.key = JSON.stringify([origin, actorId, homeId]);
    this.additionalData = new TextEncoder().encode(`pantopus-task-create-v1:${this.key}`);
  }

  async load(): Promise<TaskDraftSnapshot | null> {
    const db = await openTaskRecoveryDatabase();
    const sealed = await readTaskRecoveryValue<SealedDraft>(db, 'drafts', this.key);
    if (!sealed) return null;
    try {
      if (sealed.version !== 1 || typeof sealed.revision !== 'string'
        || !(sealed.iv instanceof ArrayBuffer) || sealed.iv.byteLength !== 12
        || !(sealed.ciphertext instanceof ArrayBuffer)) throw new Error('Invalid envelope');
      const key = await readTaskRecoveryValue<CryptoKey>(db, 'keys', 'task-create-v1');
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
    const db = await openTaskRecoveryDatabase();
    const key = await taskRecoveryEncryptionKey(db, 'task-create-v1');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: this.additionalData }, key,
      new TextEncoder().encode(JSON.stringify(draft)));
    const revision = crypto.randomUUID();
    const sealed: SealedDraft = { version: 1, revision, iv: iv.buffer, ciphertext };
    await this.replace(db, expected, sealed, isCurrent);
    return { draft: structuredClone(draft), revision };
  }

  async clear(expected: TaskDraftSnapshot, isCurrent: () => boolean): Promise<void> {
    await this.replace(await openTaskRecoveryDatabase(), expected, null, isCurrent);
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
