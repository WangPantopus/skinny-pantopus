'use client';

import { useEffect, useState } from 'react';
import { authSessionMarker, getApiBaseUrl, getAuthToken, onTokenChange } from '@pantopus/api';
import { activateChatStorage, deleteChatRecords, isChatStorageCurrent, onChatHistoryRetired,
  readChatHistoryGeneration, readChatReceivedMedia, retireChatHistoryRooms, writeChatRecords } from '@/components/chat/chatStorage';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const passiveMedia = /^(image\/(jpeg|png|gif|webp|avif|heic|heif)|video\/(mp4|webm|quicktime)|application\/pdf)$/;
// Files this tab saw answer 404/410: a download that raced the answer may not save them again.
const goneMedia = new Set<string>();
let downloads = 0;
const waiting: Array<() => void> = [];

async function download(url: string, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  if (downloads >= 4) await new Promise<void>((resolve, reject) => {
    const ready = () => { signal.removeEventListener('abort', cancel); resolve(); };
    const cancel = () => {
      const index = waiting.indexOf(ready);
      if (index >= 0) waiting.splice(index, 1);
      reject(signal.reason);
    };
    signal.addEventListener('abort', cancel, { once: true });
    waiting.push(ready);
  });
  else downloads++;
  try {
    signal.throwIfAborted();
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal });
    if (!response.ok) throw Object.assign(new Error('Attachment unavailable'), { status: response.status });
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
    if (!passiveMedia.test(type) || Number(response.headers.get('content-length') || 0) > MAX_FILE_BYTES) {
      void response.body?.cancel();
      throw Object.assign(new Error('This attachment cannot be saved for offline use.'), { status: 422 });
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Attachment unavailable');
    const parts: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > MAX_FILE_BYTES) throw Object.assign(new Error('This attachment cannot be saved for offline use.'), { status: 422 });
        parts.push(new Uint8Array(part.value));
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    return new Blob(parts, { type });
  } finally {
    const next = waiting.shift();
    if (next) next();
    else downloads--;
  }
}

/** Private originals and thumbnails use the same account/room retirement fence
 * as history. A server denial never falls back to a previously saved file. */
export function useChatMedia(url: string | null | undefined, accountId?: string | null, roomId?: string, messageId?: string) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ key: string; url: string | null; error: boolean; loading: boolean } | null>(null);
  const key = JSON.stringify([accountId, roomId, messageId, url]);
  const renderMarker = authSessionMarker();
  let source: string | null = null;
  if (url && typeof window !== 'undefined') {
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.origin === window.location.origin && /^\/api\/chat\/files\/[0-9a-f-]+$/i.test(parsed.pathname)) {
        source = `${parsed.pathname}${parsed.searchParams.get('variant') === 'thumbnail' ? '?variant=thumbnail' : ''}`;
      }
    } catch { /* Existing non-private/pending URLs retain their current behavior. */ }
  }

  useEffect(() => {
    if (!source || !accountId || !roomId || !messageId) return;
    let disposed = false;
    let objectUrl: string | undefined;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);
    const marker = authSessionMarker();
    const mediaKey = `${roomId}:${source}`;
    const retireView = () => {
      disposed = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setResult({ key, url: null, error: true, loading: false });
    };
    const stopAccount = onTokenChange(retireView);
    const stopHistory = onChatHistoryRetired((event) => {
      if (event.account !== JSON.stringify([getApiBaseUrl(), accountId])) return;
      if (event.cleared || event.rooms.includes(roomId) && (!event.messageIds || event.messageIds.includes(messageId))) retireView();
      else if (!disposed) setVersion(value => value + 1);
    });
    const online = () => { if (!disposed) setVersion(value => value + 1); };
    window.addEventListener('online', online);
    setResult({ key, url: null, error: false, loading: true });
    void (async () => {
      const scope = await activateChatStorage(accountId).catch(() => null);
      const generation = scope ? await readChatHistoryGeneration(scope).catch(() => null) : null;
      const current = async () => {
        if (disposed || getAuthToken() === null || authSessionMarker() !== marker || scope && !isChatStorageCurrent(scope)) return false;
        if (scope && generation !== null && await readChatHistoryGeneration(scope) !== generation) {
          setVersion(value => value + 1);
          return false;
        }
        return true;
      };
      let blob: Blob | null = null;
      if (navigator.onLine) {
        try {
          try { blob = await download(source, controller.signal); }
          catch (error) {
            // Older servers may have no thumbnail variant; the original still
            // requires its own successful authorization before it is shown.
            if ((error as { status?: number }).status !== 404 || !source.endsWith('?variant=thumbnail')) throw error;
            blob = await download(source.split('?')[0], controller.signal);
          }
          if (!await current()) return;
          // Quota/storage failure must not hide a freshly authorized image.
          if (scope && generation !== null && !goneMedia.has(`${scope.account}|${roomId}:${source.split('?')[0]}`)) {
            await writeChatRecords(scope, [{ kind: 'received-media', key: mediaKey, bytes: await blob.arrayBuffer(),
              roomId, messageId, historyGeneration: generation, mimeType: blob.type }]).catch(() => {});
          }
        } catch (error) {
          const status = (error as { status?: number }).status;
          if (disposed || controller.signal.aborted && !timedOut) return;
          if (status === 401 || status === 403) {
            // Access to the room's files ended: retire every saved file of the
            // room behind the history fence, without hiding readable text.
            retireView();
            await retireChatHistoryRooms(accountId, [roomId], true).catch(() => {});
            return;
          }
          if (status === 404 || status === 410) {
            // This file is gone (410: deleted with its message, #2809). Remove
            // only its saved copies. Advancing the room's history fence here
            // would cancel the history read that carries the message's deletion,
            // so the deleted message stayed on screen after every reload.
            retireView();
            const original = `${roomId}:${source.split('?')[0]}`;
            if (scope) {
              goneMedia.add(`${scope.account}|${original}`);
              await deleteChatRecords(scope, [{ kind: 'received-media', key: original },
                { kind: 'received-media', key: `${original}?variant=thumbnail` }]).catch(() => {});
            }
            return;
          }
          if (status && status < 500 && status !== 408 && status !== 429) throw error;
        }
      }
      if (!blob && scope) {
        try { blob = await readChatReceivedMedia(scope, mediaKey); }
        catch { await deleteChatRecords(scope, [{ kind: 'received-media', key: mediaKey }]).catch(() => {}); }
      }
      if (!await current()) return;
      if (!blob || !passiveMedia.test(blob.type) || blob.size > MAX_FILE_BYTES) throw new Error('Attachment unavailable offline');
      objectUrl = URL.createObjectURL(blob);
      setResult({ key, url: objectUrl, error: false, loading: false });
    })().catch(() => { if (!disposed) setResult({ key, url: null, error: true, loading: false }); }).finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timeout);
      stopAccount(); stopHistory(); window.removeEventListener('online', online);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, accountId, roomId, messageId, key, version]);

  const retry = () => setVersion(value => value + 1);
  const rejectMedia = () => {
    if (renderMarker !== authSessionMarker()) return;
    setResult({ key, url: null, error: true, loading: false });
    if (source && accountId && roomId) void activateChatStorage(accountId).then((scope) => {
      if (renderMarker === authSessionMarker()) return deleteChatRecords(scope, [{ kind: 'received-media', key: `${roomId}:${source}` }]);
    }).catch(() => {});
  };
  if (!source) return { url: url || null, error: false, loading: false, retry, rejectMedia };
  if (!accountId || !roomId || !messageId) return { url: null, error: true, loading: false, retry, rejectMedia };
  return { ...(result?.key === key ? result : { url: null, error: false, loading: true }), retry, rejectMedia };
}
