import { activateChatStorage, assertChatOutboxCapacity, consumeChatDraft, isChatStorageCurrent,
  readChatBytes, readChatRecord, writeChatRecords, type ChatDraftCommit, type ChatStorageScope } from './chatStorage';

export interface ChatDraftContext {
  reply: { messageId: string; roomId?: string; senderName: string; text: string } | null;
  edit: { messageId: string; text: string } | null;
}
export interface ChatComposerDraft extends ChatDraftContext { text: string; editText: string; files: File[] }
export interface ChatDraftConfig {
  actorId: string | null | undefined;
  key: string;
  ready: boolean;
  restoreContext: (context: ChatDraftContext) => Promise<void>;
}
interface StoredFile { key: string; name: string; type: string; lastModified: number }
interface StoredDraft extends Omit<ChatComposerDraft, 'files'> { revision: string; files: StoredFile[] }
export interface ChatDraftSnapshot { scope: ChatStorageScope; key: string; saved: StoredDraft | null }
const fileKeys = new WeakMap<File, string>();
const fileKey = (file: File) => {
  let key = fileKeys.get(file);
  if (!key) { key = `draft:${crypto.randomUUID()}`; fileKeys.set(file, key); }
  return key;
};
export const chatDraftSignature = (draft: ChatComposerDraft) => JSON.stringify({ text: draft.text, editText: draft.editText,
  reply: draft.reply, edit: draft.edit, files: draft.files.map(fileKey) });
// Navigation must wait for the previous component's last retained change before
// adopting the same draft. Revisions guard other tabs independently.
const writes = new Map<string, Promise<unknown>>();
const scopeKey = (account: string, key: string) => JSON.stringify([account, key]);

export async function loadChatDraft(actorId: string, key: string): Promise<{ snapshot: ChatDraftSnapshot; draft: ChatComposerDraft | null }> {
  const scope = await activateChatStorage(actorId);
  await writes.get(scopeKey(scope.account, key))?.catch(() => {});
  const saved = await readChatRecord<StoredDraft>(scope, 'draft', key);
  if (!saved) return { snapshot: { scope, key, saved: null }, draft: null };
  if (typeof saved.revision !== 'string' || typeof saved.text !== 'string' || typeof saved.editText !== 'string' || !Array.isArray(saved.files)) {
    throw new Error('The saved draft could not be opened. It was kept on this device.');
  }
  const files = await Promise.all(saved.files.map(async (file) => {
    const bytes = await readChatBytes(scope, 'media', file.key);
    if (!bytes) throw new Error('A draft attachment could not be recovered. Keep this page open and select the file again.');
    const restored = new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
    fileKeys.set(restored, file.key);
    return restored;
  }));
  return { snapshot: { scope, key, saved }, draft: { ...saved, files } };
}

export function chatDraftCommit(snapshot: ChatDraftSnapshot | null): ChatDraftCommit | undefined {
  return snapshot?.saved ? { key: snapshot.key, revision: snapshot.saved.revision, mediaKeys: snapshot.saved.files.map((file) => file.key) } : undefined;
}

export function saveChatDraft(snapshot: ChatDraftSnapshot, draft: ChatComposerDraft): Promise<ChatDraftSnapshot> {
  const { scope, key, saved } = snapshot;
  const identity = scopeKey(scope.account, key);
  const write = (writes.get(identity) ?? Promise.resolve()).catch(() => {}).then(async () => {
    if (!isChatStorageCurrent(scope)) throw new Error('This chat session ended.');
    const previous = chatDraftCommit(snapshot);
    const empty = !draft.text && !draft.files.length && !draft.reply && !draft.edit;
    if (empty) {
      if (previous) await writeChatRecords(scope, [], consumeChatDraft(previous));
      return { ...snapshot, saved: null };
    }
    const files = draft.files.map((file) => ({ key: fileKey(file), name: file.name, type: file.type, lastModified: file.lastModified }));
    const value: StoredDraft = { ...draft, files, revision: crypto.randomUUID() };
    const kept = new Set(files.map((file) => file.key));
    const prior = new Set(saved?.files.map((file) => file.key) ?? []);
    const additions = draft.files.flatMap((file, index) => prior.has(files[index].key) ? [] : [{ key: files[index].key, file }]);
    const mutation = { expectedDraft: { key, revision: saved?.revision ?? null },
      remove: (saved?.files ?? []).filter((file) => !kept.has(file.key)).map((file) => ({ kind: 'media' as const, key: file.key })) };
    await assertChatOutboxCapacity(scope, [{ kind: 'draft', key, bytes: new TextEncoder().encode(JSON.stringify(value)).byteLength },
      ...additions.map(({ key, file }) => ({ kind: 'media' as const, key, bytes: file.size }))], mutation);
    const media = await Promise.all(additions.map(async ({ key, file }) => ({ kind: 'media' as const, key, bytes: await file.arrayBuffer() })));
    await writeChatRecords(scope, [{ kind: 'draft', key, revision: value.revision, value }, ...media], mutation);
    return { ...snapshot, saved: value };
  });
  writes.set(identity, write);
  void write.finally(() => { if (writes.get(identity) === write) writes.delete(identity); }).catch(() => {});
  return write;
}
