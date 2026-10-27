'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ConversationView from '@/components/chat/ConversationView';
import { safeRedirectPath } from '@/lib/auth-utils';

export default function ConversationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const otherUserId = String(params.otherUserId || '');
  const topicId = searchParams.get('topic') || undefined;
  // Back and Block go here, and anyone can put anything in a link: only our own
  // pages (a `javascript:` value would run in this page, `//host` would leave the site).
  const returnTo = safeRedirectPath(searchParams.get('returnTo'), '/app/chat');
  const messageId = searchParams.get('message') || undefined;

  useEffect(() => {
    if (!otherUserId) router.replace('/app/chat');
  }, [otherUserId, router]);

  if (!otherUserId) return <div className="p-6 text-app-text-secondary">Redirecting...</div>;

  return (
    <ConversationView
      otherUserId={otherUserId}
      initialTopicId={topicId}
      returnTo={returnTo}
      initialMessageId={messageId}
      key={messageId || 'latest'}
    />
  );
}