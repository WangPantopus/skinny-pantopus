// ============================================================
// PlaceSectionDetail — the authed container for /app/place/[section].
//
// Resolves the resident's primary home + its PlaceIntelligence (the
// same queries the dashboard uses, so it's a warm cache hit on
// tap-through), owns the page states (auth gate, shimmer, error,
// no-place), then dispatches the matching group-detail view.
// Mobile-web-first single column with a comfortable desktop max-width.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { MapPinned } from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { ShimmerBlock } from '@/components/ui/Shimmer';
import { DetailHeader } from '@/components/archetypes/place';
import PlaceShell from '../PlaceShell';
import { PLACE_DETAIL_BY_SLUG } from './sections';
import TodayDetail from './TodayDetail';
import YourHomeDetail from './YourHomeDetail';
import RiskDetail from './RiskDetail';
import BlockDetail from './BlockDetail';
import MoneyDetail from './MoneyDetail';
import CivicDetail from './CivicDetail';
import IdentityDetail from './IdentityDetail';

function DetailShell({ section, children }: { section: string; children: React.ReactNode }) {
  return <PlaceShell active={section}>{children}</PlaceShell>;
}

function DetailSkeleton() {
  return (
    <div className="px-4 sm:px-5 pt-1 pb-16" role="status">
      <span className="sr-only">Loading section details…</span>
      <div aria-hidden="true">
        <div className="h-3 w-24 mt-6 mb-2"><ShimmerBlock className="h-3 w-24" /></div>
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
              <div className="flex items-center gap-3 mb-3">
                <ShimmerBlock className="w-11 h-11 rounded-xl" />
                <div className="flex-1 flex flex-col gap-2">
                  <ShimmerBlock className="h-4 w-1/3" />
                  <ShimmerBlock className="h-3 w-1/2" />
                </div>
              </div>
              <ShimmerBlock className="h-3 w-5/6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlaceSectionDetail({ section }: { section: string }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const meta = PLACE_DETAIL_BY_SLUG[section];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !getAuthToken()) {
      router.replace(`/login?redirectTo=${encodeURIComponent(`/app/place/${section}`)}`);
    }
  }, [mounted, router, section]);

  const authed = mounted && !!getAuthToken();
  const valid = !!meta;

  const homeQuery = useQuery({
    queryKey: queryKeys.placePrimaryHome(),
    queryFn: async () => api.homes.getPrimaryHome(),
    enabled: authed && valid,
    staleTime: 60_000,
  });

  const homeId = homeQuery.data?.home?.id ?? null;

  const intelQuery = useQuery({
    queryKey: homeId ? queryKeys.placeIntelligence(homeId) : ['place', 'intelligence', 'none'],
    queryFn: async () => api.place.getPlaceIntelligence(homeId as string),
    enabled: authed && valid && !!homeId,
    staleTime: 60_000,
  });

  // Resident name is only needed by the Identity detail.
  const userQuery = useQuery({
    queryKey: ['users', 'me', 'profile'],
    queryFn: async () => api.users.getMyProfile(),
    enabled: authed && valid && section === 'identity',
    staleTime: 5 * 60_000,
  });

  // ── Unknown section ───────────────────────────────────────
  if (!valid) {
    return (
      <DetailShell section={section}>
        <DetailHeader title="Not found" />
        <div className="px-4 sm:px-5">
          <EmptyState
            icon={MapPinned}
            title="That section doesn't exist"
            description="Head back to your Place to pick up where you left off."
            actionLabel="Back to your Place"
            onAction={() => router.push('/app/place')}
          />
        </div>
      </DetailShell>
    );
  }

  if (!mounted || !authed) {
    return (
      <DetailShell section={section}>
        <DetailHeader title={meta.title} />
        <DetailSkeleton />
      </DetailShell>
    );
  }

  if (homeQuery.isError) {
    return (
      <DetailShell section={section}>
        <DetailHeader title={meta.title} />
        <div className="px-4 sm:px-5">
          <ErrorState message="We couldn't load your place. Check your connection and try again." onRetry={() => homeQuery.refetch()} />
        </div>
      </DetailShell>
    );
  }

  if (homeQuery.isSuccess && !homeId) {
    return (
      <DetailShell section={section}>
        <DetailHeader title={meta.title} />
        <div className="px-4 sm:px-5">
          <EmptyState
            icon={MapPinned}
            title="You haven't added a place yet"
            description="Claim your address to see flood risk, today's air, your home's value, and your verified neighbors."
            actionLabel="Add your place"
            onAction={() => router.push('/app/homes')}
          />
        </div>
      </DetailShell>
    );
  }

  if (homeQuery.isPending || intelQuery.isPending) {
    return (
      <DetailShell section={section}>
        <DetailHeader title={meta.title} />
        <DetailSkeleton />
      </DetailShell>
    );
  }

  if (intelQuery.isError || !intelQuery.data) {
    return (
      <DetailShell section={section}>
        <DetailHeader title={meta.title} />
        <div className="px-4 sm:px-5">
          <ErrorState message="We couldn't load your place. Check your connection and try again." onRetry={() => intelQuery.refetch()} />
        </div>
      </DetailShell>
    );
  }

  const intelligence = intelQuery.data;
  const residentName = userQuery.data?.name || userQuery.data?.firstName || '';

  return (
    <DetailShell section={section}>
      {meta.group === 'today' && <TodayDetail intelligence={intelligence} />}
      {meta.group === 'your_home' && <YourHomeDetail intelligence={intelligence} homeId={homeId} />}
      {meta.group === 'risk_readiness' && <RiskDetail intelligence={intelligence} homeId={homeId} />}
      {meta.group === 'your_block' && <BlockDetail intelligence={intelligence} homeId={homeId} />}
      {meta.group === 'money_signals' && <MoneyDetail intelligence={intelligence} homeId={homeId} />}
      {meta.group === 'civic' && <CivicDetail intelligence={intelligence} />}
      {meta.group === 'identity' && <IdentityDetail intelligence={intelligence} homeId={homeId} residentName={residentName} />}
    </DetailShell>
  );
}
