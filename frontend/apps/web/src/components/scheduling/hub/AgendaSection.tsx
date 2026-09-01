"use client";

// A1 — "Today & upcoming" agenda. Reuses the Home-calendar row vocabulary:
// a type-tinted glyph, title + time, duration, booker, and a W0 status pill.
// Grouped by day (Today / Tomorrow / weekday). Booking rows are read-only here
// and deep-link to the booking detail.

import clsx from "clsx";
import Link from "next/link";
import {
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Info,
  MapPin,
  Phone,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Booking, EventType } from "@pantopus/types";
import BookingStatusPill from "@/components/scheduling/BookingStatusPill";
import { dayKey, dayLabel, durationLabel, fmtTime, initials } from "./format";

type EventTypeLite = Pick<EventType, "id" | "name" | "location_mode">;

const LOCATION_ICON: Record<string, LucideIcon> = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
  custom: ClipboardList,
  ask: ClipboardList,
};

const LOCATION_TONE: Record<string, string> = {
  video: "bg-app-info-bg text-app-info",
  phone: "bg-app-personal-bg text-app-personal",
  in_person: "bg-app-home-bg text-app-home",
  custom: "bg-app-business-bg text-app-business",
  ask: "bg-app-business-bg text-app-business",
};

function BookingRow({
  booking,
  et,
  tz,
}: {
  booking: Booking;
  et?: EventTypeLite;
  tz?: string | null;
}) {
  const mode = et?.location_mode ?? "video";
  const Icon = LOCATION_ICON[mode] ?? CalendarClock;
  const tone =
    LOCATION_TONE[mode] ?? "bg-app-surface-sunken text-app-text-strong";
  const title = et?.name ?? "Booking";
  const dur = durationLabel(booking.start_at, booking.end_at);

  return (
    <Link
      href={`/app/scheduling/bookings/${booking.id}`}
      className="block rounded-xl border border-app-border bg-app-surface p-3 shadow-sm transition-colors hover:bg-app-hover"
    >
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            tone,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-app-text">
              {title}
            </span>
            <span className="shrink-0 text-[13px] font-bold tabular-nums text-app-text">
              {fmtTime(booking.start_at, tz)}
            </span>
          </div>
          <p className="mb-2 flex items-center gap-1.5 text-[11.5px] text-app-text-secondary">
            <CalendarClock
              className="h-3 w-3 text-app-text-muted"
              aria-hidden
            />
            {dur}
          </p>
          <div className="flex items-center gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-app-personal-bg text-[9px] font-bold text-app-personal">
                {initials(booking.invitee_name)}
              </span>
              <span className="truncate text-[11.5px] font-medium text-app-text-strong">
                {booking.invitee_name ?? "Guest"}
              </span>
            </span>
            <span className="ml-auto shrink-0">
              <BookingStatusPill status={booking.status} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function AgendaSection({
  bookings,
  eventTypes,
  tz,
  paused,
}: {
  bookings: Booking[];
  eventTypes: EventTypeLite[];
  tz?: string | null;
  paused?: boolean;
}) {
  const etMap = new Map(eventTypes.map((e) => [e.id, e]));

  // Group sorted bookings by viewer-local day.
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
  const groups: {
    key: string;
    label: string;
    sub: string;
    items: Booking[];
  }[] = [];
  for (const b of sorted) {
    const key = dayKey(b.start_at, tz);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const { label, sub } = dayLabel(b.start_at, tz);
      g = { key, label, sub, items: [] };
      groups.push(g);
    }
    g.items.push(b);
  }

  return (
    <section>
      <div className="flex items-center justify-between pb-2 pt-1">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-secondary">
          Today &amp; upcoming
        </h2>
        <Link
          href="/app/scheduling/bookings"
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-app-personal"
        >
          See all bookings
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      {paused && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-app-border bg-app-surface px-3 py-2.5 text-xs text-app-text-secondary">
          <Info
            className="h-3.5 w-3.5 shrink-0 text-app-text-muted"
            aria-hidden
          />
          Existing bookings stay on your calendar while paused.
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app-border bg-app-surface px-4 py-8 text-center">
          <p className="text-sm font-medium text-app-text">
            Nothing booked yet
          </p>
          <p className="mt-1 text-xs text-app-text-secondary">
            Upcoming bookings will show up here.
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="mb-1">
            <div className="flex items-baseline gap-2 px-0.5 pb-2 pt-3">
              <span className="text-xs font-bold uppercase tracking-wide text-app-text">
                {g.label}
              </span>
              <span className="text-[11px] font-medium text-app-text-muted">
                {g.sub}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {g.items.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  et={etMap.get(b.event_type_id ?? "")}
                  tz={tz}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
