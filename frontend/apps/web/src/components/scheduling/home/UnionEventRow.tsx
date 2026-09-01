"use client";

// F1 — a single agenda row in the household calendar union. Renders either a
// HomeCalendarEvent (category chip + assignee stack, editable) or a live booking
// row (source:'booking', read-only, deep-links to the scheduling booking
// detail — we NEVER create event rows for bookings).

import { CalendarCheck, ChevronRight, MapPin } from "lucide-react";
import type { HomeCalendarUnionEvent } from "@pantopus/types";
import BookingStatusPill from "@/components/scheduling/BookingStatusPill";
import { Avatar, AvatarStack } from "./Avatars";
import { categoryFor, formatTimeParts, type HomeMember } from "./helpers";

export default function UnionEventRow({
  event,
  members,
  onClick,
  dim = false,
}: {
  event: HomeCalendarUnionEvent;
  members: HomeMember[];
  onClick?: () => void;
  dim?: boolean;
}) {
  const { time, ampm } = formatTimeParts(event.start_at);
  const isBooking = event.source === "booking";
  const cat = categoryFor(event.event_type);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ opacity: dim ? 0.55 : 1 }}
      className="flex w-full items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-2.5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:border-app-border-strong"
    >
      {/* time */}
      <div className="w-10 shrink-0 text-center">
        <div className="text-[13px] font-bold tabular-nums tracking-tight text-app-text">
          {time}
        </div>
        <div className="mt-0.5 text-[9.5px] font-semibold text-app-text-muted">
          {ampm}
        </div>
      </div>
      <div className="h-9 w-px shrink-0 self-stretch bg-app-border" />

      {/* body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isBooking && (
            <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-app-home" />
          )}
          <span className="truncate text-[13.5px] font-bold tracking-tight text-app-text">
            {event.title}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          {isBooking ? (
            <BookingStatusPill
              status={event.booking_status ?? "confirmed"}
              className="!px-2 !py-0.5 !text-[10px]"
            />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-app-surface-sunken px-2 py-0.5 text-[10px] font-semibold text-app-text-secondary">
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: cat.color }}
              />
              {cat.label}
            </span>
          )}
          {event.location_notes && (
            <span className="inline-flex min-w-0 items-center gap-1 truncate text-[10.5px] text-app-text-secondary">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{event.location_notes}</span>
            </span>
          )}
        </div>
      </div>

      {/* trailing: assignees, or chevron for read-only bookings */}
      {isBooking ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-app-text-muted" />
      ) : members.length === 1 ? (
        <Avatar member={members[0]} size={26} />
      ) : members.length > 1 ? (
        <AvatarStack members={members} size={26} />
      ) : null}
    </button>
  );
}
