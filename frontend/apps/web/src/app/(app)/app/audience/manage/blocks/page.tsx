'use client';

// Blocked-fans management. Audience Profile design v2 §9 + §11.7.
// Lists every PersonaBlock on the persona; renders identical UI for
// persona_owner_action and personal_block_propagation rows (the
// creator must NOT be able to tell which kind they're looking at).
// Chargeback / platform_safety blocks render with a disabled
// Unblock button — they're moderator-removable only.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { PersonaBlockSummary } from '@pantopus/api';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';
import { AudienceZoneHeader } from '@/components/AudienceZoneHeader';
import { toast } from '@/components/ui/toast-store';

interface PersonaShape {
  id: string;
  handle: string | null;
  displayName: string | null;
}

export default function BlocksPage() {
  const router = useRouter();
  const flagState = useFeatureFlagState('audience_profile');

  const [persona, setPersona] = useState<PersonaShape | null>(null);
  const [blocks, setBlocks] = useState<PersonaBlockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (flagState.isFetched && !flagState.enabled) router.replace('/app/persona');
  }, [flagState.isFetched, flagState.enabled, router]);

  async function refresh(personaId: string) {
    try {
      const list = await api.personaBlocks.listBlocks(personaId);
      setBlocks(list.blocks);
    } catch {
      toast.error('Could not load blocked fans.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!flagState.isFetched || !flagState.enabled) return;
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
        await refresh(p.id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [flagState.isFetched, flagState.enabled, router]);

  async function unblock(block: PersonaBlockSummary) {
    if (!persona || busyId) return;
    if (!block.membershipId) {
      toast.error('Could not resolve this fan membership.');
      return;
    }
    setBusyId(block.id);
    try {
      await api.personaBlocks.unblockFan(persona.id, block.membershipId);
      toast.success(
        block.fanHandle
          ? `@${block.fanHandle} can access this profile again.`
          : 'Fan unblocked.',
      );
      await refresh(persona.id);
    } catch {
      toast.error('Could not unblock.');
    } finally {
      setBusyId(null);
    }
  }

  if (!flagState.isFetched || !flagState.enabled || loading || !persona) {
    return (
      <div className="min-h-screen bg-app">
        <AudienceZoneHeader />
        <main className="mx-auto max-w-3xl p-6 text-app-secondary" aria-busy={loading}>
          {loading ? 'Loading…' : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      <AudienceZoneHeader handle={persona.handle} displayName={persona.displayName} />
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-app">Blocked fans</h1>
          <Link href="/app/audience" className="text-sm text-teal-700 hover:underline">
            ← Back to dashboard
          </Link>
        </header>

        {blocks.length === 0 ? (
          <p className="rounded-md border border-dashed border-app-strong bg-surface p-4 text-sm text-app-secondary">
            No blocked fans on this profile.
          </p>
        ) : (
          <ul className="divide-y divide-app-strong rounded-lg border border-app-strong bg-surface">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-app">
                    {b.fanHandle ? `@${b.fanHandle}` : '(handle unavailable)'}
                  </p>
                  <p className="mt-0.5 text-xs text-app-secondary">
                    Blocked {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {b.canUnblock ? (
                  <button
                    type="button"
                    onClick={() => unblock(b)}
                    disabled={busyId === b.id}
                    className="rounded-md border border-app-strong px-3 py-1 text-xs font-medium text-app hover:bg-app/30"
                  >
                    {busyId === b.id ? 'Unblocking…' : 'Unblock'}
                  </button>
                ) : (
                  <span className="text-xs text-app-secondary">Moderator only</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-app-secondary">
          When you block a fan, their subscription is canceled with a
          prorated refund and their access ends immediately. Blocks
          can&rsquo;t be reversed for chargebacks or platform-safety
          actions.
        </p>
      </main>
    </div>
  );
}
