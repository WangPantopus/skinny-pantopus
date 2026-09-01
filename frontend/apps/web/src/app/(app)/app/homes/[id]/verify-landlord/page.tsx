'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getAuthToken } from '@pantopus/api';
import LandlordVerificationFlow from '@/components/home/LandlordVerificationFlow';

function VerifyLandlordContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  // The Place verify flow routes here with ?return=place; once the
  // landlord approves we return to /app/place (the B3 reveal).
  const returnToPlace = searchParams.get('return') === 'place';
  const verifiedDest = returnToPlace ? '/app/place?verified=1' : `/app/homes/${homeId}/dashboard`;

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  if (!homeId) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <LandlordVerificationFlow
        homeId={homeId}
        onApproved={() => router.push(verifiedDest)}
        onBack={() => router.back()}
      />
    </div>
  );
}

export default function VerifyLandlordPage() { return <Suspense><VerifyLandlordContent /></Suspense>; }
