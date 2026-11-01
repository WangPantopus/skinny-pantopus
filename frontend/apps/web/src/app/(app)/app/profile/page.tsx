'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@pantopus/api';
import PublicProfileClient from '@/app/[username]/PublicProfileClient';
import ErrorState from '@/components/ui/ErrorState';
import { useMe } from '@/lib/me';

/**
 * Your profile: the same page neighbors see, in owner mode (Edit profile, Preview as, tips only you see, your latest
 * posts, your month and your account). /<your username> shows the same page.
 */
export default function MyProfilePage() {
  const router = useRouter();
  // The session cookie is readable only in the browser: until mount, the page renders what the cache already has.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const signedIn = mounted && !!getAuthToken();
  useEffect(() => {
    if (mounted && !getAuthToken()) router.push('/login');
  }, [mounted, router]);

  const meQuery = useMe({ enabled: signedIn });
  const me = meQuery.data ?? null;

  if (me?.id) {
    return <PublicProfileClient username={String(me.id)} initialProfile={null} ownerHome />;
  }

  if (meQuery.isError) {
    const message = meQuery.error instanceof Error && meQuery.error.message ? meQuery.error.message : "We couldn't load your profile.";
    return (
      <div className="bg-app text-app">
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <ErrorState message={message} onRetry={() => { void meQuery.refetch(); }} />
        </main>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-20" role="status">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" aria-hidden="true"></div>
        <p className="mt-4 text-app-muted">Loading your profile…</p>
      </div>
    </div>
  );
}
