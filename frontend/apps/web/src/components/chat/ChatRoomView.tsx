'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { ChatRoomWithDetails, ChatMessage } from '@pantopus/types';
import { getInitials } from '@pantopus/ui-utils';
import { useChatMessages, getDateKey, formatDateLabel, extractAttachments } from '../../hooks/useChatMessages';
import { useSocketEvent } from '../../hooks/useSocket';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import GigPickerModal from './GigPickerModal';
import ListingPickerModal from './ListingPickerModal';
import ImageLightbox from './ImageLightbox';
import MessageReactionBar from './MessageReactionBar';
import UserIdentityLink from '@/components/user/UserIdentityLink';

export default function ChatRoomView({
  roomId,
  asBusinessUserId,
  returnTo = '/app/chat',
}: {
  roomId: string;
  asBusinessUserId?: string;
  returnTo?: string;
}) {
  const router = useRouter();

  // ── Room-specific state ───────────────────────────────
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<ChatRoomWithDetails | null>(null);
  const [representedUserIds, setRepresentedUserIds] = useState<string[]>([]);
  const [preBidStatus, setPreBidStatus] = useState<Record<string, any> | null>(null);
  const [historicalMessages, setHistoricalMessages] = useState<ChatMessage[]>([]);
  const [historicalRoomId, setHistoricalRoomId] = useState<string | null>(null);

  // ── Attachment modals ───────────────────────────────────
  const [showGigPicker, setShowGigPicker] = useState(false);
  const [showListingPicker, setShowListingPicker] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title?: string } | null>(null);

  // ── Shared chat hook ──────────────────────────────────
  const chat = useChatMessages({ roomId, asBusinessUserId, currentUserId });

  // ── Load current user ─────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const userData = await api.users.getMyProfile() as { id?: string };
        setCurrentUserId(userData?.id || null);
      } catch {}
    })();
  }, []);

  // ── Load room info ────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const resp = await (api.chat as Record<string, any> & { getChatRoom?: (id: string, opts?: Record<string, any>) => Promise<{ room?: ChatRoomWithDetails }> }).getChatRoom?.(roomId, {
          ...(asBusinessUserId ? { asBusinessUserId } : {}),
        });
        setRoomInfo(resp?.room || null);
      } catch {}
    })();
  }, [roomId, asBusinessUserId]);

  // ── Business identity resolution ──────────────────────
  const isRepresented = useCallback(
    (id: string | null | undefined) => {
      const sid = String(id || '');
      return sid ? representedUserIds.includes(sid) : false;
    },
    [representedUserIds],
  );

  useEffect(() => {
    if (!currentUserId) { setRepresentedUserIds([]); return; }
    const represented = new Set<string>([String(currentUserId)]);
    const participants = Array.isArray(roomInfo?.participants) ? roomInfo.participants : [];
    const participantIds: string[] = Array.from(
      new Set(participants.map((p: Record<string, any>) => String((p?.user_id as string) || ((p?.user as Record<string, any>)?.id as string) || '')).filter(Boolean)),
    );
    Promise.all(
      participantIds.map(async (candidateId) => {
        if (!candidateId || candidateId === String(currentUserId)) return;
        try {
          const access = await ((api.businessIam as Record<string, any>).getMyBusinessAccess as ((id: string) => Promise<{ hasAccess?: boolean; isOwner?: boolean; permissions?: string[] }>) | undefined)?.(candidateId);
          if (access?.hasAccess && (access?.isOwner || (Array.isArray(access?.permissions) && (access.permissions.includes('gigs.manage') || access.permissions.includes('gigs.post'))))) {
            represented.add(candidateId);
          }
        } catch {}
      }),
    ).then(() => setRepresentedUserIds(Array.from(represented)));
  }, [roomInfo, currentUserId]);

  // ── Pre-bid status ────────────────────────────────────
  const loadPreBidStatus = useCallback(async () => {
    try {
      const status = await api.chat.getPreBidStatus(roomId);
      setPreBidStatus(status);
    } catch {
      setPreBidStatus(null);
    }
  }, [roomId]);

  useEffect(() => { loadPreBidStatus(); }, [loadPreBidStatus]);

  // ── Historical messages from other rooms ──────────────
  useEffect(() => {
    if (!roomInfo || !currentUserId) { setHistoricalMessages([]); setHistoricalRoomId(null); return; }
    const participants = roomInfo?.participants || [];
    const nonCurrent = participants.filter((p: Record<string, any>) => !isRepresented((p.user_id as string) || ((p.user as Record<string, any>)?.id as string)));
    const ownerParticipant = participants.find((p: Record<string, any>) => p.role === 'owner');
    const iRepresentOwner = Boolean(ownerParticipant && isRepresented((ownerParticipant.user_id as string) || ((ownerParticipant.user as Record<string, any>)?.id as string)));
    const other = (iRepresentOwner
      ? (nonCurrent.find((p: Record<string, any>) => p.role !== 'owner') || nonCurrent[0])
      : (ownerParticipant || nonCurrent[0])) as Record<string, any> | undefined;
    const otherUser = other?.user as Record<string, any> | undefined;
    const otherUserId = otherUser?.id as string | undefined;
    if (!otherUserId) { setHistoricalMessages([]); setHistoricalRoomId(null); return; }

    (async () => {
      try {
        try { await ((api.chat as Record<string, any>).markConversationAsRead as ((id: string, opts?: Record<string, any>) => Promise<void>) | undefined)?.(String(otherUserId), { ...(asBusinessUserId ? { asBusinessUserId } : {}) }); } catch {}
        const convResp = await ((api.chat as Record<string, any>).getConversationMessages as ((id: string, opts?: Record<string, any>) => Promise<{ messages?: ChatMessage[]; roomIds?: string[] }>) | undefined)?.(String(otherUserId), {
          limit: 1000,
          ...(asBusinessUserId ? { asBusinessUserId } : {}),
        });
        const allConvMessages = (convResp?.messages || []).filter(Boolean);
        setHistoricalMessages(allConvMessages.filter((m: ChatMessage) => String(m?.room_id || '') !== String(roomId)));
        const roomIds = Array.isArray(convResp?.roomIds) ? convResp.roomIds : [];
        const firstOtherRoomId = roomIds.find((rid: string) => String(rid) !== String(roomId)) || null;
        setHistoricalRoomId(firstOtherRoomId ? String(firstOtherRoomId) : null);
      } catch { setHistoricalMessages([]); setHistoricalRoomId(null); }
    })();
  }, [roomInfo, currentUserId, roomId, representedUserIds, asBusinessUserId, isRepresented]);

  // ── Ownership check ───────────────────────────────────
  const isOwnMessage = useCallback(
    (msg: ChatMessage) => isRepresented(msg.user_id || msg.sender_id || (msg.sender as Record<string, any>)?.id as string),
    [isRepresented],
  );

  // ── Send with pre-bid check ───────────────────────────
  const handleSend = useCallback(
    async (text: string, files?: File[]) => {
      if (preBidStatus?.is_pre_bid && (preBidStatus.messages_remaining || 0) <= 0) {
        chat.setError('Message limit reached. Place a bid to continue chatting.');
        return;
      }
      try {
        await chat.sendMessage(text, files);
        if (preBidStatus?.is_pre_bid) await loadPreBidStatus();
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        const errMsg = err?.code === 'PRE_BID_LIMIT'
          ? 'Message limit reached. Place a bid to continue chatting.'
          : (err?.message || 'Failed to send');
        chat.setError(errMsg);
      }
    },
    [chat, preBidStatus, loadPreBidStatus],
  );

  // ── Attachment action handlers ───────────────────────────
  const handleAttachAction = useCallback((action: 'gig' | 'listing') => {
    if (action === 'gig') setShowGigPicker(true);
    else if (action === 'listing') setShowListingPicker(true);
  }, []);

  const gigSendMutation = useMutation({
    mutationFn: async (gig: { id: string; title: string; category: string | null; price: number | null; status: string }) => {
      return api.chat.sendMessage({
        roomId,
        messageText: gig.title,
        messageType: 'gig_offer',
        metadata: { gigId: gig.id, title: gig.title, category: gig.category, price: gig.price, status: gig.status },
        ...(asBusinessUserId ? { asBusinessUserId } : {}),
      });
    },
    onSuccess: async () => {
      if (!chat.connected) await chat.refresh();
    },
    onError: () => {},
  });

  const handleGigSelected = useCallback((gig: { id: string; title: string; category: string | null; price: number | null; status: string }) => {
    setShowGigPicker(false);
    gigSendMutation.mutate(gig);
  }, [gigSendMutation]);

  const listingSendMutation = useMutation({
    mutationFn: async (listing: { id: string; title: string; category: string | null; price: number | null; condition: string | null; status: string; imageUrl: string | null; isFree: boolean }) => {
      return api.chat.sendMessage({
        roomId,
        messageText: listing.title,
        messageType: 'listing_offer',
        metadata: { listingId: listing.id, title: listing.title, category: listing.category, price: listing.price, condition: listing.condition, status: listing.status, imageUrl: listing.imageUrl, isFree: listing.isFree },
        ...(asBusinessUserId ? { asBusinessUserId } : {}),
      });
    },
    onSuccess: async () => {
      if (!chat.connected) await chat.refresh();
    },
    onError: () => {},
  });

  const handleListingSelected = useCallback((listing: { id: string; title: string; category: string | null; price: number | null; condition: string | null; status: string; imageUrl: string | null; isFree: boolean }) => {
    setShowListingPicker(false);
    listingSendMutation.mutate(listing);
  }, [listingSendMutation]);

  const handleImageClick = useCallback((url: string, title?: string) => {
    setLightboxImage({ url, title });
  }, []);

  // ── Reaction handler ────────────────────────────────
  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    await chat.reactToMessage(messageId, emoji);
  }, [chat.reactToMessage]);

  useSocketEvent('message:reaction_updated', useCallback((data: { messageId?: string; reactions?: Array<{ reaction: string; count: number; users: Array<{ id: string; name: string }>; reacted_by_me?: boolean }> }) => {
    if (!data?.messageId) return;
    const adjustedReactions = (data.reactions || []).map((reaction) => ({
      ...reaction,
      reacted_by_me: currentUserId ? reaction.users.some((user) => user.id === currentUserId) : false,
    }));
    setHistoricalMessages((prev) => prev.map((message) => (
      String(message?.id || '') === String(data.messageId)
        ? { ...message, reactions: adjustedReactions }
        : message
    )));
  }, [currentUserId]));

  // ── Derive chat title ─────────────────────────────────
  const participants = roomInfo?.participants || [];
  const nonCurrentParticipants = participants.filter((p: Record<string, any>) => !isRepresented((p.user_id as string) || ((p.user as Record<string, any>)?.id as string)));
  const ownerParticipant = participants.find((p: Record<string, any>) => p.role === 'owner');
  const iRepresentOwner = Boolean(ownerParticipant && isRepresented((ownerParticipant.user_id as string) || ((ownerParticipant.user as Record<string, any>)?.id as string)));
  const otherParticipant =
    roomInfo?.type === 'gig'
      ? (iRepresentOwner
          ? (nonCurrentParticipants.find((p: Record<string, any>) => p.role !== 'owner') || nonCurrentParticipants[0])
          : ownerParticipant || nonCurrentParticipants[0])
      : (nonCurrentParticipants.find((p: Record<string, any>) => p.role !== 'owner') || nonCurrentParticipants[0]);
  const otherUser = (otherParticipant as Record<string, any>)?.user as Record<string, any> | undefined;
  const chatTitle = (otherUser?.name as string)
    || [(otherUser?.first_name as string), (otherUser?.last_name as string)].filter(Boolean).join(' ')
    || (otherUser?.username as string)
    || roomInfo?.name
    || 'Conversation';
  const otherProfileHref = otherUser?.username ? `/${String(otherUser.username)}` : null;

  // ── Historical messages header ────────────────────────
  const historicalHeader = historicalMessages.length > 0 ? (
    <div className="mb-5">
      <div className="flex items-center justify-center my-4">
        <div className="bg-violet-100 text-violet-700 text-xs font-medium px-3 py-1 rounded-full">
          Earlier messages with this person
        </div>
      </div>
      {(() => {
        const groups: { dateKey: string; label: string; msgs: ChatMessage[] }[] = [];
        let lastKey = '';
        historicalMessages.forEach((m: ChatMessage) => {
          const dKey = getDateKey(m?.created_at);
          if (dKey !== lastKey) {
            groups.push({ dateKey: dKey, label: formatDateLabel(m?.created_at), msgs: [] });
            lastKey = dKey;
          }
          groups[groups.length - 1]?.msgs.push(m);
        });
        return groups.map((group) => (
          <div key={`hist-group-${group.dateKey || 'unknown'}`}>
            <div className="flex items-center justify-center my-3">
              <div className="bg-violet-100 text-violet-700 text-[11px] font-medium px-3 py-1 rounded-full">
                {group.label || 'Unknown date'}
              </div>
            </div>
            {group.msgs.map((m: ChatMessage) => {
              const sender = m.sender as Record<string, any> | undefined;
              const isMine = isRepresented(m.user_id || m.sender_id || (sender?.id as string));
              const who = (sender?.name as string) || (sender?.username as string) || 'Someone';
              const ts = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const msgText = m.message_text || m.message || '';
              const attachments = extractAttachments(m);
              return (
                <div key={`hist-${m.id}`} className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] ${isMine ? 'order-1' : ''}`}>
                    {!isMine && (
                      <div className="mb-0.5 ml-1">
                        <UserIdentityLink
                          userId={sender?.id as string}
                          username={sender?.username as string}
                          displayName={who}
                          avatarUrl={sender?.profile_picture_url as string}
                          textClassName="text-xs text-app-muted"
                        />
                      </div>
                    )}
                    <div className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                      isMine ? 'bg-violet-500 text-white rounded-br-md' : 'bg-violet-50 text-app border border-violet-200 rounded-bl-md'
                    }`}>
                      {msgText}
                      {attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {attachments.map((a: { file_url?: string; original_filename?: string }, i: number) => (
                            <a key={`${m.id}-hist-att-${i}`} href={a.file_url || '#'} target="_blank" rel="noopener noreferrer"
                              className={`block text-xs underline ${isMine ? 'text-violet-100' : 'text-violet-700'}`}>
                              {a.original_filename || `Attachment ${i + 1}`}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={`text-[10px] text-app-muted mt-0.5 ${isMine ? 'text-right mr-1' : 'ml-1'}`}>{ts}</div>
                    {Array.isArray((m as ChatMessage & { reactions?: unknown[] }).reactions) && ((m as ChatMessage & { reactions?: unknown[] }).reactions?.length || 0) > 0 && (
                      <MessageReactionBar
                        reactions={((m as ChatMessage & { reactions?: any[] }).reactions || []) as any}
                        onReact={(emoji) => { void handleReact(String(m.id), emoji); }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ));
      })()}
      {historicalRoomId && (
        <div className="text-center mt-2">
          <button onClick={() => router.push(`/app/chat/${historicalRoomId}`)} className="text-xs text-violet-600 hover:text-violet-800">
            Open original conversation
          </button>
        </div>
      )}
      <div className="flex items-center justify-center my-4">
        <div className="bg-app-surface-raised text-app-text-secondary text-xs font-medium px-3 py-1 rounded-full">
          Task conversation starts below
        </div>
      </div>
    </div>
  ) : null;

  const inputDisabled = preBidStatus?.is_pre_bid && (preBidStatus.messages_remaining || 0) <= 0;

  return (
    <div className="bg-app-surface-sunken flex flex-col h-full min-h-0 overflow-hidden">
      {/* Chat toolbar */}
      <div className="bg-surface border-b border-app flex-shrink-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-3">
            <button onClick={() => router.push(returnTo)} className="text-app-text-secondary hover:text-app p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {getInitials(chatTitle)}
              </div>
              <div className="min-w-0">
                {otherProfileHref ? (
                  <Link href={otherProfileHref} className="block font-semibold text-app truncate">
                    {chatTitle}
                  </Link>
                ) : (
                  <div className="font-semibold text-app truncate">{chatTitle}</div>
                )}
                {roomInfo?.type === 'gig' && chatTitle !== 'Conversation' && (
                  <div className="text-xs text-app-muted">Task Chat</div>
                )}
              </div>
            </div>
            <button onClick={() => chat.refresh()} className="text-sm font-semibold text-primary-700 hover:text-primary-800 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

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
          headerContent={historicalHeader}
          onImageClick={handleImageClick}
          onReact={handleReact}
        />
      </div>

      {/* Pre-bid chat limit banner */}
      {preBidStatus?.is_pre_bid && (
        <div className="bg-amber-50 border-t border-amber-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            {(preBidStatus.messages_remaining || 0) > 0 ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">{preBidStatus.messages_remaining}</span> pre-bid
                  {preBidStatus.messages_remaining === 1 ? ' message' : ' messages'} remaining
                </p>
                <div className="flex gap-1">
                  {Array.from({ length: preBidStatus.messages_limit }).map((_, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full ${i < (preBidStatus.messages_sent || 0) ? 'bg-amber-400' : 'bg-amber-200'}`} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-amber-800 font-medium">Message limit reached. Place a bid to continue chatting.</p>
                {preBidStatus.gig_id && (
                  <button onClick={() => router.push(`/app/gigs/${preBidStatus.gig_id}`)}
                    className="text-xs bg-primary-600 text-white px-3 py-1 rounded-full hover:bg-primary-700 font-medium">
                    Place a Bid
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        sending={chat.sending}
        disabled={inputDisabled}
        placeholder={inputDisabled ? 'Place a bid to continue chatting…' : 'Type a message…'}
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
      />

      {/* Image Lightbox */}
      <ImageLightbox
        imageUrl={lightboxImage?.url || null}
        title={lightboxImage?.title}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}
