'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useBadges } from '@/contexts/BadgeContext';
import MiniConversationList from './MiniConversationList';
import MiniChatView from './MiniChatView';

type WidgetView = 'closed' | 'list' | 'chat';

interface ActiveChat {
  roomId?: string;
  otherUserId?: string;
  name: string;
  avatar?: string;
}

export default function FloatingChatWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadMessages } = useBadges();

  const [view, setView] = useState<WidgetView>('closed');
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);

  // Don't render on chat pages
  if (pathname?.startsWith('/app/chat')) return null;

  const handleSelectConversation = (chat: ActiveChat) => {
    setActiveChat(chat);
    setView('chat');
  };

  const handleBack = () => {
    setActiveChat(null);
    setView('list');
  };

  const handleExpand = () => {
    if (activeChat?.otherUserId) {
      router.push(`/app/chat/conversation/${activeChat.otherUserId}`);
    } else if (activeChat?.roomId) {
      router.push(`/app/chat/${activeChat.roomId}`);
    } else {
      router.push('/app/chat');
    }
    setView('closed');
    setActiveChat(null);
  };

  const handleClose = () => {
    setView('closed');
    setActiveChat(null);
  };

  // Closed: show chat bubble
  if (view === 'closed') {
    return (
      <button
        type="button"
        onClick={() => setView('list')}
        className="fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 hover:shadow-xl transition-all duration-200 flex items-center justify-center"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {unreadMessages > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadMessages > 9 ? '9+' : unreadMessages}
          </span>
        )}
      </button>
    );
  }

  // Panel (list or chat view)
  return (
    <div
      className="fixed bottom-24 right-6 z-40 w-[360px] h-[500px] bg-surface rounded-2xl shadow-2xl border border-app flex flex-col overflow-hidden transition-all duration-200 ease-in-out"
      onWheel={(e) => e.stopPropagation()}
    >
      {view === 'list' ? (
        <>
          {/* List header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-app">
            <h3 className="font-semibold text-app text-sm">Messages</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { router.push('/app/chat'); handleClose(); }}
                className="w-7 h-7 rounded-full hover:bg-surface-muted flex items-center justify-center text-app-muted transition-colors"
                title="Open full chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 rounded-full hover:bg-surface-muted flex items-center justify-center text-app-muted transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <MiniConversationList onSelectConversation={handleSelectConversation} />
        </>
      ) : (
        <MiniChatView
          roomId={activeChat?.roomId}
          otherUserId={activeChat?.otherUserId}
          name={activeChat?.name || 'Chat'}
          avatar={activeChat?.avatar}
          onBack={handleBack}
          onExpand={handleExpand}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
