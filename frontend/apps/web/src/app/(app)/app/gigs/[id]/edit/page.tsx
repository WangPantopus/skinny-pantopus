'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function EditGigPage() {
  const router = useRouter();
  const params = useParams();
  const gigId = params.id as string;

  useEffect(() => {
    if (!gigId) return;
    router.replace(`/app/gigs/new?editGigId=${encodeURIComponent(gigId)}`);
  }, [router, gigId]);

  return <div className="p-6 text-app-text-secondary">Redirecting to full edit form…</div>;
}

