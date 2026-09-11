import { openTaskRecoveryDatabase, readTaskRecoveryValue, taskRecoveryEncryptionKey } from '../tasks/TaskRecoveryStorage';

import { validPendingResidencyReview, type PendingResidencyReview } from './residencyReviewModel';

export interface ResidencyReviewSnapshot { draft: PendingResidencyReview; revision: string }
interface SealedDraft { version: 1; revision: string; iv: ArrayBuffer; ciphertext: ArrayBuffer }
/** Encrypted original residency decision, with atomic compare-and-write across tabs. */
export class PendingResidencyReviewStore {
  private readonly key: string;
  private readonly additionalData: Uint8Array<ArrayBuffer>;

  constructor(readonly origin: string, readonly actorId: string, readonly homeId: string) {
    this.key = JSON.stringify(['residency-review', origin, actorId, homeId]);
    this.additionalData = new TextEncoder().encode(`pantopus-residency-review-v1:${this.key}`);
  }

  async load(): Promise<ResidencyReviewSnapshot | null> {
    const db = await openTaskRecoveryDatabase();
    const sealed = await readTaskRecoveryValue<SealedDraft>(db, 'drafts', this.key);
    if (!sealed) return null;
    try {
      if (sealed.version !== 1 || typeof sealed.revision !== 'string'
        || !(sealed.iv instanceof ArrayBuffer) || sealed.iv.byteLength !== 12
        || !(sealed.ciphertext instanceof ArrayBuffer)) throw new Error('Invalid envelope');
      const key = await readTaskRecoveryValue<CryptoKey>(db, 'keys', 'residency-review-v1');
      if (!key) throw new Error('Missing key');
      const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: this.additionalData }, key, sealed.ciphertext);
      const draft = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as PendingResidencyReview;
      if (!validPendingResidencyReview(draft, this.origin, this.actorId, this.homeId)) throw new Error('Invalid saved request');
      return { draft, revision: sealed.revision };
    } catch {
      // A corrupt command is never treated as an empty slot or silently erased.
      throw new Error('The original residency decision could not be read. It has been kept; no new residency decision was submitted.');
    }
  }

  async save(draft: PendingResidencyReview, expected: ResidencyReviewSnapshot | null, isCurrent: () => boolean): Promise<ResidencyReviewSnapshot> {
    if (!validPendingResidencyReview(draft, this.origin, this.actorId, this.homeId)) throw new Error('The original residency decision is invalid.');
    const db = await openTaskRecoveryDatabase();
    const key = await taskRecoveryEncryptionKey(db, 'residency-review-v1');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: this.additionalData }, key,
      new TextEncoder().encode(JSON.stringify(draft)));
    const revision = crypto.randomUUID();
    const sealed: SealedDraft = { version: 1, revision, iv: iv.buffer, ciphertext };
    await this.replace(db, expected, sealed, isCurrent);
    return { draft: structuredClone(draft), revision };
  }

  async clear(expected: ResidencyReviewSnapshot, isCurrent: () => boolean): Promise<void> {
    await this.replace(await openTaskRecoveryDatabase(), expected, null, isCurrent);
  }

  private replace(db: IDBDatabase, expected: ResidencyReviewSnapshot | null, next: SealedDraft | null,
    isCurrent: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('drafts', 'readwrite');
      const store = transaction.objectStore('drafts');
      const request = store.get(this.key);
      let failure = 'The original residency decision could not be saved. No replacement request was submitted.';
      request.onsuccess = () => {
        let current = false;
        try { current = isCurrent(); } catch { /* A missing lifetime proof cannot authorize a write. */ }
        if (!current) {
          failure = 'This residency review is no longer current. The saved request was kept.';
          transaction.abort(); return;
        }
        const actual = request.result as SealedDraft | undefined;
        if (expected ? actual?.revision !== expected.revision : actual !== undefined) {
          failure = 'Another tab changed the saved residency decision. Reopen this form to recover that request.';
          transaction.abort(); return;
        }
        try {
          if (next) store.put(next, this.key);
          else store.delete(this.key);
        } catch {
          // Quota/security errors may be synchronous; reject through the same
          // retained-command path instead of escaping the IndexedDB callback.
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(new Error(failure));
    });
  }
}
