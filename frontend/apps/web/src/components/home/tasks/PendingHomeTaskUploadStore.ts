import { openTaskRecoveryDatabase, readTaskRecoveryValue, taskRecoveryEncryptionKey } from './TaskRecoveryStorage';

export interface RetainedTaskUpload {
  version: 1; origin: string; actor_id: string; home_id: string; task_id: string;
  upload_id: string; filename: string; mime_type: string; size: number; sha256: string; confirmed: boolean;
}
export interface TaskUploadSnapshot { draft: RetainedTaskUpload; revision: string }
interface Envelope { version: 1; revision: string; iv: ArrayBuffer; ciphertext: ArrayBuffer }
const KEY_ID = 'task-upload-v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIMES = new Set(['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/** Only the original identity and fingerprint are stored; file bytes require reselection. */
export class PendingHomeTaskUploadStore {
  private readonly key: string;
  private readonly additionalData: Uint8Array<ArrayBuffer>;

  constructor(readonly origin: string, readonly actorId: string, readonly homeId: string, readonly taskId: string) {
    this.key = JSON.stringify(['upload-v1', origin, actorId, homeId, taskId]);
    this.additionalData = new TextEncoder().encode(`pantopus-task-upload-v1:${this.key}`);
  }

  private valid(value: RetainedTaskUpload): boolean {
    return value?.version === 1 && value.origin === this.origin && value.actor_id === this.actorId
      && value.home_id === this.homeId && value.task_id === this.taskId && UUID.test(value.upload_id)
      && typeof value.filename === 'string' && value.filename.length > 0 && value.filename.length <= 1024
      && MIMES.has(value.mime_type) && Number.isSafeInteger(value.size) && value.size > 0 && value.size <= 25 * 1024 * 1024
      && /^[0-9a-f]{64}$/.test(value.sha256) && typeof value.confirmed === 'boolean';
  }

  async load(): Promise<TaskUploadSnapshot | null> {
    const db = await openTaskRecoveryDatabase();
    const sealed = await readTaskRecoveryValue<Envelope>(db, 'drafts', this.key);
    if (!sealed) return null;
    try {
      if (sealed.version !== 1 || typeof sealed.revision !== 'string' || !(sealed.iv instanceof ArrayBuffer)
        || sealed.iv.byteLength !== 12 || !(sealed.ciphertext instanceof ArrayBuffer)) throw new Error('Invalid envelope');
      const key = await readTaskRecoveryValue<CryptoKey>(db, 'keys', KEY_ID);
      if (!key) throw new Error('Missing key');
      const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: this.additionalData }, key, sealed.ciphertext);
      try {
        const draft = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as RetainedTaskUpload;
        if (!this.valid(draft)) throw new Error('Invalid original upload');
        return { draft, revision: sealed.revision };
      } finally { new Uint8Array(bytes).fill(0); }
    } catch {
      throw new Error('The original attachment request could not be read. It has been kept; no replacement upload was submitted.');
    }
  }

  async prepare(file: File, expected: TaskUploadSnapshot | undefined, isCurrent: () => boolean): Promise<TaskUploadSnapshot> {
    if (!MIMES.has(file.type) || file.size === 0 || file.size > 25 * 1024 * 1024) throw new Error('Choose a supported nonempty file of 25 MB or less.');
    const bytes = await file.arrayBuffer();
    let hash: string;
    try { hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join(''); }
    finally { new Uint8Array(bytes).fill(0); }
    const saved = await this.load();
    if (!isCurrent()) throw new Error('Reopen this task before continuing.');
    if (expected && saved?.revision !== expected.revision) throw new Error('Another tab changed attachment recovery. Reopen this task.');
    // Renaming a reselected file does not change its original POST metadata.
    if (saved?.draft.sha256 === hash && saved.draft.size === file.size) return saved;
    if (saved && !saved.draft.confirmed) throw new Error(`An attachment is still unconfirmed. Reselect ${saved.draft.filename}, or check its current status before choosing another file.`);
    const draft: RetainedTaskUpload = { version: 1, origin: this.origin, actor_id: this.actorId, home_id: this.homeId,
      task_id: this.taskId, upload_id: crypto.randomUUID(), filename: file.name, mime_type: file.type, size: file.size, sha256: hash, confirmed: false };
    return this.save(draft, saved, isCurrent);
  }

  async confirm(original: TaskUploadSnapshot, isCurrent: () => boolean): Promise<TaskUploadSnapshot> {
    return this.save({ ...original.draft, confirmed: true }, original, isCurrent);
  }

  async clear(original: TaskUploadSnapshot, isCurrent: () => boolean): Promise<void> {
    await this.replace(await openTaskRecoveryDatabase(), original, null, isCurrent);
  }

  private async save(draft: RetainedTaskUpload, expected: TaskUploadSnapshot | null, isCurrent: () => boolean): Promise<TaskUploadSnapshot> {
    if (!this.valid(draft)) throw new Error('The original attachment request is invalid.');
    const db = await openTaskRecoveryDatabase();
    const key = await taskRecoveryEncryptionKey(db, KEY_ID);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: this.additionalData }, key, new TextEncoder().encode(JSON.stringify(draft)));
    const revision = crypto.randomUUID();
    await this.replace(db, expected, { version: 1, revision, iv: iv.buffer, ciphertext }, isCurrent);
    return { draft: structuredClone(draft), revision };
  }

  private replace(db: IDBDatabase, expected: TaskUploadSnapshot | null, next: Envelope | null, isCurrent: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      const read = store.get(this.key);
      let failure = 'The original attachment request could not be saved. No replacement upload was submitted.';
      read.onsuccess = () => {
        let current = false;
        try { current = isCurrent(); } catch { /* Missing lifetime proof cannot authorize a write. */ }
        if (!current) { failure = 'Reopen this task before continuing.'; tx.abort(); return; }
        if (expected ? read.result?.revision !== expected.revision : read.result !== undefined) {
          failure = 'Another tab changed attachment recovery. Reopen this task.'; tx.abort(); return;
        }
        if (next) store.put(next, this.key); else store.delete(this.key);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error(failure));
    });
  }
}
