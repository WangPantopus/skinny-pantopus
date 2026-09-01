'use client';

// Fan's view of their DM thread with one persona. Audience Profile
// design v2 §11.5 (fan opens DM) + §11.6 (fan dashboard). The route
// /app/audience/membership/{persona.id}/inbox is the deep-link
// target of the persona_dm_reply_fan notification.
//
// If the fan doesn't have an active thread yet, the page surfaces a
// "Start a conversation" composer that calls openThread.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { PersonaDmThreadSummary } from '@pantopus/api';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';
import { AudienceZoneHeader } from '@/components/AudienceZoneHeader';
import { PersonaDmThreadView } from '@/components/audience/PersonaDmThreadView';
import { toast } from '@/components/ui/toast-store';
import { webFeatureFlags } from '@/lib/featureFlags';

export default function FanInboxPage() {
  const router = useRouter();
  const params = useParams<{ personaId: string }>();
  const personaId = String(params?.personaId || '');
  const flagState = useFeatureFlagState('audience_profile');
  const paidMembershipsEnabled = webFeatureFlags.personaPaidMemberships;

  const [threads, setThreads] = useState<PersonaDmThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!flagState.isFetched) return;
    if (!flagState.enabled) router.replace('/app/persona');
    else if (!paidMembershipsEnabled) router.replace('/app/audience');
  }, [flagState.isFetched, flagState.enabled, paidMembershipsEnabled, router]);

  async function refresh() {
    if (!personaId) return;
    try {
      const list = await api.personaDms.listThreads(personaId);
      setThreads(list.threads);
    } catch {
      toast.error('Could not load your messages.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!flagState.isFetched || !flagState.enabled || !paidMembershipsEnabled || !personaId) return;
    (async () => {
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // refresh closes over personaId only; refetch when that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagState.isFetched, flagState.enabled, paidMembershipsEnabled, personaId]);

  async function openThreadFromComposer() {
    if (opening || !draft.trim()) return;
    setOpening(true);
    try {
      const res = await api.personaDms.openThread(personaId, { body: draft.trim() });
      setDraft('');
      toast.success(
        res.quotaRemaining != null
          ? `Sent. ${res.quotaRemaining} thread${res.quotaRemaining === 1 ? '' : 's'} left this period.`
          : 'Sent.',
      );
      await refresh();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message)
        : '';
      if (/402|quota_exhausted/.test(msg)) {
        toast.error('You have used all your message threads for this period.');
      } else if (/403|blocked/.test(msg)) {
        toast.error('This profile cannot accept new messages from your account.');
      } else if (/no_membership/.test(msg)) {
        toast.error('You need to subscribe to a paid tier first.');
      } else {
        toast.error('Could not send. Try again.');
      }
    } finally {
      setOpening(false);
    }
  }

  if (!flagState.isFetched || !flagState.enabled || !paidMembershipsEnabled || loading) {
    return (
      <div className="min-h-screen bg-app">
        <AudienceZoneHeader />
        <main className="mx-auto max-w-2xl p-6 text-app-secondary" aria-busy={loading}>
          {loading ? 'Loading…' : null}
        </main>
      </div>
    );
  }

  const thread = threads[0] || null;

  return (
    <div className="min-h-screen bg-app">
      <AudienceZoneHeader />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-app">Messages</h1>
          <Link
            href={`/app/audience/membership/${personaId}`}
            className="text-sm text-teal-700 hover:underline"
          >
            ← Back to membership
          </Link>
        </header>

        {thread ? (
          <PersonaDmThreadView personaId={personaId} threadId={thread.id} />
        ) : (
          <section className="rounded-lg border border-app-strong bg-surface p-4">
            <h2 className="text-base font-semibold text-app">Start a conversation</h2>
            <p className="mt-1 text-sm text-app-secondary">
              Opening a thread uses one of your monthly message-thread quotas.
              The creator decides if and when they reply.
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-3 w-full resize-none rounded-md border border-app-strong bg-surface px-3 py-2 text-app outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Say hi…"
            />
            <button
              type="button"
              onClick={openThreadFromComposer}
              disabled={opening || draft.trim().length === 0}
              className="mt-3 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {opening ? 'Sending…' : 'Send'}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
