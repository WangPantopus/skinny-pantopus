'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import ActionQueueCard from '@/components/dashboard/ActionQueueCard';
import {
  HubTopBar,
  StatusStrip,
  SetupBanner,
  PillarGrid,
  NearbyModule,
  HubDiscovery,
  JumpBackIn,
  ActivityLog,
  HubSkeleton,
  useHubContext,
  PlaceBriefCard,
  HubTodayCard,
} from '@/components/hub';
import ProfileCompletionCard from '@/components/hub/ProfileCompletionCard';
import type { HubPayload } from '@/components/hub';
import type { HubToday } from '@pantopus/types';

const HUB_STALE_TIME = 120_000; // 2 minutes

// Fetches the hub payload + (in parallel) the user's homes, merging them
// so the UI shows homes even when hub returns none.
async function fetchHubData(): Promise<HubPayload> {
  const [hubPayload, myHomesRes] = await Promise.all([
    api.hub.getHub(),
    api.homes.getMyHomes().catch(() => null),
  ]);

  let homes: api.HubHome[] = hubPayload.homes ?? [];
  let availability = hubPayload.availability ?? { hasHome: false, hasBusiness: false, hasPayoutMethod: false };
  let cards = hubPayload.cards ?? { personal: { unreadChats: 0 } };
  let setupSteps: api.SetupStep[] = hubPayload.setup?.steps ?? [];

  // If hub returned no homes but user has homes (e.g. verified owner from
  // my-homes), use that so UI shows them.
  if (homes.length === 0 && myHomesRes) {
    const myHomes = (myHomesRes as { homes?: Array<{ id: string; name?: string | null; address?: string; city?: string; occupancy?: { role?: string } }> })?.homes ?? [];
    if (myHomes.length > 0) {
      homes = myHomes.map((h, i) => ({
        id: h.id,
        name: h.name || h.address || 'Home',
        addressShort: [h.address, h.city].filter(Boolean).join(', ') || 'My home',
        city: h.city ?? null,
        state: null,
        latitude: null,
        longitude: null,
        isPrimary: i === 0,
        roleBase: h.occupancy?.role ?? 'owner',
      }));
      availability = { ...availability, hasHome: true };
      cards = { ...cards, home: { newMail: 0, billsDue: [], tasksDue: [], memberCount: 0 } };
      setupSteps = setupSteps.map((s) => (s.key === 'home' ? { ...s, done: true } : s));
    }
  }

  const profileCompleteness =
    (hubPayload.setup as Partial<HubPayload['setup']>).profileCompleteness ?? { score: 0, checks: {}, missingFields: [] };

  return {
    ...hubPayload,
    homes,
    availability,
    cards,
    setup: {
      ...hubPayload.setup,
      steps: setupSteps,
      profileCompleteness,
    },
  };
}

// ─── Main Hub Page ───────────────────────────────────────────
export default function HubPage() {
  const router = useRouter();
  const ctx = useHubContext();

  // Track mount so SSR and first client render agree (avoids hydration mismatch
  // from reading auth state that only exists on the client).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth redirect on missing token
  useEffect(() => {
    if (!mounted) return;
    if (!getAuthToken()) {
      router.replace('/login?redirectTo=%2Fapp%2Fhub');
    }
  }, [router, mounted]);

  const hasToken = mounted && !!getAuthToken();

  // ── Hub payload (staleTime 120s) ──────────────────────────
  const hubQuery = useQuery<HubPayload>({
    queryKey: queryKeys.hub(),
    queryFn: fetchHubData,
    staleTime: HUB_STALE_TIME,
    enabled: hasToken,
  });

  // ── Hub Today (staleTime 120s, retry 1x with 800ms delay) ──
  const todayQuery = useQuery<HubToday | null>({
    queryKey: queryKeys.hubToday(),
    queryFn: () => api.hub.getHubToday({ retries: 1, retryDelayMs: 800 }),
    staleTime: HUB_STALE_TIME,
    enabled: hasToken,
  });

  const data = hubQuery.data ?? null;
  const todayData = todayQuery.data ?? null;
  const loading = hubQuery.isPending && hasToken;
  const todayLoading = todayQuery.isPending && hasToken;
  const error = hubQuery.error instanceof Error ? hubQuery.error.message : (hubQuery.error ? 'Failed to load hub' : '');

  // Initialize hub context once data loads
  useEffect(() => {
    if (!data) return;
    ctx.init(
      data.context?.activeHomeId ?? null,
      data.homes,
      data.businesses ?? [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const activeHome = useMemo(
    () => data?.homes.find((h) => h.id === ctx.activeHomeId) || null,
    [data?.homes, ctx.activeHomeId],
  );

  // ── Loading ────────────────────────────────────────────────
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-app">
        <div className="max-w-5xl mx-auto px-4 py-6"><HubSkeleton /></div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Something went wrong'}</p>
          <button
            onClick={() => {
              void hubQuery.refetch();
              void todayQuery.refetch();
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Filter setup steps: remove attach_home (has its own CTA card) and complete_profile (has its own card)
  const filteredSetupSteps = data.setup.steps.filter((s) => s.key !== 'attach_home' && s.key !== 'complete_profile');
  const setupAllDone = filteredSetupSteps.every((s) => s.done);
  const profileCompleteness = data.setup.profileCompleteness;

  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <HubTopBar
          activeHome={activeHome}
          homes={data.homes}
          businesses={data.businesses}
          activePersona={ctx.activePersona}
          userName={data.user.name}
          username={data.user.username}
          homePickerOpen={ctx.homePickerOpen}
          setHomePickerOpen={ctx.setHomePickerOpen}
          personaPickerOpen={ctx.personaPickerOpen}
          setPersonaPickerOpen={ctx.setPersonaPickerOpen}
          onSwitchHome={ctx.switchHome}
          onSwitchPersona={ctx.switchPersona}
        />

        <StatusStrip
          items={data.statusItems}
          hasHome={data.availability.hasHome}
          activeHomeId={ctx.activeHomeId}
          setupDone={setupAllDone}
          setupTotal={filteredSetupSteps.length}
          setupCompleted={filteredSetupSteps.filter((s) => s.done).length}
        />

        <HubTodayCard today={todayData} loading={todayLoading} />

        {ctx.activeHomeId && (
          <PlaceBriefCard
            homeId={ctx.activeHomeId}
            homeName={activeHome?.name || activeHome?.addressShort}
          />
        )}

        {profileCompleteness && profileCompleteness.score < 100 && (
          <ProfileCompletionCard completeness={profileCompleteness} />
        )}

        {!setupAllDone && <SetupBanner steps={filteredSetupSteps} />}

        <ActionQueueCard />

        <PillarGrid
          personal={data.cards.personal}
          home={data.cards.home}
          business={data.cards.business}
          activeHomeId={ctx.activeHomeId}
          businesses={data.businesses}
          hasHome={data.availability.hasHome}
          hasBusiness={data.availability.hasBusiness}
        />

        <NearbyModule />

        <HubDiscovery />

        <JumpBackIn items={data.jumpBackIn} hasBusiness={data.availability.hasBusiness} />

        <ActivityLog items={data.activity} />
      </div>

    </div>
  );
}
