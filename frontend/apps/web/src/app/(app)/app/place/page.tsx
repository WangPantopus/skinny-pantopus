'use client';

// ============================================================
// /app/place — the address-led Place dashboard (authed).
//
// Thin route. Normally renders the PlaceDashboard container (which owns
// fetching, the auth gate, and the page states). When the verification
// flow returns here with `?verified=1`, it shows the B3 success reveal
// first; "Go to your place" clears the flag, refreshes the Place
// queries, and drops the resident onto the now T4-verified dashboard.
// ============================================================

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import PlaceDashboard from '@/components/place/PlaceDashboard';
import PendingPlaceSaver from '@/components/place/PendingPlaceSaver';
import PlaceDashboardSkeleton from '@/components/place/PlaceDashboardSkeleton';
import VerifiedSuccess from '@/components/place/VerifiedSuccess';

function PlaceRoute() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const justVerified = params.get('verified') === '1';

  if (justVerified) {
    return (
      <VerifiedSuccess
        onContinue={() => {
          // Refetch the now-verified tier (T4) before showing the dashboard.
          queryClient.invalidateQueries({ queryKey: ['place'] });
          router.replace('/app/place');
        }}
      />
    );
  }

  return (
    <>
      <PendingPlaceSaver />
      <PlaceDashboard />
    </>
  );
}

export default function PlacePage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-[640px] px-4 sm:px-5 py-5 sm:py-6"><PlaceDashboardSkeleton /></div>}>
      <PlaceRoute />
    </Suspense>
  );
}
