import * as api from '@pantopus/api';
import type { ChatMessage } from '@pantopus/types';
import { activateChatStorage, assertChatOutboxCapacity, consumeChatDraft, deleteChatRecords, isChatStorageCurrent, listChatRecordKeys, readChatBytes,
  readChatRecord, suspendChatStorage, writeChatRecords, type ChatDraftCommit, type ChatStorageScope } from './chatStorage';

interface PendingFile { key: string; name: string; type: string; lastModified: number }
type UploadedFile = { id: string; mime_type?: string; original_filename?: string; file_url?: string };
export interface PendingChatSend {
  clientMessageId: string;
  roomId: string;
  otherUserId?: string;
  asBusinessUserId?: string;
  topicId?: string;
  text: string;
  messageType?: 'gig_offer' | 'listing_offer';
  metadata?: Record<string, unknown>;
  topicRequest?: { topicType: 'task' | 'listing'; topicRefId: string; title: string };
  replyToId?: string;
  createdAt: string;
  files: PendingFile[];
  uploadedFiles?: UploadedFile[];
  attempts: number;
  nextAttemptAt: number;
  state: 'queued' | 'sending' | 'failed' | 'refused';
  error?: string;
  lastStatus?: number;
}
type Listener = (pending: PendingChatSend[], accepted?: ChatMessage) => void;
let accountId: string | null = null;
let scope: ChatStorageScope | null = null;
let starting: Promise<void> | null = null;
let running: ChatStorageScope | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let pending: PendingChatSend[] = [];
let enqueueTime = 0;
let readVersion = 0;
let storageWrites = Promise.resolve();
const listeners = new Set<Listener>();

function publish(accepted?: ChatMessage) { listeners.forEach((listener) => listener(pending, accepted)); }
const current = (saved: ChatStorageScope | null): saved is ChatStorageScope => !!saved && saved === scope && isChatStorageCurrent(saved);
const save = (saved: ChatStorageScope, message: PendingChatSend) => writeChatRecords(saved, [{ kind: 'outbox', key: message.clientMessageId, value: message }]);

async function readPending(saved: ChatStorageScope) {
  if (!current(saved)) return;
  const version = ++readVersion;
  const ids = await listChatRecordKeys(saved, 'outbox');
  const messages = await Promise.all(ids.map((id) => readChatRecord<PendingChatSend>(saved, 'outbox', id)));
  if (!current(saved) || version !== readVersion) return;
  pending = messages.filter((message): message is PendingChatSend => !!message && typeof message.clientMessageId === 'string'
    && typeof message.roomId === 'string' && Array.isArray(message.files)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)
      || a.clientMessageId.localeCompare(b.clientMessageId));
  publish();
}

function schedule(delay = 0) {
  clearTimeout(timer);
  if (current(scope)) timer = setTimeout(() => { void drain(); }, delay);
}

export function suspendChatOutbox(): void {
  clearTimeout(timer);
  window.removeEventListener('online', wake);
  window.removeEventListener('focus', wake);
  accountId = null;
  scope = null;
  starting = null;
  pending = [];
  readVersion++;
  suspendChatStorage();
  publish();
}
function wake() { void resumeChatOutbox(); }

async function withOutboxLock<T>(saved: ChatStorageScope, work: () => Promise<T>): Promise<T> {
  return navigator.locks ? await navigator.locks.request(`pantopus-chat-outbox:${saved.account}`, work) : await work();
}

export async function resumeChatOutbox(): Promise<void> {
  const saved = scope;
  if (!current(saved)) return;
  try {
    await withOutboxLock(saved, async () => {
      await readPending(saved);
      if (!current(saved)) return;
      for (const message of pending) if (message.state === 'queued' && message.lastStatus !== 429 && message.nextAttemptAt > Date.now()) {
        await save(saved, { ...message, nextAttemptAt: 0 });
      }
      await readPending(saved);
      schedule();
    });
  } catch { if (current(saved)) schedule(5000); }
}

export function startChatOutbox(actorId: string): Promise<void> {
  if (accountId === actorId && current(scope)) return starting ?? Promise.resolve();
  if (accountId === actorId && starting) return starting;
  suspendChatOutbox();
  accountId = actorId;
  const attempt = activateChatStorage(actorId).then(async (saved) => {
    if (accountId !== actorId || !isChatStorageCurrent(saved)) return;
    scope = saved;
    await readPending(saved);
    if (!current(saved)) return;
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    void resumeChatOutbox();
  }).catch((error: unknown) => {
    if (starting === attempt) { accountId = null; scope = null; }
    throw error;
  }).finally(() => { if (starting === attempt) starting = null; });
  starting = attempt;
  return attempt;
}

export function subscribeChatOutbox(listener: Listener): () => void {
  listeners.add(listener);
  listener(pending);
  return () => { listeners.delete(listener); };
}

export async function enqueueChatSend(actorId: string, input: Omit<PendingChatSend, 'files' | 'createdAt' | 'attempts' | 'nextAttemptAt' | 'state'>, files: File[] = [], draft?: ChatDraftCommit): Promise<void> {
  await startChatOutbox(actorId);
  const saved = scope;
  if (!current(saved)) throw new Error('Sign in again before sending.');
  enqueueTime = Math.max(Date.now(), enqueueTime + 1);
  const message: PendingChatSend = { ...input, createdAt: new Date(enqueueTime).toISOString(), attempts: 0,
    nextAttemptAt: 0, state: 'queued', files: files.map((file, index) => ({ key: `${input.clientMessageId}:${index}`,
      name: file.name, type: file.type, lastModified: file.lastModified })) };
  // Serialize disk commits so rapid sends retain the same order after a crash.
  const write = storageWrites.catch(() => {}).then(async () => {
    const mutation = consumeChatDraft(draft);
    // File.size is available without allocating or encrypting the attachment.
    await assertChatOutboxCapacity(saved, [
      { kind: 'outbox', key: message.clientMessageId, bytes: new TextEncoder().encode(JSON.stringify(message)).byteLength },
      ...files.map((file, index) => ({ kind: 'media' as const, key: message.files[index].key, bytes: file.size })),
    ], mutation);
    const media = await Promise.all(files.map(async (file, index) => ({ kind: 'media' as const, key: message.files[index].key, bytes: await file.arrayBuffer() })));
    // Moving the draft and its attachment bytes into the queue is one commit:
    // a reload sees either the original composer or the retained send.
    await writeChatRecords(saved, [{ kind: 'outbox', key: message.clientMessageId, value: message }, ...media], mutation);
    if (!current(saved)) return;
    await readPending(saved);
    schedule();
  });
  storageWrites = write;
  await write;
}

async function discard(saved: ChatStorageScope, message: PendingChatSend) {
  await deleteChatRecords(saved, [{ kind: 'outbox', key: message.clientMessageId },
    ...message.files.map((file) => ({ kind: 'media' as const, key: file.key }))]);
  if (current(saved)) { readVersion++; pending = pending.filter((entry) => entry.clientMessageId !== message.clientMessageId); publish(); }
}

export async function retryChatSend(id: string): Promise<void> {
  const saved = scope;
  if (!current(saved)) return;
  await withOutboxLock(saved, async () => {
    await readPending(saved);
    const message = pending.find((entry) => entry.clientMessageId === id);
    if (!message || !current(saved) || message.state === 'refused') return;
    await save(saved, { ...message, state: 'queued', nextAttemptAt: 0, attempts: 0, error: undefined });
    await readPending(saved);
    schedule();
  });
}

export async function removeChatSend(id: string): Promise<void> {
  const saved = scope;
  if (!current(saved)) return;
  const remove = async () => {
    await readPending(saved);
    const message = pending.find((entry) => entry.clientMessageId === id);
    if (message && current(saved)) await discard(saved, message);
  };
  await withOutboxLock(saved, remove);
}

async function drain(): Promise<void> {
  if (running === scope || !current(scope) || !navigator.onLine) return;
  const saved = scope;
  running = saved;
  const work = async () => {
    try {
      await storageWrites.catch(() => {});
      await readPending(saved);
      if (!current(saved)) return;
      const heads = new Map<string, PendingChatSend>();
      for (const message of pending) if (message.state !== 'failed' && message.state !== 'refused' && !heads.has(message.roomId)) heads.set(message.roomId, message);
      const ready = [...heads.values()].find((message) => message.nextAttemptAt <= Date.now());
      if (!ready) {
        const next = Math.min(...[...heads.values()].map((message) => message.nextAttemptAt));
        if (Number.isFinite(next)) schedule(Math.max(250, next - Date.now()));
        return;
      }
      let message = { ...ready, state: 'sending' as const } as PendingChatSend;
      pending = pending.map((entry) => entry.clientMessageId === message.clientMessageId ? message : entry);
      publish();
      try {
        if (message.topicRequest && message.otherUserId && !message.topicId) {
          const result = await api.chat.findOrCreateTopic(message.otherUserId, message.topicRequest);
          if (!current(saved)) return;
          message = { ...message, topicId: result.topic.id };
          await save(saved, message);
        }
        if (message.files.length && !message.uploadedFiles) {
          const files = await Promise.all(message.files.map(async (file) => {
            const bytes = await readChatBytes(saved, 'media', file.key);
            if (!bytes) throw Object.assign(new Error('The saved attachment is unavailable. Remove this message and select the file again.'), { statusCode: 422 });
            return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
          }));
          if (!current(saved)) return;
          const result = await api.upload.uploadChatMedia(message.roomId, files, message.clientMessageId);
          message = { ...message, uploadedFiles: result.media as UploadedFile[] };
          await save(saved, message);
        }
        if (!current(saved)) return;
        const uploaded = message.uploadedFiles ?? [];
        const type = message.messageType || (uploaded.length ? (uploaded.length === 1 && uploaded[0].mime_type?.startsWith('image/') ? 'image' : 'file') : 'text');
        const result = await api.chat.sendMessage({ roomId: message.roomId, messageText: message.text || undefined,
          messageType: type, metadata: message.metadata, clientMessageId: message.clientMessageId, replyToId: message.replyToId,
          topicId: message.topicId, asBusinessUserId: message.asBusinessUserId,
          ...(uploaded.length ? { fileIds: uploaded.map((file) => file.id) } : {}) });
        if (!current(saved)) return;
        await discard(saved, message);
        if (!current(saved)) return;
        publish(result.message);
      } catch (error) {
        if (!current(saved)) return;
        const failure = error as { statusCode?: number; message?: string; data?: { retryAfter?: number } };
        const retryable = !failure.statusCode || failure.statusCode >= 500 || failure.statusCode === 408 || failure.statusCode === 429;
        const attempts = message.attempts + 1;
        const delay = Math.max(Number(failure.data?.retryAfter || 0) * 1000, Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6))) + Math.random() * 500;
        message = { ...message, attempts, state: retryable ? 'queued' : (failure.statusCode === 403 || failure.statusCode === 404 ? 'refused' : 'failed'),
          nextAttemptAt: Date.now() + delay, error: failure.message || 'Waiting for a connection.', lastStatus: failure.statusCode };
        await save(saved, message);
        if (current(saved)) { pending = pending.map((entry) => entry.clientMessageId === message.clientMessageId ? message : entry); publish(); }
      }
      schedule(50);
    } catch {
      // Storage failure must not send an unretained replacement. Existing
      // commands stay on disk and are retried after the device recovers.
      if (current(saved)) schedule(5000);
    }
  };
  try {
    // One worker across same-origin tabs; server client IDs are the fallback
    // for browsers without Web Locks or a tab that closes during a request.
    await withOutboxLock(saved, work);
  } finally { if (running === saved) running = null; if (saved !== scope && current(scope)) schedule(); }
}

export function pendingChatMessage(message: PendingChatSend, actorId: string): ChatMessage {
  return { id: message.clientMessageId, room_id: message.roomId, user_id: message.asBusinessUserId || actorId,
    sender_id: message.asBusinessUserId || actorId, message_text: message.text, message_type: message.messageType || (message.files.length ? 'file' : 'text'), metadata: message.metadata,
    created_at: message.createdAt, topic_id: message.topicId, reply_to_id: message.replyToId,
    attachments: message.uploadedFiles || message.files.map((file) => ({ original_filename: file.name, mime_type: file.type })),
    is_edited: false, is_deleted: false, _clientMessageId: message.clientMessageId,
    _optimistic: message.state === 'queued' || message.state === 'sending', _failed: message.state === 'failed' || message.state === 'refused',
    _refused: message.state === 'refused', _outbox: true, _queued: message.state === 'queued', _error: message.error } as ChatMessage;
}
