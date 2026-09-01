'use client';

import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, X, MessageCircle, Users, Loader2 } from 'lucide-react';
import Image from 'next/image';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';

function NewChatContent() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  // Load current user ID to filter from results
  useEffect(() => {
    api.users.getMyProfile().then((res: any) => {
      setCurrentUserId(res?.user?.id || res?.id || null);
    }).catch(() => {});
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await api.users.searchUsers(q.trim(), { limit: 20 });
      const users = (res as any)?.users || [];
      setResults(currentUserId ? users.filter((u: any) => u.id !== currentUserId) : users);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [currentUserId]);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(text), 300);
  };

  const handleSelectUser = async (selectedUser: any) => {
    if (creating) return;
    setCreating(selectedUser.id);
    try {
      const res = await api.chat.createDirectChat(selectedUser.id);
      const roomId = (res as any)?.room?.id || (res as any)?.roomId;
      if (roomId) {
        router.push(`/app/mailbox?roomId=${roomId}`);
      } else {
        router.push('/app/mailbox');
      }
    } catch {
      setCreating(null);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">New Message</h1>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-app-surface-sunken rounded-xl px-3.5 py-2.5 mb-4">
        <Search className="w-4 h-4 text-app-text-muted flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search people..."
          autoFocus
          className="flex-1 text-sm text-app-text bg-transparent outline-none placeholder:text-app-text-muted"
        />
        {query.length > 0 && (
          <button onClick={() => { setQuery(''); setResults([]); }}>
            <X className="w-4 h-4 text-app-text-muted hover:text-app-text" />
          </button>
        )}
      </div>

      {/* Results */}
      {searching ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" />
        </div>
      ) : results.length > 0 ? (
        <div className="divide-y divide-app-border-subtle">
          {results.map((user: any) => {
            const name = user.name || user.username || 'User';
            const avatarUrl = user.profile_picture_url || user.profilePicture || user.avatar_url;
            const isCreating = creating === user.id;
            return (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                disabled={!!creating}
                className="w-full flex items-center gap-3 px-2 py-3 hover:bg-app-hover transition text-left disabled:opacity-50"
              >
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={name} width={48} height={48} sizes="48px" quality={75} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-emerald-700">{getInitials(name)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-app-text truncate">{name}</p>
                  {user.username && <p className="text-xs text-app-text-secondary">@{user.username}</p>}
                </div>
                {isCreating ? (
                  <Loader2 className="w-5 h-5 text-emerald-600 animate-spin flex-shrink-0" />
                ) : (
                  <MessageCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      ) : query.trim().length >= 2 ? (
        <div className="text-center py-16">
          <Search className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">No users found</p>
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">Search for someone to message</p>
          <p className="text-xs text-app-text-muted mt-1">Type a name or username to find people</p>
        </div>
      )}
    </div>
  );
}

export default function NewChatPage() { return <Suspense><NewChatContent /></Suspense>; }
