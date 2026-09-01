"use client";

// The canonical date + time slot picker. A month calendar and the selected
// day's times stack in one scroll (not a wizard). Slots are fetched CLIENT-SIDE
// (no-store via the axios client) for both public (slug + eventTypeSlug) and
// manage (manageToken) flows; host flows inject a `fetchSlots` override
// (bookings/:id/available-slots, find-a-time, etc.). Every state is handled:
// loading skeleton, day-with-slots (grouped Morning/Afternoon), fully-booked
// day, and no-availability-in-month — an empty result is a calm, expected
// outcome, never an error. Available days are solid, unavailable muted, today
// carries a pillar ring, the selected day is a filled pillar circle.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CalendarSearch,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Globe,
  Clock,
  ChevronRight as ChevronRightSm,
  CheckCircle2,
  Info,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";
import type { BookingSlot } from "@pantopus/types";
import { publicBooking } from "@pantopus/api";
import ErrorState from "@/components/ui/ErrorState";
import { decodeError } from "./decodeError";
import { pillarTokens, type Pillar } from "./pillarTokens";
import TimezoneSelector, {
  detectTimezone,
  zoneLabel,
} from "./TimezoneSelector";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface SlotFetchRange {
  from: string;
  to: string;
  tz: string;
}

interface SlotPickerProps {
  slug?: string;
  eventTypeSlug?: string;
  manageToken?: string;
  /** Override the slot fetcher (host flows). Receives an ISO date range + tz. */
  fetchSlots?: (range: SlotFetchRange) => Promise<BookingSlot[]>;
  tz?: string;
  onTzChange?: (tz: string) => void;
  onPick: (slot: BookingSlot) => void;
  /** Currently selected slot start (ISO) for highlight. */
  selected?: string | null;
  pillar?: Pillar;
  /** Disable picking (e.g. past the reschedule cutoff). */
  disabled?: boolean;
  /**
   * DST/timezone hint copy to show between the timezone chip and calendar.
   * When set, renders an INFO banner (design Frame 5).
   * Typically "Clocks change this weekend — times are adjusted."
   */
  dstHint?: string | null;
  /**
   * Set of slot-start ISO strings that were taken by a race-condition (Frame 6).
   * Slots in this set render with strikethrough + "Just taken" WARN pill badge.
   * A floating WARN toast is shown when this set is non-empty.
   */
  takenSlots?: Set<string>;
  /**
   * Frame 2 — collective-intersect is in progress (Business/Home pillar, multi-member).
   * Shows an avatar-cluster row, skeleton rows, and a ComposedPill instead of
   * the plain loading skeleton.
   */
  composing?: boolean;
  /**
   * Frame 5 — composed-empty (Home intersect): slots were found for the month
   * but none for this day because member calendars don't overlap.
   * Shows a framed EmptyCard with calendar-x icon and member free/busy dots.
   * Pass the member list via this prop; falls back to a generic card if omitted.
   */
  composedEmpty?: boolean;
  /**
   * Optional member list for the Frame 5 composed-empty card.
   * Each entry has initials, gradient, and free/busy status.
   */
  composedMembers?: Array<{ initials: string; grad: string; free: boolean }>;
  className?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthRange(
  year: number,
  month: number,
): { first: string; last: string } {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    first: `${year}-${pad(month + 1)}-01`,
    last: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

function todayKeyInTz(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function slotDayKey(slot: BookingSlot): string {
  return (slot.startLocal || slot.start).slice(0, 10);
}

function slotParts(slot: BookingSlot): { hour: number; label: string } {
  const s = slot.startLocal || slot.start;
  const m = s.match(/T(\d{2}):(\d{2})/);
  if (!m) return { hour: 0, label: s };
  const h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour: h, label: `${hour12}:${min} ${ampm}` };
}

// Human, date-aware label from an ISO date key (parsed as a local civil date so
// negative-offset zones don't drift to the previous day).
function humanDate(dateKey: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = dateKey.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", opts);
}

// H14 a11y: the slot button's full accessible name — "Tue, Jun 16, 3:00 PM,
// available" — so the time is never announced without its date or availability.
function slotAriaLabel(slot: BookingSlot): string {
  const date = humanDate(slotDayKey(slot), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${date}, ${slotParts(slot).label}, available`;
}

// H14 a11y: pillar-tinted keyboard focus ring (focus-visible → no change for
// mouse users). Literal classes so Tailwind's JIT generates them.
const FOCUS_RING: Record<Pillar, string> = {
  personal: "focus-visible:ring-app-personal",
  home: "focus-visible:ring-app-home",
  business: "focus-visible:ring-app-business",
};
const FOCUS_BASE =
  "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

// Design (slot-picker-frames.jsx SlotRow): full-width row button —
//   Clock icon (left) + time text + optional host hint sub-label (flex-1) +
//   chevron-right (default) or check-circle-2 (selected) on the right.
//   When the slot is in takenSlots: strikethrough time + "Just taken" WARN pill.
function SlotRow({
  slot,
  isSel,
  isTaken,
  disabled,
  onPick,
  tk,
  pillar,
}: {
  slot: BookingSlot;
  isSel: boolean;
  isTaken: boolean;
  disabled?: boolean;
  onPick: (s: BookingSlot) => void;
  tk: ReturnType<typeof pillarTokens>;
  pillar: Pillar;
}) {
  const { label } = slotParts(slot);
  const isDisabled = disabled || isTaken;
  return (
    <button
      key={`${slot.start}-${slot.end}`}
      type="button"
      disabled={isDisabled}
      onClick={() => !isTaken && onPick(slot)}
      aria-pressed={isSel}
      aria-label={
        isTaken
          ? `${label}, just taken`
          : isSel
            ? `${label}, selected`
            : `${label}, available`
      }
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-xl border px-3 py-[11px] text-left transition-colors",
        FOCUS_BASE,
        FOCUS_RING[pillar],
        isDisabled && !isSel && "cursor-not-allowed opacity-55",
        isTaken && "opacity-55",
        isSel
          ? clsx(tk.bgSoft, tk.border)
          : "border-app-border bg-app-surface hover:bg-app-hover",
      )}
    >
      <Clock
        className={clsx(
          "h-3.5 w-3.5 shrink-0",
          isSel ? tk.text : "text-app-text-muted",
        )}
        aria-hidden
      />
      <span
        className={clsx(
          "flex-1 text-[13.5px] font-bold tabular-nums leading-none",
          isTaken
            ? "text-app-text-muted line-through"
            : isSel
              ? tk.text
              : "text-app-text",
        )}
      >
        {label}
      </span>
      {isTaken ? (
        <span
          className="rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
          style={{
            color: "#B45309",
            background: "#FFFBEB",
            borderColor: "#FDE68A",
          }}
        >
          Just taken
        </span>
      ) : isSel ? (
        <CheckCircle2
          className={clsx("h-[18px] w-[18px] shrink-0", tk.text)}
          aria-hidden
        />
      ) : (
        <ChevronRightSm
          className="h-[17px] w-[17px] shrink-0 text-app-text-muted"
          aria-hidden
        />
      )}
    </button>
  );
}

function SlotGroup({
  title,
  slots,
  onPick,
  selected,
  disabled,
  takenSlots,
  tk,
  pillar,
}: {
  title: string;
  slots: BookingSlot[];
  onPick: (s: BookingSlot) => void;
  selected?: string | null;
  disabled?: boolean;
  takenSlots?: Set<string>;
  tk: ReturnType<typeof pillarTokens>;
  pillar: Pillar;
}) {
  if (slots.length === 0) return null;
  return (
    <div role="group" aria-label={`${title} times`}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-app-text-muted">
        {title}
      </p>
      <div className="flex flex-col gap-2">
        {slots.map((slot) => {
          const isSel = selected === slot.start;
          const isTaken = !!(takenSlots?.has(slot.start));
          return (
            <SlotRow
              key={`${slot.start}-${slot.end}`}
              slot={slot}
              isSel={isSel}
              isTaken={isTaken}
              disabled={disabled}
              onPick={onPick}
              tk={tk}
              pillar={pillar}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function SlotPicker({
  slug,
  eventTypeSlug,
  manageToken,
  fetchSlots,
  tz: tzProp,
  onTzChange,
  onPick,
  selected,
  pillar = "personal",
  disabled = false,
  dstHint,
  takenSlots,
  composing = false,
  composedEmpty = false,
  composedMembers,
  className,
}: SlotPickerProps) {
  const tk = pillarTokens(pillar);
  const [tzInternal, setTzInternal] = useState<string>(
    () => tzProp || detectTimezone(),
  );
  const tz = tzProp || tzInternal;
  const [tzOpen, setTzOpen] = useState(false);

  const now = new Date();
  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const [slotsByDay, setSlotsByDay] = useState<Record<string, BookingSlot[]>>(
    {},
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadSlots = useCallback(
    async (range: SlotFetchRange): Promise<BookingSlot[]> => {
      if (fetchSlots) return fetchSlots(range);
      if (slug && eventTypeSlug) {
        const res = await publicBooking.getPublicSlots(
          slug,
          eventTypeSlug,
          range,
        );
        return res.slots ?? [];
      }
      if (manageToken) {
        const res = await publicBooking.getManageSlots(manageToken, range);
        return res.slots ?? [];
      }
      return [];
    },
    [fetchSlots, slug, eventTypeSlug, manageToken],
  );

  useEffect(() => {
    let cancelled = false;
    const { first, last } = monthRange(cursor.year, cursor.month);
    const today = todayKeyInTz(tz);
    const from = first < today ? today : first;
    setLoading(true);
    setError(null);
    loadSlots({ from, to: last, tz })
      .then((slots) => {
        if (cancelled) return;
        const byDay: Record<string, BookingSlot[]> = {};
        for (const s of slots) {
          const k = slotDayKey(s);
          (byDay[k] ||= []).push(s);
        }
        setSlotsByDay(byDay);
        setSelectedDay((prev) => {
          if (prev && byDay[prev]?.length) return prev;
          const firstAvail = Object.keys(byDay).sort()[0];
          return firstAvail ?? null;
        });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(decodeError(err).message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cursor, tz, loadSlots, reloadKey]);

  const handleTz = (next: string) => {
    if (!tzProp) setTzInternal(next);
    onTzChange?.(next);
  };

  const goMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const todayKey = todayKeyInTz(tz);

  // Build the 6-week month grid.
  const cells = useMemo(() => {
    const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const out: Array<{ key: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < firstWeekday; i++)
      out.push({ key: `pad-${i}`, day: 0, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({
        key: `${cursor.year}-${pad(cursor.month + 1)}-${pad(d)}`,
        day: d,
        inMonth: true,
      });
    }
    while (out.length % 7 !== 0)
      out.push({ key: `tail-${out.length}`, day: 0, inMonth: false });
    return out;
  }, [cursor]);

  const monthHasSlots = Object.keys(slotsByDay).length > 0;
  const daySlots = selectedDay ? (slotsByDay[selectedDay] ?? []) : [];
  const morning = daySlots.filter((s) => slotParts(s).hour < 12);
  const afternoon = daySlots.filter((s) => slotParts(s).hour >= 12);

  const jumpToNextAvailable = () => {
    const next = Object.keys(slotsByDay)
      .sort()
      .find((k) => k > (selectedDay ?? ""));
    if (next) setSelectedDay(next);
    else goMonth(1);
  };

  const hasTakenSlots = !!(takenSlots?.size);

  return (
    <div className={clsx("space-y-5", className)}>
      {/* Timezone chip */}
      <button
        type="button"
        onClick={() => setTzOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={tzOpen}
        aria-label={`Time zone: ${zoneLabel(tz)}. Change time zone`}
        className={clsx(
          "inline-flex items-center gap-2 rounded-full border border-app-border bg-app-surface px-3 py-1.5 text-xs font-medium text-app-text hover:bg-app-hover",
          FOCUS_BASE,
          FOCUS_RING[pillar],
        )}
      >
        <Globe className="h-3.5 w-3.5 text-app-text-muted" aria-hidden />
        {zoneLabel(tz)}
      </button>

      {/* DST / timezone hint banner (Frame 5) — shown when dstHint is set. */}
      {dstHint && (
        <div
          className="flex items-start gap-2 rounded-xl border px-3 py-2.5"
          style={{
            background: "#F0F9FF",
            borderColor: "#BAE6FD",
          }}
        >
          <Info
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            style={{ color: "#0369A1" }}
            aria-hidden
          />
          <span
            className="text-[11px] font-medium leading-[15px]"
            style={{ color: "#0369A1" }}
          >
            {dstHint}
          </span>
        </div>
      )}

      {/* Month header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-app-text-strong">
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-app-border bg-app-surface text-app-text hover:bg-app-hover"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-app-border bg-app-surface text-app-text hover:bg-app-hover"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div>
        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((w) => (
            <div
              key={w}
              className="py-1 text-center text-[11px] font-semibold text-app-text-muted"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            if (!cell.inMonth) return <div key={cell.key} />;
            const available = (slotsByDay[cell.key]?.length ?? 0) > 0;
            const isToday = cell.key === todayKey;
            const isSelected = cell.key === selectedDay;
            const isPast = cell.key < todayKey;
            return (
              <button
                key={cell.key}
                type="button"
                disabled={!available || disabled}
                onClick={() => setSelectedDay(cell.key)}
                aria-pressed={isSelected}
                aria-label={`${humanDate(cell.key, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}${isToday ? ", today" : ""}, ${
                  available ? "available" : "no times available"
                }`}
                className={clsx(
                  "flex h-10 items-center justify-center rounded-full text-sm transition-colors",
                  FOCUS_BASE,
                  FOCUS_RING[pillar],
                  isSelected && clsx(tk.bg, tk.textOn, "font-semibold"),
                  !isSelected &&
                    available &&
                    "font-medium text-app-text hover:bg-app-hover",
                  !available &&
                    clsx(
                      "cursor-default",
                      isPast
                        ? "text-app-text-muted/40"
                        : "text-app-text-muted/60",
                    ),
                  !isSelected && isToday && clsx("ring-1 ring-inset", tk.ring),
                )}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots region */}
      <div className="min-h-[120px]">
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        ) : loading && composing ? (
          /* Frame 2 — Composing: collective-intersect in progress */
          <div
            className="space-y-3"
            aria-label="Finding times for all members"
            aria-busy="true"
          >
            {/* Avatar cluster + caption row */}
            <div className="flex items-center gap-2.5 px-0.5">
              <div className="flex">
                {(
                  composedMembers ?? [
                    { initials: "A", grad: "linear-gradient(135deg,#a78bfa,#6d28d9)", free: true },
                    { initials: "B", grad: "linear-gradient(135deg,#38bdf8,#0369a1)", free: true },
                    { initials: "C", grad: "linear-gradient(135deg,#fdba74,#ea580c)", free: false },
                  ]
                ).map((m, i) => (
                  <div
                    key={i}
                    style={{ background: m.grad, marginLeft: i === 0 ? 0 : -8 }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white text-[8px] font-bold text-white"
                  >
                    {m.initials}
                  </div>
                ))}
              </div>
              <span className="text-xs font-semibold text-app-text-secondary">
                Finding times that work for everyone
              </span>
            </div>
            {/* Skeleton slot rows */}
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-xl border border-app-border bg-app-surface px-3 py-[11px]"
                >
                  <div className="h-3.5 w-3.5 shrink-0 animate-pulse rounded bg-app-surface-muted" />
                  <div className="h-3 w-16 animate-pulse rounded bg-app-surface-muted" />
                  <div className="flex-1" />
                  <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-app-surface-muted" />
                </div>
              ))}
            </div>
            {/* ComposedPill — accent-tinted pill explaining composed availability */}
            <div
              className={clsx(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5",
                tk.bgSoft,
              )}
              style={{ borderColor: `${tk.hex ?? "#0284c7"}33` }}
            >
              <CalendarClock
                className={clsx("h-[15px] w-[15px] shrink-0", tk.text)}
                aria-hidden
              />
              <span className="flex-1 text-[11.5px] font-medium leading-[15px] text-app-text-secondary">
                Times come from each member's availability.
              </span>
            </div>
          </div>
        ) : loading ? (
          /* Frame 1 — Plain loading skeleton */
          <div
            className="space-y-2"
            aria-label="Loading times"
            aria-busy="true"
          >
            <div className="h-3 w-20 animate-pulse rounded bg-app-surface-muted" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 animate-pulse rounded-xl bg-app-surface-muted"
                />
              ))}
            </div>
          </div>
        ) : !monthHasSlots ? (
          /* Frame 3 — No times in range: full EmptyCard with icon halo, body, CTAs */
          <div className="flex flex-col items-center rounded-xl border border-dashed border-app-border-strong bg-app-surface px-[18px] pb-[18px] pt-6 text-center">
            {/* Icon halo */}
            <div className="mb-2.5 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-app-surface-muted">
              <CalendarSearch
                className="h-[23px] w-[23px] text-app-text-muted"
                strokeWidth={1.85}
                aria-hidden
              />
            </div>
            <p className="text-[15px] font-bold leading-5 tracking-tight text-app-text-strong">
              No open times in {MONTH_NAMES[cursor.month]}
            </p>
            <p className="mt-2 max-w-[225px] text-[12px] leading-[17px] text-app-text-muted">
              Availability changes often. Try a later month.
            </p>
            <div className="mt-3 flex w-full flex-col gap-2">
              {/* Primary CTA — filled accent */}
              <button
                type="button"
                onClick={() => goMonth(1)}
                className={clsx(
                  "inline-flex h-[42px] w-full items-center justify-center gap-[7px] rounded-[11px] border-none text-[13px] font-bold tracking-tight",
                  tk.bg,
                  tk.textOn,
                )}
              >
                <ArrowRight className="h-[15px] w-[15px]" aria-hidden />
                See {MONTH_NAMES[(cursor.month + 1) % 12]}
              </button>
              {/* Secondary CTA — ghost */}
              <button
                type="button"
                className="inline-flex h-10 w-full items-center justify-center gap-[7px] rounded-[11px] border border-app-border bg-app-surface text-[12.5px] font-bold tracking-tight text-app-text"
              >
                <Bell className="h-[14px] w-[14px]" aria-hidden />
                Get notified when times open
              </button>
            </div>
          </div>
        ) : daySlots.length === 0 && composedEmpty ? (
          /* Frame 5 — Composed empty (Home intersect): member calendars don't overlap */
          <div
            className={clsx(
              "flex flex-col items-center rounded-xl px-[18px] pb-[18px] pt-6 text-center",
              tk.bgSoft,
            )}
            style={{ border: `1px solid ${tk.hex ?? "#16a34a"}33` }}
          >
            {/* Icon halo (white bg + accent border on framed variant) */}
            <div
              className="mb-2.5 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white"
              style={{ border: `1px solid ${tk.hex ?? "#16a34a"}33` }}
            >
              <CalendarX
                className={clsx("h-[23px] w-[23px]", tk.text)}
                strokeWidth={1.85}
                aria-hidden
              />
            </div>
            <p className="max-w-[230px] text-[15px] font-bold leading-5 tracking-tight text-app-text-strong">
              Everyone&apos;s calendars don&apos;t overlap in this window
            </p>
            <p className="mt-2 max-w-[225px] text-[12px] leading-[17px] text-app-text-muted">
              These times need every required member free at once. Try widening the range.
            </p>
            {/* Member free/busy cluster — only shown when composedMembers is provided */}
            {composedMembers && composedMembers.length > 0 && (
              <div className="mt-3 flex w-full items-center justify-center gap-3.5 pb-0.5 pt-2.5">
                {composedMembers.map((m, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className="relative">
                      <div
                        style={{ background: m.grad }}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white"
                      >
                        {m.initials}
                      </div>
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-[11px] w-[11px] rounded-full border-2 border-white"
                        style={{ background: m.free ? "#16A34A" : "#D1D5DB" }}
                      />
                    </div>
                    <span
                      className="text-[9px] font-semibold"
                      style={{ color: m.free ? "#15803d" : undefined }}
                    >
                      {m.free ? "Free" : "Busy"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => goMonth(1)}
                className={clsx(
                  "inline-flex h-[42px] w-full items-center justify-center gap-[7px] rounded-[11px] border-none text-[13px] font-bold tracking-tight",
                  tk.bg,
                  tk.textOn,
                )}
              >
                <ArrowRight className="h-[15px] w-[15px]" aria-hidden />
                Try next month
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-full items-center justify-center gap-[7px] rounded-[11px] border border-app-border bg-app-surface text-[12.5px] font-bold tracking-tight text-app-text"
              >
                <Bell className="h-[14px] w-[14px]" aria-hidden />
                Notify me
              </button>
            </div>
          </div>
        ) : daySlots.length === 0 ? (
          <div className="rounded-xl border border-app-border bg-app-surface px-4 py-8 text-center">
            <p className="text-sm font-medium text-app-text">
              No times left this day
            </p>
            <button
              type="button"
              onClick={jumpToNextAvailable}
              className={clsx(
                "mt-2 text-sm font-medium hover:underline",
                tk.text,
              )}
            >
              See next available
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <SlotGroup
              title="Morning"
              slots={morning}
              onPick={onPick}
              selected={selected}
              disabled={disabled}
              takenSlots={takenSlots}
              tk={tk}
              pillar={pillar}
            />
            <SlotGroup
              title="Afternoon"
              slots={afternoon}
              onPick={onPick}
              selected={selected}
              disabled={disabled}
              takenSlots={takenSlots}
              tk={tk}
              pillar={pillar}
            />
          </div>
        )}
      </div>

      <TimezoneSelector
        open={tzOpen}
        onClose={() => setTzOpen(false)}
        value={tz}
        onSelect={handleTz}
        pillar={pillar}
      />

      {/* Slot-just-taken floating WARN toast (Frame 6) */}
      {hasTakenSlots && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-6"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div
            className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 shadow-lg"
            style={{
              background: "#FFFBEB",
              borderColor: "#FDE68A",
            }}
          >
            <TriangleAlert
              className="h-[15px] w-[15px] shrink-0"
              style={{ color: "#B45309" }}
              aria-hidden
            />
            <span
              className="text-[12.5px] font-bold"
              style={{ color: "#B45309" }}
            >
              That time was just taken
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
