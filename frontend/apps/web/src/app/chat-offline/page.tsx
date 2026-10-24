'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import ChatRoomView from '@/components/chat/ChatRoomView';
import ConversationView from '@/components/chat/ConversationView';
import ChatListPage from '@/app/(app)/app/chat/page';
import { safeRedirectPath } from '@/lib/auth-utils';
import { getAuthToken, onTokenChange } from '@pantopus/api';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
type SavedRoute = { inbox?: boolean; roomId?: string; otherUserId?: string; topicId?: string; messageId?: string; asBusinessUserId?: string; returnTo: string };

/** A fixed, anonymous document: the worker never stores the requested chat URL
 * or authenticated HTML. The existing views open their encrypted local history
 * only after validating the browser's account/session binding. */
export default function OfflineChatShell() {
  return <Suspense><OfflineChatContent /></Suspense>;
}

function OfflineChatContent() {
  const [route, setRoute] = useState<SavedRoute | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const search = useSearchParams().toString();
  useEffect(() => {
    const update = () => {
      setSignedIn(getAuthToken() !== null);
      const url = new URL(window.location.href);
      const person = url.pathname.match(new RegExp(`^/app/chat/conversation/(${uuid})/?$`, 'i'));
      const room = url.pathname.match(new RegExp(`^/app/chat/(${uuid})/?$`, 'i'));
      const identifier = (name: string) => {
        const value = url.searchParams.get(name);
        return value && new RegExp(`^${uuid}$`, 'i').test(value) ? value : undefined;
      };
      // Same rule as the online chat pages: Back only goes to our own pages.
      const returnTo = safeRedirectPath(url.searchParams.get('returnTo'), '/app/chat');
      setRoute(/^\/app\/chat\/?$/.test(url.pathname) ? { inbox: true, returnTo: '/app/chat' } : person || room ? {
        otherUserId: person?.[1], roomId: room?.[1], topicId: identifier('topic'), messageId: identifier('message'),
        asBusinessUserId: identifier('asBusinessUserId'), returnTo,
      } : null);
    };
    update();
    const stop = onTokenChange(update);
    window.addEventListener('popstate', update);
    return () => { stop(); window.removeEventListener('popstate', update); };
  }, [search]);

  return <AppShell>{!signedIn || !route ? <div className="p-6 text-app-text-secondary" role="status">
    {signedIn ? 'Reconnect to open Messages.' : 'Reconnect and sign in to open your saved messages.'}
  </div> : route.inbox ? <ChatListPage /> : <ThreadFrame>{route.otherUserId ? <ConversationView otherUserId={route.otherUserId} initialTopicId={route.topicId}
    initialMessageId={route.messageId} returnTo={route.returnTo} key={`${route.otherUserId}:${route.topicId || 'all'}:${route.messageId || 'latest'}`} />
    : <ChatRoomView roomId={route.roomId!} asBusinessUserId={route.asBusinessUserId}
      initialMessageId={route.messageId} returnTo={route.returnTo} key={`${route.roomId}:${route.messageId || 'latest'}`} />}</ThreadFrame>}</AppShell>;
}

/** The same frame as the chat routes' layouts: the message list scrolls inside
 * the viewport, opens at the newest message and keeps the composer on screen. */
function ThreadFrame({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col overflow-hidden flex-1 min-h-0" style={{ height: 'calc(100vh - 3.5rem)' }}>{children}</div>;
}
