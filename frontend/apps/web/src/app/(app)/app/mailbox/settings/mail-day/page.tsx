'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { MailItemV2, MailDaySettings } from '@/types/mailbox';
import {
  useMailDaySummary,
  useMailDaySettings,
  useUpdateMailDaySettings,
} from '@/lib/mailbox-queries';

// ── Timezone list (common US + intl) ─────────────────────────

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

// ── Season helper ────────────────────────────────────────────

function getSeasonEmoji(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return '🌸';
  if (m >= 5 && m <= 7) return '☀️';
  if (m >= 8 && m <= 10) return '🍂';
  return '❄️';
}

// ── Type icon for mail type ──────────────────────────────────

function mailTypeIcon(item: MailItemV2): string {
  if (item.mail_object_type === 'package') return '📦';
  if (item.category === 'bill') return '⚡';
  if (item.sender_trust === 'verified_gov') return '🏛';
  if (item.category === 'financial') return '💰';
  return '✉️';
}

// ── Toggle row component ─────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-2.5 cursor-pointer group">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm text-app-text">{label}</p>
        {description && (
          <p className="text-xs text-app-text-secondary mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-primary-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-app-surface rounded-full shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

// ── Notification permission helper ───────────────────────────

type NotifState = 'default' | 'granted' | 'denied' | 'unsupported';

function useNotificationPermission(): [NotifState, () => void] {
  const [state, setState] = useState<NotifState>('default');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setState('unsupported');
      return;
    }
    setState(Notification.permission as NotifState);
  }, []);

  const request = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    Notification.requestPermission().then((perm) => {
      setState(perm as NotifState);
    });
  }, []);

  return [state, request];
}

// ── Main Page ────────────────────────────────────────────────

export default function MailDayPage() {
  const { data: summary, isLoading: summaryLoading } = useMailDaySummary();
  const { data: settings, isLoading: settingsLoading } = useMailDaySettings();
  const updateSettings = useUpdateMailDaySettings();
  const [notifState, requestNotif] = useNotificationPermission();

  const [dismissed, setDismissed] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // Local draft settings for the form
  const [draft, setDraft] = useState<Partial<MailDaySettings>>({});

  useEffect(() => {
    if (settings) {
      setDraft({
        enabled: settings.enabled,
        delivery_time: settings.delivery_time,
        timezone: settings.timezone,
        include_personal: settings.include_personal,
        include_home: settings.include_home,
        include_business: settings.include_business,
        include_earn_count: settings.include_earn_count,
        include_community: settings.include_community,
        interrupt_time_sensitive: settings.interrupt_time_sensitive,
        interrupt_packages_otd: settings.interrupt_packages_otd,
        interrupt_certified: settings.interrupt_certified,
      });
    }
  }, [settings]);

  const updateDraft = useCallback(
    <K extends keyof MailDaySettings>(key: K, value: MailDaySettings[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = useCallback(() => {
    updateSettings.mutate(draft, {
      onSuccess: () => {
        setSaveToast(true);
        setTimeout(() => setSaveToast(false), 3000);
      },
    });
  }, [draft, updateSettings]);

  if (summaryLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-app-surface">
      <div className="max-w-5xl mx-auto p-6">
        {/* Save toast */}
        {saveToast && (
          <div className="mb-4 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              Settings saved
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── LEFT: Mail Day Summary ───────────────────────── */}
          <div>
            <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-3">
              Mail Day Summary
            </p>

            {dismissed || !summary ? (
              <div className="rounded-xl border border-app-border p-8 text-center">
                <div className="text-4xl mb-3">{getSeasonEmoji()}</div>
                <p className="text-sm text-app-text-secondary">
                  {dismissed
                    ? "You've dismissed today's summary. Check back tomorrow!"
                    : 'No Mail Day summary available.'}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-app-border overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-br from-primary-50 to-sky-50 dark:from-primary-950/40 dark:to-sky-950/40 px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                      Mail Day{settings?.delivery_time ? ` · ${settings.delivery_time}` : ''}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-app-text">
                    {summary.greeting}
                  </p>
                </div>

                {/* Illustration + stats */}
                <div className="px-5 py-4 border-b border-app-border-subtle text-center">
                  <div className="text-5xl mb-2">{getSeasonEmoji()}</div>
                  <p className="text-sm text-app-text-secondary dark:text-app-text-muted">
                    Flag is up · <span className="font-semibold">{summary.total_new} new item{summary.total_new !== 1 ? 's' : ''}</span>
                  </p>
                </div>

                {/* Today's arrivals */}
                {summary.arrivals.length > 0 && (
                  <div className="px-5 py-3 border-b border-app-border-subtle">
                    <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                      Today&apos;s Arrivals
                    </p>
                    <div className="space-y-1">
                      {summary.arrivals.map((item) => (
                        <a
                          key={item.id}
                          href={`/app/mailbox/${item.drawer}/${item.id}`}
                          className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-app-hover dark:hover:bg-gray-800 transition-colors group"
                        >
                          <span className="flex-shrink-0">{mailTypeIcon(item)}</span>
                          <span className="text-sm text-app-text truncate group-hover:text-primary-600">
                            {item.sender_display || 'Unknown sender'}
                          </span>
                          <span className="text-xs text-app-text-secondary truncate ml-auto flex-shrink-0">
                            {item.display_title || item.preview_text || ''}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Needs attention */}
                {summary.needs_attention.length > 0 && (
                  <div className="px-5 py-3 border-b border-app-border-subtle">
                    <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-2">
                      Needs Attention
                    </p>
                    <div className="space-y-1">
                      {summary.needs_attention.map((item) => (
                        <a
                          key={item.id}
                          href={`/app/mailbox/${item.drawer}/${item.id}`}
                          className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                        >
                          <span className="text-amber-500 flex-shrink-0">⚠</span>
                          <span className="text-sm text-app-text truncate">
                            {item.sender_display || item.display_title || 'Action needed'}
                          </span>
                          {item.due_date && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto flex-shrink-0">
                              Due {new Date(item.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extra stats */}
                {(summary.earn_count > 0 || summary.community_count > 0) && (
                  <div className="px-5 py-3 border-b border-app-border-subtle flex items-center gap-4 text-xs text-app-text-secondary">
                    {summary.earn_count > 0 && (
                      <span>{summary.earn_count} earn opportunity{summary.earn_count !== 1 ? 's' : ''}</span>
                    )}
                    {summary.community_count > 0 && (
                      <span>{summary.community_count} community update{summary.community_count !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                )}

                {/* Memory */}
                {summary.memory && !summary.memory.dismissed && (
                  <div className="px-5 py-3 border-b border-app-border-subtle">
                    <Link
                      href="/app/mailbox/memory"
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors"
                    >
                      <span className="text-xl flex-shrink-0">&#x1F4F8;</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">{summary.memory.headline}</p>
                        {summary.memory.body && <p className="text-xs text-purple-600 dark:text-purple-500 mt-0.5 truncate">{summary.memory.body}</p>}
                      </div>
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex-shrink-0">View</span>
                    </Link>
                  </div>
                )}

                {/* Actions */}
                <div className="px-5 py-3 flex items-center gap-2">
                  <Link
                    href="/app/mailbox/personal"
                    className="flex-1 py-2 text-center text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Open Mailbox
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    className="flex-1 py-2 text-center text-sm font-medium text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Settings ──────────────────────────────── */}
          <div>
            <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-3">
              Settings
            </p>

            <div className="space-y-6">
              {/* Mail Day enabled + delivery time + timezone */}
              <div className="space-y-3">
                <div className="border border-app-border rounded-lg px-3 py-2.5">
                  <ToggleRow
                    label="Mail Day enabled"
                    description="Receive a daily summary of your mail"
                    checked={draft.enabled ?? true}
                    onChange={(v) => updateDraft('enabled', v)}
                  />
                </div>

                <div>
                  <label className="text-xs text-app-text-secondary mb-1 block">Delivery Time</label>
                  <input
                    type="time"
                    value={draft.delivery_time || '08:00'}
                    onChange={(e) => updateDraft('delivery_time', e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-app-text-secondary mb-1 block">Timezone</label>
                  <select
                    value={draft.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                    onChange={(e) => updateDraft('timezone', e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Include in Mail Day */}
              <div>
                <p className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-1">
                  Include in Mail Day
                </p>
                <div className="divide-y divide-app-border-subtle">
                  <ToggleRow
                    label="Personal"
                    checked={draft.include_personal ?? true}
                    onChange={(v) => updateDraft('include_personal', v)}
                  />
                  <ToggleRow
                    label="Home"
                    checked={draft.include_home ?? true}
                    onChange={(v) => updateDraft('include_home', v)}
                  />
                  <ToggleRow
                    label="Business"
                    checked={draft.include_business ?? true}
                    onChange={(v) => updateDraft('include_business', v)}
                  />
                  <ToggleRow
                    label="Earn count"
                    checked={draft.include_earn_count ?? true}
                    onChange={(v) => updateDraft('include_earn_count', v)}
                  />
                  <ToggleRow
                    label="Neighborhood notices"
                    checked={draft.include_community ?? true}
                    onChange={(v) => updateDraft('include_community', v)}
                  />
                </div>
              </div>

              {/* Always interrupt */}
              <div>
                <p className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-1">
                  Always Interrupt (Instant)
                </p>
                <div className="divide-y divide-app-border-subtle">
                  <ToggleRow
                    label="Time-sensitive"
                    description="Bills due soon, deadlines"
                    checked={draft.interrupt_time_sensitive ?? true}
                    onChange={(v) => updateDraft('interrupt_time_sensitive', v)}
                  />
                  <ToggleRow
                    label="Packages out for delivery"
                    description="Real-time delivery alerts"
                    checked={draft.interrupt_packages_otd ?? true}
                    onChange={(v) => updateDraft('interrupt_packages_otd', v)}
                  />
                  <ToggleRow
                    label="Certified mail"
                    description="Requires acknowledgment"
                    checked={draft.interrupt_certified ?? true}
                    onChange={(v) => updateDraft('interrupt_certified', v)}
                  />
                </div>
              </div>

              {/* Browser notifications */}
              <div>
                <p className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-1">
                  Browser Notifications
                </p>
                <div className="py-2.5">
                  {notifState === 'unsupported' ? (
                    <p className="text-sm text-app-text-muted">
                      Browser notifications are not supported in this browser.
                    </p>
                  ) : notifState === 'granted' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                        Notifications enabled
                      </p>
                    </div>
                  ) : notifState === 'denied' ? (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Notifications blocked. Check your browser settings to enable them.
                    </p>
                  ) : (
                    <div>
                      <p className="text-sm text-app-text-secondary dark:text-app-text-muted mb-2">
                        Enable browser notifications for Mail Day delivery alerts.
                      </p>
                      <button
                        type="button"
                        onClick={requestNotif}
                        className="px-4 py-2 text-sm font-medium text-primary-600 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      >
                        Enable Notifications
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Save */}
              <button
                type="button"
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className={`w-full py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  updateSettings.isPending
                    ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
