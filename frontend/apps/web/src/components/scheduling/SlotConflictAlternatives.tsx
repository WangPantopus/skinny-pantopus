"use client";

// The 409-conflict presenter — the most important scheduling error, designed
// to never dead-end. Leads with a calm amber A18 double-ring halo + CalendarX
// icon + body text, then nearest-open slot rows for one-tap re-pick, plus a
// "Pick another time" ghost. When fully booked (no alternatives), offers a
// waitlist CTA and an unconditional "See another day" ghost. A re-fetching
// state shows shimmer rows.
//
// Layout mirrors slot-taken-frames.jsx (design source of truth):
//   ErrorBlock — centered double-ring halo (64pt outer + 50pt inner),
//   CalendarX icon (amber), h2 title, body text — all center-aligned.
//   SlotRows — full-width buttons: clock icon + weekday+date left + "Soonest"
//   badge on the first row (primary-100/700 chip), time+duration right, chevron.
//   Ghost button — plain surface border button, label varies by mode.

import { BellPlus, CalendarSearch, CalendarX, ChevronRight, Clock } from "lucide-react";
import clsx from "clsx";
import type { BookingSlot, SlotConflict } from "@pantopus/types";
import { ShimmerLine } from "@/components/ui/Shimmer";
import { pillarTokens, type Pillar } from "./pillarTokens";

const WARN = "#D97706";
const WARN_BG = "#FFFBEB";
const WARN_RING = "#FDE68A";

// H14 a11y: pillar-tinted keyboard focus ring.
const FOCUS_RING: Record<Pillar, string> = {
  personal: "focus-visible:ring-app-personal",
  home: "focus-visible:ring-app-home",
  business: "focus-visible:ring-app-business",
};
const FOCUS_BASE =
  "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

function formatSlot(slot: BookingSlot): {
  weekday: string;
  date: string;
  time: string;
  duration: string;
} {
  const d = new Date(slot.startLocal || slot.start);
  if (Number.isNaN(d.getTime())) {
    return { weekday: slot.start, date: "", time: "", duration: "" };
  }
  const weekday = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  // Duration in minutes from start/end
  let duration = "";
  if (slot.end) {
    const end = new Date(slot.end);
    if (!Number.isNaN(end.getTime())) {
      const mins = Math.round((end.getTime() - d.getTime()) / 60000);
      duration = mins >= 60
        ? `${Math.floor(mins / 60)} hr${mins % 60 ? ` ${mins % 60} min` : ""}`
        : `${mins} min`;
    }
  }
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return { weekday, date: "", time, duration };
}

// ─── A18 double-ring error halo (centered) ───────────────────────────────────

function ErrorBlock({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-4 py-2 text-center"
    >
      {/* Outer halo (64×64) → inner ringed circle (50×50) */}
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full opacity-60"
          style={{ background: WARN_BG }}
        />
        <div
          className="relative flex h-[50px] w-[50px] items-center justify-center rounded-full border-2"
          style={{
            background: WARN_BG,
            borderColor: WARN_RING,
            color: WARN,
          }}
        >
          <CalendarX className="h-6 w-6" strokeWidth={2} aria-hidden />
        </div>
      </div>
      <div>
        <h2 className="text-[17px] font-bold leading-snug tracking-tight text-app-text">
          {title}
        </h2>
        <p className="mt-1.5 max-w-[228px] text-[12px] leading-[17px] text-app-text-secondary">
          {body}
        </p>
      </div>
    </div>
  );
}

// ─── Slot row (mirrors SlotRow in design) ────────────────────────────────────

function SlotRowButton({
  slot,
  soonest,
  onPick,
  pillar,
}: {
  slot: BookingSlot;
  soonest: boolean;
  onPick: (s: BookingSlot) => void;
  pillar: Pillar;
}) {
  const { weekday, time, duration } = formatSlot(slot);
  return (
    <button
      type="button"
      onClick={() => onPick(slot)}
      aria-label={`Book ${time}${weekday ? `, ${weekday}` : ""}${soonest ? " (soonest)" : ""}`}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-xl border border-app-border bg-app-surface px-3 py-2.5 text-left shadow-sm hover:bg-app-hover",
        FOCUS_BASE,
        FOCUS_RING[pillar],
      )}
    >
      <Clock
        className="h-3.5 w-3.5 shrink-0 text-app-text-muted"
        aria-hidden
      />
      {/* Left: weekday + "Soonest" badge */}
      <div className="shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-app-text">{weekday}</span>
          {soonest && (
            <span
              className="rounded-full border px-1.5 py-px text-[8px] font-bold uppercase tracking-wider"
              style={{
                background: "var(--color-primary-100)",
                color: "var(--color-primary-700)",
                borderColor: "var(--color-primary-100)",
              }}
            >
              Soonest
            </span>
          )}
        </div>
      </div>
      <div className="flex-1" />
      {/* Right: time + duration */}
      <div className="shrink-0 text-right">
        <span className="block text-[12px] font-bold tabular-nums text-app-text">
          {time}
        </span>
        {duration && (
          <span className="block text-[10px] text-app-text-muted">{duration}</span>
        )}
      </div>
      <ChevronRight
        className="h-[15px] w-[15px] shrink-0 text-app-text-muted"
        aria-hidden
      />
    </button>
  );
}

function GhostButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon?: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface text-[13px] font-bold text-app-text hover:bg-app-hover"
    >
      {Icon && <Icon className="h-[15px] w-[15px]" strokeWidth={2.1} aria-hidden />}
      {label}
    </button>
  );
}

// ─── "Your details are saved." footer note ───────────────────────────────────

function SavedNote() {
  return (
    <div className="flex items-center justify-center gap-1.5 border-t border-app-border pt-2.5">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-app-success"
        aria-hidden
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
      <span className="text-[11px] font-semibold text-app-text-secondary">
        Your details are saved.
      </span>
    </div>
  );
}

interface SlotConflictAlternativesProps {
  conflict: SlotConflict;
  onPick: (slot: BookingSlot) => void;
  onPickAnother?: () => void;
  onJoinWaitlist?: () => void;
  /** True while the nearest-open times are being re-fetched. */
  loading?: boolean;
  pillar?: Pillar;
  className?: string;
}

export default function SlotConflictAlternatives({
  conflict,
  onPick,
  onPickAnother,
  onJoinWaitlist,
  loading = false,
  pillar = "personal",
  className,
}: SlotConflictAlternativesProps) {
  const tk = pillarTokens(pillar);
  const alternatives = conflict.alternatives ?? [];

  return (
    <div className={clsx("flex flex-col gap-3.5", className)}>
      {/* A18 centered error halo block */}
      <ErrorBlock
        title="That time was just taken"
        body={
          alternatives.length === 0 && !loading
            ? "And the rest of this day just filled up too."
            : conflict.message ||
              "Someone grabbed it first. Here are the closest open times — your details are saved."
        }
      />

      {loading ? (
        /* Re-fetching skeleton rows */
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-app-border bg-app-surface px-3 py-3"
            >
              <ShimmerLine width="w-40" />
              <ShimmerLine width="w-5" />
            </div>
          ))}
          <p className="pt-1 text-center text-[11px] font-semibold text-app-text-muted">
            Checking live availability
          </p>
        </div>
      ) : alternatives.length > 0 ? (
        /* Alternative slot rows with "Soonest" badge on index 0 */
        <div className="flex flex-col gap-2">
          {alternatives.map((slot, idx) => (
            <SlotRowButton
              key={`${slot.start}-${slot.end}`}
              slot={slot}
              soonest={idx === 0}
              onPick={onPick}
              pillar={pillar}
            />
          ))}
        </div>
      ) : (
        /* Fully booked — dashed card + waitlist */
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-app-border-strong bg-app-surface px-4 py-6 text-center gap-2.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-surface-muted text-app-text-muted">
            <CalendarX className="h-[22px] w-[22px]" strokeWidth={1.9} aria-hidden />
          </div>
          <p className="text-[14px] font-bold text-app-text">
            This day is fully booked
          </p>
          <p className="max-w-[208px] text-[11.5px] leading-4 text-app-text-secondary">
            Join the waitlist and we&rsquo;ll text you the moment a time opens up.
          </p>
        </div>
      )}

      {/* Primary + ghost CTAs */}
      <div className="flex flex-col gap-2.5">
        {alternatives.length === 0 && !loading && (
          <button
            type="button"
            onClick={onJoinWaitlist}
            disabled={!onJoinWaitlist}
            className={clsx(
              "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold transition disabled:opacity-50",
              tk.bg,
              tk.textOn,
            )}
          >
            <BellPlus className="h-4 w-4" aria-hidden />
            Join the waitlist
          </button>
        )}
        {/* "See another day" in fully-booked state; "Pick another time" with alternatives */}
        {alternatives.length === 0 && !loading ? (
          // Fully booked: unconditional "See another day" ghost
          <GhostButton
            icon={CalendarSearch}
            label="See another day"
            onClick={onPickAnother}
          />
        ) : (
          // Has alternatives: "Pick another time" if callback provided
          onPickAnother && (
            <GhostButton
              icon={CalendarSearch}
              label="Pick another time"
              onClick={onPickAnother}
            />
          )
        )}
      </div>

      <SavedNote />
    </div>
  );
}
