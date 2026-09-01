"use client";

// G5 — Business Scheduling Settings. The "Booking" settings hub for the active
// business: Confirmation (auto-confirm vs approve + approval window),
// Scheduling (notice / horizon / buffers / timezone), Policy, Notifications and
// Payments — plus the Team-availability link and the Assignment surface the W2
// editor links here for. Defaults persist to the booking page (timezone +
// cancellation_policy are columns; the rest rides in branding); notify toggles
// persist to notification-preferences. Business violet accents; sky controls.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CalendarRange,
  ChevronLeft,
  Clock,
  CreditCard,
  GitCommitHorizontal,
  Globe,
  Hourglass,
  Lock,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import * as api from "@pantopus/api";
import type {
  BookingPage,
  NotificationPreferences,
  PaymentsStatus,
} from "@pantopus/types";
import { PillarThemeProvider } from "@/components/scheduling/PillarThemeProvider";
import TimezoneSelector, {
  zoneLabel,
} from "@/components/scheduling/TimezoneSelector";
import { decodeError } from "@/components/scheduling/decodeError";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import {
  AccentOverline,
  BusinessSwitcher,
  Card,
  Chevron,
  Chip,
  Group,
  IconDisc,
  Note,
  Segmented,
  SettingRow,
  Skeleton,
  Toggle,
} from "./ui";
import { useBusinessOwner } from "./owner";
import {
  type ConfirmationMode,
  type SchedulingDefaults,
  approvalWindowLabel,
  brandingPatch,
  bufferLabel,
  cancellationLabel,
  confirmationNote,
  horizonLabel,
  minNoticeLabel,
  notifyMember,
  notifyOwner,
  prefsWith,
  readDefaults,
} from "./settings";

const MANAGE_ROLES = new Set(["owner", "admin", "manager"]);

export default function BusinessSettings() {
  const biz = useBusinessOwner();
  const owner = biz.owner;

  const [page, setPage] = useState<BookingPage | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [payments, setPayments] = useState<PaymentsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tzOpen, setTzOpen] = useState(false);
  const [draft, setDraft] = useState<SchedulingDefaults | null>(null);

  const load = useCallback(async () => {
    if (!owner?.ownerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [pageRes, prefsRes] = await Promise.all([
        api.scheduling.getBookingPage(owner),
        api.scheduling
          .getNotificationPreferences(owner)
          .catch(() => ({ prefs: {} })),
      ]);
      setPage(pageRes.page);
      setPrefs(prefsRes.prefs ?? {});
      setDraft(readDefaults(pageRes.page));
      // Payments is a non-blocking enrichment.
      api.scheduling
        .getPaymentsStatus(owner)
        .then(setPayments)
        .catch(() => setPayments(null));
    } catch (err) {
      setError(decodeError(err).message);
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounced persistence of the branding-backed defaults.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistDefaults = useCallback(
    (next: SchedulingDefaults) => {
      if (!owner) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          const { page: updated } = await api.scheduling.updateBookingPage(
            {
              branding: brandingPatch(page, {
                confirmation: next.confirmation,
                approvalWindowHours: next.approvalWindowHours,
                minNoticeMin: next.minNoticeMin,
                maxHorizonDays: next.maxHorizonDays,
                bufferBeforeMin: next.bufferBeforeMin,
                bufferAfterMin: next.bufferAfterMin,
              }),
            },
            owner,
          );
          setPage(updated);
          toast.success("Saved", 1500);
        } catch (err) {
          toast.error(decodeError(err).message || "Couldn’t save");
        }
      }, 550);
    },
    [owner, page],
  );

  const editDefaults = useCallback(
    (patch: Partial<SchedulingDefaults>) => {
      setDraft((d) => {
        const next = { ...(d ?? readDefaults(page)), ...patch };
        persistDefaults(next);
        return next;
      });
    },
    [page, persistDefaults],
  );

  const patchTimezone = useCallback(
    async (tz: string) => {
      if (!owner) return;
      try {
        const { page: updated } = await api.scheduling.updateBookingPage(
          { timezone: tz },
          owner,
        );
        setPage(updated);
        toast.success("Timezone updated", 1500);
      } catch (err) {
        toast.error(decodeError(err).message || "Couldn’t update timezone");
      }
    },
    [owner],
  );

  const patchPrefs = useCallback(
    async (patch: Partial<{ notifyOwner: boolean; notifyMember: boolean }>) => {
      if (!owner) return;
      const next = prefsWith(prefs, patch);
      setPrefs(next); // optimistic
      try {
        const { prefs: saved } =
          await api.scheduling.updateNotificationPreferences(next, owner);
        setPrefs(saved);
      } catch (err) {
        setPrefs(prefs); // revert
        toast.error(decodeError(err).message || "Couldn’t save notifications");
      }
    },
    [owner, prefs],
  );

  // ── States ────────────────────────────────────────────────────────────────

  if (biz.loading || (loading && owner)) {
    return <SettingsSkeleton switcher={biz.options.length > 1} />;
  }

  if (biz.unavailable || !owner) {
    return (
      <div className="mx-auto max-w-2xl">
        <Header
          options={biz.options}
          activeId={biz.active?.id ?? null}
          onSwitch={biz.setActiveId}
        />
        <Card>
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-app-business-bg text-app-business">
              <Users className="h-6 w-6" aria-hidden />
            </span>
            <p className="text-base font-semibold text-app-text">
              No business yet
            </p>
            <p className="max-w-xs text-sm text-app-text-secondary">
              Business scheduling is available once you own or join a business
              on Pantopus.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !page || !draft) {
    return (
      <div className="mx-auto max-w-2xl">
        <Header
          options={biz.options}
          activeId={biz.active?.id ?? null}
          onSwitch={biz.setActiveId}
        />
        <ErrorState
          message={error ?? "Couldn’t load settings."}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const approve = draft.confirmation === "approve";

  // Permission-gated state: non-admin members see a read-only view with dimmed
  // sections and a lock note at the bottom (design FrameGated).
  const gatedRole = biz.active?.role?.toLowerCase() ?? "";
  const gated = gatedRole
    ? ![...MANAGE_ROLES].some((r) => gatedRole.includes(r))
    : false; // owner default — not gated

  return (
    <PillarThemeProvider pillar="business">
      <div className="mx-auto max-w-2xl">
        <Header
          options={biz.options}
          activeId={biz.active?.id ?? null}
          onSwitch={biz.setActiveId}
        />

        <p className="px-1 pb-1 text-xs leading-snug text-app-text-secondary">
          Defaults flow into each service — change them per service anytime.
        </p>

        <div className="space-y-1">
          {/* Confirmation */}
          <section style={{ opacity: gated ? 0.55 : 1 }}>
            <AccentOverline className="pb-2 pt-4">Confirmation</AccentOverline>
            <Card>
              <div className="px-4 py-3.5">
                <div className="mb-2 flex items-center gap-2.5">
                  <IconDisc icon={CalendarCheck} tone="business" />
                  <p className="text-[15px] font-medium text-app-text">
                    New bookings
                  </p>
                </div>
                <Segmented<ConfirmationMode>
                  value={draft.confirmation}
                  onChange={gated ? undefined : (id) => editDefaults({ confirmation: id })}
                  options={[
                    { id: "auto", label: "Auto-confirm" },
                    { id: "approve", label: "Approve each request" },
                  ]}
                  disabled={gated}
                />
                <p className="mt-2 px-0.5 text-[11px] leading-tight text-app-text-secondary">
                  {confirmationNote(draft.confirmation)}
                </p>
              </div>
              {approve && (
                <SettingRow
                  icon={Hourglass}
                  label="Approval window"
                  sub={approvalWindowLabel(draft.approvalWindowHours)}
                  href={gated ? undefined : "/app/scheduling/business/settings/approval-window"}
                  last
                  trailing={gated ? null : <Chevron />}
                />
              )}
            </Card>
          </section>

          {/* Scheduling — navigate rows, no inline expand */}
          <div style={{ opacity: gated ? 0.7 : 1 }}>
            <Group title="Scheduling">
              <SettingRow
                icon={Clock}
                label="Minimum notice"
                sub={minNoticeLabel(draft.minNoticeMin)}
                href={gated ? undefined : "/app/scheduling/business/settings/minimum-notice"}
                trailing={gated ? null : <Chevron />}
              />
              <SettingRow
                icon={CalendarRange}
                label="Booking horizon"
                sub={horizonLabel(draft.maxHorizonDays)}
                href={gated ? undefined : "/app/scheduling/business/settings/booking-horizon"}
                trailing={gated ? null : <Chevron />}
              />
              <SettingRow
                icon={GitCommitHorizontal}
                label="Buffers"
                sub={bufferLabel(draft.bufferBeforeMin, draft.bufferAfterMin)}
                href={gated ? undefined : "/app/scheduling/business/settings/buffers"}
                trailing={gated ? null : <Chevron />}
              />
              <SettingRow
                icon={Globe}
                label="Time zone"
                sub={page.timezone ? zoneLabel(page.timezone) : "Not set"}
                onClick={gated ? undefined : () => setTzOpen(true)}
                last
                trailing={gated ? null : <Chevron />}
              />
            </Group>
          </div>

          {/* Policy — hidden when gated */}
          {!gated && (
            <section>
              <AccentOverline className="pb-2 pt-4">Policy</AccentOverline>
              <Card>
                <SettingRow
                  icon={Shield}
                  label="Cancellation & no-show policy"
                  sub={cancellationLabel(page.cancellation_policy) ?? undefined}
                  href="/app/scheduling/payments/policy"
                  last
                  trailing={
                    cancellationLabel(page.cancellation_policy) ? (
                      <Chevron />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Chip tone="warning">Set up</Chip>
                        <Chevron />
                      </div>
                    )
                  }
                />
              </Card>
            </section>
          )}

          {/* Notifications */}
          <div style={{ opacity: gated ? 0.7 : 1 }}>
            <Group title="Notifications">
              <SettingRow
                icon={Bell}
                label="Notify the owner"
                trailing={
                  <Toggle
                    on={notifyOwner(prefs)}
                    onChange={gated ? undefined : (v) => void patchPrefs({ notifyOwner: v })}
                    disabled={gated}
                    label="Notify the owner"
                  />
                }
              />
              <SettingRow
                icon={UserCheck}
                label="Notify the assigned member"
                last
                trailing={
                  <Toggle
                    on={notifyMember(prefs)}
                    onChange={gated ? undefined : (v) => void patchPrefs({ notifyMember: v })}
                    disabled={gated}
                    label="Notify the assigned member"
                  />
                }
              />
            </Group>
          </div>

          {/* Payments — shown unconditionally per design; hidden when gated */}
          {!gated && (
            <section>
              <AccentOverline className="pb-2 pt-4">Payments</AccentOverline>
              <Card>
                <SettingRow
                  icon={CreditCard}
                  iconTone="stripe"
                  label="Stripe payments"
                  sub={
                    payments?.connected
                      ? payments.payouts_enabled
                        ? "Connected · payouts enabled"
                        : "Connected · finish setup"
                      : "Not connected"
                  }
                  href="/app/scheduling/payments"
                  last
                  trailing={
                    payments?.connected ? (
                      <div className="flex items-center gap-1.5">
                        <Chip tone="success" icon={CalendarCheck}>
                          Connected
                        </Chip>
                        <Chevron />
                      </div>
                    ) : (
                      // The whole row already links to /app/scheduling/payments,
                      // so this is a styled span, not a nested <Link> (which
                      // would produce an invalid <a> inside <a>).
                      <span className="rounded-full bg-primary-600 px-3 py-1.5 text-xs font-bold text-white">
                        Connect
                      </span>
                    )
                  }
                />
              </Card>
              {payments && !payments.connected && (
                <div className="pt-2">
                  <Note tone="warning" icon={AlertTriangle}>
                    Connect payments to charge for services.
                  </Note>
                </div>
              )}
            </section>
          )}

          {/* Lock note — only admins can change booking settings */}
          {gated && (
            <div className="flex items-center gap-1.5 px-1 py-0.5 text-app-text-muted">
              <Lock className="h-3 w-3" aria-hidden />
              <span className="text-[11px] font-medium">
                Only admins can change booking settings.
              </span>
            </div>
          )}
        </div>

        <p className="mt-6 px-1 font-mono text-[11px] text-app-text-muted">
          {page.slug} · business #{owner.ownerId?.slice(0, 8)}
        </p>

        <TimezoneSelector
          open={tzOpen}
          onClose={() => setTzOpen(false)}
          value={page.timezone ?? undefined}
          onSelect={(z) => {
            setTzOpen(false);
            void patchTimezone(z);
          }}
          pillar="business"
        />
      </div>
    </PillarThemeProvider>
  );
}

function Header({
  options,
  activeId,
  onSwitch,
}: {
  options: { id: string; name: string }[];
  activeId: string | null;
  onSwitch: (id: string) => void;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <Link
          href="/app/scheduling/business"
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-full text-app-text-secondary transition-colors hover:bg-app-hover"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-app-business">
            Business
          </p>
          <h1 className="text-xl font-bold text-app-text">Booking settings</h1>
        </div>
      </div>
      <BusinessSwitcher
        options={options}
        activeId={activeId}
        onChange={onSwitch}
      />
    </div>
  );
}

function SettingsSkeleton({ switcher }: { switcher: boolean }) {
  return (
    <div className="mx-auto max-w-2xl" aria-hidden>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-6 w-40" />
        </div>
        {switcher && <Skeleton className="h-7 w-28 rounded-full" />}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}
