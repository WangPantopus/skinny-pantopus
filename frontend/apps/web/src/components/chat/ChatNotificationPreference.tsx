'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Bell, BellOff } from 'lucide-react';
import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/components/ui/toast-store';
import type { ChatSearchTarget } from './ChatSearch';

export default function ChatNotificationPreference({ target }: { target: ChatSearchTarget }) {
  const client = useQueryClient();
  const key = ['chat', 'preferences', target.currentUserId, target.roomId, target.otherUserId, target.asBusinessUserId];
  const scope = JSON.stringify(key);
  const activeScope = useRef<string | null>(scope);
  activeScope.current = scope;
  useEffect(() => { activeScope.current = scope; return () => { activeScope.current = null; }; }, [scope]);
  const query = useQuery({ queryKey: key, queryFn: () => api.chat.getChatPreferences(target, target.asBusinessUserId),
    enabled: Boolean(target.currentUserId), staleTime: 30_000, retry: false });
  const mutation = useMutation({ mutationFn: async (enabled: boolean) => {
    const marker = api.authSessionMarker();
    const saved = await api.chat.setChatPreferences(target, enabled, target.asBusinessUserId);
    return { saved, marker, scope, key };
  },
    onSuccess: ({ saved, marker, scope: savedScope, key: savedKey }) => {
      if (marker !== api.authSessionMarker() || activeScope.current !== savedScope) return;
      client.setQueryData(savedKey, saved); void client.invalidateQueries({ queryKey: queryKeys.conversations() });
    },
    onError: () => { if (activeScope.current === scope) toast.error('Could not save notification settings. Try again.'); } });
  const muted = query.data?.notificationsEnabled === false;
  return <button className="p-1 text-app-muted hover:text-app disabled:opacity-50" disabled={query.isPending || mutation.isPending}
    aria-label={query.isError ? 'Retry notification settings' : muted ? 'Unmute conversation' : 'Mute conversation'}
    title={query.isError ? 'Notification settings unavailable. Retry.' : muted ? 'Unmute conversation' : 'Mute conversation'}
    onClick={() => query.isError || !query.data ? void query.refetch() : mutation.mutate(!query.data.notificationsEnabled)}>
    {muted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
  </button>;
}
