'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBusinessChatRooms, type BusinessChatRoom as BusinessInboxRoom } from '@/hooks/useBusinessChatRooms';
import { chosenUsername } from '@pantopus/utils';

export default function BusinessInboxPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = String(params.id || '');
  const { loading, error, failure, rooms, total, totalUnread, hasMore, loadingMore, refresh: load, loadMore } = useBusinessChatRooms(businessId);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => {
      const name = String(r.other_participant_name || r.other_participant_username || r.room_name || '').toLowerCase();
      const preview = String(r.last_message_preview || r.last_message?.message_text || '').toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [rooms, search]);

  const getRoomDate = (room: BusinessInboxRoom) => room.last_message_at || room.last_message?.created_at || null;
  const getRoomPreview = (room: BusinessInboxRoom) => room.last_message_preview || room.last_message?.message_text || 'No messages yet';
  const getRoomName = (room: BusinessInboxRoom) => room.other_participant_name || chosenUsername(room.other_participant_username) || room.room_name || 'Chat';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-app-text">Business Inbox</h1>
          <p className="text-sm text-app-text-secondary mt-1">{total} conversations · {totalUnread} unread</p>
        </div>
        <button onClick={() => void load()} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
          Refresh
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={hasMore ? "Search loaded conversations..." : "Search inbox..."}
        className="w-full rounded-lg border border-app-border px-3 py-2 text-sm mb-4"
      />

      {loading && <div className="text-app-text-secondary">Loading...</div>}
      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      {!loading && !failure && (
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-app-text-secondary text-sm">No {hasMore ? 'loaded ' : ''}conversations found.</div>
          ) : (
            <div className="divide-y divide-app-border-subtle">
              {filtered.map((room) => (
                <button
                  key={room.id}
                  onClick={() => router.push(`/app/business/${businessId}/inbox/${room.id}`)}
                  className={`w-full text-left px-4 py-3 hover:bg-app-hover ${Number(room.unread_count || 0) > 0 ? 'bg-violet-50/40' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-sm truncate ${Number(room.unread_count || 0) > 0 ? 'font-semibold text-app-text' : 'text-app-text'}`}>
                      {getRoomName(room)}
                    </div>
                    <div className="text-xs text-app-text-muted">{getRoomDate(room) ? new Date(getRoomDate(room)!).toLocaleDateString() : ''}</div>
                  </div>
                  <div className="text-sm text-app-text-secondary truncate mt-0.5">{getRoomPreview(room)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!loading && !failure && hasMore && <div className="pt-4 text-center">
        <button onClick={() => void loadMore()} disabled={loadingMore} className="text-sm text-violet-600 hover:underline disabled:opacity-50">
          {loadingMore ? 'Loading…' : 'Load more conversations'}
        </button>
      </div>}
    </div>
  );
}
