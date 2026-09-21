"use client";

// A4 — Scheduling notification preferences. A P/E/S channel matrix (SMS is
// locked "coming soon") for host ("Notify me") and attendee events, plus
// reminder lead-time chips. Backed by GET/PUT /notification-preferences, whose
// shape is flexible: unknown keys are round-tripped untouched.

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { BellOff, Check, Lock } from "lucide-react";
import * as api from "@pantopus/api";
import type {
  NotificationPreferences,
  SchedulingOwnerRef,
} from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarForOwner,
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import { Overline } from "./ui";
import { reminderLabel } from "./format";
import {
  NOTIFY_ATTENDEES,
  NOTIFY_ME,
  REMINDER_PRESETS,
  readChannels,
  writeChannels,
  type Channels,
  type Group,
  type Prefs,
  type RowDef,
} from "./notificationPrefs";

function ChannelChip({
  letter,
  state,
  pillar,
  onClick,
}: {
  letter: string;
  state: "on" | "off" | "disabled" | "locked";
  pillar: Pillar;
  onClick?: () => void;
}) {
  const tk = pillarTokens(pillar);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "disabled" || state === "locked" || !onClick}
      aria-pressed={state === "on"}
      className={clsx(
        "relative flex h-[22px] w-[22px] items-center justify-center rounded-md border font-mono text-[10px] font-bold",
        state === "on"
          ? clsx(tk.bg, tk.border, "text-white")
          : state === "off"
            ? "border-app-border-strong bg-app-surface text-app-text-muted"
            : "border-app-border bg-app-surface-sunken text-app-text-muted",
        onClick && state !== "disabled" && state !== "locked"
          ? "cursor-pointer"
          : "cursor-default",
      )}
    >
      {letter}
      {state === "locked" && (
        <span className="absolute -bottom-1 -right-1 flex h-[11px] w-[11px] items-center justify-center rounded-full border border-app-border bg-app-surface">
          <Lock
            className="h-[6px] w-[6px] text-app-text-muted"
            strokeWidth={3}
            aria-hidden
          />
        </span>
      )}
    </button>
  );
}

function ChannelHeader({ label, pillar }: { label: string; pillar: Pillar }) {
  const tk = pillarTokens(pillar);
  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-t-xl px-4 py-2.5",
        pillarTokens(pillar).bgSoft,
      )}
    >
      <span
        className={clsx(
          "flex-1 text-[10.5px] font-bold uppercase tracking-wide",
          tk.text,
        )}
      >
        {label}
      </span>
      {["P", "E"].map((l) => (
        <span
          key={l}
          className="w-[22px] text-center font-mono text-[10px] font-bold text-app-text-muted"
        >
          {l}
        </span>
      ))}
      <span className="flex w-[22px] items-center justify-center gap-0.5 font-mono text-[10px] font-bold text-app-text-muted">
        S<Lock className="h-2 w-2" strokeWidth={2.6} aria-hidden />
      </span>
    </div>
  );
}

function MatrixRow({
  row,
  channels,
  pillar,
  onToggle,
  isAttendeeGroup,
  paused,
}: {
  row: RowDef;
  channels: Channels;
  pillar: Pillar;
  onToggle: (chan: "push" | "email") => void;
  isAttendeeGroup?: boolean;
  paused?: boolean;
}) {
  // P chip: attendee rows → always disabled (no push for attendees per design)
  const pState: "on" | "off" | "disabled" =
    paused || isAttendeeGroup ? "disabled" : channels.push ? "on" : "off";
  // E chip: locked rows (booking_confirmation) → 'locked'; else normal on/off
  const eState: "on" | "off" | "locked" | "disabled" = paused
    ? "disabled"
    : row.lockedEmail
      ? "locked"
      : channels.email
        ? "on"
        : "off";
  // S chip: always disabled (coming soon); design shows no lock badge on rows
  const sState = "disabled" as const;

  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-app-text">{row.label}</p>
        {row.sub && (
          <p className="mt-0.5 text-[11.5px] text-app-text-secondary">
            {row.sub}
          </p>
        )}
      </div>
      <ChannelChip
        letter="P"
        state={pState}
        pillar={pillar}
        onClick={pState === "on" || pState === "off" ? () => onToggle("push") : undefined}
      />
      <ChannelChip
        letter="E"
        state={eState}
        pillar={pillar}
        onClick={eState === "on" || eState === "off" ? () => onToggle("email") : undefined}
      />
      <ChannelChip letter="S" state={sState} pillar={pillar} />
    </div>
  );
}

function MatrixCard({
  group,
  title,
  rows,
  helper,
  prefs,
  pillar,
  onChange,
  isAttendeeGroup,
  paused,
  children,
}: {
  group: Group;
  title: string;
  rows: RowDef[];
  helper: string;
  prefs: Prefs;
  pillar: Pillar;
  onChange: (next: Prefs) => void;
  isAttendeeGroup?: boolean;
  paused?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={paused ? "opacity-[0.55]" : undefined}>
      <div className="overflow-hidden rounded-xl border border-app-border bg-app-surface">
        <ChannelHeader label={title} pillar={pillar} />
        <div className="divide-y divide-app-border-subtle">
          {rows.map((row) => {
            const channels = readChannels(prefs, group, row.key, row.def);
            return (
              <MatrixRow
                key={row.key}
                row={row}
                channels={channels}
                pillar={pillar}
                isAttendeeGroup={isAttendeeGroup}
                paused={paused}
                onToggle={(chan) =>
                  !paused &&
                  onChange(
                    writeChannels(prefs, group, row.key, {
                      ...channels,
                      [chan]: !channels[chan],
                    }),
                  )
                }
              />
            );
          })}
        </div>
        {children}
      </div>
      <p className="px-1 pt-2 text-[11.5px] leading-4 text-app-text-secondary">
        {helper}
      </p>
    </div>
  );
}

/** A4 design PauseBanner — shown when scheduling notifications are paused. */
function PauseBanner({ onResume }: { onResume?: () => void }) {
  return (
    <div className="mb-1 rounded-xl border border-app-warning-light bg-app-warning-bg p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-warning-light text-app-warning">
          <BellOff className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-[18px] text-app-warning">
            Notifications paused
          </p>
          <p className="mt-0.5 text-[11.5px] leading-[15px] text-app-warning">
            Emergency alerts still come through
          </p>
        </div>
        {onResume && (
          <button
            type="button"
            onClick={onResume}
            className="shrink-0 rounded-full border border-app-warning-light bg-white px-3 py-[5px] text-xs font-semibold text-app-warning"
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
}

/** A4 design PushOffNotice — shown when OS-level push permission is off. */
function PushOffNotice() {
  return (
    <div className="mb-1 rounded-[10px] border border-app-error-light bg-app-error-bg p-[10px_12px]">
      <div className="flex items-center gap-[10px]">
        <BellOff
          className="h-[15px] w-[15px] shrink-0 text-app-error"
          aria-hidden
        />
        <p className="min-w-0 flex-1 text-xs leading-4 text-app-text">
          Push is off for Pantopus. Turn it on in Settings to get booking
          alerts.
        </p>
        <button
          type="button"
          className="shrink-0 rounded-full border border-app-error-light bg-white px-3 py-[5px] text-[11.5px] font-semibold text-app-error"
          onClick={() => window.open("app-settings:") }
        >
          Settings
        </button>
      </div>
    </div>
  );
}

export default function NotificationPrefsForm() {
  const owner = useSchedulingOwner();
  return <NotificationPrefsFormForOwner key={JSON.stringify(owner)} owner={owner} />;
}

function NotificationPrefsFormForOwner({ owner }: { owner: SchedulingOwnerRef }) {
  const pillar = pillarForOwner(owner.ownerType);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"notifications" | "reminders" | null>(null);
  const [reminders, setReminders] = useState<number[]>([]);
  const generation = useRef(0);
  const confirmedReminders = useRef<number[]>([]);
  const reminderVersion = useRef(0);
  const reminderQueue = useRef<{ minutes: number[]; version: number } | null>(null);
  const reminderSaving = useRef<number | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // paused: scheduling notifications muted by host; pushOff: OS-level push denied
  const [paused, setPaused] = useState(false);
  const [pushOff, setPushOff] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    setPrefs(null);
    setReminders([]);
    setSaved(null);
    reminderQueue.current = null;
    confirmedReminders.current = [];
    try {
      const [{ prefs: loaded }, { page }] = await Promise.all([
        api.scheduling.getNotificationPreferences(owner),
        api.scheduling.getBookingPage(owner),
      ]);
      if (current !== generation.current) return;
      confirmedReminders.current = page.reminder_minutes;
      setReminders(page.reminder_minutes);
      const raw = (loaded ?? {}) as Prefs;
      setPrefs(raw);
      // Read paused + push_off flags if the API surfaces them (keys round-tripped)
      const sched = (raw.scheduling && typeof raw.scheduling === "object"
        ? raw.scheduling
        : {}) as Record<string, unknown>;
      setPaused(sched.paused === true);
      setPushOff(sched.push_off === true);
    } catch {
      if (current === generation.current) setError("Couldn't load notification settings. Please try again.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
      reminderQueue.current = null;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [load]);

  const showSaved = (kind: "notifications" | "reminders") => {
    setSaved(kind);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    const current = generation.current;
    savedTimer.current = setTimeout(() => {
      if (current === generation.current) setSaved(null);
    }, 2000);
  };

  const persist = useCallback(
    (next: Prefs) => {
      const current = generation.current;
      setPrefs(next);
      setSaved(null);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (current !== generation.current) return;
        try {
          const { prefs: updated } =
            await api.scheduling.updateNotificationPreferences(
              next as NotificationPreferences,
              owner,
            );
          if (current !== generation.current) return;
          setPrefs((updated ?? next) as Prefs);
          showSaved("notifications");
        } catch (err) {
          if (current !== generation.current) return;
          toast.error(
            decodeError(err).message || "Couldn’t save notifications",
          );
        }
      }, 500);
    },
    [owner],
  );

  const persistReminders = async (minutes: number[]) => {
    if (minutes.length > 5 || minutes.some((m) => !Number.isInteger(m) || m < 0 || m > 43200)) {
      toast.error("Choose up to 5 reminder times, each within 30 days.");
      return;
    }
    const current = generation.current;
    const version = ++reminderVersion.current;
    setReminders(minutes);
    setSaved(null);
    reminderQueue.current = { minutes, version };
    if (reminderSaving.current === current) return;
    reminderSaving.current = current;
    try {
      // Serialize this owner's writes; a slower earlier reply cannot overwrite a later choice.
      while (current === generation.current && reminderQueue.current) {
        const next = reminderQueue.current;
        reminderQueue.current = null;
        try {
          const { page } = await api.scheduling.updateBookingPage(
            { reminder_minutes: next.minutes }, owner,
          );
          if (current !== generation.current) return;
          confirmedReminders.current = page.reminder_minutes;
          if (next.version === reminderVersion.current) {
            setReminders(page.reminder_minutes);
            showSaved("reminders");
          }
        } catch {
          if (current !== generation.current) return;
          if (next.version === reminderVersion.current) {
            setReminders(confirmedReminders.current);
            toast.error("Couldn't save reminders. Please try again.");
          }
        }
      }
    } finally {
      if (reminderSaving.current === current) reminderSaving.current = null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-hidden>
        <div className="h-6 w-40 animate-pulse rounded bg-app-surface-sunken" />
        <div className="h-72 w-full animate-pulse rounded-xl bg-app-surface-sunken" />
        <div className="h-52 w-full animate-pulse rounded-xl bg-app-surface-sunken" />
      </div>
    );
  }

  if (error || !prefs) {
    return (
      <ErrorState
        message={error ?? "Couldn’t load notifications."}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-app-text">Notifications</h1>
        {saved && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-app-text px-3 py-1 text-xs font-semibold text-app-text-inverse">
            <Check
              className="h-3.5 w-3.5 text-app-success"
              strokeWidth={3}
              aria-hidden
            />
            {saved === "reminders" ? "Reminder times saved" : "Notification changes saved"}
          </span>
        )}
      </div>

      {/* A4 design banners: paused state (amber) + push-off state (red) */}
      {paused && (
        <PauseBanner
          onResume={() => {
            // Optimistically clear local paused flag; real clear is server-side
            setPaused(false);
          }}
        />
      )}
      {pushOff && <PushOffNotice />}

      <Overline>Scheduling &amp; bookings</Overline>

      <MatrixCard
        group="host"
        title="Notify me"
        rows={NOTIFY_ME}
        helper="Only you see these. Pick the channel for each event."
        prefs={prefs}
        pillar={pillar}
        paused={paused}
        onChange={persist}
      >
        <div className={clsx("border-t border-app-border-subtle px-3.5 py-3", paused && "opacity-[0.55]")}>
          <p className="mb-2.5 text-[12.5px] font-semibold text-app-text-strong">
            Send reminders
          </p>
          <div className="flex flex-wrap gap-2">
            {REMINDER_PRESETS.map((m) => {
              const active = reminders.includes(m);
              const tk = pillarTokens(pillar);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  disabled={paused}
                  onClick={() =>
                    !paused &&
                    void persistReminders(
                      active ? reminders.filter((x) => x !== m) : [...reminders, m],
                    )
                  }
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                    paused
                      ? "cursor-default border-app-border bg-app-surface-sunken text-app-text-muted"
                      : active
                        ? clsx(tk.bg, tk.border, "text-white")
                        : "border-app-border-strong bg-app-surface text-app-text-strong hover:bg-app-hover",
                  )}
                >
                  {active && !paused && (
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  )}
                  {reminderLabel(m)}
                </button>
              );
            })}
          </div>
        </div>
      </MatrixCard>

      <MatrixCard
        group="attendee"
        title="Notify attendees"
        rows={NOTIFY_ATTENDEES}
        helper="Attendees always get a confirmation — you choose the rest."
        prefs={prefs}
        pillar={pillar}
        isAttendeeGroup
        paused={paused}
        onChange={persist}
      />

      <p className="flex flex-wrap items-center justify-center gap-3.5 px-4 pt-2 text-center font-mono text-[11px] text-app-text-muted">
        <span>P · Push</span>
        <span>E · Email</span>
        <span className="inline-flex items-center gap-1">
          S · SMS <Lock className="h-2.5 w-2.5" strokeWidth={2.6} aria-hidden />{" "}
          soon
        </span>
      </p>
    </div>
  );
}
