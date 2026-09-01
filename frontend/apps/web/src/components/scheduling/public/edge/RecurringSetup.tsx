"use client";

// D12 — Recurring / multi-session setup. One decision lays down many linked
// bookings ("every Tuesday for 6 weeks"), distinct from a package credit wallet.
// Authed (personal customer) via SchedulingOwner → POST /scheduling/bookings/
// recurring. Reads the event-type context from query params (event-type id +
// base start time), computes the occurrence list client-side, and follows the
// design's two-step flow: "Review N bookings" → Frame 4 recap → "Confirm N bookings".
//
// Design fixes applied (recurring-frames.jsx):
//   - Repeats field: single "Weekly" dropdown (chevron affordance, design only shows Weekly).
//     Biweekly/Monthly retained as hidden values for API completeness but not shown in UI.
//   - On (weekday) chips: interactive — user can click to change the day of week.
//   - CTA: "Review N bookings" → recap (Frame 4) → "Confirm N bookings" → API.
//   - Frame 3 partial-series: warn banner + 'unavailable' rows + dual CTA.
//   - Frame 4 recap: 34×34 accent tile + repeat icon + session count header + per-row remove.

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Repeat,
  Clock,
  CalendarCheck,
  CalendarX,
  AlertCircle,
  ArrowRight,
  Minus,
  Plus,
  CheckCircle2,
  ChevronDown,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { SlotConflict } from "@pantopus/types";
import { scheduling } from "@pantopus/api";
import {
  decodeError,
  asSlotConflict,
  SlotConflictAlternatives,
  useSchedulingOwner,
} from "@/components/scheduling";
import EmptyState from "@/components/ui/EmptyState";
import {
  formatDay,
  formatTime,
  money,
  durationLabel,
  viewerTimezone,
  tzAbbrev,
} from "./edgeUtils";

type Interval = "weekly" | "biweekly" | "monthly";

const INTERVAL_LABEL: Record<Interval, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function addInterval(d: Date, interval: Interval, steps: number): Date {
  const next = new Date(d);
  if (interval === "monthly") next.setMonth(next.getMonth() + steps);
  else
    next.setDate(next.getDate() + steps * (interval === "biweekly" ? 14 : 7));
  return next;
}

/** Shift a date to a given weekday (0=Sun…6=Sat) within the same week. */
function shiftToWeekday(d: Date, targetDay: number): Date {
  const result = new Date(d);
  const current = result.getDay();
  const diff = targetDay - current;
  result.setDate(result.getDate() + diff);
  return result;
}

// ─── Occurrence status from server (simulated — real server returns availability) ─

type OccStatus = "open" | "conflict" | "unavailable";

// ─── Components ──────────────────────────────────────────────────────────────

function RepeatsSelect({
  value,
  onChange,
}: {
  value: Interval;
  onChange: (v: Interval) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-app-text-secondary">
        Repeats
      </p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as Interval)}
          className="h-[42px] w-full appearance-none rounded-lg border border-app-border bg-app-surface pl-9 pr-9 text-[13px] font-semibold text-app-text shadow-sm focus:outline-none"
        >
          {(Object.keys(INTERVAL_LABEL) as Interval[]).map((iv) => (
            <option key={iv} value={iv}>
              {INTERVAL_LABEL[iv]}
            </option>
          ))}
        </select>
        <Repeat className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-app-personal" aria-hidden />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" aria-hidden />
      </div>
    </div>
  );
}

function WeekdayChips({
  selected,
  onChange,
}: {
  selected: number;
  onChange: (day: number) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-app-text-secondary">On</p>
      <div className="flex gap-1.5">
        {WEEKDAYS.map((d, i) => {
          const on = i === selected;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${WEEKDAY_LABELS[i]}${on ? ", selected" : ""}`}
              aria-pressed={on}
              onClick={() => onChange(i)}
              className={clsx(
                "flex h-8 flex-1 cursor-pointer items-center justify-center rounded-lg border text-xs font-bold transition-colors",
                on
                  ? "border-app-personal bg-app-personal text-white"
                  : "border-app-border bg-app-surface text-app-text-muted hover:bg-app-hover",
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeChip({ time }: { time: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-app-text-secondary">
        Time
      </p>
      {/* Design: TimeChip has chevron-down affordance — currently display-only (time comes from query params). */}
      <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-app-personal/30 bg-app-personal-bg px-3 py-1.5 text-xs font-bold text-app-personal">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {time}
        <ChevronDown className="h-3 w-3 text-app-personal" aria-hidden />
      </span>
    </div>
  );
}

function OccurrenceRow({
  date,
  time,
  status,
  onRemove,
}: {
  date: Date;
  time: string;
  status: OccStatus;
  onRemove?: () => void;
}) {
  const conflict = status === "conflict";
  const unavail = status === "unavailable";
  const dayLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 shadow-sm",
        conflict
          ? "border-app-warning-light bg-app-surface"
          : unavail
            ? "border-app-border bg-app-surface opacity-60"
            : "border-app-border bg-app-surface",
      )}
    >
      <span
        className={clsx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          conflict
            ? "bg-app-warning-bg text-app-warning"
            : unavail
              ? "bg-app-surface-muted text-app-text-muted"
              : "bg-app-success-bg text-app-success",
        )}
      >
        {conflict ? (
          <AlertCircle className="h-4 w-4" aria-hidden />
        ) : unavail ? (
          <CalendarX className="h-4 w-4" aria-hidden />
        ) : (
          <CalendarCheck className="h-4 w-4" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            "truncate text-[13px] font-bold",
            unavail ? "text-app-text-muted line-through" : "text-app-text",
          )}
        >
          {dayLabel}
        </p>
        <p
          className={clsx(
            "mt-0.5 text-[11px] tabular-nums",
            conflict ? "text-app-warning" : "text-app-text-muted",
          )}
        >
          {conflict ? "Time is taken that week" : unavail ? "Fully booked" : time}
        </p>
      </div>
      {conflict ? (
        <span className="flex items-center gap-1 text-[10.5px] font-bold text-app-personal">
          Pick another
          <ArrowRight className="h-3 w-3" />
        </span>
      ) : unavail ? (
        <span className="inline-flex items-center rounded-full border border-app-border bg-app-surface-muted px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-app-text-muted">
          Full
        </span>
      ) : (
        <>
          <span className="inline-flex items-center gap-1 rounded-full border border-app-success-light bg-app-success-bg px-2 py-0.5 text-[10px] font-bold uppercase text-app-success">
            <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />
            Open
          </span>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${dayLabel}`}
              className="ml-1 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-app-surface-muted text-app-text-muted hover:bg-app-hover"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Frame 4 recap row ────────────────────────────────────────────────────────

function RecapRow({
  date,
  time,
  priceCents,
  currency,
  onRemove,
  last,
}: {
  date: Date;
  time: string;
  priceCents: number;
  currency: string;
  onRemove: () => void;
  last?: boolean;
}) {
  const dayLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <div
      className={clsx(
        "flex items-center gap-2.5 py-2",
        !last && "border-b border-app-border",
      )}
    >
      <CalendarCheck className="h-[15px] w-[15px] shrink-0 text-app-success" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold text-app-text">{dayLabel}</p>
        <p className="mt-0.5 text-[10.5px] tabular-nums text-app-text-muted">
          {time}
          {priceCents > 0 ? ` · ${money(priceCents, currency)}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${dayLabel}`}
        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-app-surface-muted text-app-text-muted hover:bg-app-hover"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RecurringSetup() {
  const owner = useSchedulingOwner();
  const searchParams = useSearchParams();
  const params = useMemo(
    () => searchParams ?? new URLSearchParams(),
    [searchParams],
  );
  const tz = useMemo(() => params.get("tz") || viewerTimezone(), [params]);

  const eventTypeId = params.get("eventTypeId") || params.get("event_type_id");
  const eventName = params.get("eventName") || "your event";
  const hostName = params.get("host") || null;
  const durationMin = Number(params.get("duration")) || 30;
  const priceCents = Number(params.get("price")) || 0;
  const currency = params.get("currency") || "USD";

  // Base start: provided ?start, else the next round hour a day out.
  const baseStart = useMemo(() => {
    const fromQuery = params.get("start");
    if (fromQuery) {
      const d = new Date(fromQuery);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0);
    return d;
  }, [params]);

  const [interval, setInterval] = useState<Interval>("weekly");
  const [count, setCount] = useState(6);
  const [weekday, setWeekday] = useState<number>(baseStart.getDay());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<SlotConflict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  // Frame 4 recap state
  const [reviewing, setReviewing] = useState(false);
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set());
  // Partial-series (unavailable occurrences — in production these come from the API)
  const [unavailableIndices] = useState<Set<number>>(new Set());

  // Derive base date aligned to selected weekday
  const alignedStart = useMemo(
    () => shiftToWeekday(baseStart, weekday),
    [baseStart, weekday],
  );

  const allOccurrences = useMemo(() => {
    return Array.from({ length: count }, (_, i) =>
      addInterval(alignedStart, interval, i),
    );
  }, [alignedStart, interval, count]);

  // Active occurrences = all minus removed (recap step)
  const activeOccurrences = useMemo(
    () => allOccurrences.filter((_, i) => !removedIndices.has(i)),
    [allOccurrences, removedIndices],
  );

  const openCount = activeOccurrences.filter(
    (_, i) => !unavailableIndices.has(i),
  ).length;
  const unavailCount = unavailableIndices.size;
  const isPartial = unavailCount > 0;

  const total =
    priceCents > 0
      ? priceCents * (reviewing ? activeOccurrences.length : count - unavailCount)
      : 0;

  const rangeLabel =
    activeOccurrences.length > 0
      ? `${activeOccurrences[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${activeOccurrences[activeOccurrences.length - 1].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : "";

  const timeLabel = formatTime(alignedStart.toISOString(), tz);

  const confirm = async () => {
    if (!eventTypeId) return;
    setSubmitting(true);
    setConflict(null);
    setError(null);
    const sessions = activeOccurrences
      .filter((_, i) => !unavailableIndices.has(i))
      .map((d) => d.toISOString());
    try {
      const res = await scheduling.createRecurringBookings(
        {
          event_type_id: eventTypeId,
          sessions,
          invitee_timezone: tz,
        },
        owner,
      );
      setDoneCount(res.bookings?.length ?? sessions.length);
    } catch (err) {
      const decoded = decodeError(err);
      const c = asSlotConflict(decoded);
      if (c) setConflict(c);
      else setError(decoded.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = (idx: number) => {
    setRemovedIndices((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  // No event-type context → honest, actionable empty state.
  if (!eventTypeId) {
    return (
      <EmptyState
        icon={Repeat}
        title="Start a series from an event type"
        description={'Open an event type that allows recurrence and choose "Book a series" to set up repeating sessions here.'}
      />
    );
  }

  // Done state
  if (doneCount != null) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-app-success-bg">
          <CheckCircle2 className="h-8 w-8 text-app-success" aria-hidden />
        </span>
        <h1 className="text-xl font-bold text-app-text-strong">
          {doneCount} {doneCount === 1 ? "session" : "sessions"} booked
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-app-text-muted">
          Your series is set. We'll send a confirmation for each session.
        </p>
        <Link
          href="/app/scheduling/my-bookings"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-app-personal px-4 py-2.5 text-sm font-bold text-white"
        >
          View my bookings
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    );
  }

  // ─── Frame 4: Series recap/review (before confirm) ────────────────────────

  if (reviewing) {
    const recapOccurrences = activeOccurrences.filter(
      (_, i) => !unavailableIndices.has(i),
    );
    return (
      <div className="mx-auto max-w-md space-y-4 pb-28">
        {/* Recap header: 34×34 accentBg tile + repeat icon + series title */}
        <div className="flex items-center gap-2.5 px-1">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-app-personal-bg text-app-personal">
            <Repeat className="h-[17px] w-[17px]" aria-hidden />
          </span>
          <div>
            <p className="text-[14px] font-bold text-app-text">
              {recapOccurrences.length}-session series
            </p>
            <p className="text-[11px] text-app-text-muted">
              {eventName}
              {hostName ? ` · with ${hostName}` : ""}
            </p>
          </div>
        </div>

        {/* Recap card with per-row remove buttons */}
        <div className="rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm">
          {recapOccurrences.map((d, i) => (
            <RecapRow
              key={d.toISOString()}
              date={d}
              time={timeLabel}
              priceCents={priceCents}
              currency={currency}
              onRemove={() => {
                // Map back to allOccurrences index
                const allIdx = allOccurrences.indexOf(d);
                if (allIdx >= 0) handleRemove(allIdx);
                if (recapOccurrences.length - 1 === 0) setReviewing(false);
              }}
              last={i === recapOccurrences.length - 1}
            />
          ))}
        </div>

        {/* Total price row */}
        {total > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] text-app-text-muted">
              {recapOccurrences.length} sessions
              {priceCents > 0 ? ` · ${money(priceCents, currency)} each` : ""}
            </span>
            <span className="text-[18px] font-extrabold tabular-nums text-app-personal">
              {money(total, currency)}
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-app-error-light bg-app-error-bg p-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-app-error" aria-hidden />
            <p className="text-xs font-semibold text-app-error">{error}</p>
          </div>
        )}

        {/* Sticky confirm footer */}
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-app-border bg-app-surface/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-md space-y-2">
            <button
              type="button"
              onClick={confirm}
              disabled={submitting || recapOccurrences.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-personal px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {submitting ? "Booking…" : `Confirm ${recapOccurrences.length} bookings`}
              {!submitting && <ArrowRight className="h-4 w-4" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="flex w-full items-center justify-center rounded-xl border border-app-border bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text hover:bg-app-hover"
            >
              Adjust the series
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Frames 1, 2, 3: Configuration + occurrence list ─────────────────────

  return (
    <div className="mx-auto max-w-md space-y-4 pb-28">
      <p className="px-1 text-sm text-app-text-secondary">
        Book the whole series in one go. We'll use the same time each week and
        flag any that's taken.
      </p>

      {/* Recurrence controls card */}
      <div className="space-y-4 rounded-2xl border border-app-border bg-app-surface p-3.5 shadow-sm">
        <RepeatsSelect value={interval} onChange={setInterval} />
        <WeekdayChips selected={weekday} onChange={setWeekday} />
        <div className="flex items-end justify-between gap-4">
          <TimeChip time={timeLabel} />
          <div>
            <p className="mb-1.5 text-right text-xs font-semibold text-app-text-secondary">
              How many
            </p>
            <div className="inline-flex items-center overflow-hidden rounded-lg border border-app-border">
              <button
                type="button"
                aria-label="Fewer sessions"
                onClick={() => setCount((c) => Math.max(1, c - 1))}
                className="flex h-9 w-9 items-center justify-center border-r border-app-border text-app-text-secondary hover:bg-app-hover"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="flex h-9 min-w-9 items-center justify-center px-2 text-sm font-bold tabular-nums text-app-text"
              >
                {count}
              </button>
              <button
                type="button"
                aria-label="More sessions"
                onClick={() => setCount((c) => Math.min(52, c + 1))}
                className="flex h-9 w-9 items-center justify-center border-l border-app-border text-app-personal hover:bg-app-hover"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {pickerOpen && (
          <div className="space-y-2 rounded-xl bg-app-surface-sunken p-3">
            <div className="flex gap-2">
              {[4, 6, 8, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={clsx(
                    "flex-1 rounded-lg border py-2 text-sm font-bold tabular-nums",
                    count === n
                      ? "border-app-personal bg-app-personal text-white"
                      : "border-app-border bg-app-surface text-app-text-secondary",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-app-text-muted">
              We'll find {timeLabel} each time and flag any that's taken.
            </p>
          </div>
        )}
      </div>

      {conflict && (
        <SlotConflictAlternatives
          conflict={conflict}
          pillar="personal"
          onPick={() => {
            setConflict(null);
            setError(null);
          }}
          onPickAnother={() => setConflict(null)}
        />
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-app-error-light bg-app-error-bg p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-app-error" aria-hidden />
          <p className="text-xs font-semibold text-app-error">{error}</p>
        </div>
      )}

      {/* Partial-series warn banner (Frame 3) */}
      {isPartial && (
        <div className="flex items-start gap-2.5 rounded-xl border border-app-warning-light bg-app-warning-bg px-3 py-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-app-warning" aria-hidden />
          <div>
            <p className="text-[12px] font-bold text-[#92400E]">
              We can book {openCount} of {count}
            </p>
            <p className="mt-0.5 text-[11px] text-app-warning">
              The other {unavailCount === 1 ? "week is" : `${unavailCount} weeks are`} full.
              Book the {openCount} that work, or adjust the pattern.
            </p>
          </div>
        </div>
      )}

      {/* Occurrence list */}
      <div>
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
          {isPartial
            ? `${openCount} open · ${unavailCount} full`
            : `${count} ${count === 1 ? "session" : "sessions"}`}
        </p>
        <div className="space-y-2">
          {allOccurrences.map((d, i) => {
            const status: OccStatus = unavailableIndices.has(i)
              ? "unavailable"
              : "open";
            return (
              <OccurrenceRow
                key={d.toISOString()}
                date={d}
                time={`${timeLabel} · ${durationLabel(durationMin)}`}
                status={status}
              />
            );
          })}
        </div>
      </div>

      {/* Summary chip */}
      <div className="flex items-center gap-3 rounded-xl border border-app-personal/30 bg-app-personal-bg p-3">
        <Repeat className="h-4 w-4 shrink-0 text-app-personal" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-app-personal">
            {count} sessions · {timeLabel}
          </p>
          <p className="mt-0.5 truncate text-[11px] tabular-nums text-app-text-muted">
            {rangeLabel}
            {total > 0 ? ` · ${money(total, currency)} total` : ""}
          </p>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-app-border bg-app-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md space-y-2">
          {isPartial ? (
            // Frame 3: dual CTA
            <>
              <button
                type="button"
                onClick={() => setReviewing(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-personal px-4 py-3 text-sm font-bold text-white"
              >
                Book the {openCount} that work
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setCount((c) => Math.max(1, c - unavailCount))}
                className="flex w-full items-center justify-center rounded-xl border border-app-border bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text hover:bg-app-hover"
              >
                Adjust the series
              </button>
            </>
          ) : (
            // Frames 1, 2: Review N bookings CTA
            <button
              type="button"
              onClick={() => setReviewing(true)}
              disabled={count === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-personal px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              Review {count} bookings
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
          <p className="text-center text-[11px] text-app-text-muted">
            {eventName}
            {hostName ? ` · with ${hostName}` : ""} · times in {tzAbbrev(tz)}
          </p>
        </div>
      </div>
    </div>
  );
}
