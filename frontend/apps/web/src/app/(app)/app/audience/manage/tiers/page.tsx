'use client';

// Tier management page. Audience Profile design v2 §10 (tier CRUD), §11.2
// (paid-tier setup UI). The page lists every tier the creator owns
// (active + hidden + archived) and lets them edit name, description,
// price, msg-threads quota, reply policy, and (for Insider rank 3) the
// creator-initiated-DM flag. Save calls PATCH per modified tier.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { OwnerTier } from '@pantopus/api';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';
import { AudienceZoneHeader } from '@/components/AudienceZoneHeader';
import {
  TierEditor,
  tierToFormValues,
  type TierFormValues,
} from '@/components/audience/TierEditor';
import { toast } from '@/components/ui/toast-store';
import { webFeatureFlags } from '@/lib/featureFlags';

interface PersonaShape {
  id: string;
  handle: string | null;
  displayName: string | null;
}

export default function ManageTiersPage() {
  const router = useRouter();
  const flagState = useFeatureFlagState('audience_profile');
  const flagEnabled = flagState.enabled;
  const paidMembershipsEnabled = webFeatureFlags.personaPaidMemberships;

  const [persona, setPersona] = useState<PersonaShape | null>(null);
  const [tiers, setTiers] = useState<OwnerTier[]>([]);
  const [forms, setForms] = useState<Record<string, TierFormValues>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!flagState.isFetched) return;
    if (!flagEnabled) router.replace('/app/persona');
    else if (!paidMembershipsEnabled) router.replace('/app/audience');
  }, [flagEnabled, flagState.isFetched, paidMembershipsEnabled, router]);

  useEffect(() => {
    let cancelled = false;
    if (!flagState.isFetched || !flagEnabled || !paidMembershipsEnabled) return;
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
          id: p.id,
          handle: p.handle ?? null,
          displayName: p.displayName ?? null,
        });
        const list = await api.personaTiers.listOwnerTiers(p.id, { includeHidden: true });
        if (cancelled) return;
        setTiers(list.tiers);
        setForms(Object.fromEntries(list.tiers.map((t) => [t.id, tierToFormValues(t)])));
      } catch (err) {
        if (!cancelled) toast.error('Could not load tiers.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [flagEnabled, flagState.isFetched, paidMembershipsEnabled, router]);

  const dirtyTierIds = useMemo(() => {
    return tiers
      .filter((t) => {
        const v = forms[t.id];
        if (!v) return false;
        const baseline = tierToFormValues(t);
        return (
          baseline.name !== v.name ||
          baseline.description !== v.description ||
          baseline.priceCents !== v.priceCents ||
          baseline.msgThreadsPerPeriod !== v.msgThreadsPerPeriod ||
          baseline.replyPolicy !== v.replyPolicy ||
          baseline.creatorCanInitiateDm !== v.creatorCanInitiateDm
        );
      })
      .map((t) => t.id);
  }, [tiers, forms]);

  const stripeMissing = useMemo(() => (
    tiers.some((t) => t.rank > 1 && t.status !== 'archived' && !t.stripePriceId)
  ), [tiers]);

  async function handleSave() {
    if (saving || !persona || dirtyTierIds.length === 0) return;
    setSaving(true);
    try {
      const updated = await Promise.all(dirtyTierIds.map((tid) => {
        const v = forms[tid];
        return api.personaTiers.updateTier(persona.id, tid, {
          name: v.name,
          description: v.description,
          price_cents: v.priceCents,
          msg_threads_per_period: v.msgThreadsPerPeriod,
          reply_policy: v.replyPolicy,
          creator_can_initiate_dm: v.creatorCanInitiateDm,
        });
      }));
      // Merge updated tiers back into local state.
      const byId = new Map(updated.map((r) => [r.tier.id, r.tier]));
      setTiers((prev) => prev.map((t) => byId.get(t.id) ?? t));
      setForms((prev) => {
        const next = { ...prev };
        for (const t of updated) {
          next[t.tier.id] = tierToFormValues(t.tier);
        }
        return next;
      });
      toast.success(`Saved ${updated.length} tier${updated.length === 1 ? '' : 's'}.`);
    } catch (err) {
      toast.error('Could not save tier changes.');
    } finally {
      setSaving(false);
    }
  }

  if (!flagState.isFetched || !flagEnabled || !paidMembershipsEnabled || loading || !persona) {
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
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-app">Tier ladder</h1>
            <p className="text-sm text-app-secondary">
              Rename, reprice, or hide each tier. Rank&nbsp;1 stays free for everyone.
            </p>
          </div>
          <Link
            href="/app/audience"
            className="text-sm text-teal-700 hover:underline"
          >
            ← Back to dashboard
          </Link>
        </header>

        {stripeMissing ? (
          <div
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            Connect your Stripe account in step&nbsp;3 of setup to start
            accepting paid memberships. Until then, free Follower works
            and paid tiers are saved as drafts.{' '}
            <Link href="/app/audience/setup?step=3" className="font-medium underline">
              Go to setup
            </Link>
          </div>
        ) : null}

        <div className="space-y-4">
          {tiers
            .filter((t) => t.status !== 'archived')
            .sort((a, b) => a.rank - b.rank)
            .map((tier) => (
              <TierEditor
                key={tier.id}
                tier={tier}
                values={forms[tier.id] ?? tierToFormValues(tier)}
                onChange={(next) => setForms((prev) => ({ ...prev, [tier.id]: next }))}
                disabled={saving}
              />
            ))}
        </div>

        <footer className="sticky bottom-0 -mx-6 border-t border-app-strong bg-app/95 px-6 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-sm text-app-secondary">
              {dirtyTierIds.length === 0
                ? 'No unsaved changes'
                : `${dirtyTierIds.length} tier${dirtyTierIds.length === 1 ? '' : 's'} changed`}
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || dirtyTierIds.length === 0}
              className="rounded-md bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
