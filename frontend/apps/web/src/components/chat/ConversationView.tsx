'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getInitials } from '@pantopus/ui-utils';
import type { ConversationTopic } from '@pantopus/types';
import { useChatMessages } from '../../hooks/useChatMessages';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import GigPickerModal from './GigPickerModal';
import ListingPickerModal from './ListingPickerModal';
import ImageLightbox from './ImageLightbox';
import ListingShareAddressButton from './ListingShareAddressButton';

// ============================================================
// UNIFIED CONVERSATION VIEW (Person-Based)
// Thin wrapper: topic system, drawer, header
// ============================================================

export default function ConversationView({
  otherUserId,
  initialTopicId,
  returnTo = '/app/chat',
}: {
  otherUserId: string;
  initialTopicId?: string;
  returnTo?: string;
}) {
  const router = useRouter();

  // ── Conversation-specific state ───────────────────────
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(initialTopicId || null);
  const [showDrawer, setShowDrawer] = useState(false);

  // ── Attachment modals ───────────────────────────────────
  const [showGigPicker, setShowGigPicker] = useState(false);
  const [showListingPicker, setShowListingPicker] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title?: string } | null>(null);

  // ── Listing topic owner tracking (for Share Address) ───
  const [listingOwnerMap, setListingOwnerMap] = useState<Record<string, string>>({});

  // ── Shared chat hook ──────────────────────────────────
  const chat = useChatMessages({ otherUserId, topicId: selectedTopicId, currentUserId });

  // ── Load current user ─────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const userData = await api.users.getMyProfile() as { id?: string };
        setCurrentUserId(userData?.id || null);
      } catch {}
    })();
  }, []);

  const otherUser = chat.directChatPeer;

  // ── Fetch topics ──────────────────────────────────────
  const fetchTopics = useCallback(async () => {
    if (!otherUserId) return;
    try {
      const result = await api.chat.getConversationTopics(otherUserId) as { topics?: ConversationTopic[] };
      setTopics(result?.topics || []);
    } catch {}
  }, [otherUserId]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  // ── Fetch listing owner for Share Address button ──────
  const activeListingTopic = useMemo(
    () => topics.find(t => t.id === selectedTopicId && t.topic_type === 'listing'),
    [topics, selectedTopicId],
  );
  const activeListingId = activeListingTopic?.topic_ref_id || null;

  useEffect(() => {
    if (!activeListingId || listingOwnerMap[activeListingId]) return;
    (async () => {
      try {
        const detail = await api.listings.getListing(activeListingId) as { listing?: { user_id?: string } };
        const ownerId = detail?.listing?.user_id;
        if (ownerId) setListingOwnerMap(prev => ({ ...prev, [activeListingId]: ownerId }));
      } catch {}
    })();
  }, [activeListingId, listingOwnerMap]);

  // ── Ownership check ───────────────────────────────────
  const isOwnMessage = useCallback(
    (msg: Record<string, any>) => {
      const senderId = (msg.user_id as string) || (msg.sender_id as string) || ((msg.sender as Record<string, any>)?.id as string);
      return senderId === currentUserId;
    },
    [currentUserId],
  );

  // ── Send and refresh topics ───────────────────────────
  const handleSend = useCallback(
    async (text: string, files?: File[]) => {
      await chat.sendMessage(text, files);
      fetchTopics();
    },
    [chat, fetchTopics],
  );

  // ── Attachment action handlers ───────────────────────────
  const handleAttachAction = useCallback((action: 'gig' | 'listing') => {
    if (action === 'gig') setShowGigPicker(true);
    else if (action === 'listing') setShowListingPicker(true);
  }, []);

  const gigSendMutation = useMutation({
    mutationFn: async (gig: { id: string; title: string; category: string | null; price: number | null; status: string }) => {
      // Create/find a topic for this gig
      const topicResult = await api.chat.findOrCreateTopic(otherUserId, {
        topicType: 'task',
        topicRefId: gig.id,
        title: gig.title,
      });
      const topicId = topicResult?.topic?.id;

      return api.chat.sendMessage({
        roomId: chat.resolvedRoomId as string,
        messageText: gig.title,
        messageType: 'gig_offer',
        metadata: { gigId: gig.id, title: gig.title, category: gig.category, price: gig.price, status: gig.status },
        ...(topicId ? { topicId } : {}),
      });
    },
    onSuccess: async () => {
      if (!chat.connected) await chat.refresh();
      fetchTopics();
    },
    onError: () => {},
  });

  const handleGigSelected = useCallback((gig: { id: string; title: string; category: string | null; price: number | null; status: string }) => {
    setShowGigPicker(false);
    if (!chat.resolvedRoomId) return;
    gigSendMutation.mutate(gig);
  }, [chat.resolvedRoomId, gigSendMutation]);

  const listingSendMutation = useMutation({
    mutationFn: async (listing: { id: string; title: string; category: string | null; price: number | null; condition: string | null; status: string; imageUrl: string | null; isFree: boolean }) => {
      // Create/find a topic for this listing
      const topicResult = await api.chat.findOrCreateTopic(otherUserId, {
        topicType: 'listing',
        topicRefId: listing.id,
        title: listing.title,
      });
      const topicId = topicResult?.topic?.id;

      return api.chat.sendMessage({
        roomId: chat.resolvedRoomId as string,
        messageText: listing.title,
        messageType: 'listing_offer',
        metadata: { listingId: listing.id, title: listing.title, category: listing.category, price: listing.price, condition: listing.condition, status: listing.status, imageUrl: listing.imageUrl, isFree: listing.isFree },
        ...(topicId ? { topicId } : {}),
      });
    },
    onSuccess: async () => {
      if (!chat.connected) await chat.refresh();
      fetchTopics();
    },
    onError: () => {},
  });

  const handleListingSelected = useCallback((listing: { id: string; title: string; category: string | null; price: number | null; condition: string | null; status: string; imageUrl: string | null; isFree: boolean }) => {
    setShowListingPicker(false);
    if (!chat.resolvedRoomId) return;
    listingSendMutation.mutate(listing);
  }, [chat.resolvedRoomId, listingSendMutation]);

  const handleImageClick = useCallback((url: string, title?: string) => {
    setLightboxImage({ url, title });
  }, []);

  // ── Reaction handler ────────────────────────────────
  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    await chat.reactToMessage(messageId, emoji);
  }, [chat.reactToMessage]);

  // ── Topic divider renderer ────────────────────────────
  const topicMap = useMemo(() => {
    const map = new Map<string, ConversationTopic>();
    topics.forEach(t => map.set(t.id, t));
    return map;
  }, [topics]);

  const renderTopicDivider = useCallback(
    (msg: Record<string, any>, prevMsg: Record<string, any> | null) => {
      if (selectedTopicId) return null; // no dividers when filtering
      const currTopicId = (msg.topic_id as string) || null;
      const prevTopicId = (prevMsg?.topic_id as string) || null;
      if (!currTopicId || currTopicId === prevTopicId) return null;
      const title = topicMap.get(currTopicId)?.title;
      if (!title) return null;
      return (
        <div key={`topic-${currTopicId}-${msg.id}`} className="flex items-center gap-3 my-4 px-4">
          <div className="flex-1 h-px bg-app-border" />
          <div className="text-xs text-app-text-secondary font-medium">
            Started chatting about &ldquo;{title}&rdquo;
          </div>
          <div className="flex-1 h-px bg-app-border" />
        </div>
      );
    },
    [selectedTopicId, topicMap],
  );

  // ── Derived values ────────────────────────────────────
  const chatTitle = otherUser?.name
    || [otherUser?.firstName, ((otherUser as Record<string, any>)?.last_name as string) ?? ((otherUser as Record<string, any>)?.lastName as string)].filter(Boolean).join(' ')
    || otherUser?.username
    || 'Conversation';
  const avatarUrl = otherUser?.profile_picture_url;
  const otherProfileHref = otherUser?.username ? `/${otherUser.username}` : null;

  const topicStatusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-surface-muted text-app-text-secondary',
    archived: 'bg-surface-muted text-app-text-secondary',
  };

  return (
    <div className="bg-app-surface-sunken flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="bg-surface border-b border-app flex-shrink-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-3">
            <button onClick={() => router.push(returnTo)} className="text-app-text-secondary hover:text-app p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={chatTitle} className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-surface-muted" width={40} height={40} sizes="40px" quality={75} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {getInitials(chatTitle)}
                </div>
              )}
              <div className="min-w-0">
                {otherProfileHref ? (
                  <Link href={otherProfileHref} className="block font-semibold text-app truncate">
                    {chatTitle}
                  </Link>
                ) : (
                  <div className="font-semibold text-app truncate">{chatTitle}</div>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className="text-app-muted hover:text-app-text-strong p-1"
              title="Conversation details"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Topic selector */}
      {topics.length > 0 && (
        <div className="bg-surface border-b border-app flex-shrink-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setSelectedTopicId(null)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  !selectedTopicId
                    ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                    : 'bg-surface-muted text-app-text-secondary hover-bg-app'
                }`}
              >
                All
              </button>
              {topics.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopicId(selectedTopicId === topic.id ? null : topic.id)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                    selectedTopicId === topic.id
                      ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                      : 'bg-surface-muted text-app-text-secondary hover-bg-app'
                  }`}
                >
                  <span>{topic.topic_type === 'task' ? '🛠' : '🛒'}</span>
                  <span className="max-w-[140px] truncate">{topic.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages — flex-1 min-h-0 so this area gets a bounded height and can scroll */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatMessageList
          messages={chat.messages}
          loading={chat.loading}
          error={chat.error}
          hasMore={chat.hasMore}
          loadingOlder={chat.loadingOlder}
          onLoadOlder={chat.loadOlder}
          isOwnMessage={isOwnMessage}
          renderTopicDivider={renderTopicDivider}
          onImageClick={handleImageClick}
          onReact={handleReact}
        />
      </div>

      {/* Share Address prompt for listing topics */}
      {activeListingId && (
        <div className="bg-surface border-t border-app-border-subtle">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <ListingShareAddressButton
              listingId={activeListingId}
              otherUserId={otherUserId}
              currentUserId={currentUserId}
              listingOwnerId={listingOwnerMap[activeListingId]}
            />
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        sending={chat.sending}
        placeholder="Message"
        onAttachAction={handleAttachAction}
      />

      {/* Gig Picker Modal */}
      <GigPickerModal
        open={showGigPicker}
        onClose={() => setShowGigPicker(false)}
        onSelectGig={handleGigSelected}
      />

      {/* Listing Picker Modal */}
      <ListingPickerModal
        open={showListingPicker}
        onClose={() => setShowListingPicker(false)}
        onSelectListing={handleListingSelected}
        otherUserId={otherUserId}
      />

      {/* Image Lightbox */}
      <ImageLightbox
        imageUrl={lightboxImage?.url || null}
        title={lightboxImage?.title}
        onClose={() => setLightboxImage(null)}
      />

      {/* Conversation Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowDrawer(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-sm bg-surface h-full shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-app">Chat details</h2>
                <button onClick={() => setShowDrawer(false)} className="text-app-muted hover:text-app-text-strong">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* User info */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-app">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={chatTitle} className="w-12 h-12 rounded-full object-cover bg-surface-muted" width={48} height={48} sizes="48px" quality={75} />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                    {getInitials(chatTitle)}
                  </div>
                )}
                <div>
                  {otherProfileHref ? (
                    <Link href={otherProfileHref} className="font-semibold text-app">
                      {chatTitle}
                    </Link>
                  ) : (
                    <div className="font-semibold text-app">{chatTitle}</div>
                  )}
                  {otherUser?.username && <div className="text-sm text-app-text-secondary">@{otherUser.username}</div>}
                </div>
              </div>

              {/* Topics section */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-3">Topics</h3>
                {topics.length === 0 ? (
                  <p className="text-sm text-app-muted">Topics appear when you chat about a task or listing.</p>
                ) : (
                  <div className="space-y-1">
                    {topics.map(topic => (
                      <button
                        key={topic.id}
                        onClick={() => { setSelectedTopicId(topic.id); setShowDrawer(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover-bg-app transition-colors text-left"
                      >
                        <span className="text-lg">{topic.topic_type === 'task' ? '🛠' : '🛒'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-app truncate">{topic.title}</div>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${topicStatusColors[topic.status] || 'bg-surface-muted text-app-text-secondary'}`}>
                            {topic.status}
                          </span>
                        </div>
                        <svg className="w-4 h-4 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Safety section */}
              <div>
                <h3 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-3">Safety</h3>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover-bg-app transition-colors text-left text-sm text-app-text-strong">
                  <span>🚩</span> Report
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-left text-sm text-red-600">
                  <span>🚫</span> Block {chatTitle}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
