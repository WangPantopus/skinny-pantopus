'use client';

// Creator inbox — list of DM threads on the persona.
// Audience Profile design v2 §11.7. Each row is a fan_handle +
// last-message preview + unread badge. Tapping a row routes to the
// per-membership thread view (the notification deep-link target).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { PersonaDmThreadSummary } from '@pantopus/api';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';
import { AudienceZoneHeader } from '@/components/AudienceZoneHeader';
import { webFeatureFlags } from '@/lib/featureFlags';

interface PersonaShape {
  id: string;
  handle: string | null;
  displayName: string | null;
}

export default function CreatorInboxPage() {
  const router = useRouter();
  const flagState = useFeatureFlagState('audience_profile');
  const paidMembershipsEnabled = webFeatureFlags.personaPaidMemberships;

  const [persona, setPersona] = useState<PersonaShape | null>(null);
  const [threads, setThreads] = useState<PersonaDmThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setPersona({
          id: p.id, handle: p.handle ?? null, displayName: p.displayName ?? null,
        });
        const list = await api.personaDms.listThreads(p.id);
        if (!cancelled) setThreads(list.threads);
      } catch {
        if (!cancelled) setError('Could not load your inbox.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [flagState.isFetched, flagState.enabled, paidMembershipsEnabled, router]);

  if (!flagState.isFetched || !flagState.enabled || !paidMembershipsEnabled || loading || !persona) {
    return (
      <div className="min-h-screen bg-app">
        <AudienceZoneHeader />
        <main className="mx-auto max-w-3xl p-6 text-app-secondary" aria-busy={loading}>
          {loading ? 'Loading inbox…' : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      <AudienceZoneHeader handle={persona.handle} displayName={persona.displayName} />
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-app">Inbox</h1>
          <Link href="/app/audience" className="text-sm text-teal-700 hover:underline">
            ← Back to dashboard
          </Link>
        </header>

        {error ? (
          <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </p>
        ) : null}

        {threads.length === 0 ? (
          <section className="rounded-lg border border-dashed border-app-strong bg-surface p-6 text-center">
            <p className="text-sm text-app-secondary">
              No conversations yet. Members and Insiders can start DM threads
              from your Beacon.
            </p>
          </section>
        ) : (
          <ul className="divide-y divide-app-strong rounded-lg border border-app-strong bg-surface">
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/app/audience/inbox/${t.membershipId}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-app/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-app">
                      @{t.fanHandle}
                      {t.tier ? (
                        <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-800">
                          {t.tier.name}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 truncate text-sm text-app-secondary">
                      {t.lastMessagePreview ?? '(no messages yet)'}
                    </p>
                  </div>
                  {t.unreadCount > 0 ? (
                    <span
                      aria-label={`${t.unreadCount} unread`}
                      className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white"
                    >
                      {t.unreadCount}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
