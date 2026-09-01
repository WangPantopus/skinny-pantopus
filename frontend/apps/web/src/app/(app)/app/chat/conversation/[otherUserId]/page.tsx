'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ConversationView from '@/components/chat/ConversationView';

export default function ConversationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const otherUserId = String(params.otherUserId || '');
  const topicId = searchParams.get('topic') || undefined;
  const returnTo = searchParams.get('returnTo') || '/app/chat';

  useEffect(() => {
    if (!otherUserId) router.replace('/app/chat');
  }, [otherUserId, router]);

  if (!otherUserId) return <div className="p-6 text-app-text-secondary">Redirecting...</div>;

  return (
    <ConversationView
      otherUserId={otherUserId}
      initialTopicId={topicId}
      returnTo={returnTo}
    />
  );
}