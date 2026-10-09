'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { User } from '@pantopus/types';
import { getAuthToken } from '@pantopus/api';
import BusinessPublicProfile from '@/components/business/BusinessPublicProfile';
import { fetchMe } from '@/lib/me';

export default function BusinessPublicPage() {
  const params = useParams();
  const username = String(params.username || '');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const token = getAuthToken();
      if (!token) return;
      try {
        const me = await fetchMe();
        setCurrentUser(me);
      } catch {
        setCurrentUser(null);
      }
    })();
  }, []);

  return <BusinessPublicProfile username={username} currentUser={currentUser} />;
}
