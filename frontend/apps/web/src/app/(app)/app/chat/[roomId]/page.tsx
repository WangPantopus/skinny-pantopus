'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ChatRoomView from '@/components/chat/ChatRoomView';

export default function ChatRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = String(params.roomId || '');
  const asBusinessUserId = searchParams.get('asBusinessUserId') || undefined;
  const returnTo = searchParams.get('returnTo') || '/app/chat';

  useEffect(() => {
    if (!roomId) router.replace('/app/chat');
  }, [roomId, router]);

  if (!roomId) return <div className="p-6 text-app-text-secondary">Redirecting...</div>;

  return (
    <ChatRoomView
      roomId={roomId}
      asBusinessUserId={asBusinessUserId}
      returnTo={returnTo}
    />
  );
}
