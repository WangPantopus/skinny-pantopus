"use client";

// B7 — Booking limits & notice rules. Interactive stepper/segmented controls per
// the design (booking-limits-frames.jsx). The backend has no schedule-level limits
// endpoint — limits live on the EVENT TYPE. Like iOS and Android B7, this reads the
// owner's first active event type and saves only the fields the user moved with
// PUT /event-types/:id. There is no weekly cap field, so "Max per week" stays a
// disabled placeholder (as on native).

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Minus, Plus, SlidersHorizontal } from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type {
  EventType,
  EventTypeInput,
  SchedulingOwnerRef,
} from "@pantopus/types";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import { toast } from "@/components/ui/toast-store";
import { decodeError } from "@/components/scheduling/decodeError";

// ─── Primitives ─────────────────────────────────────────────────

function Stepper({
  value,
  unit,
  min = 0,
  max = 999,
  onChange,
  error,
  disabled,
}: {
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  error?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Decrease"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        className={clsx(
          "min-w-[2.75rem] text-center text-[13px] font-bold tabular-nums",
          error ? "text-app-error" : "text-app-text",
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 text-[11px] font-semibold text-app-text-secondary">
            {unit}
          </span>
        )}
      </span>
      <button
        type="button"
        aria-label="Increase"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

function RowCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-3.5 shadow-sm">
      {children}
    </div>
  );
}

/** Label + stepper on one line; caption or error below. */
function StepperRow({
  label,
  value,
  unit,
  caption,
  error,
  errorMsg,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  caption?: string;
  error?: boolean;
  errorMsg?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <RowCard>
      <div className="flex items-center gap-3">
        <span className="flex-1 text-[13.5px] font-semibold tracking-tight text-app-text">
          {label}
        </span>
        <Stepper
          value={value}
          unit={unit}
          min={min}
          max={max}
          onChange={onChange}
          error={error}
          disabled={disabled}
        />
      </div>
      {error && errorMsg ? (
        <div className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-tight text-app-error">
          <AlertCircle
            className="mt-0.5 h-3 w-3 shrink-0"
            aria-hidden
          />
          <span>{errorMsg}</span>
        </div>
      ) : caption ? (
        <div className="mt-2 text-[11px] leading-tight text-app-text-secondary">
          {caption}
        </div>
      ) : null}
    </RowCard>
  );
}

const START_OPTIONS = [
  { value: ":00", label: ":00 only" },
  { value: ":30", label: ":00 & :30" },
  { value: ":15", label: "every 15 min" },
] as const;
type StartOption = (typeof START_OPTIONS)[number]["value"];

/** Label on top, full-width segmented, caption below. */
function SegmentRow({
  label,
  value,
  caption,
  onChange,
}: {
  label: string;
  value: StartOption;
  caption?: string;
  onChange: (next: StartOption) => void;
}) {
  return (
    <RowCard>
      <span className="text-[13.5px] font-semibold tracking-tight text-app-text">
        {label}
      </span>
      <div className="mt-2.5 flex gap-1 rounded-lg bg-app-surface-sunken p-1">
        {START_OPTIONS.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(o.value)}
              className={clsx(
                "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[11.5px] font-semibold transition-colors",
                on
                  ? "bg-app-surface text-primary-700 shadow-sm"
                  : "text-app-text-secondary hover:text-app-text",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {caption && (
        <div className="mt-2 text-[11px] leading-tight text-app-text-secondary">
          {caption}
        </div>
      )}
    </RowCard>
  );
}

// ─── State model ────────────────────────────────────────────────

interface LimitsState {
  minNoticeHours: number;
  bookUpToDays: number;
  maxPerDay: number;
  perPersonLimit: number;
  startTimes: StartOption;
}

/** The design's weekly number; shown disabled until the backend has a weekly cap. */
const WEEKLY_PLACEHOLDER = 20;

const START_MINUTES: Record<StartOption, number> = {
  ":00": 60,
  ":30": 30,
  ":15": 15,
};

/** An event type's limits as the controls show them; a null cap shows as 0. */
function toLimits(et: EventType): LimitsState {
  return {
    minNoticeHours: Math.max(0, Math.round(et.min_notice_min / 60)),
    bookUpToDays: Math.max(1, et.max_horizon_days),
    maxPerDay: et.daily_cap ?? 0,
    perPersonLimit: et.per_booker_cap ?? 0,
    startTimes:
      et.slot_interval_min === 60
        ? ":00"
        : et.slot_interval_min === 30
          ? ":30"
          : ":15",
  };
}

/**
 * Only the controls the user moved. The projection is lossy (90 min shows as
 * 2 hours, a 20-min interval as every 15 min), so an untouched control must not
 * be written back. 0 on a cap clears it.
 */
function changedFields(
  limits: LimitsState,
  loaded: LimitsState,
): Partial<EventTypeInput> {
  const patch: Partial<EventTypeInput> = {};
  if (limits.minNoticeHours !== loaded.minNoticeHours)
    patch.min_notice_min = limits.minNoticeHours * 60;
  if (limits.bookUpToDays !== loaded.bookUpToDays)
    patch.max_horizon_days = limits.bookUpToDays;
  if (limits.maxPerDay !== loaded.maxPerDay)
    patch.daily_cap = limits.maxPerDay > 0 ? limits.maxPerDay : null;
  if (limits.perPersonLimit !== loaded.perPersonLimit)
    patch.per_booker_cap =
      limits.perPersonLimit > 0 ? limits.perPersonLimit : null;
  if (limits.startTimes !== loaded.startTimes)
    patch.slot_interval_min = START_MINUTES[limits.startTimes];
  return patch;
}

// ─── Component ──────────────────────────────────────────────────

export default function BookingLimitsForm({
  owner,
}: {
  owner: SchedulingOwnerRef;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "error" | "empty" | "ready">(
    "loading",
  );
  const [eventType, setEventType] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [loaded, setLoaded] = useState<LimitsState | null>(null);
  const [limits, setLimits] = useState<LimitsState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    api.scheduling
      .listEventTypes(owner)
      .then(({ eventTypes }) => {
        if (!alive) return;
        // The list is in sort order; like iOS, edit the first active one.
        const target = eventTypes.find((e) => e.is_active) ?? eventTypes[0];
        if (!target) {
          setPhase("empty");
          return;
        }
        const shown = toLimits(target);
        setEventType({ id: target.id, name: target.name });
        setLoaded(shown);
        setLimits(shown);
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

  if (phase === "loading")
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <ShimmerBlock key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  if (phase === "error")
    return <ErrorState message="Couldn't load these limits." onRetry={load} />;
  if (phase === "empty" || !eventType || !loaded || !limits)
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title="No event types yet"
        description="Create an event type first. Booking limits and notice rules are set per event type."
        actionLabel="Create event type"
        onAction={() => router.push("/app/scheduling/event-types/new")}
      />
    );

  const set = <K extends keyof LimitsState>(k: K, v: LimitsState[K]) =>
    setLimits((cur) => (cur ? { ...cur, [k]: v } : cur));

  // Conflict: booking window shorter than minimum notice → no times will show.
  const windowConflict = limits.bookUpToDays * 24 < limits.minNoticeHours;

  const patch = changedFields(limits, loaded);
  const doneDisabled =
    saving || windowConflict || Object.keys(patch).length === 0;

  const save = async () => {
    if (doneDisabled) return;
    setSaving(true);
    try {
      const res = await api.scheduling.updateEventType(eventType.id, patch, owner);
      const shown = toLimits(res.eventType);
      setLoaded(shown);
      setLimits(shown);
      toast.success("Limits updated.");
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={clsx("space-y-3", saving && "pointer-events-none opacity-70")}
    >
      <p className="px-0.5 text-[10px] font-bold uppercase tracking-widest text-app-personal">
        Personal · {eventType.name}
      </p>
      <p className="px-0.5 text-[11.5px] leading-relaxed text-app-text-secondary">
        Sensible defaults are set, so you usually don&apos;t need to touch
        these.
      </p>

      <StepperRow
        label="Minimum notice"
        value={limits.minNoticeHours}
        unit="hours"
        caption="Can't be booked inside this window."
        onChange={(v) => set("minNoticeHours", v)}
      />
      <StepperRow
        label="Book up to"
        value={limits.bookUpToDays}
        unit="days"
        caption="How far ahead people can book."
        error={windowConflict}
        errorMsg="Your booking window is shorter than your minimum notice, so no times will show."
        min={1}
        max={730}
        onChange={(v) => set("bookUpToDays", v)}
      />
      <StepperRow
        label="Max per day"
        value={limits.maxPerDay}
        caption="Most bookings you'll take in a day. 0 means no limit."
        max={100}
        onChange={(v) => set("maxPerDay", v)}
      />
      {/* Max per week — present in every design frame (lines 151,173,201) */}
      <StepperRow
        label="Max per week"
        value={WEEKLY_PLACEHOLDER}
        caption="Most bookings you'll take in a week."
        disabled
        onChange={() => undefined}
      />
      <StepperRow
        label="Per-person limit"
        value={limits.perPersonLimit}
        unit={limits.perPersonLimit === 1 ? "booking" : "bookings"}
        caption="How many one person can hold at once. 0 means no limit."
        max={20}
        onChange={(v) => set("perPersonLimit", v)}
      />
      <SegmentRow
        label="Start times"
        value={limits.startTimes}
        caption="Where bookings can start within the hour."
        onChange={(v) => set("startTimes", v)}
      />

      <button
        type="button"
        disabled={doneDisabled}
        onClick={() => void save()}
        className="w-full rounded-xl bg-app-personal-solid py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Done"}
      </button>
    </div>
  );
}
