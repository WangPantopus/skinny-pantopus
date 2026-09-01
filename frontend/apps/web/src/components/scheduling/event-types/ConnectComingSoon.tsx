"use client";

// W2 — Event Types. B8 Connected calendars. OAuth sync is deferred server-side:
// GET /connected-calendars returns an empty list and POST .../connect returns
// 501 NOT_AVAILABLE. So this surface leads with a calm "coming soon" hero and
// offers provider rows whose Connect action surfaces the coming-soon message
// (never a dead end). If the read ever returns connected accounts, they render.

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  Calendar,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CalendarSync,
  Check,
  ExternalLink,
  Lock,
  RefreshCw,
  SearchCheck,
  Settings,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import * as api from "@pantopus/api";
import type { ConnectedCalendar, SchedulingOwnerRef } from "@pantopus/types";
import { toast } from "@/components/ui/toast-store";
import { decodeError } from "@/components/scheduling/decodeError";
import ErrorState from "@/components/ui/ErrorState";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import { ToggleRow } from "./fields";

interface Provider {
  key: string;
  name: string;
  icon: LucideIcon;
}

const PROVIDERS: Provider[] = [
  { key: "google", name: "Google Calendar", icon: CalendarDays },
  { key: "apple", name: "Apple Calendar", icon: Calendar },
  { key: "outlook", name: "Outlook", icon: CalendarRange },
];

type Phase = "loading" | "error" | "ready";

export default function ConnectComingSoon({
  owner,
}: {
  owner: SchedulingOwnerRef;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [calendars, setCalendars] = useState<ConnectedCalendar[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    api.scheduling
      .getConnectedCalendars(owner)
      .then((res) => {
        if (!alive) return;
        setCalendars(res.calendars ?? []);
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [owner]);

  useEffect(() => load(), [load]);

  const handleConnect = async (providerKey: string) => {
    setConnecting(providerKey);
    try {
      await api.scheduling.connectCalendar(owner);
      // If the backend ever starts handing back a real flow, reflect it.
      toast.success("Calendar connected.");
      load();
    } catch (err) {
      const decoded = decodeError(err);
      // 501 NOT_AVAILABLE is the expected, first-class "coming soon" response.
      toast.info(decoded.message || "Calendar sync is coming soon.");
    } finally {
      setConnecting(null);
    }
  };

  if (phase === "loading") {
    return (
      <div className="flex flex-col gap-3">
        <ShimmerBlock className="h-44 rounded-2xl" />
        <ShimmerBlock className="h-16 rounded-2xl" />
        <ShimmerBlock className="h-16 rounded-2xl" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <ErrorState
        message="We couldn't load your connected calendars."
        onRetry={load}
      />
    );
  }

  const hasConnected = calendars.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {hasConnected ? (
        calendars.map((c) => (
          <ConnectedRow
            key={c.id}
            calendar={c}
            onDisconnect={() => {
              toast.info("Disconnect coming soon.");
            }}
          />
        ))
      ) : (
        <ComingSoonHero />
      )}

      <p className="mt-1 px-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted">
        Providers
      </p>
      <p className="px-0.5 text-xs leading-snug text-app-text-secondary">
        Connect a calendar to check for conflicts and add bookings
        automatically.
      </p>

      {PROVIDERS.map((p) => (
        <ConnectRow
          key={p.key}
          provider={p}
          connecting={connecting === p.key}
          disabled={connecting != null}
          onConnect={() => handleConnect(p.key)}
        />
      ))}
    </div>
  );
}

function ProviderTile({
  icon: Icon,
  muted,
}: {
  icon: LucideIcon;
  muted?: boolean;
}) {
  return (
    <span
      className={clsx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-app-border bg-app-surface shadow-sm",
        muted ? "text-app-text-muted" : "text-app-text-secondary",
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
    </span>
  );
}

function ComingSoonHero() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-app-border bg-app-surface p-6 text-center shadow-sm">
      <span className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
        <CalendarSync className="h-7 w-7" strokeWidth={1.9} aria-hidden />
      </span>
      <h2 className="text-base font-bold text-app-text">
        Calendar sync is coming soon
      </h2>
      <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-app-text-secondary">
        We&apos;ll let you know when you can connect Google, Apple, and Outlook
        to check for conflicts.
      </p>
      <div className="mt-5 flex gap-3.5">
        {PROVIDERS.map((p) => (
          <span key={p.key} className="opacity-50">
            <ProviderTile icon={p.icon} muted />
          </span>
        ))}
      </div>
    </div>
  );
}

function ConnectRow({
  provider,
  connecting,
  disabled,
  onConnect,
}: {
  provider: Provider;
  connecting: boolean;
  disabled: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm">
      <ProviderTile icon={provider.icon} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-app-text">
          {provider.name}
        </p>
        <p className="mt-0.5 text-[11px] text-app-text-secondary">
          {connecting ? "Opening…" : "Not connected"}
        </p>
      </div>
      <button
        type="button"
        onClick={onConnect}
        disabled={disabled}
        className="h-8 shrink-0 rounded-lg bg-primary-600 px-3.5 text-[12.5px] font-bold text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {connecting ? "…" : "Connect"}
      </button>
    </div>
  );
}

/** Determine display status from the calendar status string. */
type CalendarDisplayStatus = "synced" | "reauth" | "denied" | "connecting";

function resolveStatus(status: string): CalendarDisplayStatus {
  if (status === "synced" || status === "active") return "synced";
  if (status === "reauth" || status === "reauth_needed") return "reauth";
  if (status === "denied" || status === "permission_denied") return "denied";
  if (status === "connecting") return "connecting";
  return "synced"; // fallback for unknown statuses
}

/** Provider icon — pick based on provider string. */
function providerIcon(provider: string): LucideIcon {
  if (provider.includes("google")) return CalendarDays;
  if (provider.includes("apple")) return Calendar;
  if (provider.includes("outlook")) return CalendarRange;
  return CalendarDays;
}

/** Inline status chip for calendar rows — Synced (green) or Action needed (amber). */
function CalendarStatusChip({ kind }: { kind: "synced" | "attention" }) {
  if (kind === "synced") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-app-success-bg px-2 py-1 text-[9.5px] font-bold text-app-success">
        <Check className="h-2.5 w-2.5" strokeWidth={2.6} aria-hidden />
        Synced
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-app-warning-bg px-2 py-1 text-[9.5px] font-bold text-app-warning">
      <TriangleAlert className="h-2.5 w-2.5" strokeWidth={2.6} aria-hidden />
      Action needed
    </span>
  );
}

/** Row header shared by all connected-state rows. */
function CalendarAccountHeader({
  calendar,
  statusKind,
}: {
  calendar: ConnectedCalendar;
  statusKind: "synced" | "attention";
}) {
  const Icon = providerIcon(calendar.provider);
  return (
    <div className="flex items-center gap-3">
      <ProviderTile icon={Icon} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold capitalize text-app-text">
          {calendar.provider}
        </p>
        {calendar.external_account && (
          <p className="mt-0.5 truncate text-[11px] text-app-text-secondary">
            {calendar.external_account}
          </p>
        )}
      </div>
      <CalendarStatusChip kind={statusKind} />
    </div>
  );
}

function ConnectedRow({
  calendar,
  onDisconnect,
}: {
  calendar: ConnectedCalendar;
  onDisconnect: () => void;
}) {
  const displayStatus = resolveStatus(calendar.status);

  // Connecting row — OAuth in flight
  if (displayStatus === "connecting") {
    const Icon = providerIcon(calendar.provider);
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm">
        <ProviderTile icon={Icon} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold capitalize text-app-text">
            {calendar.provider}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <ExternalLink
              className="h-2.5 w-2.5 text-app-text-secondary"
              aria-hidden
            />
            <span className="text-[11px] text-app-text-secondary">
              Opening {calendar.provider}…
            </span>
          </div>
        </div>
        {/* Shimmer in place of the Connect button while OAuth is in flight */}
        <div className="h-8 w-20 animate-pulse rounded-lg bg-app-surface-sunken" />
      </div>
    );
  }

  // Re-auth row — token expired
  if (displayStatus === "reauth") {
    return (
      <div className="flex flex-col gap-2.5 rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm">
        <CalendarAccountHeader calendar={calendar} statusKind="attention" />
        <div className="flex flex-col gap-2.5 rounded-xl border border-app-warning-light bg-app-warning-bg p-3">
          <div className="flex items-start gap-2.5">
            <TriangleAlert
              className="mt-px h-4 w-4 shrink-0 text-app-warning"
              strokeWidth={2}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold leading-snug text-app-text-secondary">
                Reconnect {calendar.provider} to keep checking for conflicts
              </p>
              <p className="mt-1 text-[11px] leading-snug text-app-text-secondary opacity-80">
                Until you reconnect, we can&apos;t see new events and might
                double-book you.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 text-[12.5px] font-bold text-white transition hover:bg-primary-700"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  // Denied row — permission denied at OS/OAuth level
  if (displayStatus === "denied") {
    const Icon = providerIcon(calendar.provider);
    return (
      <div className="flex flex-col gap-2.5 rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <ProviderTile icon={Icon} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold capitalize text-app-text">
              {calendar.provider}
            </p>
            <p className="mt-0.5 text-[11px] text-app-text-secondary">
              Not connected
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-app-border bg-app-surface-raised p-2.5">
          <Lock
            className="mt-px h-3.5 w-3.5 shrink-0 text-app-text-muted"
            strokeWidth={2}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] leading-snug text-app-text-secondary">
              Calendar access was declined. Allow it in Settings to connect.
            </p>
            <button
              type="button"
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-primary-600"
            >
              <Settings className="h-3 w-3" aria-hidden />
              Open Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Synced row — fully connected
  return (
    <div className="flex flex-col gap-0 rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm">
      <CalendarAccountHeader calendar={calendar} statusKind="synced" />
      <div className="my-2.5 h-px bg-app-border" />
      <ToggleRow
        icon={SearchCheck}
        label="Check for conflicts"
        sub="Block times when you're busy elsewhere"
        on={calendar.check_conflicts}
      />
      <ToggleRow
        icon={CalendarPlus}
        label="Add bookings to this calendar"
        sub="New bookings show up here"
        on={calendar.write_target}
        last
      />
      <div className="mt-2.5 flex items-center justify-between border-t border-app-border pt-2">
        {calendar.last_synced_at ? (
          <span className="flex items-center gap-1 text-[10.5px] text-app-text-secondary">
            <RefreshCw className="h-2.5 w-2.5" aria-hidden />
            Synced {new Date(calendar.last_synced_at).toLocaleString()}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onDisconnect}
          className="text-[11.5px] font-semibold text-app-text-secondary transition hover:text-app-text"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
