'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

function DisputeRedirectInner() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (id) router.replace(`/app/homes/${id}/dashboard`);
    else router.replace('/app/homes');
  }, [id, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
    </div>
  );
}

export default function DisputePage() {
  return (
    <Suspense fallback={null}>
      <DisputeRedirectInner />
    </Suspense>
  );
}
