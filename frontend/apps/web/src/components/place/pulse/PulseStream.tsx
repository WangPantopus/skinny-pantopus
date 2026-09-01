// ============================================================
// PulseStream — the authed container for /app/place/pulse (W2.5).
//
// The feed sibling to the structured dashboard. Resolves the resident's
// primary home, then fetches its NeighborhoodPulse (the ranked signal
// stream) and hands it to the presentational view. The PlaceIntelligence
// query is supplementary — it only sharpens the header address and surfaces
// the claimed (T3) verify nudge — so it never gates the stream (and is a
// warm cache hit on tap-through from the dashboard).
//
// Owns the page states: auth gate, shimmer skeleton, error (retry), and
// the no-place empty state. Mobile-web-first single column with a
// comfortable desktop max-width.
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
import { detailAddress } from '@/components/place/detail/sections';
import PulseStreamView from './PulseStreamView';
import PlaceShell from '../PlaceShell';

const REDIRECT_TO = encodeURIComponent('/app/place/pulse');

function StreamShell({ children }: { children: React.ReactNode }) {
  return <PlaceShell active="pulse">{children}</PlaceShell>;
}

function StreamSkeleton() {
  return (
    <div className="px-4 sm:px-5 pt-1 pb-16" aria-hidden="true">
      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px] mt-1">
        <div className="flex items-center gap-3">
          <ShimmerBlock className="w-[46px] h-[46px] rounded-[14px]" />
          <div className="flex-1 flex flex-col gap-2">
            <ShimmerBlock className="h-4 w-1/3" />
            <ShimmerBlock className="h-3 w-3/4" />
          </div>
        </div>
      </div>
      <div className="h-3 w-28 mt-6 mb-2.5"><ShimmerBlock className="h-3 w-28" /></div>
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[15px]">
            <div className="flex items-start gap-3">
              <ShimmerBlock className="w-[38px] h-[38px] rounded-[10px]" />
              <div className="flex-1 flex flex-col gap-2">
                <ShimmerBlock className="h-4 w-2/3" />
                <ShimmerBlock className="h-3 w-5/6" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PulseStream() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // getAuthToken gate (middleware also guards /app/*; this is the client guard).
  useEffect(() => {
    if (mounted && !getAuthToken()) {
      router.replace(`/login?redirectTo=${REDIRECT_TO}`);
    }
  }, [mounted, router]);

  const authed = mounted && !!getAuthToken();

  // 1) Resolve the resident's primary home (the default place).
  const homeQuery = useQuery({
    queryKey: queryKeys.placePrimaryHome(),
    queryFn: async () => api.homes.getPrimaryHome(),
    enabled: authed,
    staleTime: 60_000,
  });

  const home = homeQuery.data?.home ?? null;
  const homeId = home?.id ?? null;

  // 2) The ranked signal stream (the primary content) — gates the page.
  const pulseQuery = useQuery({
    queryKey: homeId ? queryKeys.placePulse(homeId) : ['place', 'pulse', 'none'],
    queryFn: async () => api.ai.getNeighborhoodPulse(homeId as string),
    enabled: authed && !!homeId,
    staleTime: 60_000,
  });

  // 2b) Supplementary: the dashboard contract gives a sharper address and
  // the tier (for the T3 verify nudge). Warm cache on tap-through; never
  // gates the stream, so a slow/failed contract still shows the pulse.
  const intelQuery = useQuery({
    queryKey: homeId ? queryKeys.placeIntelligence(homeId) : ['place', 'intelligence', 'none'],
    queryFn: async () => api.place.getPlaceIntelligence(homeId as string),
    enabled: authed && !!homeId,
    staleTime: 60_000,
  });

  const homeAddress = home ? [home.address, home.city].filter(Boolean).join(' · ') : undefined;
  const address = intelQuery.data ? detailAddress(intelQuery.data.place) : homeAddress;
  const verifyAddress = intelQuery.data?.place.label ?? homeAddress;
  const showVerify = intelQuery.data?.tier === 'T3';

  // ── States ───────────────────────────────────────────────
  if (!mounted || !authed) {
    return (
      <StreamShell>
        <DetailHeader title="Today's Pulse" backHref="/app/place" />
        <StreamSkeleton />
      </StreamShell>
    );
  }

  if (homeQuery.isError) {
    return (
      <StreamShell>
        <DetailHeader title="Today's Pulse" backHref="/app/place" />
        <div className="px-4 sm:px-5">
          <ErrorState message="We couldn't load your pulse. Check your connection and try again." onRetry={() => homeQuery.refetch()} />
        </div>
      </StreamShell>
    );
  }

  if (homeQuery.isSuccess && !homeId) {
    return (
      <StreamShell>
        <DetailHeader title="Today's Pulse" backHref="/app/place" />
        <div className="px-4 sm:px-5">
          <EmptyState
            icon={MapPinned}
            title="You haven't added a place yet"
            description="Claim your address to see today's air, local alerts, and what's happening on your block."
            actionLabel="Add your place"
            onAction={() => router.push('/app/homes')}
          />
        </div>
      </StreamShell>
    );
  }

  if (homeQuery.isPending || pulseQuery.isPending) {
    return (
      <StreamShell>
        <DetailHeader title="Today's Pulse" address={address} backHref="/app/place" />
        <StreamSkeleton />
      </StreamShell>
    );
  }

  if (pulseQuery.isError || !pulseQuery.data) {
    return (
      <StreamShell>
        <DetailHeader title="Today's Pulse" address={address} backHref="/app/place" />
        <div className="px-4 sm:px-5">
          <ErrorState message="We couldn't load your pulse. Check your connection and try again." onRetry={() => pulseQuery.refetch()} />
        </div>
      </StreamShell>
    );
  }

  return (
    <StreamShell>
      <PulseStreamView
        pulse={pulseQuery.data.pulse}
        address={address}
        homeId={homeId as string}
        verifyAddress={verifyAddress}
        showVerify={showVerify}
      />
    </StreamShell>
  );
}
