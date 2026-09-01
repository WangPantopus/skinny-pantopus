'use client';

// Tier setup wizard. Audience Profile design v2 §11.1 (creator publish
// flow) + §11.2 (enable paid tiers). Three steps:
//   1. Identity — links out to the existing persona-creation flow when
//      the user has no persona; otherwise auto-skips.
//   2. Tiers — same UI as /app/audience/manage/tiers but in wizard
//      chrome. Save advances to step 3.
//   3. Stripe Connect — placeholder; P1.7 fills this in.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = {
  1: 'Profile basics',
  2: 'Tiers',
  3: 'Stripe Connect',
};

interface PersonaShape {
  id: string;
  handle: string | null;
  displayName: string | null;
}

export default function AudienceSetupPage() {
  const router = useRouter();
  const params = useSearchParams();
  const flagState = useFeatureFlagState('audience_profile');
  const flagEnabled = flagState.enabled;
  const paidMembershipsEnabled = webFeatureFlags.personaPaidMemberships;

  const initialStep = (() => {
    const raw = Number(params.get('step'));
    if (!paidMembershipsEnabled) return 1;
    return raw === 1 || raw === 2 || raw === 3 ? (raw as Step) : 1;
  })();
  const [step, setStep] = useState<Step>(initialStep);

  const [persona, setPersona] = useState<PersonaShape | null>(null);
  const [tiers, setTiers] = useState<OwnerTier[]>([]);
  const [forms, setForms] = useState<Record<string, TierFormValues>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (flagState.isFetched && !flagEnabled) router.replace('/app/persona');
  }, [flagEnabled, flagState.isFetched, router]);

  useEffect(() => {
    let cancelled = false;
    if (!flagState.isFetched || !flagEnabled) return;
    (async () => {
      try {
        const me = await api.personas.getMyPersona();
        if (cancelled) return;
        if (!me?.persona) {
          // No persona yet — wizard parks on Step 1 (which links to
          // /app/persona for the existing creation flow). Once that flow
          // returns, the user lands back here at Step 2.
          setPersona(null);
          setLoading(false);
          return;
        }
        const p = me.persona;
        setPersona({
          id: p.id,
          handle: p.handle ?? null,
          displayName: p.displayName ?? null,
        });
        if (paidMembershipsEnabled) {
          const list = await api.personaTiers.listOwnerTiers(p.id, { includeHidden: true });
          if (cancelled) return;
          setTiers(list.tiers);
          setForms(Object.fromEntries(list.tiers.map((t) => [t.id, tierToFormValues(t)])));
          // If we landed on Step 1 but a persona already exists, jump to Step 2.
          if (initialStep === 1) setStep(2);
        } else {
          setTiers([]);
          setForms({});
          setStep(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // initialStep is captured once; do not include it in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagEnabled, flagState.isFetched, paidMembershipsEnabled]);

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

  async function handleSaveAndAdvance() {
    if (saving || !persona) return;
    setSaving(true);
    try {
      if (dirtyTierIds.length > 0) {
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
        const byId = new Map(updated.map((r) => [r.tier.id, r.tier]));
        setTiers((prev) => prev.map((t) => byId.get(t.id) ?? t));
        setForms((prev) => {
          const next = { ...prev };
          for (const t of updated) next[t.tier.id] = tierToFormValues(t.tier);
          return next;
        });
      }
      setStep(3);
    } catch {
      toast.error('Could not save tier changes.');
    } finally {
      setSaving(false);
    }
  }

  if (!flagState.isFetched || !flagEnabled || loading) {
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
      <AudienceZoneHeader handle={persona?.handle} displayName={persona?.displayName} />
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <header className="space-y-3">
          <h1 className="text-xl font-semibold text-app">Set up your Beacon</h1>
          {paidMembershipsEnabled ? (
            <Stepper step={step} setStep={setStep} hasPersona={!!persona} />
          ) : null}
        </header>

        {step === 1 ? (
          <StepIdentity
            persona={persona}
            paidMembershipsEnabled={paidMembershipsEnabled}
            onContinue={() => setStep(2)}
          />
        ) : step === 2 ? (
          <StepTiers
            tiers={tiers.filter((t) => t.status !== 'archived').sort((a, b) => a.rank - b.rank)}
            forms={forms}
            onChange={(id, next) => setForms((prev) => ({ ...prev, [id]: next }))}
            saving={saving}
            onContinue={handleSaveAndAdvance}
            dirtyCount={dirtyTierIds.length}
          />
        ) : (
          <StepStripe persona={persona} />
        )}
      </main>
    </div>
  );
}

function Stepper({ step, setStep, hasPersona }: {
  step: Step; setStep: (s: Step) => void; hasPersona: boolean;
}) {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Setup progress">
      {([1, 2, 3] as Step[]).map((n) => {
        const reachable = n === 1 || (n === 2 && hasPersona) || (n === 3 && hasPersona);
        const isActive = step === n;
        return (
          <li key={n} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => reachable && setStep(n)}
              disabled={!reachable}
              aria-current={isActive ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-1 ${
                isActive
                  ? 'bg-teal-600 text-white'
                  : reachable
                    ? 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                    : 'bg-app/50 text-app-secondary'
              }`}
            >
              <span className="font-mono text-xs">{n}</span>
              <span>{STEP_TITLES[n]}</span>
            </button>
            {n < 3 ? <span className="text-app-secondary">→</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function StepIdentity({ persona, paidMembershipsEnabled, onContinue }: {
  persona: PersonaShape | null;
  paidMembershipsEnabled: boolean;
  onContinue: () => void;
}) {
  if (persona) {
    return (
      <section
        aria-labelledby="step-1-heading"
        className="rounded-lg border border-app-strong bg-surface p-5"
      >
        <h2 id="step-1-heading" className="text-base font-semibold text-app">
          Profile is ready
        </h2>
        <p className="mt-2 text-sm text-app-secondary">
          @{persona.handle} is set up. You can post updates from your Beacon dashboard.
        </p>
        {paidMembershipsEnabled ? (
          <button
            type="button"
            onClick={onContinue}
            className="mt-4 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Continue to tiers
          </button>
        ) : (
          <Link
            href="/app/audience"
            className="mt-4 inline-flex rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Go to dashboard
          </Link>
        )}
      </section>
    );
  }
  return (
    <section
      aria-labelledby="step-1-heading"
      className="rounded-lg border border-app-strong bg-surface p-5"
    >
      <h2 id="step-1-heading" className="text-base font-semibold text-app">
        Pick a handle, name, and bio
      </h2>
      <p className="mt-2 text-sm text-app-secondary">
        Your Beacon is separate from your personal account. People who
        follow you here never see your real name, neighborhood, or personal
        profile.
      </p>
      <Link
        href="/app/persona"
        className="mt-4 inline-flex rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
      >
        Open profile setup
      </Link>
      <p className="mt-2 text-xs text-app-secondary">
        Once you publish, return to the Beacon dashboard to post updates.
      </p>
    </section>
  );
}

function StepTiers({
  tiers, forms, onChange, saving, onContinue, dirtyCount,
}: {
  tiers: OwnerTier[];
  forms: Record<string, TierFormValues>;
  onChange: (id: string, v: TierFormValues) => void;
  saving: boolean;
  onContinue: () => void;
  dirtyCount: number;
}) {
  return (
    <section aria-labelledby="step-2-heading" className="space-y-4">
      <h2 id="step-2-heading" className="text-base font-semibold text-app">
        Configure your tiers
      </h2>
      <p className="text-sm text-app-secondary">
        Three tiers come pre-filled. Rename or reprice each one. Free
        Follower stays free; paid tiers go live once Stripe is connected.
      </p>
      <div className="space-y-4">
        {tiers.map((tier) => (
          <TierEditor
            key={tier.id}
            tier={tier}
            values={forms[tier.id] ?? tierToFormValues(tier)}
            onChange={(next) => onChange(tier.id, next)}
            disabled={saving}
          />
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-app-strong pt-3">
        <p className="text-sm text-app-secondary">
          {dirtyCount === 0 ? 'No changes yet' : `${dirtyCount} tier${dirtyCount === 1 ? '' : 's'} changed`}
        </p>
        <button
          type="button"
          onClick={onContinue}
          disabled={saving}
          className="rounded-md bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : dirtyCount > 0 ? 'Save and continue' : 'Continue'}
        </button>
      </div>
    </section>
  );
}

// P1.7 — Stripe Connect onboarding step. Calls
// POST /api/personas/:id/payments/onboard to get a fresh Stripe-hosted
// onboarding URL, then navigates the same tab to it. Stripe redirects
// back to /app/audience/setup?step=stripe&done=1 after onboarding;
// when ?done=1 is present the component polls
// GET /api/personas/:id/payments/status until charges_enabled +
// details_submitted flip true (max ~10 attempts at 2s intervals).
function StepStripe({ persona }: { persona: PersonaShape | null }) {
  const params = useSearchParams();
  const justReturned = params.get('done') === '1';
  const [status, setStatus] = useState<{
    hasAccount: boolean;
    ready: boolean;
    chargesEnabled?: boolean;
    detailsSubmitted?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  // Initial status fetch.
  useEffect(() => {
    let cancelled = false;
    if (!persona) return;
    (async () => {
      try {
        const res = await api.personaPayments.getOnboardingStatus(persona.id);
        if (!cancelled) setStatus(res.status);
      } catch {
        if (!cancelled) setStatus({ hasAccount: false, ready: false });
      }
    })();
    return () => { cancelled = true; };
  }, [persona]);

  // Post-return polling: only when we just bounced back from Stripe.
  useEffect(() => {
    if (!justReturned || !persona || polling) return;
    let cancelled = false;
    setPolling(true);
    (async () => {
      for (let attempt = 0; attempt < 10 && !cancelled; attempt += 1) {
        try {
          const res = await api.personaPayments.getOnboardingStatus(persona.id);
          if (cancelled) return;
          setStatus(res.status);
          if (res.status?.ready) break;
        } catch {
          // ignore, retry
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setPolling(false);
    })();
    return () => { cancelled = true; };
  }, [justReturned, persona, polling]);

  async function handleStartOnboarding() {
    if (!persona || loading) return;
    setLoading(true);
    try {
      const { url } = await api.personaPayments.startOnboarding(persona.id);
      if (typeof window !== 'undefined') {
        window.location.assign(url);
      }
    } catch {
      toast.error('Could not start Stripe onboarding. Try again in a moment.');
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="step-3-heading"
      className="rounded-lg border border-app-strong bg-surface p-5"
    >
      <h2 id="step-3-heading" className="text-base font-semibold text-app">
        Stripe Connect
      </h2>
      <p className="mt-2 text-sm text-app-secondary">
        Connect a Stripe Express account to start accepting paid
        memberships. Stripe handles KYC, payouts, and tax forms.
      </p>

      {!status ? (
        <p className="mt-3 text-sm text-app-secondary" aria-busy>
          Checking your Stripe status…
        </p>
      ) : status.ready ? (
        <p
          className="mt-3 rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-sm text-teal-900"
          role="status"
        >
          Stripe is connected. Paid tiers will appear on your public
          profile within a few minutes.
        </p>
      ) : status.hasAccount ? (
        <p
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          {polling
            ? 'Verifying with Stripe…'
            : 'Stripe still needs more details from you.'}
          {' '}
          {status.chargesEnabled === false ? 'Card payments are not yet enabled. ' : ''}
          {status.detailsSubmitted === false ? 'Some required information is missing. ' : ''}
        </p>
      ) : (
        <p className="mt-3 text-sm text-app-secondary">
          You haven&rsquo;t started Stripe Connect yet.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleStartOnboarding}
          disabled={!persona || loading || polling || status?.ready}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status?.ready
            ? 'Stripe connected'
            : status?.hasAccount
              ? loading ? 'Opening Stripe…' : 'Continue Stripe onboarding'
              : loading ? 'Opening Stripe…' : 'Connect Stripe'}
        </button>
        <Link
          href="/app/audience"
          className="rounded-md border border-app-strong px-4 py-2 text-sm font-medium text-app hover:bg-surface"
        >
          {status?.ready ? 'Done — go to dashboard' : 'Skip for now'}
        </Link>
      </div>
    </section>
  );
}
