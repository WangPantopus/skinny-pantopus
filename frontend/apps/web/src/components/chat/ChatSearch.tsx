'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, X } from 'lucide-react';
import * as api from '@pantopus/api';
import SearchInput from '@/components/SearchInput';

export type ChatSearchTarget = { roomId?: string; otherUserId?: string; asBusinessUserId?: string; currentUserId?: string | null };

/** The same authorized search powers the inbox and an individual conversation. */
export function ChatSearchResults({ query, target = {}, onSelect }: {
  query: string; target?: ChatSearchTarget; onSelect?: () => void;
}) {
  const router = useRouter();
  const [result, setResult] = useState<api.chat.ChatSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scope = JSON.stringify([query.trim(), target.roomId, target.otherUserId, target.asBusinessUserId, target.currentUserId]);
  useEffect(() => {
    const current = ++generation.current;
    setResult(null); setError(null); inFlight.current = false;
    if (!query.trim() || !target.currentUserId) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      void api.chat.searchChatMessages(query.trim(), target).then((next) => {
        if (generation.current === current) setResult(next);
      }).catch((error) => {
        if (generation.current === current) setError(error instanceof Error ? error.message : 'Could not search messages.');
      }).finally(() => { if (generation.current === current) setLoading(false); });
    }, 300);
    return () => { clearTimeout(timer); generation.current += 1; };
  }, [scope, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadMore = async () => {
    if (inFlight.current || !result?.hasMore || !result.nextCursor) return;
    const current = generation.current;
    inFlight.current = true; setLoading(true); setError(null);
    try {
      const page = await api.chat.searchChatMessages(query.trim(), { ...target, before: result.nextCursor });
      if (current !== generation.current) return;
      setResult((old) => ({ ...page,
        messages: [...new Map([...(old?.messages || []), ...page.messages].map((message) => [message.id, message])).values()],
        roomContexts: { ...old?.roomContexts, ...page.roomContexts } }));
    } catch (error) {
      if (current === generation.current) setError(error instanceof Error ? error.message : 'Could not load more matches.');
    } finally { if (current === generation.current) { inFlight.current = false; setLoading(false); } }
  };
  const rows = result?.messages || [];
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rows[index].id, estimateSize: () => 88, overscan: 3 });
  if (!query.trim()) return null;
  return <div className="rounded-xl border border-app bg-surface p-3">
    <div className="text-xs font-semibold text-app-text-secondary mb-2">Messages{rows.length ? ` · ${rows.length}${result?.hasMore ? '+' : ''} matches` : ''}</div>
    {error && <div role="alert" className="text-sm text-red-600 mb-2">{error} <button className="underline" onClick={() => result ? void loadMore() : setAttempt((n) => n + 1)}>Try again</button></div>}
    {!result && loading && <p className="text-sm text-app-muted">Searching messages…</p>}
    {result && !rows.length && !loading && <p className="text-sm text-app-muted">No messages match.</p>}
    {!!rows.length && <div ref={scrollRef} className="max-h-72 overflow-y-auto" style={{ height: Math.min(288, rows.length * 88) }} aria-label="Message search results">
      <div style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const message = rows[row.index];
          const context = result?.roomContexts[message.room_id];
          return <button key={row.key} className="w-full text-left px-2 py-2 rounded-lg hover-bg-app" style={{ position: 'absolute', top: 0, left: 0, height: 88, transform: `translateY(${row.start}px)` }}
            onClick={() => {
              const kind = target.roomId ? 'room' : target.otherUserId ? 'conversation' : context?.kind;
              const id = target.roomId || target.otherUserId || context?.conversationId;
              if (!id || !kind) return;
              const params = new URLSearchParams({ message: message.id });
              if (target.asBusinessUserId) params.set('asBusinessUserId', target.asBusinessUserId);
              router.push(`/app/chat/${kind === 'conversation' ? 'conversation/' : ''}${id}?${params}`);
              onSelect?.();
            }}>
            <div className="text-xs text-app-muted truncate">{context?.name || 'Conversation'} · {new Date(message.created_at).toLocaleDateString()}</div>
            <div className="text-sm text-app-text-strong line-clamp-2">{message.message_text || message.message || message.content}</div>
          </button>;
        })}
      </div>
    </div>}
    {result?.hasMore && <button className="mt-2 text-sm text-primary-700 underline" onClick={() => void loadMore()} disabled={loading}>{loading ? 'Loading matches…' : 'Load more matches'}</button>}
  </div>;
}

export default function ChatSearch({ target }: { target: ChatSearchTarget }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => { setOpen(false); setQuery(''); }, [target.roomId, target.otherUserId, target.currentUserId]);
  return <div className="relative">
    <button aria-label="Search messages" className="p-1 text-app-muted hover:text-app" onClick={() => setOpen(!open)}><Search className="w-5 h-5" /></button>
    {open && <div className="absolute right-0 top-9 z-30 w-[min(90vw,420px)] rounded-xl border border-app bg-surface shadow-lg p-3" onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
      <div className="flex items-center gap-2 mb-2"><SearchInput value={query} onChange={setQuery} placeholder="Search messages…" className="flex-1" /><button aria-label="Close message search" className="p-1" onClick={() => setOpen(false)}><X className="w-4 h-4" /></button></div>
      <ChatSearchResults query={query} target={target} onSelect={() => setOpen(false)} />
    </div>}
  </div>;
}
