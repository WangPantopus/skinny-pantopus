import * as api from '@pantopus/api';
import type { ChatMessage, ChatRoomWithDetails } from '@pantopus/types';
import { activateChatStorage, assertChatOutboxCapacity, consumeChatDraft, deleteChatRecords, isChatStorageActiveFor, isChatStorageCurrent, listChatRecordKeys, readChatBytes,
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
// A person view combines rooms, but a reply may only reuse a direct room with
// the same represented identity and peer. Older room detail is not proof of
// active membership; keep the captured send until it can be verified.
export function directReplyRoomStatus(room: ChatRoomWithDetails, roomId: string, identityId: string, peerId: string): 'ready' | 'unavailable' | 'unsupported' {
  if (room.id !== roomId || (room.type || room.room_type) !== 'direct') return 'unsupported';
  const roomActive = (room as ChatRoomWithDetails & { is_active?: boolean }).is_active;
  if (roomActive === false) return 'unsupported';
  if (roomActive !== true || !Array.isArray(room.participants)) return 'unavailable';
  const members = room.participants;
  const ids = new Set(members.map((member) => member.user_id || member.user?.id));
  if (members.length !== 2 || ids.size !== 2 || !ids.has(identityId) || !ids.has(peerId)) return 'unsupported';
  if (members.some((member) => member.is_active === false || member.left_at)) return 'unsupported';
  if (members.some((member) => member.is_active !== true || !('left_at' in member))) return 'unavailable';
  return 'ready';
}

export function chatReplyRoomHref(roomId: string, asBusinessUserId?: string, messageId?: string): string {
  const params = new URLSearchParams();
  if (asBusinessUserId) params.set('asBusinessUserId', asBusinessUserId);
  if (messageId) params.set('message', messageId);
  const query = params.toString();
  return `/app/chat/${encodeURIComponent(roomId)}${query ? `?${query}` : ''}`;
}

export const REPLY_AUDIENCE_REFUSAL = 'This reply belongs to a different conversation. Open the original conversation to review its participants and reply there.';

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
// Sends shown from the moment Send is pressed while their durable commit is
// still in progress. A failed commit removes the bubble and the composer keeps
// the text; the saved outbox stays the only source for sending and retries.
let staged: PendingChatSend[] = [];

function visible(): PendingChatSend[] {
  if (!staged.length) return pending;
  const saved = new Set(pending.map((message) => message.clientMessageId));
  return [...pending, ...staged.filter((message) => !saved.has(message.clientMessageId))];
}
function publish(accepted?: ChatMessage) { const shown = visible(); listeners.forEach((listener) => listener(shown, accepted)); }
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

/** Retire this tab's outbox state. `keepStorageFor` keeps an already active
 * storage scope of that same account, so its in-flight reads (a saved inbox or
 * conversation being restored) are not cancelled when the outbox starts. */
export function suspendChatOutbox(keepStorageFor?: string): void {
  clearTimeout(timer);
  window.removeEventListener('online', wake);
  window.removeEventListener('focus', wake);
  accountId = null;
  scope = null;
  starting = null;
  pending = [];
  staged = [];
  readVersion++;
  if (!keepStorageFor || !isChatStorageActiveFor(keepStorageFor)) suspendChatStorage();
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
  // The first start after a page load used to suspend the storage scope too,
  // cancelling a saved inbox or conversation being restored for this same
  // account, so cached rows did not appear until the network answered.
  suspendChatOutbox(actorId);
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
  listener(visible());
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
  // Show the bubble at once; sending still starts only from the saved outbox.
  staged = [...staged, message];
  publish();
  // Serialize disk commits so rapid sends retain the same order after a crash.
  const write = storageWrites.catch(() => {}).then(async () => {
    const mutation = consumeChatDraft(draft);
    // File.size is available without allocating or encrypting the attachment.
    // A text-only send has nothing large to read first: the write below
    // enforces the same limits in its own transaction, one storage read sooner.
    if (files.length) await assertChatOutboxCapacity(saved, [
      { kind: 'outbox', key: message.clientMessageId, bytes: new TextEncoder().encode(JSON.stringify(message)).byteLength },
      ...files.map((file, index) => ({ kind: 'media' as const, key: message.files[index].key, bytes: file.size })),
    ], mutation);
    const media = await Promise.all(files.map(async (file, index) => ({ kind: 'media' as const, key: message.files[index].key, bytes: await file.arrayBuffer() })));
    // Moving the draft and its attachment bytes into the queue is one commit:
    // a reload sees either the original composer or the retained send.
    await writeChatRecords(saved, [{ kind: 'outbox', key: message.clientMessageId, value: message }, ...media], mutation);
    if (!current(saved)) return;
    // The read below supersedes any older in-flight read before it publishes,
    // so the committed copy replaces the staged bubble without a gap.
    staged = staged.filter((entry) => entry !== message);
    await readPending(saved);
    schedule();
  });
  storageWrites = write;
  try {
    await write;
  } finally {
    if (staged.includes(message)) {
      staged = staged.filter((entry) => entry !== message);
      if (current(saved)) publish();
    }
  }
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
    // Only an explicit person-reply retry can revisit an audience refusal.
    // The worker still checks the captured room and identities before sending.
    if (!message || !current(saved) || message.state === 'refused' && !(message.replyToId && message.otherUserId)) return;
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
  const actorId = accountId;
  if (!actorId) return;
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
        if (message.replyToId && message.otherUserId) {
          const result = await api.chat.getChatRoom(message.roomId, { asBusinessUserId: message.asBusinessUserId });
          if (!current(saved)) return;
          const audience = directReplyRoomStatus(result.room, message.roomId, message.asBusinessUserId || actorId, message.otherUserId);
          if (audience !== 'ready') throw Object.assign(new Error(audience === 'unsupported' ? REPLY_AUDIENCE_REFUSAL
            : 'The original conversation could not yet be verified. Your reply is saved and will retry.'), { statusCode: audience === 'unsupported' ? 403 : 503 });
        }
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
        const failure = error as { statusCode?: number; message?: string; data?: { code?: string; retryAfter?: number } };
        // The pre-bid allowance is a permanent send refusal, not a timed rate limit.
        const preBidLimited = failure.statusCode === 429 && failure.data?.code === 'PRE_BID_LIMIT';
        const rateLimited = failure.statusCode === 429 && !preBidLimited;
        const retryable = !failure.statusCode || failure.statusCode >= 500 || failure.statusCode === 408 || rateLimited;
        const attempts = message.attempts + 1;
        const delay = Math.max(Number(failure.data?.retryAfter || 0) * 1000, Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6))) + Math.random() * 500;
        message = { ...message, attempts, state: retryable ? 'queued' : (failure.statusCode === 403 || failure.statusCode === 404 ? 'refused' : 'failed'),
          nextAttemptAt: Date.now() + delay, error: preBidLimited ? 'Message limit reached.' : failure.message || 'Waiting for a connection.', lastStatus: failure.statusCode };
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
    _refused: message.state === 'refused', _outbox: true, _queued: message.state === 'queued', _error: message.error,
    _canRetryReply: Boolean(message.replyToId && message.otherUserId),
    _replyRoomHref: message.replyToId && message.otherUserId ? chatReplyRoomHref(message.roomId, message.asBusinessUserId) : undefined } as ChatMessage;
}
