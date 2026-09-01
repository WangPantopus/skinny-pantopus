'use client';

// P1.8 — privacy-handshake first-follow screen.
//
// Audience Profile design v2 §11.4 (UX flow), §9.5 v1 (handshake
// rationale). The most important screen in the design: a fan confirms
// one global fan_handle, optionally an avatar, and acknowledges the
// platform-trust statement BEFORE they're allowed to follow or
// subscribe.
//
// Privacy invariants enforced here:
//   * The pre-filled fan_handle is fetched from the server's identity
//     endpoint — NEVER derived from User.username on the
//     client.
//   * Choosing the user's own Pantopus username requires an explicit
//     in-form confirmation (no implicit auto-derive).
//   * The platform-trust acknowledgement checkbox must be ticked
//     before Continue is enabled. The acknowledgement is part of the
//     screen — not a dismissible popup.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import type { AudienceProfile } from '@pantopus/types';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';
import { AudienceZoneHeader } from '@/components/AudienceZoneHeader';
import { toast } from '@/components/ui/toast-store';

interface MePayload {
  username: string | null;
}

export default function FollowHandshakePage() {
  const router = useRouter();
  const params = useParams<{ handle: string }>();
  const search = useSearchParams();
  const handle = String(params?.handle || '').replace(/^@/, '');
  const tierRank = (() => {
    const raw = Number(search.get('tier_rank'));
    return raw === 1 || raw === 2 || raw === 3 || raw === 4 ? raw : 1;
  })();

  const flagState = useFeatureFlagState('audience_profile');
  const flagEnabled = flagState.enabled;

  const [persona, setPersona] = useState<AudienceProfile | null>(null);
  const [me, setMe] = useState<MePayload | null>(null);
  const [fanHandle, setFanHandle] = useState('');
  const [identityLocked, setIdentityLocked] = useState(false);
  const [identitySource, setIdentitySource] = useState<string | null>(null);
  const [refreshingSuggestion, setRefreshingSuggestion] = useState(false);
  const [usePantopusUsername, setUsePantopusUsername] = useState(false);
  const [confirmUsernameOpen, setConfirmUsernameOpen] = useState(false);
  const [fanAvatarUrl, setFanAvatarUrl] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (flagState.isFetched && !flagEnabled) router.replace(`/@${handle}`);
  }, [flagEnabled, flagState.isFetched, handle, router]);

  // Fetch the persona, the viewer's username, and the initial fan_handle suggestion.
  useEffect(() => {
    let cancelled = false;
    if (!flagState.isFetched || !flagEnabled || !handle) return;
    (async () => {
      try {
        const [p, suggestion, viewer] = await Promise.all([
          api.personas.getPersona(handle).catch(() => null),
          api.personas.getFanHandleSuggestion(handle).catch(() => ({ suggestion: '', identity: null, locked: false })),
          // Some installations expose /users/me; fall back to null silently.
          (api as unknown as { users?: { getCurrent: () => Promise<{ username: string | null }> } })
            .users?.getCurrent?.()
            .catch(() => ({ username: null })) ?? Promise.resolve({ username: null }),
        ]);
        if (cancelled) return;
        setPersona(p?.persona ?? null);
        setFanHandle(suggestion?.suggestion ?? '');
        setIdentityLocked(!!suggestion?.locked);
        setIdentitySource(suggestion?.identity?.source ?? null);
        setMe({ username: viewer?.username ?? null });
      } catch {
        if (!cancelled) setSubmitError('Could not load this profile.');
      }
    })();
    return () => { cancelled = true; };
  }, [flagEnabled, flagState.isFetched, handle]);

  async function refreshSuggestion() {
    if (refreshingSuggestion || usePantopusUsername || identityLocked) return;
    setRefreshingSuggestion(true);
    try {
      const res = await api.personas.getFanHandleSuggestion(handle);
      setFanHandle(res.suggestion);
      setIdentityLocked(!!res.locked);
      setIdentitySource(res.identity?.source ?? null);
    } catch {
      toast.error('Could not refresh — try again.');
    } finally {
      setRefreshingSuggestion(false);
    }
  }

  function handleUsePantopusUsername() {
    if (identityLocked) return;
    if (!me?.username) {
      toast.info('Your Pantopus username is not available right now.');
      return;
    }
    setConfirmUsernameOpen(true);
  }

  function confirmUsePantopusUsername() {
    if (!me?.username) return;
    setFanHandle(me.username);
    setUsePantopusUsername(true);
    setConfirmUsernameOpen(false);
  }

  function cancelUsePantopusUsername() {
    setConfirmUsernameOpen(false);
  }

  function handleEditFanHandle(v: string) {
    if (identityLocked) return;
    setFanHandle(v);
    // Editing away from the username turns off the explicit-ack flag.
    if (usePantopusUsername && me?.username && v.toLowerCase() !== me.username.toLowerCase()) {
      setUsePantopusUsername(false);
    }
  }

  const tierLabel = useMemo(() => {
    if (tierRank === 1) return 'Follower';
    if (tierRank === 2) return 'Member';
    if (tierRank === 3) return 'Insider';
    return 'Direct';
  }, [tierRank]);

  const canSubmit = (
    !submitting
    && acknowledged
    && fanHandle.trim().length >= 3
    && /^[a-zA-Z0-9_.-]+$/.test(fanHandle.trim())
    && persona
  );
  const helperCopy = identityLocked
    ? identitySource === 'persona_bound'
      ? 'This matches your own Beacon profile.'
      : 'This fan name is already set.'
    : 'Use the suggestion or choose your own fan name.';

  async function onSubmit() {
    if (!persona || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.personas.followPersonaWithHandshake(persona.id, {
        tier_rank: tierRank,
        fan_handle: fanHandle.trim(),
        fan_display_name: fanHandle.trim(),
        fan_avatar_url: fanAvatarUrl.trim() || null,
        acknowledged_platform_trust: true,
        acknowledged_using_pantopus_username: usePantopusUsername || undefined,
      });

      if (res.requiresPayment) {
        if (res.subscribeUrl) {
          if (typeof window !== 'undefined') window.location.assign(res.subscribeUrl);
          return;
        }
        // P1.8 placeholder — Stripe Checkout lands in P1.9. Inform
        // the fan and route them back to the persona page so their
        // handshake choices aren't lost in flight.
        toast.info('Stripe Checkout is coming in the next release. Your handshake is saved.');
        router.push(`/@${handle}?handshake=pending`);
        return;
      }

      // Free Follower path.
      router.push(`/@${handle}?welcome=1`);
    } catch (err: unknown) {
      const msg = errorMessage(err);
      // Surface the most user-actionable backend codes.
      if (/fan_handle_taken/i.test(msg)) {
        setSubmitError('That fan name is already taken. Try refreshing the suggestion.');
      } else if (/persona_block_active/i.test(msg)) {
        setSubmitError('This profile cannot accept a new membership from your account at this time.');
      } else {
        setSubmitError('Something went wrong. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!flagState.isFetched || !flagEnabled || !persona) {
    return (
      <div className="min-h-screen bg-app">
        <AudienceZoneHeader />
        <main className="mx-auto max-w-xl p-6 text-app-secondary" aria-busy>
          Loading…
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      <AudienceZoneHeader handle={persona.handle} displayName={persona.displayName} />
      <main className="mx-auto max-w-xl space-y-6 p-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-app">
            Follow @{persona.handle} as a fan
          </h1>
          <p className="text-sm text-app-secondary">
            Choose the fan name Beacon creators see. It is separate from your
            Pantopus account — your real name, neighborhood, and personal
            profile stay private.
          </p>
          {tierRank > 1 ? (
            <p className="rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-sm text-teal-900">
              You&rsquo;re subscribing at the <strong>{tierLabel}</strong>{' '}
              tier. After this screen you&rsquo;ll be sent to Stripe to
              complete payment.
            </p>
          ) : null}
        </header>

        <section className="space-y-2">
          <label className="block text-sm font-medium text-app-strong" htmlFor="fan-handle">
            Your Beacon fan name
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id="fan-handle"
              type="text"
              value={fanHandle}
              onChange={(e) => handleEditFanHandle(e.target.value)}
              maxLength={40}
              minLength={3}
              pattern="[a-zA-Z0-9_.-]+"
              autoComplete="off"
              spellCheck={false}
              readOnly={identityLocked}
              className="min-w-0 flex-1 rounded-md border border-app-strong bg-surface px-3 py-2 text-app outline-none focus:ring-2 focus:ring-teal-500 read-only:opacity-80"
              aria-describedby="fan-handle-hint"
            />
            <button
              type="button"
              onClick={refreshSuggestion}
              disabled={refreshingSuggestion || usePantopusUsername || identityLocked}
              aria-label="Refresh suggestion"
              className="rounded-md border border-app-strong bg-surface px-3 py-2 text-sm text-app hover:bg-app/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshingSuggestion ? '…' : '↻'}
            </button>
          </div>
          <p id="fan-handle-hint" className="text-xs text-app-secondary">
            3-40 characters. Letters, numbers, underscore, dot, dash. {helperCopy}
          </p>
        </section>

        <section className="space-y-2">
          <label className="block text-sm font-medium text-app-strong" htmlFor="fan-avatar">
            Optional avatar (separate from your profile picture)
          </label>
          <input
            id="fan-avatar"
            type="url"
            placeholder="https://… (optional)"
            value={fanAvatarUrl}
            onChange={(e) => setFanAvatarUrl(e.target.value)}
            className="w-full rounded-md border border-app-strong bg-surface px-3 py-2 text-app outline-none focus:ring-2 focus:ring-teal-500"
          />
          <p className="text-xs text-app-secondary">
            Direct image upload lands in the next release. Until then,
            paste a URL or leave blank.
          </p>
        </section>

        <aside
          role="note"
          className="rounded-md border border-app-strong bg-surface p-4 text-sm text-app"
        >
          <p>
            <span aria-hidden className="mr-2">ⓘ</span>
            Pantopus will not connect your two sides for you. Other
            people may still figure it out from how you write or what
            you post — that&rsquo;s outside what we control.
          </p>
          <Link
            href="/help/audience-firewall"
            className="mt-2 inline-block text-teal-700 hover:underline"
          >
            What does this mean? →
          </Link>
        </aside>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1"
            aria-label="I understand the privacy disclosure"
          />
          <span className="text-app">I understand</span>
        </label>

        {submitError ? (
          <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-app-strong pt-4">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="rounded-md bg-teal-600 px-5 py-2 text-base font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? 'Saving…'
              : tierRank > 1
                ? 'Continue to subscribe →'
                : 'Continue →'}
          </button>
          <button
            type="button"
            onClick={handleUsePantopusUsername}
            disabled={submitting || identityLocked}
            className="text-sm text-app-secondary hover:text-app"
          >
            Use my Pantopus username instead
          </button>
        </div>

        {confirmUsernameOpen ? (
          <ConfirmDialog
            title="Use your Pantopus username?"
            body={
              <>
                Other people on Pantopus might recognize you from this
                handle. This is allowed but it makes the firewall more
                porous. You can keep the random name before continuing.
              </>
            }
            confirmLabel="Yes, use my username"
            cancelLabel="Keep the random one"
            onConfirm={confirmUsePantopusUsername}
            onCancel={cancelUsePantopusUsername}
          />
        ) : null}
      </main>
    </div>
  );
}

function ConfirmDialog({
  title, body, confirmLabel, cancelLabel, onConfirm, onCancel,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-username-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="max-w-md rounded-lg bg-surface p-5 shadow-lg">
        <h2 id="confirm-username-title" className="text-base font-semibold text-app">
          {title}
        </h2>
        <p className="mt-2 text-sm text-app-secondary">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-app-strong px-4 py-2 text-sm text-app hover:bg-app/30"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const maybeMsg = (err as { message?: unknown }).message;
    if (typeof maybeMsg === 'string') return maybeMsg;
  }
  return String(err);
}
