'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Guests get a guest pass on the Home's Guest Passes page, so this address redirects there.
 */
export default function HomeAddGuestRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const homeId = params.id as string;

  useEffect(() => {
    router.replace(`/app/homes/${homeId}/share`);
  }, [homeId, router]);

  return (
    <div className="min-h-screen bg-app-surface-raised flex items-center justify-center">
      <p className="text-app-text-secondary">Redirecting...</p>
    </div>
  );
}
