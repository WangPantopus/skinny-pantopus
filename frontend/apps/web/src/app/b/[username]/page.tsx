'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import type { User } from '@pantopus/types';
import { getAuthToken } from '@pantopus/api';
import BusinessPublicProfile from '@/components/business/BusinessPublicProfile';

export default function BusinessPublicPage() {
  const params = useParams();
  const username = String(params.username || '');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const token = getAuthToken();
      if (!token) return;
      try {
        const me = await api.users.getMyProfile();
        setCurrentUser(me);
      } catch {
        setCurrentUser(null);
      }
    })();
  }, []);

  return <BusinessPublicProfile username={username} currentUser={currentUser} />;
}
