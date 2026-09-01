'use client';

// Fan's membership management page. Audience Profile design v2 §11.6:
//   - Header: tier name, renewal date, price.
//   - Change tier (modal with tier picker).
//   - Cancel (confirmation modal with period-end disclosure — no
//     retention dark-pattern).
//   - "Inbox" link → /app/audience/membership/[personaId]/inbox
//     (P1.12).
//   - Refund-request CTA surfaces here for SLA-missed threads.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { FanMembershipPayload, PublicTier } from '@pantopus/api';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';
import { AudienceZoneHeader } from '@/components/AudienceZoneHeader';
import { toast } from '@/components/ui/toast-store';
import { webFeatureFlags } from '@/lib/featureFlags';

export default function FanMembershipPage() {
  const router = useRouter();
  const params = useParams<{ personaId: string }>();
  const personaId = String(params?.personaId || '');
  const flagState = useFeatureFlagState('audience_profile');
  const paidMembershipsEnabled = webFeatureFlags.personaPaidMemberships;

  const [membership, setMembership] = useState<FanMembershipPayload | null>(null);
  const [tiers, setTiers] = useState<PublicTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierPickerOpen, setTierPickerOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!flagState.isFetched) return;
    if (!flagState.enabled) router.replace('/app/persona');
    else if (!paidMembershipsEnabled) router.replace('/app/audience');
  }, [flagState.isFetched, flagState.enabled, paidMembershipsEnabled, router]);

  async function refresh() {
    if (!personaId) return;
    try {
      const res = await api.personaMembership.getMyMembership(personaId);
      setMembership(res.membership);
      // Fetch the public tier ladder so the change-tier modal has
      // something to render. listPublicTiers needs the persona's
      // handle, which the membership response carries.
      if (res.membership?.persona?.handle) {
        try {
          const list = await api.personaTiers.listPublicTiers(res.membership.persona.handle);
          setTiers(list.tiers);
        } catch {
          /* tier list is non-blocking */
        }
      }
    } catch {
      toast.error('Could not load your membership.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!flagState.isFetched || !flagState.enabled || !paidMembershipsEnabled || !personaId) return;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // refresh closes over personaId; refetch when that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagState.isFetched, flagState.enabled, paidMembershipsEnabled, personaId]);

  const currentRank = membership?.tier.rank ?? 0;
  const isTerminal = membership?.status === 'expired' || membership?.status === 'canceled';
  const renewLabel = useMemo(() => {
    if (!membership?.currentPeriodEnd) return null;
    return new Date(membership.currentPeriodEnd).toLocaleDateString();
  }, [membership]);

  async function changeTier(targetRank: number) {
    if (!membership || busy || targetRank === currentRank) return;
    setBusy(true);
    try {
      if (targetRank > currentRank) {
        await api.personaMembership.upgradeMembership(personaId, targetRank);
        toast.success('Tier upgraded.');
      } else {
        await api.personaMembership.downgradeMembership(personaId, targetRank);
        toast.success('Downgrade scheduled — takes effect at the end of this period.');
      }
      setTierPickerOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change tier.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelMembership() {
    if (!membership || busy) return;
    setBusy(true);
    try {
      await api.personaMembership.cancelMembership(personaId);
      toast.success('Cancellation scheduled. You keep access until your period ends.');
      setCancelOpen(false);
      await refresh();
    } catch {
      toast.error('Could not cancel.');
    } finally {
      setBusy(false);
    }
  }

  if (!flagState.isFetched || !flagState.enabled || !paidMembershipsEnabled || loading || !membership) {
    return (
      <div className="min-h-screen bg-app">
        <AudienceZoneHeader />
        <main className="mx-auto max-w-2xl p-6 text-app-secondary" aria-busy={loading}>
          {loading ? 'Loading…' : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      <AudienceZoneHeader handle={membership.persona.handle} displayName={membership.persona.displayName} />
      <main className="mx-auto max-w-2xl space-y-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold text-app">
            {membership.tier.name} · @{membership.persona.handle}
          </h1>
          <p className="mt-1 text-sm text-app-secondary">
            ${(membership.tier.priceCents / 100).toFixed(0)}/mo
            {renewLabel ? ` · renews ${renewLabel}` : ''}
          </p>
        </header>

        {membership.cancelAtPeriodEnd ? (
          <div
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            Cancellation pending. You keep {membership.tier.name} access until{' '}
            <strong>{renewLabel}</strong>.
          </div>
        ) : null}

        {isTerminal ? (
          <div
            role="status"
            className="rounded-md border border-app-strong bg-surface px-4 py-3 text-sm text-app-secondary"
          >
            This membership is no longer available. Any eligible refund has
            been processed.
          </div>
        ) : null}

        {membership.scheduledTierChange ? (
          <div
            role="status"
            className="rounded-md border border-teal-300 bg-teal-50 px-4 py-3 text-sm text-teal-900"
          >
            A tier change is scheduled to take effect on{' '}
            <strong>{renewLabel}</strong>.
          </div>
        ) : null}

        <section className="rounded-lg border border-app-strong bg-surface p-4">
          <h2 className="text-base font-semibold text-app">Inbox</h2>
          <p className="mt-1 text-sm text-app-secondary">
            DM the creator. Each new thread uses one of your monthly
            message credits.
          </p>
          <Link
            href={`/app/audience/membership/${personaId}/inbox`}
            className="mt-3 inline-flex rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Open inbox
          </Link>
          <p className="mt-2 text-xs text-app-secondary">
            {membership.quotaRemaining.msgThreads != null
              ? `${membership.quotaRemaining.msgThreads} message thread${
                  membership.quotaRemaining.msgThreads === 1 ? '' : 's'
                } left this period.`
              : 'No messaging on this tier — upgrade to send a DM.'}
          </p>
        </section>

        {!isTerminal ? (
        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setTierPickerOpen(true)}
            disabled={busy}
            className="rounded-md border border-app-strong bg-surface px-4 py-2 text-sm font-medium text-app hover:bg-app/30"
          >
            Change tier
          </button>
          {!membership.cancelAtPeriodEnd ? (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              disabled={busy}
              className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
            >
              Cancel membership
            </button>
          ) : null}
        </section>
        ) : null}

        {tierPickerOpen ? (
          <ConfirmModal
            title="Change tier"
            body={
              <ul className="space-y-2">
                {tiers
                  .filter((t) => t.rank !== currentRank)
                  .map((t) => {
                    const direction = t.rank > currentRank ? 'Upgrade' : 'Downgrade';
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => changeTier(t.rank)}
                          disabled={busy}
                          className="flex w-full items-center justify-between rounded-md border border-app-strong bg-surface px-3 py-2 text-left text-sm hover:bg-app/30"
                        >
                          <span>
                            <strong className="block text-app">{t.name}</strong>
                            <span className="text-xs text-app-secondary">
                              ${(t.priceCents / 100).toFixed(0)}/mo
                            </span>
                          </span>
                          <span className="text-xs font-medium text-teal-700">
                            {direction}
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            }
            cancelLabel="Cancel"
            onCancel={() => setTierPickerOpen(false)}
          />
        ) : null}

        {cancelOpen ? (
          <ConfirmModal
            title="Cancel membership?"
            body={
              <p>
                You&rsquo;ll keep {membership.tier.name} access until{' '}
                <strong>{renewLabel}</strong>. After that, your access
                ends. No partial refund — you paid for this period.
              </p>
            }
            confirmLabel={busy ? 'Cancelling…' : 'Yes, cancel at period end'}
            cancelLabel="Keep my membership"
            onConfirm={cancelMembership}
            onCancel={() => setCancelOpen(false)}
          />
        ) : null}
      </main>
    </div>
  );
}

function ConfirmModal({
  title, body, confirmLabel, cancelLabel, onConfirm, onCancel,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel: string;
  onConfirm?: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="max-w-md rounded-lg bg-surface p-5 shadow-lg">
        <h2 className="text-base font-semibold text-app">{title}</h2>
        <div className="mt-3 text-sm text-app-secondary">{body}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-app-strong px-4 py-2 text-sm text-app hover:bg-app/30"
          >
            {cancelLabel}
          </button>
          {confirmLabel && onConfirm ? (
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              {confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
