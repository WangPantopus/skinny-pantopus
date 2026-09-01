'use client';

/**
 * /app/settings/security — "Where you're logged in".
 *
 * Persistent login & trusted devices (docs/persistent-login/CONTRACT.md):
 *   - GET  /api/auth/devices            → devices + web sessions + recent events
 *   - DELETE /api/auth/devices/:id      → step-up `revoke_device`
 *   - POST /api/auth/sessions/revoke-others / revoke-all → step-up `revoke_sessions`
 *   - GET/PATCH /api/auth/security-prefs → PATCH needs step-up `change_security_prefs`
 *   - GET  /api/auth/security-events
 *
 * Every step-up-gated action opens the password modal, obtains a 5-minute
 * purpose-bound token and sends it as `X-Step-Up`. Cookie transport + CSRF are
 * handled by the shared client.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Globe,
  Laptop,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import * as api from '@pantopus/api';
import {
  authDevices,
  clearAuthToken,
  getAuthToken,
  type AuthDeviceSummary,
  type AuthSecurityEvent,
  type AuthSessionSummary,
  type SecurityPrefs,
} from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import StepUpPasswordModal, { type StepUpRequest } from '@/components/settings/StepUpPasswordModal';
import {
  describeSession,
  formatRelativeTime,
  isSecurityAlertEvent,
  platformLabel,
  securityEventLabel,
  summarizeEventMeta,
  trustLevelLabel,
} from '@/lib/securityActivity';

type PendingStepUp = { request: StepUpRequest; resolve: (token: string | null) => void };

function errorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { message?: unknown } | null | undefined;
  return typeof anyErr?.message === 'string' && anyErr.message ? anyErr.message : fallback;
}

export default function SecuritySettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [devices, setDevices] = useState<AuthDeviceSummary[]>([]);
  const [sessions, setSessions] = useState<AuthSessionSummary[]>([]);
  const [events, setEvents] = useState<AuthSecurityEvent[]>([]);
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [prefs, setPrefs] = useState<SecurityPrefs | null>(null);
  const [draftPrefs, setDraftPrefs] = useState<SecurityPrefs | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingStepUp, setPendingStepUp] = useState<PendingStepUp | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      if (!getAuthToken()) {
        router.push('/login?redirectTo=%2Fapp%2Fsettings%2Fsecurity');
        return;
      }
      const [devicesRes, prefsRes, methodsRes] = await Promise.allSettled([
        authDevices.getDevices(),
        authDevices.getSecurityPrefs(),
        api.auth.getAuthMethods(),
      ]);

      if (devicesRes.status === 'fulfilled') {
        setDevices(devicesRes.value.devices);
        setSessions(devicesRes.value.sessions);
        setEvents(devicesRes.value.events);
      } else {
        setLoadError(errorMessage(devicesRes.reason, 'Could not load your devices.'));
      }
      if (prefsRes.status === 'fulfilled') {
        setPrefs(prefsRes.value);
        setDraftPrefs(prefsRes.value);
      }
      if (methodsRes.status === 'fulfilled') {
        setHasPassword(Boolean(methodsRes.value?.hasPassword));
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---------- step-up plumbing ----------
  const requestStepUp = useCallback(
    (request: StepUpRequest) =>
      new Promise<string | null>((resolve) => {
        setPendingStepUp({ request, resolve });
      }),
    [],
  );

  const resolveStepUp = useCallback(
    (token: string | null) => {
      pendingStepUp?.resolve(token);
      setPendingStepUp(null);
    },
    [pendingStepUp],
  );

  /** Ask for step-up, then run `action(token)`. Returns true on success. */
  const runWithStepUp = useCallback(
    async (key: string, request: StepUpRequest, action: (token: string) => Promise<void>): Promise<boolean> => {
      const token = await requestStepUp(request);
      if (!token) return false;
      setBusy(key);
      try {
        await action(token);
        return true;
      } catch (err: unknown) {
        if (authDevices.isStepUpRequired(err)) {
          toast.error('Your confirmation expired. Please try again.');
        } else {
          toast.error(errorMessage(err, 'Something went wrong. Please try again.'));
        }
        return false;
      } finally {
        setBusy(null);
      }
    },
    [requestStepUp],
  );

  // ---------- actions ----------
  const handleRemoveDevice = async (device: AuthDeviceSummary) => {
    const label = device.name || device.model || platformLabel(device.platform);
    const ok = await runWithStepUp(
      `device:${device.id}`,
      {
        purpose: 'revoke_device',
        title: `Remove ${label}?`,
        description: 'That device will be signed out immediately and will need a full sign-in to come back.',
        confirmLabel: 'Remove device',
        destructive: true,
      },
      async (token) => {
        await authDevices.revokeDevice(device.id, token);
      },
    );
    if (ok) {
      toast.success(`${label} removed`);
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
      void load();
    }
  };

  const otherSessionCount = useMemo(() => {
    const otherSessions = sessions.filter((s) => !s.isCurrent).length;
    const otherDevices = devices.filter((d) => !d.isCurrent).length;
    return otherSessions + otherDevices;
  }, [sessions, devices]);

  const handleSignOutOthers = async () => {
    const ok = await runWithStepUp(
      'revoke-others',
      {
        purpose: 'revoke_sessions',
        title: 'Sign out of all other devices?',
        description: 'Every other browser and phone will be signed out. This browser stays signed in.',
        confirmLabel: 'Sign out others',
        destructive: true,
      },
      async (token) => {
        const res = await authDevices.revokeOtherSessions(token);
        toast.success(
          typeof res?.revoked === 'number'
            ? `Signed out of ${res.revoked} other session${res.revoked === 1 ? '' : 's'}`
            : 'Signed out of all other devices',
        );
      },
    );
    if (ok) void load();
  };

  const handleSignOutEverywhere = async () => {
    const ok = await runWithStepUp(
      'revoke-all',
      {
        purpose: 'revoke_sessions',
        title: 'Sign out everywhere?',
        description:
          'Every device — including this browser — will be signed out and any saved one-tap restore will be cancelled. You will need to sign in again.',
        confirmLabel: 'Sign out everywhere',
        destructive: true,
      },
      async (token) => {
        await authDevices.revokeAllSessions(token);
      },
    );
    if (!ok) return;
    // Server-side everything is dead now; clear our cookies + local state and leave.
    try {
      await api.auth.logout();
    } catch {
      /* cookies are already invalid server-side */
    }
    clearAuthToken();
    toast.success('Signed out everywhere');
    router.push('/login');
  };

  const prefsDirty =
    Boolean(prefs && draftPrefs) &&
    (prefs!.allowRestoreGrants !== draftPrefs!.allowRestoreGrants || prefs!.newDeviceEmail !== draftPrefs!.newDeviceEmail);

  const handleSavePrefs = async () => {
    if (!draftPrefs || !prefsDirty) return;
    const next = draftPrefs;
    const ok = await runWithStepUp(
      'prefs',
      {
        purpose: 'change_security_prefs',
        title: 'Update security preferences?',
        description: 'Confirm your password to change how your account handles new devices and reinstalls.',
        confirmLabel: 'Save preferences',
      },
      async (token) => {
        const saved = await authDevices.updateSecurityPrefs(next, token);
        setPrefs(saved);
        setDraftPrefs(saved);
      },
    );
    if (ok) toast.success('Security preferences saved');
  };

  const handleShowMoreEvents = async () => {
    setBusy('events');
    try {
      const res = await authDevices.getSecurityEvents(50);
      setEvents(res.events);
      setEventsExpanded(true);
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Could not load security activity'));
    } finally {
      setBusy(null);
    }
  };

  // ---------- render ----------
  if (loading) {
    return (
      <div className="bg-app min-h-screen">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
              <p className="mt-4 text-app-secondary">Loading security settings…</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const currentSession = sessions.find((s) => s.isCurrent) || null;
  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const sortedDevices = [...devices].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  const visibleEvents = eventsExpanded ? events : events.slice(0, 10);

  return (
    <div className="bg-app min-h-screen">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/app/profile/settings')}
            className="p-1.5 hover-bg-app rounded-lg transition"
            aria-label="Back to settings"
          >
            <ArrowLeft className="w-5 h-5 text-app" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-app">Security</h1>
            <p className="text-sm text-app-secondary">Where you&apos;re logged in, trusted devices and recent activity.</p>
          </div>
          <button
            onClick={() => void load()}
            className="ml-auto p-2 hover-bg-app rounded-lg transition text-app-muted"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loadError && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">Could not load your devices</p>
              <p className="text-sm text-amber-800">{loadError}</p>
            </div>
            <button
              onClick={() => void load()}
              className="text-sm font-medium text-amber-900 underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        <div className="space-y-6">
          {/* Where you're logged in */}
          <section className="bg-surface rounded-xl border border-app p-6" aria-labelledby="sec-devices">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 id="sec-devices" className="text-lg font-semibold text-app">
                  Where you&apos;re logged in
                </h2>
                <p className="text-sm text-app-secondary">
                  Phones with the Pantopus app and browsers with an active session. Remove anything you don&apos;t recognise.
                </p>
              </div>
            </div>

            <ul className="divide-y divide-app-border-subtle" data-testid="session-list">
              {/* Current browser first */}
              {currentSession && (
                <SessionRow key={currentSession.id} session={currentSession} current />
              )}

              {sortedDevices.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  removing={busy === `device:${device.id}`}
                  onRemove={() => void handleRemoveDevice(device)}
                />
              ))}

              {otherSessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}

              {!currentSession && sortedDevices.length === 0 && otherSessions.length === 0 && !loadError && (
                <li className="py-6 text-center text-sm text-app-secondary">
                  No other sessions yet. When you sign in on a phone it will show up here.
                </li>
              )}
            </ul>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => void handleSignOutOthers()}
                disabled={busy !== null || (!loadError && otherSessionCount === 0)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-app-strong text-app-strong rounded-lg hover-bg-app font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="w-4 h-4" />
                {busy === 'revoke-others' ? 'Signing out…' : 'Sign out of all other devices'}
              </button>
              <button
                onClick={() => void handleSignOutEverywhere()}
                disabled={busy !== null}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShieldAlert className="w-4 h-4" />
                {busy === 'revoke-all' ? 'Signing out…' : 'Sign out everywhere'}
              </button>
            </div>
            <p className="mt-2 text-xs text-app-muted">
              Both actions ask for your password. &ldquo;Sign out everywhere&rdquo; also signs out this browser and cancels
              one-tap restore on your phones.
            </p>
          </section>

          {/* Security preferences */}
          <section className="bg-surface rounded-xl border border-app p-6" aria-labelledby="sec-prefs">
            <h2 id="sec-prefs" className="text-lg font-semibold text-app mb-1">
              Security preferences
            </h2>
            <p className="text-sm text-app-secondary mb-4">Changes are confirmed with your password.</p>
            {draftPrefs ? (
              <div className="space-y-1">
                <ToggleRow
                  label="Email me when a new device signs in"
                  description="Get an email whenever your account is used from a phone or browser we haven't seen before."
                  checked={draftPrefs.newDeviceEmail}
                  onChange={(v) => setDraftPrefs((p) => (p ? { ...p, newDeviceEmail: v } : p))}
                />
                <ToggleRow
                  label="Allow one-tap restore after reinstall (Android)"
                  description="Lets the Android app offer “Continue as you” behind your fingerprint or screen lock after you reinstall it. Turning this off cancels existing restore grants."
                  checked={draftPrefs.allowRestoreGrants}
                  onChange={(v) => setDraftPrefs((p) => (p ? { ...p, allowRestoreGrants: v } : p))}
                />
                <div className="pt-4">
                  <button
                    onClick={() => void handleSavePrefs()}
                    disabled={!prefsDirty || busy !== null}
                    className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy === 'prefs' ? 'Saving…' : 'Save preferences'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-app-secondary">Preferences are unavailable right now.</p>
            )}
          </section>

          {/* Recent security activity */}
          <section className="bg-surface rounded-xl border border-app p-6" aria-labelledby="sec-events">
            <h2 id="sec-events" className="text-lg font-semibold text-app mb-1">
              Recent security activity
            </h2>
            <p className="text-sm text-app-secondary mb-4">Sign-ins, sign-outs, password changes and anything we blocked.</p>
            {visibleEvents.length === 0 ? (
              <p className="text-sm text-app-secondary py-4 text-center">No security activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-app-border-subtle" data-testid="event-list">
                {visibleEvents.map((ev) => {
                  const alert = isSecurityAlertEvent(ev);
                  const meta = summarizeEventMeta(ev);
                  return (
                    <li key={String(ev.id)} className="py-3 flex items-start gap-3">
                      <div
                        className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          alert ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        {alert ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-app">{securityEventLabel(ev.type)}</p>
                        {meta && <p className="text-xs text-app-secondary truncate">{meta}</p>}
                      </div>
                      <time className="text-xs text-app-muted whitespace-nowrap" dateTime={ev.createdAt}>
                        {formatRelativeTime(ev.createdAt)}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
            {!eventsExpanded && (events.length > 10 || events.length >= 20) && (
              <button
                onClick={() => void handleShowMoreEvents()}
                disabled={busy !== null}
                className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
              >
                {busy === 'events' ? 'Loading…' : 'Show more'}
              </button>
            )}
          </section>
        </div>
      </main>

      <StepUpPasswordModal
        request={pendingStepUp?.request ?? null}
        hasPassword={hasPassword}
        onResolve={resolveStepUp}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

function PlatformIcon({ platform }: { platform: string | null | undefined }) {
  const p = (platform || '').toLowerCase();
  if (p === 'ios' || p === 'android') return <Smartphone className="w-5 h-5" />;
  if (p === 'web') return <Globe className="w-5 h-5" />;
  return <MonitorSmartphone className="w-5 h-5" />;
}

function CurrentBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
      This device
    </span>
  );
}

function DeviceRow({
  device,
  removing,
  onRemove,
}: {
  device: AuthDeviceSummary;
  removing: boolean;
  onRemove: () => void;
}) {
  const trust = trustLevelLabel(device.trustLevel);
  const trustClass =
    trust.tone === 'ok'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : trust.tone === 'warn'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-surface-muted text-app-secondary border-app';
  const title = device.name || device.model || platformLabel(device.platform);
  const subtitleParts = [
    platformLabel(device.platform),
    device.model && device.model !== device.name ? device.model : null,
    device.osVersion ? `OS ${device.osVersion}` : null,
    device.appVersion ? `App ${device.appVersion}` : null,
  ].filter(Boolean);

  return (
    <li className="py-4 flex items-start gap-4" data-testid={`device-${device.id}`}>
      <div className="mt-0.5 w-10 h-10 rounded-full bg-surface-muted text-app-secondary flex items-center justify-center flex-shrink-0">
        <PlatformIcon platform={device.platform} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-app flex items-center flex-wrap">
          <span className="truncate">{title}</span>
          {device.isCurrent && <CurrentBadge />}
          <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${trustClass}`}>
            {trust.label}
          </span>
        </p>
        <p className="text-sm text-app-secondary truncate">{subtitleParts.join(' · ')}</p>
        <p className="text-xs text-app-muted">
          Last active {formatRelativeTime(device.lastSeenAt)}
          {device.lastIp ? ` · ${device.lastIp}` : ''}
          {device.trustedAt ? ` · trusted since ${formatRelativeTime(device.trustedAt)}` : ''}
        </p>
      </div>
      {!device.isCurrent && (
        <button
          onClick={onRemove}
          disabled={removing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
          aria-label={`Remove ${title}`}
        >
          <Trash2 className="w-4 h-4" />
          {removing ? 'Removing…' : 'Remove'}
        </button>
      )}
    </li>
  );
}

function SessionRow({ session, current = false }: { session: AuthSessionSummary; current?: boolean }) {
  const isWeb = !session.platform || session.platform === 'web';
  return (
    <li className="py-4 flex items-start gap-4" data-testid={`session-${session.id}`}>
      <div className="mt-0.5 w-10 h-10 rounded-full bg-surface-muted text-app-secondary flex items-center justify-center flex-shrink-0">
        {isWeb ? <Laptop className="w-5 h-5" /> : <PlatformIcon platform={session.platform} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-app flex items-center flex-wrap">
          <span className="truncate">{describeSession(session)}</span>
          {(current || session.isCurrent) && <CurrentBadge />}
        </p>
        <p className="text-xs text-app-muted">
          {current || session.isCurrent ? 'Active now' : `Last active ${formatRelativeTime(session.lastSeenAt)}`}
          {' · '}signed in {formatRelativeTime(session.issuedAt)}
        </p>
      </div>
    </li>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-app last:border-0 gap-4">
      <div className="flex-1">
        <p className="font-medium text-app">{label}</p>
        <p className="text-sm text-app-secondary">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          checked ? 'bg-primary-600' : 'bg-surface-muted'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-app-surface shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
