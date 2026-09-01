'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { ChatRoomWithDetails } from '@pantopus/types';
import { formatTimeAgo, getInitials } from '@pantopus/ui-utils';
import { MessageCircle, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SearchInput from '@/components/SearchInput';

type BusinessChatRoom = ChatRoomWithDetails & {
  other_participant_name?: string | null;
  other_participant_username?: string | null;
  last_message_preview?: string | null;
  last_message_at?: string | null;
};

export default function BusinessChatListPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = String(params.id || '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<BusinessChatRoom[]>([]);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setError(null);
      setLoading(true);
      const resp = await api.chat.getBusinessChatRooms(businessId, { limit: 100 });
      const list = Array.isArray(resp?.rooms) ? (resp.rooms as BusinessChatRoom[]) : [];
      setRooms(
        list.sort((a, b) => {
          const ta = a?.last_message_at || a?.last_message?.created_at;
          const tb = b?.last_message_at || b?.last_message?.created_at;
          const at = ta ? new Date(ta).getTime() : 0;
          const bt = tb ? new Date(tb).getTime() : 0;
          return bt - at;
        })
      );
    } catch (e: unknown) {
      console.error('Failed to load business chats', e);
      setError(e instanceof Error ? e.message : 'Failed to load business chats');
    } finally {
      setLoading(false);
    }
  };

  const getRoomName = (room: BusinessChatRoom) =>
    room.other_participant_name || room.other_participant_username || room.room_name || 'Chat';

  const getRoomPreview = (room: BusinessChatRoom) =>
    room.last_message_preview || room.last_message?.message_text || 'No messages yet';

  const getRoomTimestamp = (room: BusinessChatRoom) =>
    room.last_message_at || room.last_message?.created_at || null;

  useEffect(() => {
    if (!businessId) return;
    void load();
  }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => {
      const name = String(getRoomName(r)).toLowerCase();
      const preview = String(getRoomPreview(r)).toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [rooms, search]);

  const totalUnread = rooms.reduce((sum, r) => sum + (Number(r?.unread_count) || 0), 0);

  const openRoom = (roomId: string) => {
    router.push(`/app/businesses/${businessId}/chat/${roomId}`);
  };

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <PageHeader
          title="Business Messages"
          subtitle={totalUnread > 0 ? `${totalUnread} unread` : `${rooms.length} conversations`}
          ctaLabel="Refresh"
          ctaOnClick={load}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search business conversations..."
            className="max-w-sm"
          />
        </PageHeader>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface rounded-xl border border-app p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-surface-muted" />
                  <div className="flex-1">
                    <div className="h-4 bg-surface-muted rounded w-1/3 mb-2" />
                    <div className="h-3 bg-surface-muted rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-app shadow-sm p-10 text-center mt-4">
            <div className="mb-3 flex justify-center"><MessageCircle className="w-10 h-10 text-app-muted" /></div>
            <div className="text-app font-semibold text-lg">No business messages yet</div>
            <div className="text-sm text-app-text-secondary mt-1">Conversations started with this business will appear here.</div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-app shadow-sm p-10 text-center mt-4">
            <div className="mb-3 flex justify-center"><Search className="w-8 h-8 text-app-muted" /></div>
            <div className="text-app font-semibold text-lg">No matches</div>
            <div className="text-sm text-app-text-secondary mt-1">No conversations match &quot;{search}&quot;</div>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-app shadow-sm overflow-hidden divide-y divide-app">
            {filteredRooms.map((r) => {
              const title = getRoomName(r);
              const subtitle = r.room_type === 'gig' ? 'Gig Chat' : r.room_type === 'direct' ? 'Direct Chat' : 'Chat';
              const preview = getRoomPreview(r);
              const unread = Number(r.unread_count || 0);
              const timestamp = getRoomTimestamp(r);
              const timeStr = formatTimeAgo(timestamp || r.updated_at, 'full');
              const initials = getInitials(String(title));
              return (
                <button
                  key={r.id}
                  onClick={() => openRoom(String(r.id))}
                  className={`w-full text-left px-4 py-3 hover-bg-app transition-colors ${unread > 0 ? 'bg-violet-50/30' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className={`truncate ${unread > 0 ? 'font-bold text-app' : 'font-semibold text-app'}`}>
                          {title}
                        </div>
                        <div className={`text-xs flex-shrink-0 ${unread > 0 ? 'text-violet-700 font-semibold' : 'text-app-muted'}`}>
                          {timeStr}
                        </div>
                      </div>
                      <div className="text-xs text-app-muted mt-0.5">{subtitle}</div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className={`text-sm truncate ${unread > 0 ? 'text-app-text-strong font-medium' : 'text-app-text-secondary'}`}>
                          {preview}
                        </div>
                        {unread > 0 && (
                          <div className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {unread}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
