"use client";

// A1 — Master "accepting bookings" control. Active → an iOS toggle; paused →
// an amber banner with Resume; permission-gated → a read-only "managed by
// owner" status with a lock. Drives booking-page is_paused.

import { CalendarCheck, Lock, Pause } from "lucide-react";
import type { BookingPage } from "@pantopus/types";
import type { Pillar } from "@/components/scheduling/pillarTokens";
import { IconTile, Toggle } from "./ui";

interface Props {
  page: BookingPage;
  pillar: Pillar;
  readOnly?: boolean;
  busy?: boolean;
  /** nextPaused = the new is_paused value the user is requesting. */
  onTogglePause: (nextPaused: boolean) => void;
}

export default function AcceptingBookingsCard({
  page,
  pillar,
  readOnly,
  busy,
  onTogglePause,
}: Props) {
  if (readOnly) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3.5 py-3 shadow-sm">
        <IconTile icon={CalendarCheck} pillar={pillar} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-app-text">
            Accepting bookings
          </p>
          <p className="mt-0.5 text-[11.5px] text-app-text-secondary">
            Managed by the owner
          </p>
        </div>
        <Lock className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden />
      </div>
    );
  }

  if (page.is_paused) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-app-warning-light bg-app-warning-bg px-3.5 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-warning-bg text-app-warning ring-1 ring-app-warning-light">
          <Pause className="h-[18px] w-[18px]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-app-text">
            Bookings are paused
          </p>
          <p className="mt-0.5 text-[11.5px] text-app-text-secondary">
            New bookings are turned off
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onTogglePause(false)}
          className="shrink-0 rounded-full bg-app-warning px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          Resume
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3.5 py-3 shadow-sm">
      <IconTile icon={CalendarCheck} pillar={pillar} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-app-text">
          Accepting bookings
        </p>
        <p className="mt-0.5 text-[11.5px] text-app-text-secondary">
          New bookings are open
        </p>
      </div>
      <Toggle
        on={!page.is_paused}
        pillar={pillar}
        disabled={busy}
        label="Accepting bookings"
        onChange={(next) => onTogglePause(!next)}
      />
    </div>
  );
}
