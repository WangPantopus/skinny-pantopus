'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Redirect /message -> /messages for backwards compatibility.
 */
export default function HomeMessageRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const homeId = params.id as string;

  useEffect(() => {
    router.replace(`/app/homes/${homeId}/messages`);
  }, [homeId, router]);

  return (
    <div className="min-h-screen bg-app-surface-raised flex items-center justify-center">
      <p className="text-app-text-secondary">Redirecting...</p>
    </div>
  );
}
