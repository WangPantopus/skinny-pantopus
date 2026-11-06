'use client';

import { useParams } from 'next/navigation';
import ChatRoomView from '@/components/chat/ChatRoomView';

export default function BusinessChatRoomPage() {
  const params = useParams();
  const businessId = String(params.id || '');
  const roomId = String(params.roomId || '');

  if (!businessId || !roomId) return null;

  return (
    <ChatRoomView
      roomId={roomId}
      asBusinessUserId={businessId}
      returnTo={`/app/businesses/${businessId}/chat`}
    />
  );
}
