"use client";

// W18 · H15 — Reminder channels & permission (host surface for the prompt).
//
// Lists how reminders can reach the host — Push (this browser, REAL via the
// Notification API), Email (always-on baseline), SMS (coming soon) — and a
// "more channels" connect affordance backed by POST /connected-calendars/connect
// (→ 501 "coming soon", never a dead end). Each row's action opens the
// ChannelConnectPrompt. Status is always shown as text, never color alone.

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  BellRing,
  Lock,
  Mail,
  MessageSquare,
  Plus,
  Radio,
  type LucideIcon,
} from "lucide-react";
import * as api from "@pantopus/api";
import type { ConnectedCalendar } from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarForOwner,
  pillarTokens,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import ErrorState from "@/components/ui/ErrorState";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import { toast } from "@/components/ui/toast-store";
import ChannelConnectPrompt from "./ChannelConnectPrompt";
import { focusRing } from "./a11y";
import {
  buildChannelViews,
  pushPromptMode,
  readPushPermission,
  type ChannelId,
  type ChannelStatus,
  type ChannelView,
  type PromptMode,
  type PushPermission,
} from "./channelState";

const CHANNEL_ICON: Record<ChannelId, LucideIcon> = {
  push: BellRing,
  email: Mail,
  sms: MessageSquare,
};

type ConnectedPhase = "loading" | "error" | "ready";

export default function ChannelsManager() {
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);
  const tk = pillarTokens(pillar);

  const [perm, setPerm] = useState<PushPermission>("unsupported");
  const [prompt, setPrompt] = useState<{ open: boolean; mode: PromptMode }>({
    open: false,
    mode: "push",
  });

  // Push permission is per-device browser state — read it on mount and whenever
  // the tab regains focus (the user may have changed it in browser settings).
  useEffect(() => {
    const sync = () => setPerm(readPushPermission());
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const [phase, setPhase] = useState<ConnectedPhase>("loading");
  const [channels, setChannels] = useState<ConnectedCalendar[]>([]);
  const [connecting, setConnecting] = useState(false);

  const loadConnected = useCallback(() => {
    let alive = true;
    setPhase("loading");
    api.scheduling
      .getConnectedCalendars(owner)
      .then((res) => {
        if (!alive) return;
        setChannels(res.calendars ?? []);
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [owner]);

  useEffect(() => loadConnected(), [loadConnected]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await api.scheduling.connectCalendar(owner);
      toast.success("Channel connected.");
      loadConnected();
    } catch (err) {
      const decoded = decodeError(err);
      // 501 NOT_AVAILABLE is the expected first-class "coming soon" response.
      toast.info(decoded.message || "Connecting more channels is coming soon.");
    } finally {
      setConnecting(false);
    }
  };

  const views = buildChannelViews(perm);

  const openFor = (id: ChannelId) => {
    if (id === "push") setPrompt({ open: true, mode: pushPromptMode(perm) });
    else if (id === "email") setPrompt({ open: true, mode: "email" });
    else setPrompt({ open: true, mode: "sms" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
            tk.bgSoft,
            tk.text,
          )}
        >
          <Radio className="h-3 w-3" aria-hidden />
          {pillar === "business"
            ? "Business"
            : pillar === "home"
              ? "Home"
              : "Personal"}
        </span>
        <h1 className="mt-2 text-xl font-bold text-app-text">
          Reminder channels
        </h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          Make sure booking reminders can actually reach you. Push lives on this
          device; email is always on.
        </p>
      </header>

      {/* Reminder delivery channels */}
      <section aria-labelledby="rc-heading">
        <h2
          id="rc-heading"
          className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted"
        >
          How reminders reach you
        </h2>
        <ul className="divide-y divide-app-border-subtle overflow-hidden rounded-2xl border border-app-border bg-app-surface">
          {views.map((view) => (
            <li key={view.id}>
              <ChannelRow
                view={view}
                icon={CHANNEL_ICON[view.id]}
                pillar={pillar}
                onAction={() => openFor(view.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* More channels — deferred (501 → coming soon) */}
      <section aria-labelledby="mc-heading">
        <h2
          id="mc-heading"
          className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted"
        >
          More channels
        </h2>
        {phase === "loading" ? (
          <div
            className="space-y-2"
            aria-busy="true"
            aria-label="Loading channels"
          >
            <ShimmerBlock className="h-24 rounded-2xl" />
          </div>
        ) : phase === "error" ? (
          <ErrorState
            message="We couldn't load your connected channels."
            onRetry={loadConnected}
          />
        ) : channels.length > 0 ? (
          <ul className="space-y-2">
            {channels.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm"
              >
                <ChannelDisc icon={Radio} pillar={pillar} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold capitalize text-app-text">
                    {c.provider}
                  </p>
                  {c.external_account && (
                    <p className="mt-0.5 truncate text-[11px] text-app-text-secondary">
                      {c.external_account}
                    </p>
                  )}
                </div>
                <StatusPill status="on" label="Connected" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-app-border bg-app-surface p-6 text-center shadow-sm">
            <span
              className={clsx(
                "mb-3 flex h-12 w-12 items-center justify-center rounded-2xl",
                tk.bgSoft,
                tk.text,
              )}
            >
              <Plus className="h-6 w-6" strokeWidth={2} aria-hidden />
            </span>
            <h3 className="text-sm font-bold text-app-text">
              More ways to reach you are coming soon
            </h3>
            <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed text-app-text-secondary">
              We&apos;ll let you know when you can send reminders through other
              channels.
            </p>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className={clsx(
                "mt-4 h-9 rounded-lg px-4 text-[12.5px] font-bold transition disabled:opacity-60",
                tk.bg,
                tk.textOn,
                focusRing(pillar),
              )}
            >
              {connecting ? "Connecting…" : "Connect a channel"}
            </button>
          </div>
        )}
      </section>

      {/* Legend */}
      <p className="flex flex-wrap items-center justify-center gap-3.5 px-4 pt-1 text-center font-mono text-[11px] text-app-text-muted">
        <span>P · Push</span>
        <span>E · Email</span>
        <span className="inline-flex items-center gap-1">
          S · SMS <Lock className="h-2.5 w-2.5" strokeWidth={2.6} aria-hidden />
          soon
        </span>
      </p>

      <ChannelConnectPrompt
        open={prompt.open}
        mode={prompt.mode}
        pillar={pillar}
        onClose={() => setPrompt((p) => ({ ...p, open: false }))}
        onPushResult={(next) => setPerm(next)}
      />
    </div>
  );
}

function ChannelRow({
  view,
  icon,
  pillar,
  onAction,
}: {
  view: ChannelView;
  icon: LucideIcon;
  pillar: ReturnType<typeof pillarForOwner>;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5">
      <ChannelDisc icon={icon} pillar={pillar} muted={view.status !== "on"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-semibold text-app-text">{view.name}</p>
          <StatusPill status={view.status} label={view.statusLabel} />
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-app-text-secondary">
          {view.detail}
        </p>
      </div>
      {view.actionLabel && (
        <button
          type="button"
          onClick={onAction}
          aria-label={`${view.actionLabel} — ${view.name}`}
          className={clsx(
            "h-8 shrink-0 rounded-lg border border-app-border bg-app-surface px-3 text-[12.5px] font-bold text-app-text transition hover:bg-app-hover",
            focusRing(pillar),
          )}
        >
          {view.actionLabel}
        </button>
      )}
    </div>
  );
}

function ChannelDisc({
  icon: Icon,
  pillar,
  muted,
}: {
  icon: LucideIcon;
  pillar: ReturnType<typeof pillarForOwner>;
  muted?: boolean;
}) {
  const tk = pillarTokens(pillar);
  return (
    <span
      className={clsx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        muted
          ? "bg-app-surface-sunken text-app-text-muted"
          : clsx(tk.bgSoft, tk.text),
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
    </span>
  );
}

const PILL_CLS: Record<ChannelStatus, string> = {
  on: "bg-app-success-bg text-app-success",
  off: "bg-app-surface-muted text-app-text-muted",
  blocked: "bg-app-warning-bg text-app-warning",
  soon: "bg-app-surface-muted text-app-text-muted",
  unsupported: "bg-app-surface-muted text-app-text-muted",
};

function StatusPill({
  status,
  label,
}: {
  status: ChannelStatus;
  label: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
        PILL_CLS[status],
      )}
    >
      {(status === "soon" || status === "blocked") && (
        <Lock className="h-2.5 w-2.5" strokeWidth={2.6} aria-hidden />
      )}
      {label}
    </span>
  );
}
