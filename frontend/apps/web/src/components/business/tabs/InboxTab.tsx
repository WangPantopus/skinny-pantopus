'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, AtSign, ChevronRight } from 'lucide-react';
import * as api from '@pantopus/api';
import { formatTimeAgo } from '@pantopus/ui-utils';

type Section = 'messages' | 'mentions';

interface Props {
  businessId: string;
}

export default function InboxTab({ businessId }: Props) {
  const router = useRouter();
  const [section, setSection] = useState<Section>('messages');
  const [rooms, setRooms] = useState<any[]>([]);
  const [matchedPosts, setMatchedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const result = await api.chat.getBusinessChatRooms(businessId);
      setRooms(result.rooms || []);
      setTotalUnread(result.totalUnread || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const loadMentions = async () => {
    setLoading(true);
    try {
      const result = await api.businesses.getMatchedPosts(businessId, { page_size: 30 });
      setMatchedPosts(result.posts || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (section === 'messages') loadRooms();
    else loadMentions();
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-app-text">
          Inbox{totalUnread > 0 ? ` (${totalUnread})` : ''}
        </h2>
        <button onClick={() => section === 'messages' ? loadRooms() : loadMentions()}
          className="text-xs text-violet-600 font-medium hover:underline">Refresh</button>
      </div>

      {/* Section toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setSection('messages')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition ${
            section === 'messages'
              ? 'border-violet-500 bg-violet-50 text-violet-700'
              : 'border-app-border text-app-text-secondary hover:bg-app-hover'
          }`}>
          <MessageCircle className="w-4 h-4" /> Messages
        </button>
        <button onClick={() => setSection('mentions')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition ${
            section === 'mentions'
              ? 'border-violet-500 bg-violet-50 text-violet-700'
              : 'border-app-border text-app-text-secondary hover:bg-app-hover'
          }`}>
          <AtSign className="w-4 h-4" /> Mentions
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin h-8 w-8 border-3 border-violet-600 border-t-transparent rounded-full" /></div>
      ) : section === 'messages' ? (
        rooms.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="w-12 h-12 mx-auto text-app-text-muted mb-3" />
            <p className="text-sm text-app-text-secondary">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rooms.map((room: any) => {
              const other = room.participants?.find((p: any) => p.user_id !== businessId)?.user;
              const lastMsg = room.last_message;
              const unread = room.unread_count > 0;

              return (
                <button key={room.id} onClick={() => router.push(`/app/chat/${room.id}`)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition hover:bg-app-hover ${
                    unread ? 'bg-violet-50 border-violet-200' : 'bg-app-surface border-app-border'
                  }`}>
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    {other?.profile_picture_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={other.profile_picture_url} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <span className="text-sm font-bold text-violet-600">{(other?.name || room.name || '?')[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${unread ? 'font-bold text-app-text' : 'font-medium text-app-text'}`}>
                        {other?.name || room.name || 'Unknown'}
                      </span>
                      {lastMsg?.created_at && <span className="text-xs text-app-text-muted flex-shrink-0 ml-2">{formatTimeAgo(lastMsg.created_at)}</span>}
                    </div>
                    {lastMsg?.content && (
                      <p className={`text-xs truncate mt-0.5 ${unread ? 'text-app-text font-medium' : 'text-app-text-secondary'}`}>
                        {lastMsg.content}
                      </p>
                    )}
                  </div>
                  {unread && (
                    <span className="bg-violet-600 text-white text-[10px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center flex-shrink-0">
                      {room.unread_count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )
      ) : (
        matchedPosts.length === 0 ? (
          <div className="text-center py-16">
            <AtSign className="w-12 h-12 mx-auto text-app-text-muted mb-3" />
            <p className="text-sm text-app-text-secondary">No posts mention your business yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {matchedPosts.map((post: any) => {
              const creator = post.creator || {};
              return (
                <button key={post.id} onClick={() => router.push(`/app/feed?post=${post.id}`)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-app-surface border border-app-border text-left transition hover:bg-app-hover">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    {creator.profile_picture_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={creator.profile_picture_url} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <span className="text-sm font-bold text-violet-600">{(creator.name || '?')[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-app-text truncate">{creator.name || creator.username || 'Someone'}</span>
                      {post.created_at && <span className="text-xs text-app-text-muted flex-shrink-0 ml-2">{formatTimeAgo(post.created_at)}</span>}
                    </div>
                    <p className="text-xs text-app-text-secondary truncate mt-0.5">{post.title || post.content}</p>
                    <div className="flex gap-3 mt-1">
                      {post.like_count > 0 && <span className="text-[11px] text-app-text-muted">{post.like_count} like{post.like_count !== 1 ? 's' : ''}</span>}
                      {post.comment_count > 0 && <span className="text-[11px] text-app-text-muted">{post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-app-text-muted flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
