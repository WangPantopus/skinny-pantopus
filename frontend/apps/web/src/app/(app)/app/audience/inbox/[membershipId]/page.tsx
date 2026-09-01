'use client';

// Creator's view of a single DM thread, addressed by membership_id
// (matches the audience-context notification deep link
// /app/audience/inbox/{membership.id} from notificationService).
//
// The list-threads endpoint is the lookup path: filter the creator's
// thread list to find the one(s) for this membership and route to
// the most recent open thread.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { PersonaDmThreadSummary } from '@pantopus/api';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';
import { AudienceZoneHeader } from '@/components/AudienceZoneHeader';
import { PersonaDmThreadView } from '@/components/audience/PersonaDmThreadView';
import { webFeatureFlags } from '@/lib/featureFlags';

interface PersonaShape { id: string; handle: string | null; displayName: string | null }

export default function CreatorInboxThreadPage() {
  const router = useRouter();
  const params = useParams<{ membershipId: string }>();
  const membershipId = String(params?.membershipId || '');
  const flagState = useFeatureFlagState('audience_profile');
  const paidMembershipsEnabled = webFeatureFlags.personaPaidMemberships;

  const [persona, setPersona] = useState<PersonaShape | null>(null);
  const [threads, setThreads] = useState<PersonaDmThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!flagState.isFetched) return;
    if (!flagState.enabled) router.replace('/app/persona');
    else if (!paidMembershipsEnabled) router.replace('/app/audience');
  }, [flagState.isFetched, flagState.enabled, paidMembershipsEnabled, router]);

  useEffect(() => {
    let cancelled = false;
    if (!flagState.isFetched || !flagState.enabled || !paidMembershipsEnabled) return;
    (async () => {
      try {
        const me = await api.personas.getMyPersona();
        if (cancelled) return;
        if (!me?.persona) {
          router.replace('/app/audience/setup');
          return;
        }
        const p = me.persona;
        setPersona({ id: p.id, handle: p.handle ?? null, displayName: p.displayName ?? null });
        const list = await api.personaDms.listThreads(p.id);
        if (cancelled) return;
        setThreads(list.threads.filter((t) => t.membershipId === membershipId));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [flagState.isFetched, flagState.enabled, paidMembershipsEnabled, router, membershipId]);

  if (!flagState.isFetched || !flagState.enabled || !paidMembershipsEnabled || loading || !persona) {
    return (
      <div className="min-h-screen bg-app">
        <AudienceZoneHeader />
        <main className="mx-auto max-w-3xl p-6 text-app-secondary" aria-busy={loading}>
          {loading ? 'Loading…' : null}
        </main>
      </div>
    );
  }

  // For v1 we expect a single open thread per (creator, membership).
  // Pick the most recent.
  const activeThread = threads[0] || null;

  return (
    <div className="min-h-screen bg-app">
      <AudienceZoneHeader handle={persona.handle} displayName={persona.displayName} />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-app">Conversation</h1>
          <Link href="/app/audience/inbox" className="text-sm text-teal-700 hover:underline">
            ← Back to inbox
          </Link>
        </header>

        {activeThread ? (
          <PersonaDmThreadView personaId={persona.id} threadId={activeThread.id} />
        ) : (
          <p className="rounded-md border border-app-strong bg-surface p-4 text-sm text-app-secondary">
            No active conversation with this fan yet.
          </p>
        )}
      </main>
    </div>
  );
}
