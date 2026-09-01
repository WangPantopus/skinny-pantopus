'use client';

// Audience destination — creator dashboard stub. Audience Profile design v2
// §4.2 (IA), §11 (UX targets), §11.8 (mode separation visual cues).
//
// P1.6 ships the dashboard shell. Updates is always visible; paid-membership
// related tabs and controls stay behind the paid memberships release flag.
//
// Gating: the audience_profile feature flag must be enabled for the user.
// If not, redirect to /app/persona (legacy entry).

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import type { OwnerTier } from '@pantopus/api';
import type { BroadcastChannel, BroadcastMessage } from '@pantopus/types';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';
import { AudienceZoneHeader } from '@/components/AudienceZoneHeader';
import { AudienceComposer } from '@/components/audience/AudienceComposer';
import { BroadcastTimeline, type BroadcastTimelineHandle } from '@/components/audience/BroadcastTimeline';
import { webFeatureFlags } from '@/lib/featureFlags';

type Tab = 'updates' | 'fans' | 'inbox';

const TABS: ReadonlyArray<{ value: Tab; label: string; ready: boolean }> = [
  { value: 'updates', label: 'Updates', ready: true },
  { value: 'fans',    label: 'Fans',    ready: false },
  { value: 'inbox',   label: 'Inbox',   ready: false },
];

function isTab(value: string | null | undefined): value is Tab {
  return value === 'updates' || value === 'fans' || value === 'inbox';
}

interface PersonaSummary {
  id: string;
  handle: string | null;
  displayName: string | null;
  followerCount: number;
}

export default function AudienceDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flagState = useFeatureFlagState('audience_profile');
  const flagEnabled = flagState.enabled;
  const paidMembershipsEnabled = webFeatureFlags.personaPaidMemberships;
  const requestedTab = searchParams.get('tab');
  const initialTab: Tab = paidMembershipsEnabled && isTab(requestedTab) ? requestedTab : 'updates';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [persona, setPersona] = useState<PersonaSummary | null>(null);
  const [channel, setChannel] = useState<BroadcastChannel | null>(null);
  const [tiers, setTiers] = useState<OwnerTier[]>([]);
  const [loading, setLoading] = useState(true);
  const timelineRef = useRef<BroadcastTimelineHandle>(null);
  const visibleTabs = useMemo(
    () => (paidMembershipsEnabled ? TABS : TABS.filter((t) => t.value === 'updates')),
    [paidMembershipsEnabled],
  );

  // Flag off → bounce to legacy persona entry. Audience Profile design
  // v2 §19.15: the surface must be invisible to users without access.
  useEffect(() => {
    if (flagState.isFetched && !flagEnabled) {
      router.replace('/app/persona');
    }
  }, [flagEnabled, flagState.isFetched, router]);

  useEffect(() => {
    let cancelled = false;
    if (!flagState.isFetched || !flagEnabled) return;
    (async () => {
      try {
        const me = await api.personas.getMyPersona();
        if (cancelled) return;
        if (!me?.persona) {
          setPersona(null);
          setChannel(null);
          setLoading(false);
          return;
        }
        const p = me.persona;
        setPersona({
          id: p.id,
          handle: p.handle ?? null,
          displayName: p.displayName ?? null,
          followerCount: p.followerCount ?? 0,
        });
        setChannel(me.channel ?? null);
        if (!paidMembershipsEnabled) {
          setTiers([]);
          return;
        }
        try {
          const list = await api.personaTiers.listOwnerTiers(p.id, { includeHidden: true });
          if (!cancelled) setTiers(list.tiers);
        } catch {
          // Tier load failure is non-fatal — the dashboard still renders.
          if (!cancelled) setTiers([]);
        }
      } catch {
        if (!cancelled) setPersona(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [flagEnabled, flagState.isFetched, paidMembershipsEnabled]);

  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === tab)) setTab('updates');
  }, [tab, visibleTabs]);

  const stats = useMemo(() => {
    const paying = tiers
      .filter((t) => t.rank >= 2 && t.status === 'active')
      .length;
    const monthlyMaxCents = tiers
      .filter((t) => t.rank >= 2 && t.status === 'active')
      .reduce((acc, t) => acc + (t.priceCents || 0), 0);
    // P1.6 stub: no Stripe yet so "Y paying" is 0. Surface the visible-tier
    // count and the rack-rate sum as the closest pre-billing approximation.
    return {
      followers: persona?.followerCount ?? 0,
      paying: 0,
      monthlyMaxCents,
      visibleTiers: paying,
    };
  }, [tiers, persona]);

  if (!flagState.isFetched || !flagEnabled || loading) {
    return (
      <div className="min-h-screen bg-app">
        <AudienceZoneHeader />
        <main className="mx-auto max-w-5xl p-6 text-app-secondary" aria-busy={loading}>
          {loading ? 'Loading…' : null}
        </main>
      </div>
    );
  }

  // Empty state — user has neither a persona nor any memberships yet.
  if (!persona) {
    return (
      <div className="min-h-screen bg-app">
        <AudienceZoneHeader />
        <main className="mx-auto flex max-w-5xl flex-col items-center gap-6 p-8 text-center">
          <h1 className="text-2xl font-semibold text-app">
            Build a public audience
          </h1>
          <p className="max-w-md text-app-secondary">
            Reach fans without exposing your private profile. Pick a handle,
            and post when you&rsquo;re ready.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/app/audience/setup"
              className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Create a Beacon
            </Link>
            <Link
              href="/app/discover"
              className="rounded-lg border border-app-strong px-5 py-2 text-sm font-medium text-app hover:bg-surface"
            >
              Browse Beacons
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      <AudienceZoneHeader
        handle={persona.handle}
        displayName={persona.displayName}
        rightSlot={paidMembershipsEnabled ? (
          <Link
            href="/app/audience/manage/tiers"
            className="rounded-md border border-teal-300 bg-white px-3 py-1 font-medium text-teal-800 hover:bg-teal-100"
          >
            Manage tiers
          </Link>
        ) : null}
      />
      <main className="mx-auto max-w-5xl p-6">
        <StatusLine
          handle={persona.handle}
          followers={stats.followers}
          paying={stats.paying}
          monthlyMaxCents={stats.monthlyMaxCents}
          paidMembershipsEnabled={paidMembershipsEnabled}
        />
        <nav
          role="tablist"
          aria-label="Beacon sections"
          className="mt-6 flex gap-1 border-b border-app-strong"
        >
          {visibleTabs.map((t) => (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`relative -mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                tab === t.value
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-app-secondary hover:text-app'
              }`}
            >
              {t.label}
              {!t.ready ? (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  Coming soon
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div role="tabpanel" className="pt-6">
          {tab === 'updates' ? (
            <UpdatesTab
              personaId={persona.id}
              personaHandle={persona.handle}
              channel={channel}
              timelineRef={timelineRef}
            />
          ) : tab === 'fans' ? (
            <ComingSoonPanel
              title="Fans"
              body="The fan list lands in the next release alongside paid memberships."
            />
          ) : (
            <ComingSoonPanel
              title="Inbox"
              body="Tier-gated DM threads land alongside paid memberships."
            />
          )}
        </div>
      </main>
    </div>
  );
}

function StatusLine({
  handle, followers, paying, monthlyMaxCents, paidMembershipsEnabled,
}: {
  handle: string | null;
  followers: number;
  paying: number;
  monthlyMaxCents: number;
  paidMembershipsEnabled: boolean;
}) {
  const dollars = monthlyMaxCents > 0 ? `$${(monthlyMaxCents / 100).toFixed(0)}/mo` : '$0/mo';
  return (
    <p className="text-sm text-app-secondary">
      <span className="font-medium text-app">@{handle || 'untitled'}</span>
      {' · '}
      {followers.toLocaleString()} {followers === 1 ? 'follower' : 'followers'}
      {paidMembershipsEnabled ? (
        <>
          {' · '}
          {paying} paying
          {' · '}
          {dollars}
        </>
      ) : null}
    </p>
  );
}

function UpdatesTab({
  personaId,
  personaHandle,
  channel,
  timelineRef,
}: {
  personaId: string;
  personaHandle: string | null;
  channel: BroadcastChannel | null;
  timelineRef: React.RefObject<BroadcastTimelineHandle | null>;
}) {
  // Persona owners always have a BroadcastChannel auto-provisioned at
  // persona creation. If we don't have it yet (transient state right
  // after publish), fall back to a thin loading shim instead of the
  // composer — never render a composer that can't actually post.
  if (!channel) {
    return (
      <section aria-label="Updates" className="rounded-xl border border-dashed border-app-strong bg-surface p-6 text-center text-sm text-app-secondary">
        Loading the broadcast channel for @{personaHandle || 'your profile'}…
      </section>
    );
  }
  return (
    <div className="space-y-4">
      <AudienceComposer
        personaId={personaId}
        personaHandle={personaHandle || ''}
        channelId={channel.id}
        onPosted={(message) => {
          timelineRef.current?.prepend(message);
        }}
      />
      <BroadcastTimeline ref={timelineRef} channelId={channel.id} />
    </div>
  );
}

function ComingSoonPanel({ title, body }: { title: string; body: string }) {
  return (
    <section aria-label={title} className="rounded-lg border border-dashed border-app-strong bg-surface p-6 text-center">
      <h2 className="text-base font-semibold text-app">{title}</h2>
      <p className="mt-2 text-sm text-app-secondary">{body}</p>
    </section>
  );
}
