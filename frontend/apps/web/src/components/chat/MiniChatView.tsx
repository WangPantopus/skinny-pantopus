'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { useChatMessages } from '../../hooks/useChatMessages';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import GigPickerModal from './GigPickerModal';
import ListingPickerModal from './ListingPickerModal';
import type { ChatMessage } from './ChatMessageBubble';

interface MiniChatViewProps {
  roomId?: string;
  otherUserId?: string;
  name: string;
  avatar?: string;
  onBack: () => void;
  onExpand: () => void;
  onClose: () => void;
}

export default function MiniChatView({ roomId, otherUserId, name, avatar, onBack, onExpand, onClose }: MiniChatViewProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showGigPicker, setShowGigPicker] = useState(false);
  const [showListingPicker, setShowListingPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const userData = await api.users.getMyProfile() as { id?: string };
        setCurrentUserId(userData?.id || null);
      } catch {}
    })();
  }, []);

  const chat = useChatMessages({
    roomId,
    otherUserId,
    currentUserId,
  });

  const targetRoomId = roomId || chat.resolvedRoomId;

  const isOwnMessage = useCallback(
    (msg: ChatMessage) => {
      const senderId = msg.user_id || msg.sender_id || msg.sender?.id;
      return senderId === currentUserId;
    },
    [currentUserId],
  );

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    await chat.reactToMessage(messageId, emoji);
  }, [chat.reactToMessage]);

  const handleSend = useCallback(async (text: string, files?: File[]) => {
    try {
      await chat.sendMessage(text);
    } catch (e: unknown) {
      chat.setError(e instanceof Error ? e.message : 'Failed to send');
    }
  }, [chat]);

  const handleAttachAction = useCallback((action: 'gig' | 'listing') => {
    if (action === 'gig') setShowGigPicker(true);
    else if (action === 'listing') setShowListingPicker(true);
  }, []);

  const gigSendMutation = useMutation({
    mutationFn: async (gig: { id: string; title: string; category: string | null; price: number | null; status: string }) => {
      return api.chat.sendMessage({
        roomId: targetRoomId as string,
        messageText: gig.title,
        messageType: 'gig_offer',
        metadata: { gigId: gig.id, title: gig.title, category: gig.category, price: gig.price, status: gig.status },
      });
    },
    onSuccess: async () => {
      if (!chat.connected) await chat.refresh();
    },
    onError: () => {},
  });

  const handleGigSelected = useCallback((gig: { id: string; title: string; category: string | null; price: number | null; status: string }) => {
    setShowGigPicker(false);
    if (!targetRoomId) return;
    gigSendMutation.mutate(gig);
  }, [targetRoomId, gigSendMutation]);

  const listingSendMutation = useMutation({
    mutationFn: async (listing: { id: string; title: string; category: string | null; price: number | null; condition: string | null; status: string; imageUrl: string | null; isFree: boolean }) => {
      return api.chat.sendMessage({
        roomId: targetRoomId as string,
        messageText: listing.title,
        messageType: 'listing_offer',
        metadata: { listingId: listing.id, title: listing.title, category: listing.category, price: listing.price, condition: listing.condition, status: listing.status, imageUrl: listing.imageUrl, isFree: listing.isFree },
      });
    },
    onSuccess: async () => {
      if (!chat.connected) await chat.refresh();
    },
    onError: () => {},
  });

  const handleListingSelected = useCallback((listing: { id: string; title: string; category: string | null; price: number | null; condition: string | null; status: string; imageUrl: string | null; isFree: boolean }) => {
    setShowListingPicker(false);
    if (!targetRoomId) return;
    listingSendMutation.mutate(listing);
  }, [targetRoomId, listingSendMutation]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-app">
        <button
          type="button"
          onClick={onBack}
          className="w-7 h-7 rounded-full hover:bg-surface-muted flex items-center justify-center text-app-muted transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {avatar ? (
          <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
        <span className="font-medium text-sm text-app truncate flex-1">
          {name || 'Chat'}
        </span>
        <button
          type="button"
          onClick={onExpand}
          className="w-7 h-7 rounded-full hover:bg-surface-muted flex items-center justify-center text-app-muted transition-colors flex-shrink-0"
          title="Open full view"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full hover:bg-surface-muted flex items-center justify-center text-app-muted transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages — override max-w-3xl from ChatMessageList/ChatMessageBubble */}
      <div className="flex-1 overflow-hidden flex flex-col [&_.max-w-3xl]:max-w-none">
        <ChatMessageList
          messages={chat.messages}
          loading={chat.loading}
          error={chat.error}
          hasMore={chat.hasMore}
          loadingOlder={chat.loadingOlder}
          onLoadOlder={chat.loadOlder}
          isOwnMessage={isOwnMessage}
          onReact={handleReact}
        />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        sending={chat.sending}
        placeholder="Type a message…"
        onAttachAction={handleAttachAction}
        compact
      />

      {/* Share a Task / Share a Listing modals */}
      <GigPickerModal
        open={showGigPicker}
        onClose={() => setShowGigPicker(false)}
        onSelectGig={handleGigSelected}
      />
      <ListingPickerModal
        open={showListingPicker}
        onClose={() => setShowListingPicker(false)}
        onSelectListing={handleListingSelected}
        otherUserId={otherUserId ?? undefined}
      />
    </div>
  );
}
