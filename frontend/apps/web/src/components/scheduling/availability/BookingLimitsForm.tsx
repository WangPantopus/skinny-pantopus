"use client";

// B7 — Booking limits & notice rules. Interactive stepper/segmented controls per
// the design (booking-limits-frames.jsx). The backend has no schedule-level limits
// endpoint — limits live on the EVENT TYPE. The save action here posts to the event-
// type layer, but we provide the interactive UI so the form matches the design's
// StepperRow + SegmentRow idiom. A "Done" CTA is rendered by the parent page when
// this tab is active.

import { type ReactNode, useState } from "react";
import { AlertCircle, Minus, Plus } from "lucide-react";
import clsx from "clsx";

// ─── Primitives ─────────────────────────────────────────────────

function Stepper({
  value,
  unit,
  min = 0,
  max = 999,
  onChange,
  error,
}: {
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  error?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Decrease"
        disabled={value <= min}
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
        disabled={value >= max}
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
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  caption?: string;
  error?: boolean;
  errorMsg?: string;
  onChange: (next: number) => void;
}) {
  return (
    <RowCard>
      <div className="flex items-center gap-3">
        <span className="flex-1 text-[13.5px] font-semibold tracking-tight text-app-text">
          {label}
        </span>
        <Stepper value={value} unit={unit} onChange={onChange} error={error} />
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
  maxPerWeek: number;
  perPersonLimit: number;
  startTimes: StartOption;
}

const DEFAULTS: LimitsState = {
  minNoticeHours: 4,
  bookUpToDays: 60,
  maxPerDay: 8,
  maxPerWeek: 20,
  perPersonLimit: 2,
  startTimes: ":15",
};

// ─── Component ──────────────────────────────────────────────────

export default function BookingLimitsForm({
  onDone,
  saving,
}: {
  onDone?: (limits: LimitsState) => Promise<void> | void;
  saving?: boolean;
}) {
  const [limits, setLimits] = useState<LimitsState>(DEFAULTS);

  const set = <K extends keyof LimitsState>(k: K, v: LimitsState[K]) =>
    setLimits((cur) => ({ ...cur, [k]: v }));

  // Conflict: booking window shorter than minimum notice → no times will show.
  const windowConflict =
    limits.bookUpToDays > 0 &&
    limits.bookUpToDays * 24 < limits.minNoticeHours;

  const doneDisabled = saving || windowConflict;

  return (
    <div
      className={clsx("space-y-3", saving && "pointer-events-none opacity-70")}
    >
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
        onChange={(v) => set("bookUpToDays", v)}
      />
      <StepperRow
        label="Max per day"
        value={limits.maxPerDay}
        caption="Most bookings you'll take in a day."
        onChange={(v) => set("maxPerDay", v)}
      />
      {/* Max per week — present in every design frame (lines 151,173,201) */}
      <StepperRow
        label="Max per week"
        value={limits.maxPerWeek}
        caption="Most bookings you'll take in a week."
        onChange={(v) => set("maxPerWeek", v)}
      />
      <StepperRow
        label="Per-person limit"
        value={limits.perPersonLimit}
        unit={limits.perPersonLimit === 1 ? "booking" : "bookings"}
        caption="How many one person can hold at once."
        onChange={(v) => set("perPersonLimit", v)}
      />
      <SegmentRow
        label="Start times"
        value={limits.startTimes}
        caption="Where bookings can start within the hour."
        onChange={(v) => set("startTimes", v)}
      />

      {/* Done / save CTA — shown inline below rows (parent page also surfaces one
          in the sticky bar for the limits tab, mirroring the sheet Done button) */}
      {onDone && (
        <button
          type="button"
          disabled={doneDisabled}
          onClick={() => void onDone(limits)}
          className="w-full rounded-xl bg-app-personal py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Done"}
        </button>
      )}
    </div>
  );
}
